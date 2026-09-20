package com.hsnpmt.sonymonitor.sony

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.util.Log

/**
 * مسؤول عن الاتصال بشبكة Wi‑Fi الخاصة بالكاميرا وربط عملية التطبيق بها.
 *
 * طريقتان:
 *  1) connectToSsid: الاتصال ببيانات معيّنة (من مسح QR أو إدخال يدوي) عبر
 *     WifiNetworkSpecifier (Android 10+). يظهر للنظام حوار موافقة، وعند النجاح
 *     نربط العملية بتلك الشبكة تحديدًا.
 *  2) ensureBound: عندما يكون المستخدم متصلًا مسبقًا بشبكة الكاميرا يدويًا،
 *     نربط العملية بأول شبكة Wi‑Fi متاحة.
 *
 * كائن مفرد (object) ليكون الربط مشتركًا عبر التطبيق (bindProcessToNetwork عامّ للعملية).
 */
object WifiConnector {

    private const val TAG = "WifiConnector"

    @Volatile var boundNetwork: Network? = null
        private set

    private var activeCallback: ConnectivityManager.NetworkCallback? = null

    private fun cm(ctx: Context) =
        ctx.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    /** يربط العملية بأول شبكة Wi‑Fi متاحة إن لم تكن مربوطة. يعيد الشبكة أو null. */
    fun ensureBound(ctx: Context): Network? {
        val c = cm(ctx)
        if (boundNetwork != null) return boundNetwork
        val wifi = c.allNetworks.firstOrNull { n ->
            c.getNetworkCapabilities(n)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        } ?: return null
        return if (c.bindProcessToNetwork(wifi)) { boundNetwork = wifi; wifi } else null
    }

    fun isWifiConnected(ctx: Context): Boolean {
        val c = cm(ctx)
        return c.allNetworks.any { n ->
            c.getNetworkCapabilities(n)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        }
    }

    /**
     * يتصل بشبكة محدّدة. onResult(success, message) يُستدعى مرّة واحدة.
     * pass فارغ ⇒ شبكة مفتوحة.
     */
    fun connectToSsid(ctx: Context, ssid: String, pass: String, onResult: (Boolean, String) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            onResult(false, "الاتصال التلقائي بالشبكة يتطلّب Android 10 أو أحدث. اتصل يدويًا من إعدادات Wi‑Fi ثم اختر «اتصال يدوي».")
            return
        }
        val c = cm(ctx)
        // ألغِ أي طلب سابق
        releaseCallback(c)

        val specBuilder = WifiNetworkSpecifier.Builder().setSsid(ssid)
        if (pass.isNotEmpty()) specBuilder.setWpa2Passphrase(pass)
        val specifier = specBuilder.build()

        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) // شبكة الكاميرا بلا إنترنت
            .setNetworkSpecifier(specifier)
            .build()

        var settled = false
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                c.bindProcessToNetwork(network)
                boundNetwork = network
                if (!settled) { settled = true; onResult(true, ssid) }
                Log.i(TAG, "متصل بشبكة الكاميرا: $ssid")
            }
            override fun onUnavailable() {
                if (!settled) { settled = true; onResult(false, "تعذّر الاتصال بشبكة الكاميرا «$ssid». تأكّد أن الكاميرا تبث الشبكة وأنك وافقت على الطلب.") }
            }
            override fun onLost(network: Network) {
                if (boundNetwork == network) boundNetwork = null
            }
        }
        activeCallback = callback
        try {
            // مهلة 30 ثانية لظهور الشبكة
            c.requestNetwork(request, callback, 30000)
        } catch (e: Exception) {
            if (!settled) { settled = true; onResult(false, e.message ?: "فشل طلب الاتصال") }
        }
    }

    fun unbind(ctx: Context) {
        val c = cm(ctx)
        try { c.bindProcessToNetwork(null) } catch (_: Exception) {}
        releaseCallback(c)
        boundNetwork = null
    }

    private fun releaseCallback(c: ConnectivityManager) {
        activeCallback?.let { try { c.unregisterNetworkCallback(it) } catch (_: Exception) {} }
        activeCallback = null
    }
}
