package com.hsnpmt.salahalarm

import android.app.Activity
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.chip.Chip
import com.google.android.material.datepicker.MaterialDatePicker
import com.google.android.material.timepicker.MaterialTimePicker
import com.google.android.material.timepicker.TimeFormat
import com.hsnpmt.salahalarm.databinding.ActivityEditAlarmBinding
import java.util.Calendar

/** Create or edit one alarm: label, time, optional date, weekly repeat chips, and alarm sound. */
class EditAlarmActivity : AppCompatActivity() {

    private lateinit var b: ActivityEditAlarmBinding

    private var editingId: Int = -1
    private var hour: Int = 5
    private var minute: Int = 0
    private var dateMillis: Long = -1L
    private var soundUri: String = ""

    private val soundPicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri: Uri? = result.data?.getParcelableExtra(
                RingtoneManager.EXTRA_RINGTONE_PICKED_URI
            )
            if (uri != null) {
                soundUri = uri.toString()
                val title = RingtoneManager.getRingtone(this, uri)?.getTitle(this)
                b.btnSound.text = title ?: "صوت مخصّص"
            } else {
                soundUri = ""
                b.btnSound.text = "الصوت الافتراضي"
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityEditAlarmBinding.inflate(layoutInflater)
        setContentView(b.root)

        editingId = intent.getIntExtra(Const.EXTRA_ALARM_ID, -1)

        b.btnBack.setOnClickListener { finish() }

        if (editingId != -1) {
            AlarmStore.get(this, editingId)?.let { prefill(it) }
            b.tvTitle.text = "تعديل المنبّه"
            b.btnDeleteAlarm.visibility = android.view.View.VISIBLE
        } else {
            updateTimeButton()
        }

        b.btnTime.setOnClickListener { pickTime() }
        b.btnDate.setOnClickListener { pickDate() }
        b.btnClearDate.setOnClickListener {
            dateMillis = -1L
            b.btnDate.text = "بدون تاريخ"
        }
        b.btnSound.setOnClickListener { pickSound() }
        b.btnSave.setOnClickListener { save() }
        b.btnDeleteAlarm.setOnClickListener {
            if (editingId != -1) {
                AlarmScheduler.cancel(this, editingId)
                AlarmStore.remove(this, editingId)
                finish()
            }
        }
    }

    private fun prefill(a: Alarm) {
        b.etLabel.setText(a.label)
        hour = a.hour
        minute = a.minute
        dateMillis = a.dateMillis
        soundUri = a.soundUri
        updateTimeButton()

        if (a.dateMillis > 0) {
            b.btnDate.text = TimeFmt.daysSummary(emptySet(), a.dateMillis)
        }
        if (a.soundUri.isNotBlank()) {
            val title = RingtoneManager.getRingtone(this, Uri.parse(a.soundUri))?.getTitle(this)
            b.btnSound.text = title ?: "صوت مخصّص"
        }

        // Restore selected weekday chips.
        for (i in 0 until b.chipGroup.childCount) {
            val chip = b.chipGroup.getChildAt(i) as? Chip ?: continue
            val tag = (chip.tag as? String)?.toIntOrNull() ?: continue
            chip.isChecked = a.days.contains(tag)
        }
    }

    private fun updateTimeButton() {
        b.btnTime.text = TimeFmt.time12(hour, minute)
    }

    private fun pickTime() {
        val picker = MaterialTimePicker.Builder()
            .setTimeFormat(TimeFormat.CLOCK_12H)
            .setHour(hour)
            .setMinute(minute)
            .setTitleText("اختر وقت الصلاة")
            .build()
        picker.addOnPositiveButtonClickListener {
            hour = picker.hour
            minute = picker.minute
            updateTimeButton()
        }
        picker.show(supportFragmentManager, "time")
    }

    private fun pickDate() {
        val picker = MaterialDatePicker.Builder.datePicker()
            .setTitleText("اختر التاريخ")
            .setSelection(
                if (dateMillis > 0) dateMillis
                else MaterialDatePicker.todayInUtcMilliseconds()
            )
            .build()
        picker.addOnPositiveButtonClickListener { selection ->
            dateMillis = selection
            b.btnDate.text = TimeFmt.daysSummary(emptySet(), dateMillis)
        }
        picker.show(supportFragmentManager, "date")
    }

    private fun pickSound() {
        val i = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
            putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
            putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "اختر صوت المنبّه")
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
            putExtra(
                RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            )
            if (soundUri.isNotBlank()) {
                putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(soundUri))
            }
        }
        soundPicker.launch(i)
    }

    private fun selectedDays(): MutableSet<Int> {
        val set = mutableSetOf<Int>()
        for (i in 0 until b.chipGroup.childCount) {
            val chip = b.chipGroup.getChildAt(i) as? Chip ?: continue
            if (chip.isChecked) {
                (chip.tag as? String)?.toIntOrNull()?.let { set.add(it) }
            }
        }
        return set
    }

    private fun save() {
        val label = b.etLabel.text?.toString()?.trim().orEmpty()
        val days = selectedDays()
        val id = if (editingId != -1) editingId else AlarmStore.nextId(this)

        // Weekly repeat overrides a one-shot date.
        val finalDate = if (days.isNotEmpty()) -1L else dateMillis

        val alarm = Alarm(
            id = id,
            label = label,
            hour = hour,
            minute = minute,
            days = days,
            dateMillis = finalDate,
            soundUri = soundUri,
            enabled = true
        )

        AlarmStore.addOrUpdate(this, alarm)
        AlarmScheduler.schedule(this, alarm)

        Toast.makeText(this, "تم حفظ المنبّه ✓", Toast.LENGTH_SHORT).show()
        finish()
    }
}
