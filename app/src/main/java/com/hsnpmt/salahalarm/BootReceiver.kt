package com.hsnpmt.salahalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Re-arms all enabled alarms after a reboot (alarms don't survive a power cycle on their own). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            AlarmScheduler.scheduleAll(context)
        }
    }
}
