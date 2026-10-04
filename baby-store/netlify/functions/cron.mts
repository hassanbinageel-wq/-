// دالة مجدولة على Netlify: تشغّل المهام الدورية للمتجر (تحرير الحجوزات المنتهية، النسخة الاحتياطية اليومية)
// وتُبقي قاعدة البيانات نشطة حتى لا تتوقف في الخطة المجانية.
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL
  if (!base) return
  try {
    const res = await fetch(`${base}/api/cron`, { method: 'POST' })
    console.log('[cron]', res.status, await res.text())
  } catch (e) {
    console.error('[cron]', e)
  }
}

export const config = { schedule: '*/10 * * * *' }
