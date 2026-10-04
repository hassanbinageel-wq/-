import { runMaintenance } from '@/lib/server/jobs'

// تستدعيها الدالة المجدولة كل 10 دقائق. آمنة للاستدعاء العام: لا تكشف بيانات وتُنفذ مرة كل دقيقة على الأكثر.
export async function POST() {
  const r = await runMaintenance()
  return Response.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
export const GET = POST
