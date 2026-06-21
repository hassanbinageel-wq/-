package com.hsnpmt.salahalarm

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.hsnpmt.salahalarm.databinding.ItemAlarmBinding

/**
 * RecyclerView adapter for the alarm list.
 *
 * @param onToggle  enabled switch flipped (id, isEnabled)
 * @param onClick   card tapped (open editor) -> id
 * @param onDelete  delete icon tapped -> id
 */
class AlarmAdapter(
    private var items: List<Alarm>,
    private val onToggle: (Int, Boolean) -> Unit,
    private val onClick: (Int) -> Unit,
    private val onDelete: (Int) -> Unit
) : RecyclerView.Adapter<AlarmAdapter.VH>() {

    inner class VH(val v: ItemAlarmBinding) : RecyclerView.ViewHolder(v.root)

    fun update(newItems: List<Alarm>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val binding = ItemAlarmBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return VH(binding)
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val a = items[position]
        with(holder.v) {
            tvTime.text = TimeFmt.time12(a.hour, a.minute)
            tvLabel.text = if (a.label.isBlank()) "منبّه صلاة" else a.label
            tvDays.text = TimeFmt.daysSummary(a.days, a.dateMillis)

            // Detach listener before setting state to avoid a feedback loop while recycling.
            swEnabled.setOnCheckedChangeListener(null)
            swEnabled.isChecked = a.enabled
            swEnabled.setOnCheckedChangeListener { _, isChecked ->
                onToggle(a.id, isChecked)
            }

            root.setOnClickListener { onClick(a.id) }
            btnDelete.setOnClickListener { onDelete(a.id) }
        }
    }
}
