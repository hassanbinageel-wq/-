package com.hsnpmt.sonymonitor.sony.ptp

import java.nio.ByteBuffer

/**
 * خصائص Sony عبر PTP (SDIO). رموز الخصائص مأخوذة من المراجع المفتوحة (libgphoto2 ptp.h)
 * وتختلف قليلًا بين الأجيال — لذلك نقرأ ما تعلنه الكاميرا فعليًا ولا نفترض وجود أي خاصية.
 */
object SonyProps {
    const val WHITE_BALANCE = 0x5005
    const val F_NUMBER = 0x5007
    const val FOCUS_MODE = 0x500A
    const val EXPOSURE_PROGRAM = 0x500E
    const val EXPOSURE_BIAS = 0x5010
    const val SHUTTER = 0xD20D
    const val COLOR_TEMP = 0xD20F
    const val FOCUS_FOUND = 0xD213
    const val BATTERY = 0xD218
    const val ISO = 0xD21E
    const val S1 = 0xD2C1        // ضغط نصفي
    const val S2 = 0xD2C2        // التقاط
    const val MOVIE_REC = 0xD2C8 // زر تسجيل الفيديو
    const val PRIORITY_KEY = 0xD25A // أولوية الإعداد: الكاميرا/الكمبيوتر (في الأجيال الأحدث)

    class Desc(
        val code: Int,
        val type: Int,
        val writable: Boolean,
        val enabled: Int,
        val current: Long,
        val currentStr: String?,
        val enumValues: List<Long>,
        val rangeMin: Long?, val rangeMax: Long?, val rangeStep: Long?
    )

    /** يحلّل رد 0x9209 (GetAllExtDevicePropInfo). يتحمّل وجود قائمة تعداد ثانية في البروتوكول الأحدث. */
    fun parseAll(data: ByteArray): Map<Int, Desc> {
        val out = LinkedHashMap<Int, Desc>()
        if (data.size < 8) return out
        val bb = PtpIpTransport.le(data)
        val count = bb.long.coerceIn(0L, 2000L).toInt()
        for (i in 0 until count) {
            if (bb.remaining() < 6) break
            try {
                val d = parseOne(bb, i == count - 1) ?: break
                out[d.code] = d
            } catch (e: Exception) { break }
        }
        return out
    }

    private fun parseOne(bb: ByteBuffer, last: Boolean): Desc? {
        val code = bb.short.toInt() and 0xFFFF
        val type = bb.short.toInt() and 0xFFFF
        val getset = bb.get().toInt() and 0xFF
        val enabled = bb.get().toInt() and 0xFF
        readValue(bb, type) // القيمة الافتراضية
        val cur = readValue(bb, type)
        val form = bb.get().toInt() and 0xFF
        var enums: List<Long> = emptyList()
        var mn: Long? = null; var mx: Long? = null; var st: Long? = null
        when (form) {
            1 -> { mn = readValue(bb, type).first; mx = readValue(bb, type).first; st = readValue(bb, type).first }
            2 -> {
                enums = readEnum(bb, type)
                // البروتوكول الأحدث يضيف قائمة ثانية (القيم القابلة للضبط الآن)
                if (!looksLikeNextEntry(bb, last)) {
                    val second = readEnum(bb, type)
                    if (second.isNotEmpty()) enums = second
                }
            }
        }
        return Desc(code, type, getset == 1, enabled, cur.first, cur.second, enums, mn, mx, st)
    }

    private fun readEnum(bb: ByteBuffer, type: Int): List<Long> {
        val n = bb.short.toInt() and 0xFFFF
        return List(n) { readValue(bb, type).first }
    }

    private fun looksLikeNextEntry(bb: ByteBuffer, last: Boolean): Boolean {
        if (last) return bb.remaining() < 2
        if (bb.remaining() < 4) return true
        val p = bb.position()
        val code = bb.getShort(p).toInt() and 0xFFFF
        val type = bb.getShort(p + 2).toInt() and 0xFFFF
        val codeOk = code in 0x5000..0x5FFF || code in 0xD000..0xDFFF
        val typeOk = type in 1..10 || type == 0xFFFF || (type and 0x4000 != 0 && (type and 0xFF) in 1..10)
        return codeOk && typeOk
    }

