package com.hsnpmt.salahalarm

/**
 * A single alarm.
 *
 * @param id          unique id (also used as the AlarmManager request code)
 * @param label       user label, e.g. "الفجر"
 * @param hour        0..23
 * @param minute      0..59
 * @param days        Calendar.DAY_OF_WEEK values (1=Sun..7=Sat). If non-empty -> weekly repeat.
 * @param dateMillis  optional one-shot calendar date (UTC midnight from the date picker). -1 = none.
 * @param soundUri    ringtone uri string; empty = default alarm sound.
 * @param enabled     whether scheduling is active.
 */
data class Alarm(
    val id: Int,
    var label: String,
    var hour: Int,
    var minute: Int,
    var days: MutableSet<Int> = mutableSetOf(),
    var dateMillis: Long = -1L,
    var soundUri: String = "",
    var enabled: Boolean = true
)
