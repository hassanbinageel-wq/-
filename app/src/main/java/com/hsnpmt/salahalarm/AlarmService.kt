package com.hsnpmt.salahalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Foreground service that actually rings. It:
 *  - plays the chosen (or default) alarm sound on a loop with USAGE_ALARM
 *  - vibrates on a loop
 *  - holds a wake lock
 *  - posts a full-screen-intent notification that launches AlarmActivity (shows even over the lock screen)
 *  - also starts AlarmActivity directly as a backup
 *
 * It keeps ringing until AlarmActivity confirms a sink/faucet photo and calls stop().
 */
class AlarmService : Service() {

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        /** Convenience: stop the ringing service from anywhere. */
        fun stop(ctx: Context) {
            val i = Intent(ctx, AlarmService::class.java).apply { action = Const.ACTION_STOP }
            ctx.startService(i)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == Const.ACTION_STOP) {
            stopAlarm()
            return START_NOT_STICKY
        }

        val label = intent?.getStringExtra(Const.EXTRA_LABEL) ?: ""
        val sound = intent?.getStringExtra(Const.EXTRA_SOUND) ?: ""

        startForeground(Const.NOTIF_ID, buildNotification(label))
        acquireWakeLock()
        startSound(sound)
        startVibration()

        // Backup: bring the full-screen alarm up directly too.
        val act = Intent(this, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(Const.EXTRA_LABEL, label)
        }
        try { startActivity(act) } catch (_: Exception) { }

        return START_STICKY
    }

    private fun buildNotification(label: String): Notification {
        createChannel()

        val fullScreen = Intent(this, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(Const.EXTRA_LABEL, label)
        }
        val fsPending = PendingIntent.getActivity(
            this, 0, fullScreen,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, Const.CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("منبّه الصلاة")
            .setContentText(if (label.isBlank()) "حان وقت الصلاة" else "حان وقت: $label")
            .setSmallIcon(R.drawable.ic_moon)
            .setCategory(Notification.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fsPending, true)
            .setContentIntent(fsPending)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(Const.CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    Const.CHANNEL_ID,
                    "تنبيهات الصلاة",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "منبّه الصلاة الذي لا يتوقف إلا بتصوير المغسلة"
                    setSound(null, null)   // sound handled by MediaPlayer for reliable looping
                    enableVibration(false) // vibration handled manually
                    setBypassDnd(true)
                }
                nm.createNotificationChannel(channel)
            }
        }
    }

    private fun startSound(soundUri: String) {
        val uri: Uri = when {
            soundUri.isNotBlank() -> Uri.parse(soundUri)
            else -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        }
        try {
            player = MediaPlayer().apply {
                setDataSource(this@AlarmService, uri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {
            // Fallback to the default alarm tone if the chosen uri failed.
            try {
                val fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                player = MediaPlayer().apply {
                    setDataSource(this@AlarmService, fallback)
                    isLooping = true
                    prepare()
                    start()
                }
            } catch (_: Exception) { }
        }
    }

    private fun startVibration() {
        val pattern = longArrayOf(0, 600, 600)
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "salahalarm:ring"
        ).apply { acquire(10 * 60 * 1000L) } // 10-minute safety cap
    }

    private fun stopAlarm() {
        try { player?.stop() } catch (_: Exception) { }
        try { player?.release() } catch (_: Exception) { }
        player = null

        try { vibrator?.cancel() } catch (_: Exception) { }
        vibrator = null

        try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) { }
        wakeLock = null

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }
}
