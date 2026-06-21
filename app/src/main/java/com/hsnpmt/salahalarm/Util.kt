package com.hsnpmt.salahalarm

import java.util.Calendar
import java.util.Locale

/** Global constants for prefs keys, notification channel, intent actions/extras, and detection tuning. */
object Const {
    const val PREFS = "salah_alarm_prefs"
    const val KEY_ALARMS = "alarms_json"

    const val CHANNEL_ID = "salah_alarm_channel"
    const val NOTIF_ID = 4201

    // Fully-qualified intent actions
    const val ACTION_START = "com.hsnpmt.salahalarm.action.START"
    const val ACTION_STOP = "com.hsnpmt.salahalarm.action.STOP"

    // Intent extras
    const val EXTRA_ALARM_ID = "extra_alarm_id"
    const val EXTRA_LABEL = "extra_label"
    const val EXTRA_SOUND = "extra_sound"
    const val EXTRA_MODE = "extra_mode"

    // Camera screen modes
    const val MODE_DISMISS = "dismiss"   // opened from a ringing alarm; OK result stops it
    const val MODE_PREVIEW = "preview"   // opened from home just to test detection

    /**
     * Keywords that count as "a sink / faucet was seen".
     * ML Kit's default image-labeling model emits English labels like "Sink", "Tap", "Plumbing fixture".
     * Tune this list freely — matching is case-insensitive "contains".
     */
    val DETECT_KEYWORDS = listOf(
        "sink", "tap", "faucet", "basin", "plumb", "bathroom"
    )

    /** Minimum label confidence (0..1) required to accept a detection. */
    const val CONFIDENCE = 0.5f
}

/** Arabic time / day formatting helpers. */
object TimeFmt {

    /** 24h -> "h:mm ص/م" in Arabic. */
    fun time12(hour: Int, minute: Int): String {
        val am = hour < 12
        var h = hour % 12
        if (h == 0) h = 12
        val suffix = if (am) "ص" else "م"
        return String.format(Locale.US, "%d:%02d %s", h, minute, suffix)
    }

    /** Calendar.DAY_OF_WEEK (1=Sun .. 7=Sat) -> Arabic name. */
    val dayNames: Map<Int, String> = mapOf(
        Calendar.SUNDAY to "الأحد",
        Calendar.MONDAY to "الاثنين",
        Calendar.TUESDAY to "الثلاثاء",
        Calendar.WEDNESDAY to "الأربعاء",
        Calendar.THURSDAY to "الخميس",
        Calendar.FRIDAY to "الجمعة",
        Calendar.SATURDAY to "السبت"
    )

    private val weekOrder = listOf(
        Calendar.SUNDAY, Calendar.MONDAY, Calendar.TUESDAY, Calendar.WEDNESDAY,
        Calendar.THURSDAY, Calendar.FRIDAY, Calendar.SATURDAY
    )

    /**
     * Human summary of an alarm's repeat rule.
     * - all 7 days  -> "كل يوم"
     * - some days   -> names joined, e.g. "الأحد، الثلاثاء"
     * - no days but a date -> "yyyy/MM/dd"
     * - nothing     -> "مرة واحدة"
     */
    fun daysSummary(days: Set<Int>, dateMillis: Long): String {
        if (days.isNotEmpty()) {
            if (days.size == 7) return "كل يوم"
            return weekOrder.filter { days.contains(it) }
                .joinToString("، ") { dayNames[it] ?: "" }
        }
        if (dateMillis > 0) {
            val c = Calendar.getInstance()
            c.timeInMillis = dateMillis
            return String.format(
                Locale.US, "%04d/%02d/%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH)
            )
        }
        return "مرة واحدة"
    }
}
