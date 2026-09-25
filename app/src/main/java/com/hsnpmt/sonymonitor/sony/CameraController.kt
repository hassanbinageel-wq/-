package com.hsnpmt.sonymonitor.sony

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import com.hsnpmt.sonymonitor.sony.ptp.SonyPtpCamera
import java.util.concurrent.TimeUnit

/**
 * منسّق دورة حياة الاتصال بالكاميرا: اكتشاف → تجهيز → اكتشاف الإمكانات →
 * بثّ حي → استطلاع الحالة → التقاط/تحكم → إعادة اتصال.
 *
 * مبدأ الصدق: لا نُفعّل أي وظيفة في الواجهة إلا إن ظهرت في getAvailableApiList
 * القادمة من الكاميرا. والحالات (ISO/شتر/فتحة/بطارية/تسجيل) تُقرأ من getEvent؛
 * ما لا تُرجعه الكاميرا يبقى "غير متاح" ولا نختلق قيمة.
 */
class CameraController(
    context: Context,
    private val callback: Callback
) {
    interface Callback {
        /** حدث عام يُمرّر إلى طبقة الويب (JSON نصّي). type مثل connected/disconnected/error/capabilities/camera-status/stream */
        fun onEvent(type: String, json: JSONObject)
        /** إطار JPEG خام من البث الحي. */
        fun onFrame(jpeg: ByteArray, sequence: Int, cameraTsMs: Long)
    }

    private val appContext = context.applicationContext

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // عملاء HTTP: واحد قصير للطلبات، وواحد بلا مهلة قراءة للبث المستمر
    private val apiClientHttp = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS) // الالتقاط قد يستغرق وقتًا (تركيز + غالق)
        .build()
    // عميل منفصل لـ getEvent كي نلغي الاستطلاع الطويل فورًا قبل الالتقاط/التركيز
    private val eventHttp = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()
    private val streamHttp = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)   // بثّ مستمر
        .retryOnConnectionFailure(true)
        .build()

    @Volatile private var api: ScalarWebApiClient? = null
    @Volatile private var device: SsdpDiscovery.Result? = null
    @Volatile private var capabilities: Set<String> = emptySet()

    private var statusJob: Job? = null
    private var liveviewJob: Job? = null
    private var liveviewParser: LiveviewParser? = null
    @Volatile private var wantLiveview = false
    /** مسار PTP/IP للكاميرات الأحدث (عند غياب ScalarWebAPI). */
    @Volatile private var ptp: SonyPtpCamera? = null

    // -------- الاتصال --------

    fun connect() {
        scope.launch {
            try {
                ptp?.let { ptp = null; it.close() }
                emit("status", JSONObject().put("phase", "binding"))
                WifiConnector.ensureBound(appContext) // إن اتصل عبر QR فهو مربوط أصلًا؛ وإلا يربط أول شبكة Wi‑Fi

                emit("status", JSONObject().put("phase", "discovering"))
                var dev = SsdpDiscovery.discover(timeoutMs = 5000)
                if (dev == null) {
                    // احتياطي: بعض هواتف Android تحجب SSDP multicast — نجرّب نقاط النهاية المعروفة مباشرةً
                    emit("status", JSONObject().put("phase", "probing"))
                    dev = probeDirect()
                }
                if (dev == null) {
                    // الكاميرات الأحدث (a7 IV / a7S III / a1 / FX3 / ZV...) لا تحوي ScalarWebAPI — نجرّب PTP/IP
                    emit("status", JSONObject().put("phase", "ptpip"))
                    val err = tryPtp()
                    if (err == null) return@launch
                    emit("error", JSONObject()
                        .put("code", "no_camera")
                        .put("message", "لم يُعثر على كاميرا Sony. تأكّد أن الهاتف متصل بشبكة Wi‑Fi الخاصة بالكاميرا، وأن الكاميرا في وضع «التحكّم بالهاتف» (a7 III وما شابهها) أو «التحكم عن بعد بالكمبيوتر عبر Wi‑Fi» (الموديلات الأحدث). تفاصيل PTP/IP: $err"))
                    return@launch
                }
                device = dev
                val client = ScalarWebApiClient(apiClientHttp, dev.cameraEndpointUrl, dev.avContentEndpointUrl, eventHttp)
                api = client

                client.startRecMode()
                delay(300)

                capabilities = try { client.getAvailableApiList() } catch (e: Exception) {
                    Log.w(TAG, "getAvailableApiList فشل: ${e.message}"); emptySet()
                }

                val caps = JSONObject()
                    .put("model", dev.modelName)
                    .put("friendlyName", dev.friendlyName)
                    .put("services", JSONArray(dev.availableServices))
                    .put("apiList", JSONArray(capabilities.toList()))
                    .put("hasLiveview", capabilities.contains("startLiveview"))
                    .put("hasTakePicture", capabilities.contains("actTakePicture"))
                    .put("hasMovieRec", capabilities.contains("startMovieRec"))
                    .put("hasAvContent", dev.avContentEndpointUrl != null)
                    .put("canSetIso", capabilities.contains("setIsoSpeedRate"))
                    .put("canSetShutter", capabilities.contains("setShutterSpeed"))
                    .put("canSetFNumber", capabilities.contains("setFNumber"))
                    .put("canSetExposureComp", capabilities.contains("setExposureCompensation"))
                    .put("canSetWhiteBalance", capabilities.contains("setWhiteBalance"))
                    .put("canTouchAF", capabilities.contains("setTouchAFPosition"))
                    .put("canHalfPress", capabilities.contains("actHalfPressShutter"))
                    .put("canSetExposureMode", capabilities.contains("setExposureMode"))
                    .put("canSetMovieQuality", capabilities.contains("setMovieQuality"))
                    .put("canSetMovieFormat", capabilities.contains("setMovieFileFormat"))
                    .put("transport", "scalar")
                if (capabilities.contains("getAvailableWhiteBalance")) {
                    try { caps.put("wbCandidates", JSONArray(client.getAvailableWhiteBalance())) } catch (_: Exception) {}
                    client.getColorTemperatureRange()?.let { caps.put("colorTempRange", it) }
                }
                if (capabilities.contains("setMovieQuality")) {
                    try { caps.put("movieQualityCandidates", JSONArray(client.getAvailableStringList("getAvailableMovieQuality"))) } catch (_: Exception) {}
                }
                if (capabilities.contains("setMovieFileFormat")) {
                    try { caps.put("movieFormatCandidates", JSONArray(client.getAvailableStringList("getAvailableMovieFileFormat"))) } catch (_: Exception) {}
                }
                if (capabilities.contains("setExposureMode")) {
                    try { caps.put("exposureModeCandidates", JSONArray(client.getAvailableStringList("getAvailableExposureMode"))) } catch (_: Exception) {}
                }
                // القيم الحالية لجودة/صيغة الفيديو (لا تأتي دائمًا في getEvent)
                if (capabilities.contains("getMovieQuality")) runCatching { caps.put("movieQuality", client.getString("getMovieQuality")) }
                if (capabilities.contains("getMovieFileFormat")) runCatching { caps.put("movieFileFormat", client.getString("getMovieFileFormat")) }
                emit("connected", caps)

                startStatusPolling()

                // إن طُلب البث قبل اكتمال الاتصال، ابدأه الآن
                if (wantLiveview) startLiveviewInternal()
            } catch (e: Exception) {
                emit("error", JSONObject().put("code", "connect_failed").put("message", e.message ?: "فشل الاتصال"))
            }
        }
    }

    /** يحاول الاتصال عبر PTP/IP على بوابة الشبكة الحالية. يعيد null عند النجاح أو وصف الخطأ. */
    private fun tryPtp(): String? {
        val hosts = LinkedHashSet<String>()
        gatewayHost()?.let { hosts.add(it) }
        hosts.add("192.168.122.1")
        var lastErr = "لا رد على المنفذ 15740"
        for (h in hosts) {
            val cam = SonyPtpCamera(h, scope,
                emit = { t, j -> emit(t, j) },
                onFrame = { jpeg, seq, ts -> callback.onFrame(jpeg, seq, ts) },
                log = { log(it) })
            try {
                log("PTP/IP: محاولة $h:15740")
                cam.wantLiveview = wantLiveview
                cam.connect()
                ptp = cam
                return null
            } catch (e: Exception) {
                lastErr = "$h: ${e.message}"
                log("PTP/IP فشل — $lastErr")
                cam.close()
            }
        }
        return lastErr
    }

    private fun gatewayHost(): String? = try {
        val cm = appContext.getSystemService(android.net.ConnectivityManager::class.java)
        val net = cm.boundNetworkForProcess ?: cm.activeNetwork
        cm.getLinkProperties(net)?.routes
            ?.firstOrNull { it.isDefaultRoute && it.gateway is java.net.Inet4Address }
            ?.gateway?.hostAddress
    } catch (_: Exception) { null }

    /** محاولة مباشرة لنقاط نهاية Sony المعروفة حين يفشل SSDP. يعيد Result أو null. */
    private fun probeDirect(): SsdpDiscovery.Result? {
        val bases = listOf(
            "http://192.168.122.1:8080/sony",
            "http://192.168.122.1:10000/sony"
        )
        for (base in bases) {
            try {
                val endpoint = "$base/camera"
                val probe = ScalarWebApiClient(apiClientHttp, endpoint)
                probe.startRecMode()
                val apis = probe.getAvailableApiList()
                if (apis.isNotEmpty()) {
                    Log.i(TAG, "probeDirect نجح على $base")
                    return SsdpDiscovery.Result(
                        baseUrl = base,
                        cameraEndpointUrl = endpoint,
                        avContentEndpointUrl = "$base/avContent",
                        friendlyName = "Sony (اتصال مباشر)",
                        modelName = "Sony",
                        availableServices = listOf("camera"),
                        locationUrl = base
                    )
                }
            } catch (e: Exception) {
                Log.w(TAG, "probeDirect $base: ${e.message}")
            }
        }
        return null
    }

    fun disconnect() {
        wantLiveview = false
        ptp?.let { p -> ptp = null; scope.launch { p.close(); WifiConnector.unbind(appContext); emit("disconnected", JSONObject()) }; return }
        stopLiveviewInternal()
        statusJob?.cancel(); statusJob = null
        scope.launch {
            try { api?.stopLiveview() } catch (_: Exception) {}
            WifiConnector.unbind(appContext)
            emit("disconnected", JSONObject())
        }
    }

    // -------- البث الحي --------

    fun startLiveview() {
        wantLiveview = true
        ptp?.let { it.startLiveview(); return }
        if (api != null) startLiveviewInternal()
    }
    fun stopLiveview() { wantLiveview = false; ptp?.let { it.stopLiveview(); return }; stopLiveviewInternal() }

    private fun startLiveviewInternal() {
        if (liveviewJob?.isActive == true) return
        liveviewJob = scope.launch {
            var attempt = 0
            while (isActive && wantLiveview) {
                try {
                    val client = api ?: break
                    emit("stream", JSONObject().put("state", "starting"))
                    // نفضّل الحجم الأكبر إن دعمته الكاميرا
                    val sizes = client.getAvailableLiveviewSize()
                    val url = if (sizes.contains("L")) client.startLiveviewWithSize("L") else client.startLiveview()
                    if (url.isBlank()) throw IllegalStateException("رابط بث فارغ")

                    emit("stream", JSONObject().put("state", "connected").put("url", url))
                    attempt = 0
                    streamLoop(url)
                    // إن رجعنا من streamLoop بلا استثناء وما زلنا نريد البث ⇒ انقطع
                    if (wantLiveview) emit("stream", JSONObject().put("state", "lost").put("reason", "انتهى الدفق"))
                } catch (e: Exception) {
                    if (!wantLiveview) break
                    emit("stream", JSONObject().put("state", "lost").put("reason", e.message ?: "خطأ في البث"))
                }
                if (!wantLiveview) break
                attempt++
                val backoff = (500L * attempt).coerceAtMost(4000L)
                emit("stream", JSONObject().put("state", "reconnecting").put("inMs", backoff).put("attempt", attempt))
                delay(backoff)
            }
        }
    }

    private fun streamLoop(url: String) {
        val req = Request.Builder().url(url).get().build()
        streamHttp.newCall(req).execute().use { resp ->
            val body = resp.body ?: throw IllegalStateException("لا جسم في رد البث")
            val parser = LiveviewParser { jpeg, seq, ts -> callback.onFrame(jpeg, seq, ts) }
            liveviewParser = parser
            body.byteStream().use { input -> parser.parse(input) }
        }
    }

    private fun stopLiveviewInternal() {
        liveviewParser?.stop()
        liveviewJob?.cancel(); liveviewJob = null
        scope.launch { try { api?.stopLiveview() } catch (_: Exception) {} }
    }

    // -------- التحكم --------

    // نحاول التنفيذ مباشرةً (قائمة الوظائف المتاحة تتغيّر مع وضع الكاميرا)،
    // ونبلّغ بالنتيجة أو رمز الخطأ الحقيقي من الكاميرا مع شرح مفهوم.
    @Volatile private var busy = false

    fun takePicture() = attempt("التقاط الصورة", exclusive = true) {
        ptp?.let { emit("action", it.takePicture()); return@attempt }
        val c = api!!
        pausePolling()
        try {
            val mode = if (capabilities.contains("getShootMode")) runCatching { c.getShootMode() }.getOrNull() else null
            log("التقاط: shootMode=${mode ?: "?"}")
            if (mode != null && mode.isNotEmpty() && !mode.equals("still", true)) {
                throw UserFacing("الكاميرا تُبلغ أن وضع التصوير الحالي «$mode» وليس «still». أدر الدايل إلى وضع الصور (P/A/S/M) ثم أعد الاتصال.")
            }
            val urls = shootWithFallback(c)
            log("التقاط: نجح، postview=${urls.size}")
            emit("action", JSONObject().put("action", "takePicture").put("ok", true).put("postview", JSONArray(urls)))
            urls.firstOrNull()?.let { fetchPostview(it) }
        } finally {
            startStatusPolling()
        }
    }

    /** actTakePicture ← وإن فشل: ضغط نصفي (تركيز) ثم التقاط، مع معالجة 40403 (التقاط طويل). */
    private suspend fun shootWithFallback(c: ScalarWebApiClient): List<String> {
        val first = try {
            return shootOnce(c)
        } catch (e: ScalarWebApiClient.ApiError) {
            log("actTakePicture فشل: ${e.code} ${e.message}")
            e
        }
        if (!capabilities.contains("actHalfPressShutter")) throw first
        log("إعادة المحاولة: ضغط نصفي للتركيز ثم التقاط")
        try {
            c.actHalfPressShutter()
            val fs = waitFocus(c, 2500)
            log("حالة التركيز بعد الضغط النصفي: ${fs ?: "غير معروفة"}")
            return shootOnce(c)
        } catch (e: ScalarWebApiClient.ApiError) {
            log("المحاولة الثانية فشلت: ${e.code} ${e.message}")
            throw e
        } finally {
            c.cancelHalfPressShutter()
        }
    }

    private fun shootOnce(c: ScalarWebApiClient): List<String> = try {
        c.actTakePicture()
    } catch (e: ScalarWebApiClient.ApiError) {
        // 40403 = "Long shooting" — الكاميرا ما زالت تلتقط؛ ننتظر النتيجة
        if (e.code == 40403) c.awaitTakePicture() else throw e
    }

    /** ينتظر focusStatus = Focused/Failed عبر getEvent(false). يعيد آخر حالة أو null. */
    private suspend fun waitFocus(c: ScalarWebApiClient, timeoutMs: Long): String? {
        val t0 = System.currentTimeMillis()
        var last: String? = null
        while (System.currentTimeMillis() - t0 < timeoutMs) {
            delay(250)
            val st = runCatching { StatusParser.parse(c.getEvent(false)) }.getOrNull() ?: continue
            last = st.optString("focusStatus", "").ifEmpty { last }
            if (last.equals("Focused", true) || last.equals("Failed", true)) break
        }
        return last
    }

    /** تنزيل صورة المعاينة (postview) بعد الالتقاط وإرسال نسخة مصغّرة للواجهة. */
    private fun fetchPostview(url: String) {
        scope.launch {
            try {
                val bytes = apiClientHttp.newCall(Request.Builder().url(url).get().build()).execute().use { r ->
                    if (!r.isSuccessful) throw IllegalStateException("HTTP ${r.code}")
                    r.body?.bytes() ?: throw IllegalStateException("فارغ")
                }
                val thumb = MediaStoreSaver.downscaleJpeg(bytes, 720)
                emit("postview", JSONObject().put("url", url)
                    .put("b64", android.util.Base64.encodeToString(thumb, android.util.Base64.NO_WRAP))
                    .put("bytes", bytes.size).put("ts", System.currentTimeMillis()))
            } catch (e: Exception) {
                log("تعذّر تنزيل صورة المعاينة: ${e.message}")
            }
        }
    }

    fun startMovieRec() = attempt("تسجيل الفيديو") {
        ptp?.let { emit("action", it.toggleMovie(true)); return@attempt }
        api!!.startMovieRec()
        emit("action", JSONObject().put("action", "startMovieRec").put("ok", true))
    }

    fun stopMovieRec() = attempt("إيقاف التسجيل") {
        ptp?.let { emit("action", it.toggleMovie(false)); return@attempt }
        api!!.stopMovieRec()
        emit("action", JSONObject().put("action", "stopMovieRec").put("ok", true))
    }

    private class UserFacing(msg: String) : Exception(msg)

    private fun attempt(label: String, exclusive: Boolean = false, block: suspend () -> Unit) {
        scope.launch {
            if (api == null && ptp == null) {
                emit("action", JSONObject().put("ok", false).put("label", label).put("message", "غير متصل بالكاميرا"))
                return@launch
            }
            if (exclusive && busy) {
                emit("action", JSONObject().put("ok", false).put("label", label).put("message", "أمر سابق ما زال قيد التنفيذ"))
                return@launch
            }
            if (exclusive) busy = true
            try { block() } catch (e: Exception) {
                val msg = describe(e)
                log("$label: فشل — $msg")
                emit("action", JSONObject().put("ok", false).put("label", label).put("message", msg)
                    .put("code", (e as? ScalarWebApiClient.ApiError)?.code ?: 0))
            } finally {
                if (exclusive) busy = false
            }
        }
    }

    /** ترجمة رموز أخطاء Sony إلى شرح عملي — مع إبقاء الرمز الأصلي ظاهرًا. */
    private fun describe(e: Exception): String {
        if (e is UserFacing) return e.message ?: ""
        if (e !is ScalarWebApiClient.ApiError) return "لا رد صالح من الكاميرا (${e.javaClass.simpleName}: ${e.message ?: ""})"
        val raw = if (e.message.isNotBlank()) " «${e.message}»" else ""
        return when (e.code) {
            40400 -> "فشل الالتقاط (40400)$raw. غالبًا لم تُثبّت الكاميرا التركيز: وجّهها لهدف واضح، أو جرّب التركيز اليدوي MF، أو اضبط «أولوية الإطلاق» في AF-S/AF-C."
            40401 -> "الكاميرا غير جاهزة (40401)$raw — انتظر لحظة وأعد المحاولة، وتأكّد من وجود بطاقة ذاكرة بمساحة كافية."
            40402 -> "الكاميرا مشغولة بأمر آخر (40402)$raw."
            1 -> "الأمر غير متاح الآن (1)$raw — تأكّد من وجود البطاقة وأنها غير مقفلة/ممتلئة، وأن الكاميرا ليست في قائمة أو عرض صور."
            3 -> "قيمة غير مقبولة (3)$raw."
            12, 15 -> "هذا الأمر غير مدعوم على هذا الموديل (${e.code})$raw."
            403 -> "الكاميرا رفضت الأمر (403)$raw."
            else -> "خطأ من الكاميرا (${e.code})$raw"
        }
    }

    /**
     * النقر للتركيز: إن دعمت الكاميرا setTouchAFPosition نرسل النقطة.
     * وإلا (مثل a7 III) ننفّذ ضغطًا نصفيًا = تركيز تلقائي على منطقة التركيز المضبوطة في الكاميرا،
     * ونُبلغ الواجهة بصدق أن اختيار النقطة نفسها غير مدعوم.
     */
    fun touchFocus(xPercent: Int, yPercent: Int) = attempt("التركيز", exclusive = true) {
        ptp?.let { emit("action", it.halfPressFocus()); return@attempt }
        val c = api!!
        if (capabilities.contains("setTouchAFPosition")) {
            c.setTouchAFPosition(xPercent.toDouble(), yPercent.toDouble())
            emit("action", JSONObject().put("action", "touchFocus").put("ok", true).put("mode", "point")
                .put("x", xPercent).put("y", yPercent))
            return@attempt
        }
        if (!capabilities.contains("actHalfPressShutter")) {
            throw UserFacing("هذه الكاميرا لا تتيح التركيز عن بُعد عبر هذا الاتصال.")
        }
        pausePolling()
        try {
            c.actHalfPressShutter()
            val fs = waitFocus(c, 2500)
            log("تركيز بالضغط النصفي: ${fs ?: "?"}")
            emit("action", JSONObject().put("action", "touchFocus").put("ok", true).put("mode", "halfpress")
                .put("focusStatus", fs ?: ""))
        } finally {
            c.cancelHalfPressShutter()
            startStatusPolling()
        }
    }

    fun setSetting(kind: String, value: String) {
        val p = ptp
        if (p != null) {
            scope.launch {
                try { emit("action", p.setSetting(kind, value)) } catch (e: Exception) {
                    emit("action", JSONObject().put("ok", false).put("action", "set").put("kind", kind)
                        .put("value", value).put("label", "ضبط $kind").put("message", describe(e)))
                }
            }
            return
        }
        setSettingWeb(kind, value)
    }

    private fun setSettingWeb(kind: String, value: String) = guarded(apiForKind(kind), "ضبط $kind", kind, value) {
        val c = api!!
        when (kind) {
            "iso" -> c.setIso(value)
            "shutter" -> c.setShutterSpeed(value)
            "fnumber" -> c.setFNumber(value)
            "exposure" -> c.setExposureCompensation(value.toInt())
            "whitebalance" -> c.setWhiteBalance(value, false, 0)
            "colortemp" -> c.setWhiteBalance("Color Temperature", true, value.toInt())
            "moviequality" -> {
                // نتحقق من القائمة المتاحة الآن (تتغيّر حسب صيغة الفيديو) — لا نستبدل القيمة بصمت
                val avail = c.getAvailableStringList("getAvailableMovieQuality")
                if (avail.isNotEmpty() && value !in avail) throw UserFacing("الجودة «$value» غير متاحة مع الصيغة الحالية. المتاح: ${avail.joinToString("، ")}")
                c.setMovieQuality(value)
            }
            "movieformat" -> {
                val avail = c.getAvailableStringList("getAvailableMovieFileFormat")
                if (avail.isNotEmpty() && value !in avail) throw UserFacing("الصيغة «$value» غير متاحة الآن. المتاح: ${avail.joinToString("، ")}")
                c.setMovieFileFormat(value)
            }
            "exposuremode" -> c.setExposureMode(value)
            else -> throw IllegalArgumentException("إعداد غير معروف: $kind")
        }
        val (rb, verified) = readBackWeb(c, kind, value)
        emit("action", JSONObject().put("action", "set").put("kind", kind).put("value", value).put("ok", true)
            .put("readback", rb ?: JSONObject.NULL).put("verified", verified ?: JSONObject.NULL))
    }

    /**
     * يقرأ القيمة من الكاميرا بعد الضبط (getter مباشر) للتأكد أنها طُبّقت فعلًا.
     * يعيد (القيمة المقروءة، تطابقت؟) — أو (null, null) إن لم يتوفّر getter.
     */
    private fun readBackWeb(c: ScalarWebApiClient, kind: String, value: String): Pair<String?, Boolean?> {
        val getter = when (kind) {
            "iso" -> "getIsoSpeedRate"; "shutter" -> "getShutterSpeed"; "fnumber" -> "getFNumber"
            "exposuremode" -> "getExposureMode"; "moviequality" -> "getMovieQuality"; "movieformat" -> "getMovieFileFormat"
            "whitebalance", "colortemp" -> "getWhiteBalance"
            else -> null
        } ?: return null to null
        if (!capabilities.contains(getter)) return null to null
        var rb: String? = null
        for (i in 0 until 6) {
            Thread.sleep(if (i == 0) 200 else 300)
            rb = try { if (getter == "getWhiteBalance") c.getWhiteBalanceString() else c.getString(getter) } catch (_: Exception) { null }
            val r = rb ?: continue
            val match = when (kind) {
                "colortemp" -> r.equals("Color Temperature|$value", true)
                "whitebalance" -> r.substringBefore('|').equals(value, true)
                else -> r == value
            }
            if (match) return r to true
        }
        return rb to false
    }

    private fun apiForKind(kind: String) = when (kind) {
        "iso" -> "setIsoSpeedRate"
        "shutter" -> "setShutterSpeed"
        "fnumber" -> "setFNumber"
        "exposure" -> "setExposureCompensation"
        "whitebalance", "colortemp" -> "setWhiteBalance"
        "moviequality" -> "setMovieQuality"
        "movieformat" -> "setMovieFileFormat"
        "exposuremode" -> "setExposureMode"
        else -> kind
    }

    /** ينفّذ الأمر فقط إن كانت الوظيفة مدعومة، ويبلّغ الفشل بصدق دون تغيير أي قيمة في الواجهة. */
    private fun guarded(requiredApi: String, label: String, kind: String? = null, value: String? = null, block: () -> Unit) {
        fun fail(msg: String) = emit("action", JSONObject().put("ok", false).put("label", label).put("message", msg).apply {
            if (kind != null) put("action", "set").put("kind", kind).put("value", value ?: "")
        })
        scope.launch {
            if (api == null) { fail("غير متصل بالكاميرا"); return@launch }
            if (!capabilities.contains(requiredApi)) {
                fail("الكاميرا الحالية لا تدعم هذا الضبط عبر هذا الاتصال ($requiredApi غير موجودة في قائمة الوظائف المتاحة).")
                return@launch
            }
            try { block() } catch (e: Exception) { fail(describe(e)) }
        }
    }

    // -------- استطلاع الحالة --------

    private fun startStatusPolling() {
        statusJob?.cancel()
        statusJob = scope.launch {
            var longPoll = false
            while (isActive) {
                try {
                    val c = api ?: break
                    val result = c.getEvent(longPoll)
                    longPoll = true
                    val parsed = StatusParser.parse(result)
                    emit("camera-status", parsed)
                } catch (e: Exception) {
                    // getEvent قد يعيد timeout مع الاستطلاع الطويل — طبيعي؛ نعيد المحاولة
                    longPoll = false
                    delay(700)
                }
            }
        }
    }

    /** يوقف الاستطلاع الطويل فورًا (يلغي طلب getEvent المعلّق) — الكاميرا ترفض أحيانًا الأوامر أثناءه. */
    private fun pausePolling() {
        statusJob?.cancel(); statusJob = null
        try { eventHttp.dispatcher.cancelAll() } catch (_: Exception) {}
    }

    fun refreshStatus() {
        if (ptp != null) return // حلقة PTP تحدّث الحالة دوريًا
        scope.launch {
            try {
                val c = api ?: return@launch
                emit("camera-status", StatusParser.parse(c.getEvent(false)))
            } catch (_: Exception) {}
        }
    }

    // -------- مساعد --------

    private fun emit(type: String, json: JSONObject) = callback.onEvent(type, json)
    private fun log(msg: String) { Log.i(TAG, msg); emit("log", JSONObject().put("msg", msg)) }

    fun release() {
        ptp?.close(); ptp = null
        try { scope.cancel() } catch (_: Exception) {}
        WifiConnector.unbind(appContext)
    }

    companion object { private const val TAG = "CameraController" }
}
