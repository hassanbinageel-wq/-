package com.hsnpmt.sonymonitor.sony

import android.content.Context
import android.util.Base64
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * معرض الكاميرا: استعراض البطاقة (UPnP)، جلب المصغّرات، واستيراد الأصل إلى الهاتف مع تقدّم.
 * الأحداث: gallery / thumb / import (تُمرّر للويب عبر emit).
 */
class MediaManager(context: Context, private val emit: (String, JSONObject) -> Unit) {
    private val ctx = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val thumbGate = Semaphore(3)
    @Volatile private var server: UpnpBrowser.Server? = null

    fun browse() {
        scope.launch {
            try {
                WifiConnector.ensureBound(ctx)
                emit("gallery", JSONObject().put("state", "searching"))
                val srv = server ?: UpnpBrowser.discover(http)
                if (srv == null) {
                    emit("gallery", JSONObject().put("state", "error").put("message",
                        "لم يُعثر على خادم ملفات الكاميرا. في a7 III وأغلب كاميرات Sony لا تُتاح ملفات البطاقة أثناء وضع «التحكّم بالهاتف». " +
                        "على الكاميرا: MENU ← الشبكة ← «إرسال إلى الهاتف الذكي» ← «اختيار على هذا الجهاز/Select on This Device»، ثم اتصل بشبكتها وأعد المحاولة."))
                    return@launch
                }
                server = srv
                emit("gallery", JSONObject().put("state", "listing").put("server", srv.friendlyName))
                val items = UpnpBrowser.listAll(http, srv)
                val arr = JSONArray()
                items.forEach {
                    arr.put(JSONObject().put("id", it.id).put("title", it.title).put("kind", it.kind)
                        .put("date", it.date).put("mime", it.mime).put("url", it.url)
                        .put("thumb", it.thumbUrl ?: JSONObject.NULL).put("size", it.size)
                        .put("imported", MediaStoreSaver.existing(ctx, it.title, it.size) ?: JSONObject.NULL))
                }
                emit("gallery", JSONObject().put("state", "done").put("server", srv.friendlyName).put("items", arr))
            } catch (e: Exception) {
                server = null
                emit("gallery", JSONObject().put("state", "error").put("message", "فشل الاستعراض: ${e.message}"))
            }
        }
    }

    fun thumb(id: String, url: String) {
        scope.launch {
            thumbGate.withPermit {
                try {
                    val bytes = get(url)
                    val small = if (bytes.size > 60_000) MediaStoreSaver.downscaleJpeg(bytes, 320) else bytes
                    emit("thumb", JSONObject().put("id", id).put("b64", Base64.encodeToString(small, Base64.NO_WRAP)))
                } catch (e: Exception) {
                    emit("thumb", JSONObject().put("id", id).put("error", e.message ?: "?"))
                }
            }
        }
    }

    /** استيراد الأصل كما هو. size=0 إن كان غير معروف. */
    fun import(id: String, url: String, name: String, mime: String, size: Long) {
        scope.launch {
            try {
                WifiConnector.ensureBound(ctx)
                MediaStoreSaver.existing(ctx, name, size)?.let { uri ->
                    emit("import", JSONObject().put("id", id).put("ok", true).put("done", true).put("dup", true).put("uri", uri))
                    return@launch
                }
                http.newCall(Request.Builder().url(url).get().build()).execute().use { r ->
                    if (!r.isSuccessful) throw IllegalStateException("HTTP ${r.code}")
                    val body = r.body ?: throw IllegalStateException("لا بيانات")
                    val total = if (size > 0) size else body.contentLength()
                    var lastPct = -1
                    val uri = MediaStoreSaver.save(ctx, name, mime.ifEmpty { body.contentType()?.toString() ?: "image/jpeg" }, size, body.byteStream()) { done ->
                        val pct = if (total > 0) ((done * 100) / total).toInt().coerceIn(0, 100) else -1
                        if (pct != lastPct) { lastPct = pct; emit("import", JSONObject().put("id", id).put("pct", pct).put("bytes", done)) }
                    }
                    emit("import", JSONObject().put("id", id).put("ok", true).put("done", true).put("uri", uri))
                }
            } catch (e: Exception) {
                emit("import", JSONObject().put("id", id).put("ok", false).put("done", true).put("message", e.message ?: "فشل الاستيراد"))
            }
        }
    }

    private fun get(url: String): ByteArray =
        http.newCall(Request.Builder().url(url).get().build()).execute().use { r ->
            if (!r.isSuccessful) throw IllegalStateException("HTTP ${r.code}")
            r.body?.bytes() ?: throw IllegalStateException("فارغ")
        }
}
