package com.hsnpmt.sonymonitor.sony

/**
 * يحلّل محتوى رمز QR الخاص بشبكة Wi‑Fi.
 *
 * يدعم:
 *  - الصيغة القياسية:  WIFI:S:<ssid>;T:WPA;P:<password>;H:false;;
 *  - صيغة Sony:        W01:S:<ssid>;P:<password>;C:...;  (وكذلك W02)
 *
 * نستخرج قيمة المفتاح S (اسم الشبكة) و P (كلمة المرور). أسماء شبكات Sony قد
 * تحتوي ':' (مثل DIRECT-xxxx:ILCE-7M3) لكنها لا تحتوي ';'، لذا نقرأ حتى ';'.
 */
object WifiQr {

    data class Creds(val ssid: String, val password: String)

    fun parse(raw: String?): Creds? {
        if (raw.isNullOrBlank()) return null
        val text = raw.trim()
        val ssid = capture(text, "S:") ?: return null
        if (ssid.isEmpty()) return null
        val pass = capture(text, "P:") ?: ""
        return Creds(unescape(ssid), unescape(pass))
    }

    /** يبحث عن "<key>" ويقرأ القيمة حتى أول ';' غير مهرّب. */
    private fun capture(text: String, key: String): String? {
        val idx = text.indexOf(key)
        if (idx < 0) return null
        val start = idx + key.length
        val sb = StringBuilder()
        var i = start
        while (i < text.length) {
            val ch = text[i]
            if (ch == '\\' && i + 1 < text.length) { sb.append(ch).append(text[i + 1]); i += 2; continue }
            if (ch == ';') break
            sb.append(ch); i++
        }
        return sb.toString()
    }

    /** فكّ تهريب الأحرف \; \: \\ \, حسب صيغة WIFI QR. */
    private fun unescape(s: String): String {
        val sb = StringBuilder(s.length)
        var i = 0
        while (i < s.length) {
            val ch = s[i]
            if (ch == '\\' && i + 1 < s.length) { sb.append(s[i + 1]); i += 2 }
            else { sb.append(ch); i++ }
        }
        return sb.toString()
    }
}
