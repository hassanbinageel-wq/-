// على خادم دائم (npm start / Docker) تُشغَّل المهام الدورية داخل العملية نفسها.
// على الاستضافة السحابية (Netlify) تُشغّلها دالة مجدولة تستدعي /api/cron (netlify/functions/cron.mts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.DISABLE_INTERNAL_JOBS) return
  if (process.env.NETLIFY || process.env.SITE_ID || process.env.AWS_LAMBDA_FUNCTION_NAME) return
  const g = globalThis as unknown as { __jobs?: boolean }
  if (g.__jobs) return
  g.__jobs = true
  const { runMaintenance } = await import('./lib/server/jobs')
  setTimeout(() => void runMaintenance(), 15_000)
  setInterval(() => void runMaintenance(), 5 * 60_000).unref?.()
}
