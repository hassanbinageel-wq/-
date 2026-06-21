package com.hsnpmt.salahalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Fired by AlarmManager at trigger time. Starts the foreground AlarmService (which rings + shows
 * the full-screen alarm), then reschedules: weekly alarms roll to their next day, one-shot alarms
 * are switched off.
 */
class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(Const.EXTRA_ALARM_ID, -1)
        val alarm = if (id != -1) AlarmStore.get(context, id) else null

        if (alarm == null || !alarm.enabled) return

        // Start ringing.
        val svc = Intent(context, AlarmService::class.java).apply {
            action = Const.ACTION_START
            putExtra(Const.EXTRA_ALARM_ID, alarm.id)
            putExtra(Const.EXTRA_LABEL, alarm.label)
            putExtra(Const.EXTRA_SOUND, alarm.soundUri)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, svc)
        } else {
            context.startService(svc)
        }

        // Reschedule or disable.
        if (alarm.days.isNotEmpty()) {
            AlarmScheduler.schedule(context, alarm)
        } else {
            alarm.enabled = false
            AlarmStore.addOrUpdate(context, alarm)
        }
    }
}
