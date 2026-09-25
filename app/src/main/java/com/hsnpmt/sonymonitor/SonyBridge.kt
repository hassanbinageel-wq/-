package com.hsnpmt.sonymonitor

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.BatteryManager
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.hsnpmt.sonymonitor.sony.CameraController
import com.hsnpmt.sonymonitor.sony.MediaManager
import com.hsnpmt.sonymonitor.sony.WifiConnector
import org.json.JSONObject

/**
 * جسر بين واجهة الويب (JavaScript) والطبقة الأصلية (Kotlin).
 *
 * كل الدوال الموسومة بـ @JavascriptInterface يمكن استدعاؤها من الويب عبر
 * window.SonyBridge.*(). والأحداث/الإطارات القادمة من الكاميرا تُدفع إلى الويب
 * عبر window.__sonyEvent(...) و window.__sonyFrame(...).
 */
class SonyBridge(
    private val context: Context,
    private val webView: WebView,
    private val onKeepScreenOn: (Boolean) -> Unit,
    private val onScanQr: () -> Unit
) : CameraController.Callback {

    private val main = Handler(Looper.getMainLooper())
    private val controller = CameraController(context, this)
    private val media = MediaManager(context) { t, j -> onEvent(t, j) }

    // -------- الاتصال بشبكة الكاميرا (QR / يدوي) --------

    /** يفتح شاشة مسح رمز QR الخاص بشبكة الكاميرا. النتيجة تصل عبر onWifiScanResult. */
    @JavascriptInterface fun scanQrConnect() { main.post { onScanQr() } }

    /** اتصال يدوي بشبكة معيّنة (إدخال SSID وكلمة المرور). */
    @JavascriptInterface fun connectWifi(ssid: String, password: String) = connectWifiInternal(ssid, password)

    /** قطع الاتصال بالشبكة وفكّ الربط. */
    @JavascriptInterface fun disconnectWifi() {
        WifiConnector.unbind(context)
        onEvent("wifi", JSONObject().put("state", "disconnected"))
    }

    /** يُستدعى من MainActivity بعد مسح QR. */
    fun onWifiScanResult(ssid: String?, password: String?) {
        if (ssid.isNullOrBlank()) { onEvent("wifi", JSONObject().put("state", "cancelled")); return }
        connectWifiInternal(ssid, password ?: "")
    }

    private fun connectWifiInternal(ssid: String, password: String) {
        onEvent("wifi", JSONObject().put("state", "connecting").put("ssid", ssid))
        WifiConnector.connectToSsid(context, ssid, password) { ok, msg ->
            if (ok) onEvent("wifi", JSONObject().put("state", "connected").put("ssid", ssid))
            else onEvent("wifi", JSONObject().put("state", "failed").put("message", msg))
        }
    }

    // -------- أوامر من الويب إلى الأصل --------

    @JavascriptInterface fun connect() = controller.connect()
    @JavascriptInterface fun disconnect() = controller.disconnect()
    @JavascriptInterface fun startLiveview() = controller.startLiveview()
    @JavascriptInterface fun stopLiveview() = controller.stopLiveview()
    @JavascriptInterface fun takePicture() = controller.takePicture()
    @JavascriptInterface fun startMovieRec() = controller.startMovieRec()
    @JavascriptInterface fun stopMovieRec() = controller.stopMovieRec()
    @JavascriptInterface fun setSetting(kind: String, value: String) = controller.setSetting(kind, value)
    @JavascriptInterface fun touchFocus(x: Int, y: Int) = controller.touchFocus(x, y)
    @JavascriptInterface fun refreshStatus() = controller.refreshStatus()

    // -------- معرض الكاميرا --------
    @JavascriptInterface fun browseMedia() = media.browse()
    @JavascriptInterface fun getThumb(id: String, url: String) = media.thumb(id, url)
    @JavascriptInterface fun importMedia(id: String, url: String, name: String, mime: String, size: String) =
        media.import(id, url, name, mime, size.toLongOrNull() ?: 0L)

    /** فتح ملف مستورد في تطبيق العرض الافتراضي (صور/فيديو). */
    @JavascriptInterface fun openMedia(uri: String, mime: String) {
        main.post {
            try {
                val i = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(Uri.parse(uri), mime.ifEmpty { "*/*" })
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(i)
            } catch (e: Exception) {
                onEvent("import", JSONObject().put("ok", false).put("message", "لا يوجد تطبيق لفتح الملف: ${e.message}"))
            }
        }
    }

    @JavascriptInterface fun keepScreenOn(on: Boolean) { main.post { onKeepScreenOn(on) } }

    /** حالة الهاتف: البطارية والمساحة المتاحة — لعرضها في المونيتور. */
    @JavascriptInterface fun getPhoneStatus(): String {
        val out = JSONObject()
        try {
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            out.put("batteryPct", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
            val status = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val plugged = status?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
            out.put("charging", plugged != 0)
        } catch (_: Exception) {}
        try {
            val stat = StatFs(context.filesDir.absolutePath)
            out.put("freeBytes", stat.availableBytes)
            out.put("totalBytes", stat.totalBytes)
        } catch (_: Exception) {}
        return out.toString()
    }

    fun release() = controller.release()

    // -------- أحداث/إطارات من الأصل إلى الويب --------

    override fun onEvent(type: String, json: JSONObject) {
        val payload = json.toString()
        // نمرّر النص كوسيط JSON آمن عبر ترميزه كسلسلة
        val js = "window.__sonyEvent && window.__sonyEvent(${jsString(type)}, ${jsString(payload)});"
        main.post { webView.evaluateJavascript(js, null) }
    }

    override fun onFrame(jpeg: ByteArray, sequence: Int, cameraTsMs: Long) {
        val b64 = Base64.encodeToString(jpeg, Base64.NO_WRAP)
        val arrival = System.currentTimeMillis()
        val js = "window.__sonyFrame && window.__sonyFrame(${jsString(b64)}, $sequence, $cameraTsMs, $arrival);"
        main.post { webView.evaluateJavascript(js, null) }
    }

    /** ترميز سلسلة كـ JSON literal آمن للحقن في JS. */
    private fun jsString(s: String): String {
        val sb = StringBuilder(s.length + 2)
        sb.append('"')
        for (c in s) {
            when (c) {
                '\\' -> sb.append("\\\\")
                '"' -> sb.append("\\\"")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                ' ' -> sb.append("\\u2028")
                ' ' -> sb.append("\\u2029")
                else -> if (c < ' ') sb.append("\\u%04x".format(c.code)) else sb.append(c)
            }
        }
        sb.append('"')
        return sb.toString()
    }
}
