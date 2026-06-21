package com.hsnpmt.salahalarm

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.hsnpmt.salahalarm.databinding.ActivityAlarmBinding
import java.util.Locale

/**
 * Full-screen alarm screen. Shows over the lock screen, can't be dismissed with Back,
 * and the ONLY way out is to photograph a sink/faucet via CameraActivity.
 */
class AlarmActivity : AppCompatActivity() {

    private lateinit var b: ActivityAlarmBinding
    private val clockHandler = Handler(Looper.getMainLooper())
    private var clockRunnable: Runnable? = null

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            // Sink confirmed -> kill the alarm and leave.
            AlarmService.stop(this)
            finishAndRemoveTask()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()

        b = ActivityAlarmBinding.inflate(layoutInflater)
        setContentView(b.root)

        val label = intent.getStringExtra(Const.EXTRA_LABEL) ?: ""
        b.tvAlarmLabel.text = label

        b.btnOpenCamera.setOnClickListener {
            val i = Intent(this, CameraActivity::class.java).apply {
                putExtra(Const.EXTRA_MODE, Const.MODE_DISMISS)
            }
            cameraLauncher.launch(i)
        }

        startClock()
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
    }

    private fun startClock() {
        clockRunnable = object : Runnable {
            override fun run() {
                val c = java.util.Calendar.getInstance()
                b.tvClock.text = String.format(
                    Locale.US, "%02d:%02d:%02d",
                    c.get(java.util.Calendar.HOUR_OF_DAY),
                    c.get(java.util.Calendar.MINUTE),
                    c.get(java.util.Calendar.SECOND)
                )
                clockHandler.postDelayed(this, 1000)
            }
        }
        clockHandler.post(clockRunnable!!)
    }

    @Deprecated("Back is intentionally disabled on the alarm screen")
    override fun onBackPressed() {
        // Do nothing: the alarm can only be dismissed by photographing the sink.
    }

    override fun onDestroy() {
        clockRunnable?.let { clockHandler.removeCallbacks(it) }
        super.onDestroy()
    }
}
