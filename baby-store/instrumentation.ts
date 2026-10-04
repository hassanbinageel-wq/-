// مهام دورية عند تشغيل الخادم: تحرير الحجوزات المنتهية، نسخة احتياطية يومية، تنظيف حدود الطلبات
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const g = globalThis as unknown as { __jobs?: boolean }
  if (g.__jobs) return
  g.__jobs = true
  const { releaseExpiredReservations } = await import('./lib/server/inventory')
  const { autoBackupIfDue } = await import('./lib/server/backup')
  const { cleanupRateLimits } = await import('./lib/server/security')
  const run = async () => {
    try {
      releaseExpiredReservations()
      cleanupRateLimits()
      await autoBackupIfDue()
    } catch (e) {
      console.error('[jobs]', e)
    }
  }
  setTimeout(run, 15_000)
  setInterval(run, 5 * 60_000).unref?.()
}
