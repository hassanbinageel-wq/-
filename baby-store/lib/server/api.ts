import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { SESSION_COOKIE, can, userFromToken, type AdminUser } from './auth'
import { clientIp, sameOrigin } from './security'
import type { Permission } from '../shared/constants'

import { ApiError } from './errors'
export { ApiError }

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...(headers || {}) } })
}

function zodMessage(err: z.ZodError): string {
  const first = err.issues[0]
  if (!first) return 'بيانات غير صالحة'
  const field = first.path.join('.')
  const msg = first.message && !/^(Invalid|Expected|Too|String|Number)/.test(first.message) ? first.message : 'قيمة غير صالحة'
  return field ? `${msg} (${field})` : msg
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) return json({ ok: false, error: e.message, code: e.code, ...(e.extra || {}) }, e.status)
  if (e instanceof z.ZodError) return json({ ok: false, error: zodMessage(e), code: 'VALIDATION' }, 400)
  if (e && typeof e === 'object' && 'code' in e && String((e as { code: string }).code).startsWith('SQLITE_CONSTRAINT_UNIQUE')) {
    return json({ ok: false, error: 'القيمة مستخدمة مسبقاً (يجب أن تكون فريدة)', code: 'DUPLICATE' }, 409)
  }
  console.error('[api error]', e)
  return json({ ok: false, error: 'حدث خطأ غير متوقع. حاول مرة أخرى', code: 'SERVER' }, 500)
}

type Ctx<P> = { params: Promise<P> }

export type AdminHandler<P> = (args: { req: NextRequest; user: AdminUser; ip: string; params: P }) => Promise<Response> | Response

/** غلاف لمسارات لوحة التحكم: جلسة + صلاحية + حماية CSRF + معالجة أخطاء */
export function adminRoute<P = Record<string, string>>(perm: Permission | Permission[] | null, handler: AdminHandler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) throw new ApiError(403, 'طلب مرفوض (مصدر غير موثوق)')
      const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value)
      if (!user) throw new ApiError(401, 'انتهت الجلسة، يرجى تسجيل الدخول')
      if (perm && !can(user, perm)) throw new ApiError(403, 'ليست لديك صلاحية لهذا الإجراء')
      const params = (ctx?.params ? await ctx.params : {}) as P
      return await handler({ req, user, ip: clientIp(req.headers), params })
    } catch (e) {
      return handleError(e)
    }
  }
}

export type PublicHandler<P> = (args: { req: NextRequest; ip: string; params: P }) => Promise<Response> | Response

export function publicRoute<P = Record<string, string>>(handler: PublicHandler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) throw new ApiError(403, 'طلب مرفوض')
      const params = (ctx?.params ? await ctx.params : {}) as P
      return await handler({ req, ip: clientIp(req.headers), params })
    } catch (e) {
      return handleError(e)
    }
  }
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError(400, 'صيغة البيانات غير صحيحة')
  }
  return schema.parse(body)
}

export async function readFile(req: Request, field = 'file'): Promise<{ buf: Buffer; name: string; form: FormData }> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new ApiError(400, 'تعذر قراءة الملف المرفوع')
  }
  const f = form.get(field)
  if (!f || typeof f === 'string') throw new ApiError(400, 'لم يتم اختيار ملف')
  const file = f as File
  if (file.size > 6 * 1024 * 1024) throw new ApiError(413, 'حجم الملف أكبر من 5 ميجابايت')
  return { buf: Buffer.from(await file.arrayBuffer()), name: file.name || 'file', form }
}
