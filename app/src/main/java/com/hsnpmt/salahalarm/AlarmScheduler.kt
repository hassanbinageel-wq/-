package com.hsnpmt.salahalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * Schedules alarms with AlarmManager.setAlarmClock(), which is the most reliable
 * exact-alarm path: it survives Doze and shows the system "next alarm" chip.
 */
object AlarmScheduler {

    private fun am(ctx: Context) =
        ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    /** Broadcast PendingIntent that fires AlarmReceiver for this alarm. */
    private fun firePendingIntent(ctx: Context, alarm: Alarm): PendingIntent {
        val i = Intent(ctx, AlarmReceiver::class.java).apply {
            action = Const.ACTION_START
            putExtra(Const.EXTRA_ALARM_ID, alarm.id)
            putExtra(Const.EXTRA_LABEL, alarm.label)
            putExtra(Const.EXTRA_SOUND, alarm.soundUri)
        }
        return PendingIntent.getBroadcast(
            ctx, alarm.id, i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** PendingIntent used as the AlarmClockInfo "show" intent (tapping the system chip opens the app). */
    private fun showPendingIntent(ctx: Context, alarm: Alarm): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            ctx, 100000 + alarm.id, i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun scheduleAll(ctx: Context) {
        for (a in AlarmStore.load(ctx)) {
            if (a.enabled) schedule(ctx, a) else cancel(ctx, a.id)
        }
    }

    fun schedule(ctx: Context, alarm: Alarm) {
        if (!alarm.enabled) { cancel(ctx, alarm.id); return }
        val trigger = nextTrigger(alarm) ?: return
        val info = AlarmManager.AlarmClockInfo(trigger, showPendingIntent(ctx, alarm))
        try {
            am(ctx).setAlarmClock(info, firePendingIntent(ctx, alarm))
        } catch (_: SecurityException) {
            // Exact-alarm permission not granted yet; MainActivity prompts the user to grant it.
        }
    }

    fun cancel(ctx: Context, id: Int) {
        val i = Intent(ctx, AlarmReceiver::class.java).apply { action = Const.ACTION_START }
        val pi = PendingIntent.getBroadcast(
            ctx, id, i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am(ctx).cancel(pi)
    }

    /**
     * Next fire time in epoch millis, or null if it can't be computed.
     *  - weekly (days set): the soonest matching weekday within the next 7 days
     *  - one-shot date: that calendar day at the chosen time (date taken from a UTC-midnight picker,
     *    so we read Y/M/D in UTC then rebuild in the LOCAL zone to avoid an off-by-one-day shift)
     *  - neither: today at the time, or tomorrow if it already passed
     */
    fun nextTrigger(alarm: Alarm): Long? {
        val now = Calendar.getInstance()

        if (alarm.days.isNotEmpty()) {
            for (offset in 0..7) {
                val c = Calendar.getInstance().apply {
                    add(Calendar.DAY_OF_YEAR, offset)
                    set(Calendar.HOUR_OF_DAY, alarm.hour)
                    set(Calendar.MINUTE, alarm.minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                if (alarm.days.contains(c.get(Calendar.DAY_OF_WEEK)) && c.after(now)) {
                    return c.timeInMillis
                }
            }
            return null
        }

        if (alarm.dateMillis > 0) {
            val utc = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
                timeInMillis = alarm.dateMillis
            }
            val local = Calendar.getInstance().apply {
                set(Calendar.YEAR, utc.get(Calendar.YEAR))
                set(Calendar.MONTH, utc.get(Calendar.MONTH))
                set(Calendar.DAY_OF_MONTH, utc.get(Calendar.DAY_OF_MONTH))
                set(Calendar.HOUR_OF_DAY, alarm.hour)
                set(Calendar.MINUTE, alarm.minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            return local.timeInMillis
        }

        val c = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, alarm.hour)
            set(Calendar.MINUTE, alarm.minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (!c.after(now)) c.add(Calendar.DAY_OF_YEAR, 1)
        return c.timeInMillis
    }
}
