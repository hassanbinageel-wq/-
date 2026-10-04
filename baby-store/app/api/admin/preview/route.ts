import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, userFromToken, can } from '@/lib/server/auth'

// تفعيل/إنهاء معاينة مسودة المظهر (للمالك فقط)
export async function GET(req: NextRequest) {
  const dm = await draftMode()
  const exit = req.nextUrl.searchParams.get('exit')
  if (exit) {
    dm.disable()
    redirect('/admin/appearance')
  }
  const user = userFromToken(req.cookies.get(SESSION_COOKIE)?.value)
  if (!can(user, 'owner')) return new Response('غير مصرح', { status: 403 })
  dm.enable()
  const to = req.nextUrl.searchParams.get('to') || '/'
  redirect(to.startsWith('/') && !to.startsWith('//') ? to : '/')
}
