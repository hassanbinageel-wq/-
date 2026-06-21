package com.hsnpmt.salahalarm

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.hsnpmt.salahalarm.databinding.ActivityMainBinding

/** Home screen: list of alarms, add button, and a camera shortcut to test sink detection. */
class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private lateinit var adapter: AlarmAdapter

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* result ignored; alarms still ring via the foreground service */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        adapter = AlarmAdapter(
            emptyList(),
            onToggle = { id, enabled ->
                AlarmStore.get(this, id)?.let { a ->
                    a.enabled = enabled
                    AlarmStore.addOrUpdate(this, a)
                    if (enabled) AlarmScheduler.schedule(this, a)
                    else AlarmScheduler.cancel(this, id)
                    refresh()
                }
            },
            onClick = { id ->
                val i = Intent(this, EditAlarmActivity::class.java)
                i.putExtra(Const.EXTRA_ALARM_ID, id)
                startActivity(i)
            },
            onDelete = { id -> confirmDelete(id) }
        )

        b.rvAlarms.layoutManager = LinearLayoutManager(this)
        b.rvAlarms.adapter = adapter

        b.fabAdd.setOnClickListener {
            val i = Intent(this, EditAlarmActivity::class.java)
            i.putExtra(Const.EXTRA_ALARM_ID, -1)
            startActivity(i)
        }

        b.btnCamera.setOnClickListener {
            val i = Intent(this, CameraActivity::class.java)
            i.putExtra(Const.EXTRA_MODE, Const.MODE_PREVIEW)
            startActivity(i)
        }

        requestNotificationPermission()
        checkExactAlarmPermission()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun refresh() {
        val list = AlarmStore.load(this).sortedWith(compareBy({ it.hour }, { it.minute }))
        adapter.update(list)
        b.emptyView.visibility = if (list.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
        b.rvAlarms.visibility = if (list.isEmpty()) android.view.View.GONE else android.view.View.VISIBLE
    }

    private fun confirmDelete(id: Int) {
        AlertDialog.Builder(this)
            .setTitle("حذف المنبّه")
            .setMessage("متأكد أنك تبي تحذف هذا المنبّه؟")
            .setPositiveButton("حذف") { _, _ ->
                AlarmScheduler.cancel(this, id)
                AlarmStore.remove(this, id)
                refresh()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun checkExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!am.canScheduleExactAlarms()) {
                AlertDialog.Builder(this)
                    .setTitle("إذن التنبيهات الدقيقة")
                    .setMessage("عشان يشتغل المنبّه بالضبط في وقته، فعّل إذن \"التنبيهات والتذكيرات\" للتطبيق.")
                    .setPositiveButton("فتح الإعدادات") { _, _ ->
                        try {
                            val i = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(i)
                        } catch (_: Exception) {
                            startActivity(Intent(Settings.ACTION_SETTINGS))
                        }
                    }
                    .setNegativeButton("لاحقًا", null)
                    .show()
            }
        }
    }
}