    /** يعيد (قيمة رقمية، نص إن كانت سلسلة). */
    private fun readValue(bb: ByteBuffer, type: Int): Pair<Long, String?> {
        if (type == 0xFFFF) {
            val n = bb.get().toInt() and 0xFF
            val sb = StringBuilder()
            repeat(n) { val c = bb.short.toInt().toChar(); if (c != '\u0000') sb.append(c) }
            return 0L to sb.toString()
        }
        if (type and 0x4000 != 0) { // مصفوفة
            val n = bb.int
            repeat(n) { readValue(bb, type and 0xFF) }
            return 0L to null
        }
        val v: Long = when (type) {
            1 -> bb.get().toLong()
            2 -> (bb.get().toInt() and 0xFF).toLong()
            3 -> bb.short.toLong()
            4 -> (bb.short.toInt() and 0xFFFF).toLong()
            5 -> bb.int.toLong()
            6 -> bb.int.toLong() and 0xFFFFFFFFL
            7, 8 -> bb.long
            9, 10 -> { val lo = bb.long; bb.long; lo }
            else -> throw IllegalStateException("نوع بيانات غير معروف $type")
        }
        return v to null
    }

    /** ترميز قيمة لإرسالها إلى 0x9205 حسب نوع الخاصية. */
    fun encode(type: Int, v: Long): ByteArray = when (type) {
        1, 2 -> byteArrayOf(v.toByte())
        3, 4 -> PtpIpTransport.le(2).putShort(v.toShort()).array()
        5, 6 -> PtpIpTransport.le(4).putInt(v.toInt()).array()
        else -> PtpIpTransport.le(8).putLong(v).array()
    }

    // ---- تحويل القيم إلى نصوص مفهومة (ومنها العودة عبر خريطة المرشّحات) ----

    fun fnumberLabel(v: Long): String {
        val f = v / 100.0
        return if (f >= 10) "%.0f".format(f) else "%.1f".format(f)
    }

    fun shutterLabel(v: Long): String {
        if (v == 0L || v == 0xFFFFFFFFL) return "BULB"
        val num = (v shr 16) and 0xFFFF
        val den = v and 0xFFFF
        if (den == 0L) return "?"
        return when {
            num == 1L && den > 1 -> "1/$den"
            den == 1L -> "$num\""
            num % den == 0L -> "${num / den}\""
            else -> "%.1f\"".format(num.toDouble() / den)
        }
    }

    fun isoLabel(v: Long): String {
        val base = v and 0xFFFFFF
        if (base == 0xFFFFFFL) return "AUTO"
        val hi = (v shr 24) and 0xFF
        return if (hi != 0L) "$base (NR)" else "$base"
    }

    fun wbLabel(v: Long): String = when (v.toInt()) {
        0x0002 -> "Auto WB"
        0x0004 -> "Daylight"
        0x8011 -> "Shade"
        0x8010 -> "Cloudy"
        0x0006 -> "Incandescent"
        0x8001 -> "Fluorescent: Warm White (-1)"
        0x8002 -> "Fluorescent: Cool White (0)"
        0x8003 -> "Fluorescent: Day White (+1)"
        0x8004 -> "Fluorescent: Daylight (+2)"
        0x8005 -> "Fluorescent: Cool White (+3)"
        0x0007 -> "Flash"
        0x8030 -> "Underwater Auto"
        0x8012 -> "Color Temperature"
        0x8020 -> "Custom 1"
        0x8021 -> "Custom 2"
        0x8022 -> "Custom 3"
        0x8023 -> "Custom"
        else -> "WB 0x%04X".format(v)
    }

    fun exposureModeLabel(v: Long): String = when (v.toInt()) {
        1 -> "Manual Exposure"
        2 -> "Program Auto"
        3 -> "Aperture Priority"
        4 -> "Shutter Priority"
        0x8000 -> "Intelligent Auto"
        0x8001 -> "Superior Auto"
        0x8050 -> "Movie Program Auto"
        0x8051 -> "Movie Aperture Priority"
        0x8052 -> "Movie Shutter Priority"
        0x8053 -> "Movie Manual Exposure"
        else -> "Mode 0x%04X".format(v)
    }

    fun isMovieMode(v: Long): Boolean = v.toInt() in 0x8050..0x808F

    fun focusModeLabel(v: Long): String = when (v.toInt()) {
        1 -> "MF"
        2 -> "AF-S"
        0x8004 -> "AF-C"
        0x8005 -> "AF-A"
        0x8006 -> "DMF"
        else -> "AF"
    }
}
