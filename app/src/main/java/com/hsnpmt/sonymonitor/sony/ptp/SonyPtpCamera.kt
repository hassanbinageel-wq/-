package com.hsnpmt.sonymonitor.sony.ptp

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.nio.ByteBuffer

/**
 * جلسة تحكّم بكاميرات Sony الأحدث عبر PTP/IP (وضع PC Remote عبر Wi‑Fi) —
 * مثل a7 IV / a7S III / a7R IV‑V / a1 / a9 II / FX3 / FX30 / ZV‑E1 / a6700 وغيرها.
 *
 * تُصدر نفس الأحداث التي يصدرها مسار ScalarWebAPI (connected / camera-status / action / stream)
 * بحيث تبقى الواجهة واحدة. كل ما لا تعلنه الكاميرا في خصائصها يبقى معطّلًا.
 *
 * تجريبي: بُني من التوثيق المفتوح للبروتوكول ويحتاج اختبارًا على كل موديل.
 */
class SonyPtpCamera(
    private val host: String,
    private val scope: CoroutineScope,
    private val emit: (String, JSONObject) -> Unit,
    private val onFrame: (ByteArray, Int, Long) -> Unit,
    private val log: (String) -> Unit
) {
    private var t: PtpIpTransport? = null
    @Volatile private var props: Map<Int, SonyProps.Desc> = emptyMap()
    @Volatile var wantLiveview = false
    private var loopJob: Job? = null
    private var eventJob: Job? = null
    @Volatile private var recording = false
    @Volatile private var dirty = true
    private var seq = 0
    var model = "Sony"; private set

    // خرائط النص ← القيمة الخام من آخر قائمة مرشّحات (لإرسال القيمة الدقيقة للكاميرا)
    private val isoMap = HashMap<String, Long>()
    private val ssMap = HashMap<String, Long>()
    private val fMap = HashMap<String, Long>()
    private val wbMap = HashMap<String, Long>()
    private val modeMap = HashMap<String, Long>()
    private var evValues: List<Long> = emptyList()

    /** يتصل ويهيّئ الجلسة. يرمي استثناءً بوصف واضح عند الفشل. */
    fun connect() {
        val tr = PtpIpTransport(host)
        try {
            tr.open("SonyMonitor")
        } catch (e: PtpIpTransport.InitFailed) {
            tr.close()
            throw IllegalStateException("رفضت الكاميرا اتصال PTP/IP (${e.message}). إن كانت «مصادقة الوصول/Access Authen.» مفعّلة في إعدادات الشبكة فأوقفها، وتأكّد أن «التحكم عن بعد بالكمبيوتر» مضبوط على Wi‑Fi.")
        }
        t = tr
        log("PTP/IP: متصل (conn=${tr.connectionNumber}, name=${tr.remoteName})")

        val os = tr.transaction(0x1002, intArrayOf(1))
        if (os.code != OK && os.code != 0x201E) throw IllegalStateException("OpenSession فشل: 0x${os.code.toString(16)}")

        runCatching { parseDeviceInfo(tr.transaction(0x1001).data) }
        log("PTP/IP: الموديل $model")

        // مصافحة Sony SDIO: 1 ثم 2 ثم معلومات الامتداد ثم 3
        sdio(1); sdio(2)
        val ext = tr.transaction(0x9202, intArrayOf(0x12C))
        if (ext.code != OK) {
            val ext2 = tr.transaction(0x9202, intArrayOf(0xC8))
            log("GetExtDeviceInfo(0xC8) → 0x${ext2.code.toString(16)}")
        } else log("GetExtDeviceInfo(0x12C) → OK")
        sdio(3)

        refreshProps()
        // في الأجيال الأحدث: اجعل أولوية الإعداد للهاتف/الكمبيوتر إن أتيح ذلك
        props[SonyProps.PRIORITY_KEY]?.let { d ->
            if (d.writable && d.current != 1L) {
                val r = setProp(SonyProps.PRIORITY_KEY, 1)
                log("PriorityKey → PC Remote: 0x${r.toString(16)}")
            }
        }
        if (props.isEmpty()) throw IllegalStateException("اتصل PTP/IP لكن الكاميرا لم تُرجع أي خصائص — قد لا تكون في وضع PC Remote.")

        emit("connected", capsJson())
        emit("camera-status", statusJson())
        startEventReader()
        startLoop()
    }

    private fun sdio(phase: Int) {
        val r = t!!.transaction(0x9201, intArrayOf(phase, 0, 0))
        log("SDIOConnect($phase) → 0x${r.code.toString(16)}")
    }

    private fun parseDeviceInfo(d: ByteArray) {
        val bb = PtpIpTransport.le(d)
        bb.short; bb.int; bb.short
        ptpString(bb); bb.short
        repeat(5) { val n = bb.int; bb.position(bb.position() + n * 2) }
        val manu = ptpString(bb)
        model = ptpString(bb).ifEmpty { "Sony" }
        Log.i(TAG, "DeviceInfo $manu $model")
    }

    private fun ptpString(bb: ByteBuffer): String {
        val n = bb.get().toInt() and 0xFF
        val sb = StringBuilder()
        repeat(n) { val c = bb.short.toInt().toChar(); if (c != '\u0000') sb.append(c) }
        return sb.toString()
    }

    fun refreshProps() {
        val r = t?.transaction(0x9209) ?: return
        if (r.code == OK) {
            props = SonyProps.parseAll(r.data)
            dirty = false
        }
    }

    private fun setProp(code: Int, v: Long): Int {
        val d = props[code]
        val type = d?.type ?: 4
        return t!!.transaction(0x9205, intArrayOf(code), SonyProps.encode(type, v)).code
    }

    private fun button(code: Int, down: Boolean): Int =
        t!!.transaction(0x9207, intArrayOf(code), PtpIpTransport.le(2).putShort((if (down) 2 else 1).toShort()).array()).code

    // ---- الأحداث والحلقة الرئيسية (بث + تحديث الحالة) ----

    private fun startEventReader() {
        eventJob = scope.launch {
            while (isActive) {
                val ev = try { t?.readEvent() } catch (e: Exception) { null } ?: break
                if (ev.first == 0xC203 || ev.first == 0xC201 || ev.first == 0x4006) dirty = true
            }
        }
    }

    private fun startLoop() {
        loopJob?.cancel()
        loopJob = scope.launch {
            var lastStatus = 0L
            var streamState = ""
            var failures = 0
            while (isActive) {
                try {
                    val now = System.currentTimeMillis()
                    if (dirty || now - lastStatus > 1500) {
                        refreshProps(); lastStatus = now
                        emit("camera-status", statusJson())
                    }
                    if (wantLiveview) {
                        if (streamState != "connected") { emit("stream", JSONObject().put("state", "connected").put("url", "ptpip://$host")); streamState = "connected" }
                        val r = t!!.transaction(0x1009, intArrayOf(LIVEVIEW_HANDLE))
                        if (r.code == OK && r.data.size > 8) {
                            val bb = PtpIpTransport.le(r.data)
                            val off = bb.int; val size = bb.int
                            if (off in 8 until r.data.size && size > 0 && off + size <= r.data.size) {
                                onFrame(r.data.copyOfRange(off, off + size), ++seq, System.currentTimeMillis())
                            }
                        } else delay(60)
                        failures = 0
                    } else {
                        streamState = ""
                        delay(250)
                    }
                } catch (e: Exception) {
                    failures++
                    log("PTP/IP: خطأ في الحلقة — ${e.message}")
                    emit("stream", JSONObject().put("state", "lost").put("reason", e.message ?: "PTP/IP"))
                    streamState = ""
                    if (failures >= 3) { emit("disconnected", JSONObject().put("reason", "انقطع اتصال PTP/IP")); break }
                    delay(600)
                }
            }
        }
    }

    fun startLiveview() { wantLiveview = true }
    fun stopLiveview() { wantLiveview = false }

    // ---- الأوامر ----

    suspend fun takePicture(): JSONObject {
        val r1 = button(SonyProps.S1, true)
        val fs = waitFocus(1800)
        val r2 = button(SonyProps.S2, true)
        delay(120)
        button(SonyProps.S2, false)
        button(SonyProps.S1, false)
        log("PTP التقاط: S1=0x${r1.toString(16)} تركيز=$fs S2=0x${r2.toString(16)}")
        if (r2 != OK) throw IllegalStateException("رفضت الكاميرا أمر الالتقاط (0x${r2.toString(16)})")
        return JSONObject().put("action", "takePicture").put("ok", true).put("postview", JSONArray())
    }

    suspend fun toggleMovie(start: Boolean): JSONObject {
        val r = button(SonyProps.MOVIE_REC, true)
        delay(120)
        button(SonyProps.MOVIE_REC, false)
        if (r != OK) throw IllegalStateException("رفضت الكاميرا أمر التسجيل (0x${r.toString(16)}) — تأكّد أن الكاميرا في وضع الفيديو أو أن زر MOVIE مفعّل")
        recording = start
        return JSONObject().put("action", if (start) "startMovieRec" else "stopMovieRec").put("ok", true)
    }

    suspend fun halfPressFocus(): JSONObject {
        button(SonyProps.S1, true)
        val fs = waitFocus(2000)
        button(SonyProps.S1, false)
        return JSONObject().put("action", "touchFocus").put("ok", true).put("mode", "halfpress").put("focusStatus", fs)
    }

    /** 0xD213: 1 = يبحث، 2 = تم التركيز، 3 = فشل (حسب libgphoto2). */
    private suspend fun waitFocus(ms: Long): String {
        if (props[SonyProps.FOCUS_FOUND] == null) { delay(700); return "" }
        val t0 = System.currentTimeMillis()
        while (System.currentTimeMillis() - t0 < ms) {
            delay(150)
            refreshProps()
            when (props[SonyProps.FOCUS_FOUND]?.current?.toInt()) {
                2, 6 -> return "Focused"
                3 -> return "Failed"
            }
        }
        return ""
    }

    fun setSetting(kind: String, value: String): JSONObject {
        val code: Int
        val raw: Long
        when (kind) {
            "iso" -> { code = SonyProps.ISO; raw = isoMap[value] ?: throw IllegalArgumentException("قيمة ISO غير متاحة: $value") }
            "shutter" -> { code = SonyProps.SHUTTER; raw = ssMap[value] ?: throw IllegalArgumentException("سرعة غير متاحة: $value") }
            "fnumber" -> { code = SonyProps.F_NUMBER; raw = fMap[value.removePrefix("F")] ?: throw IllegalArgumentException("فتحة غير متاحة: $value") }
            "whitebalance" -> { code = SonyProps.WHITE_BALANCE; raw = wbMap[value] ?: throw IllegalArgumentException("وضع WB غير متاح: $value") }
            "exposure" -> {
                code = SonyProps.EXPOSURE_BIAS
                val target = value.toInt() * 1000.0 / 3.0
                raw = evValues.minByOrNull { kotlin.math.abs(it - target) } ?: Math.round(target)
            }
            "exposuremode" -> { code = SonyProps.EXPOSURE_PROGRAM; raw = modeMap[value] ?: throw IllegalArgumentException("وضع التصوير «$value» غير متاح الآن") }
            "moviequality", "movieformat" -> throw IllegalStateException("ضبط صيغة/جودة الفيديو غير منفّذ عبر PTP/IP بعد — اضبطه من الكاميرا")
            "colortemp" -> {
                if (props[SonyProps.WHITE_BALANCE]?.current != 0x8012L) setProp(SonyProps.WHITE_BALANCE, 0x8012)
                code = SonyProps.COLOR_TEMP; raw = value.toLong()
            }
            else -> throw IllegalArgumentException("إعداد غير مدعوم عبر PTP/IP: $kind")
        }
        val d = props[code] ?: throw IllegalStateException("الكاميرا لا تعلن هذه الخاصية (0x${code.toString(16)})")
        if (!d.writable) throw IllegalStateException("الخاصية للقراءة فقط الآن — قد تكون مقفولة بوضع الدايل أو «أولوية الإعداد» على الكاميرا")
        val r = setProp(code, raw)
        if (r != OK) throw IllegalStateException("رفضت الكاميرا القيمة (0x${r.toString(16)})")
        dirty = true
        // تحقّق: نعيد قراءة الخاصية من الكاميرا حتى تطابق القيمة المطلوبة
        var cur: Long? = null
        for (i in 0 until 6) {
            Thread.sleep(if (i == 0) 150 else 250)
            refreshProps()
            cur = props[code]?.current
            if (cur == raw) break
        }
        val rb = cur?.let { labelFor(code, it) }
        return JSONObject().put("action", "set").put("kind", kind).put("value", value).put("ok", true)
            .put("readback", if (code == SonyProps.COLOR_TEMP && rb != null) "Color Temperature|$rb" else rb ?: JSONObject.NULL)
            .put("verified", cur == raw)
    }

    private fun labelFor(code: Int, v: Long): String = when (code) {
        SonyProps.ISO -> SonyProps.isoLabel(v)
        SonyProps.SHUTTER -> SonyProps.shutterLabel(v)
        SonyProps.F_NUMBER -> SonyProps.fnumberLabel(v)
        SonyProps.WHITE_BALANCE -> SonyProps.wbLabel(v)
        SonyProps.EXPOSURE_PROGRAM -> SonyProps.exposureModeLabel(v)
        else -> v.toString()
    }

    // ---- JSON للواجهة ----

    private fun capsJson(): JSONObject {
        val p = props
        fun w(c: Int) = p[c]?.writable == true
        val caps = JSONObject()
            .put("model", model).put("friendlyName", model)
            .put("transport", "ptpip")
            .put("services", JSONArray().put("ptpip"))
            .put("apiList", JSONArray(p.keys.map { "0x%04X".format(it) }))
            .put("hasLiveview", true)
            .put("hasTakePicture", p.containsKey(SonyProps.S2) || p.containsKey(SonyProps.S1))
            .put("hasMovieRec", p.containsKey(SonyProps.MOVIE_REC))
            .put("hasAvContent", false)
            .put("canSetIso", w(SonyProps.ISO))
            .put("canSetShutter", w(SonyProps.SHUTTER))
            .put("canSetFNumber", w(SonyProps.F_NUMBER))
            .put("canSetExposureComp", w(SonyProps.EXPOSURE_BIAS))
            .put("canSetWhiteBalance", w(SonyProps.WHITE_BALANCE))
            .put("canTouchAF", false)
            .put("canHalfPress", p.containsKey(SonyProps.S1))
            .put("canSetExposureMode", w(SonyProps.EXPOSURE_PROGRAM))
            .put("canSetMovieQuality", false)
            .put("canSetMovieFormat", false)
        p[SonyProps.WHITE_BALANCE]?.let { d ->
            caps.put("wbCandidates", JSONArray(d.enumValues.map { SonyProps.wbLabel(it) }))
        }
        p[SonyProps.COLOR_TEMP]?.let { d ->
            val mn = d.rangeMin ?: d.enumValues.minOrNull() ?: 2500L
            val mx = d.rangeMax ?: d.enumValues.maxOrNull() ?: 9900L
            caps.put("colorTempRange", JSONObject().put("min", mn).put("max", mx).put("step", (d.rangeStep ?: 100L).coerceAtLeast(1L)))
        }
        return caps
    }

    private fun statusJson(): JSONObject {
        val p = props
        val o = JSONObject()
        p[SonyProps.ISO]?.let { d ->
            o.put("iso", SonyProps.isoLabel(d.current))
            isoMap.clear(); d.enumValues.forEach { isoMap[SonyProps.isoLabel(it)] = it }
            if (d.enumValues.isNotEmpty()) o.put("isoCandidates", JSONArray(d.enumValues.map { SonyProps.isoLabel(it) }))
        }
        p[SonyProps.SHUTTER]?.let { d ->
            o.put("shutter", SonyProps.shutterLabel(d.current))
            ssMap.clear(); d.enumValues.forEach { ssMap[SonyProps.shutterLabel(it)] = it }
            if (d.enumValues.isNotEmpty()) o.put("shutterCandidates", JSONArray(d.enumValues.map { SonyProps.shutterLabel(it) }))
        }
        p[SonyProps.F_NUMBER]?.let { d ->
            if (d.current in 1L..0xFFFEL) o.put("fnumber", SonyProps.fnumberLabel(d.current))
            fMap.clear(); d.enumValues.forEach { fMap[SonyProps.fnumberLabel(it)] = it }
            if (d.enumValues.isNotEmpty()) o.put("fnumberCandidates", JSONArray(d.enumValues.map { SonyProps.fnumberLabel(it) }))
        }
        p[SonyProps.EXPOSURE_BIAS]?.let { d ->
            val cur = if (d.type == 3 && d.current > 32767) d.current - 65536 else d.current
            evValues = d.enumValues.map { if (d.type == 3 && it > 32767) it - 65536 else it }
            o.put("exposureCompIndex", Math.round(cur * 3 / 1000.0).toInt())
            o.put("exposureCompStep", 2)
            val mn = evValues.minOrNull() ?: d.rangeMin; val mx = evValues.maxOrNull() ?: d.rangeMax
            if (mn != null && mx != null) {
                o.put("exposureCompMin", Math.round(mn * 3 / 1000.0).toInt())
                o.put("exposureCompMax", Math.round(mx * 3 / 1000.0).toInt())
            }
        }
        p[SonyProps.WHITE_BALANCE]?.let { d ->
            o.put("whiteBalance", SonyProps.wbLabel(d.current))
            wbMap.clear(); d.enumValues.forEach { wbMap[SonyProps.wbLabel(it)] = it }
        }
        p[SonyProps.COLOR_TEMP]?.let { d -> if (d.current > 0) o.put("colorTemp", d.current) }
        p[SonyProps.EXPOSURE_PROGRAM]?.let { d ->
            o.put("exposureMode", SonyProps.exposureModeLabel(d.current))
            o.put("shootMode", if (SonyProps.isMovieMode(d.current)) "movie" else "still")
            modeMap.clear(); d.enumValues.forEach { modeMap[SonyProps.exposureModeLabel(it)] = it }
            if (d.writable && d.enumValues.isNotEmpty()) o.put("exposureModeCandidates", JSONArray(d.enumValues.map { SonyProps.exposureModeLabel(it) }))
        }
        p[SonyProps.FOCUS_MODE]?.let { d -> o.put("focusMode", SonyProps.focusModeLabel(d.current)) }
        p[SonyProps.BATTERY]?.let { d ->
            val v = if (d.type == 1 && d.current > 127) d.current - 256 else d.current
            if (v in 0L..100L) { o.put("cameraBatteryLevel", v); o.put("cameraBatteryDenom", 100) }
        }
        o.put("isRecordingMovie", recording)
        return o
    }

    fun close() {
        wantLiveview = false
        loopJob?.cancel(); eventJob?.cancel()
        try { t?.transaction(0x1003) } catch (_: Exception) {}
        t?.close(); t = null
    }

    companion object {
        private const val TAG = "SonyPtpCamera"
        const val OK = 0x2001
        const val LIVEVIEW_HANDLE = 0xFFFFC002.toInt()
    }
}
