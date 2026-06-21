package com.hsnpmt.salahalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persists the alarm list in SharedPreferences as a JSON array.
 * Uses org.json (built into Android) so there is no extra dependency.
 */
object AlarmStore {

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(Const.PREFS, Context.MODE_PRIVATE)

    fun load(ctx: Context): MutableList<Alarm> {
        val raw = prefs(ctx).getString(Const.KEY_ALARMS, null) ?: return mutableListOf()
        val list = mutableListOf<Alarm>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val daysArr = o.optJSONArray("days") ?: JSONArray()
                val days = mutableSetOf<Int>()
                for (j in 0 until daysArr.length()) days.add(daysArr.getInt(j))
                list.add(
                    Alarm(
                        id = o.getInt("id"),
                        label = o.optString("label", ""),
                        hour = o.getInt("hour"),
                        minute = o.getInt("minute"),
                        days = days,
                        dateMillis = o.optLong("dateMillis", -1L),
                        soundUri = o.optString("soundUri", ""),
                        enabled = o.optBoolean("enabled", true)
                    )
                )
            }
        } catch (_: Exception) {
            // Corrupt data -> start clean rather than crash.
            return mutableListOf()
        }
        return list
    }

    fun save(ctx: Context, alarms: List<Alarm>) {
        val arr = JSONArray()
        for (a in alarms) {
            val o = JSONObject()
            o.put("id", a.id)
            o.put("label", a.label)
            o.put("hour", a.hour)
            o.put("minute", a.minute)
            val daysArr = JSONArray()
            for (d in a.days) daysArr.put(d)
            o.put("days", daysArr)
            o.put("dateMillis", a.dateMillis)
            o.put("soundUri", a.soundUri)
            o.put("enabled", a.enabled)
            arr.put(o)
        }
        prefs(ctx).edit().putString(Const.KEY_ALARMS, arr.toString()).apply()
    }

    fun get(ctx: Context, id: Int): Alarm? = load(ctx).firstOrNull { it.id == id }

    /** Insert or replace by id. */
    fun addOrUpdate(ctx: Context, alarm: Alarm) {
        val list = load(ctx)
        val idx = list.indexOfFirst { it.id == alarm.id }
        if (idx >= 0) list[idx] = alarm else list.add(alarm)
        save(ctx, list)
    }

    fun remove(ctx: Context, id: Int) {
        val list = load(ctx)
        list.removeAll { it.id == id }
        save(ctx, list)
    }

    /** Next free id (max + 1), starting at 1. */
    fun nextId(ctx: Context): Int = (load(ctx).maxOfOrNull { it.id } ?: 0) + 1
}
