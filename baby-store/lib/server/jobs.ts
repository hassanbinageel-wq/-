import { db } from './db'
import { releaseExpiredReservations } from './inventory'
import { cleanupRateLimits } from './security'
import { autoBackupIfDue } from './backup'

/**
 * المهام الدورية: تحرير الحجوزات المنتهية، تنظيف حدود الطلبات، النسخة التلقائية اليومية.
 * آمنة للاستدعاء المتكرر؛ تُنفذ فعلياً مرة واحدة على الأكثر كل دقيقة.
 */
export async function runMaintenance(): Promise<{ ran: boolean }> {
  const claimed = await db()
    .prepare(
      `INSERT INTO meta(key,value) VALUES('jobs_last_run', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE meta.value < datetime('now','-55 seconds')
       RETURNING value`,
    )
    .get()
  if (!claimed) return { ran: false }
  try {
    await releaseExpiredReservations()
    await cleanupRateLimits()
    await autoBackupIfDue()
  } catch (e) {
    console.error('[jobs]', e)
  }
  return { ran: true }
}
