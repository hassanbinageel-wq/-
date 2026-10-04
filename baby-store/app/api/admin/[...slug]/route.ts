import type { NextRequest } from 'next/server'
import { adminRoute, json, handleError } from '@/lib/server/api'
import { match } from '@/lib/server/admin/router'
import { ROUTES } from '@/lib/server/admin/routes'
import { PUBLIC_ROUTES } from '@/lib/server/admin/auth-routes'
import { clientIp, sameOrigin } from '@/lib/server/security'
import { ApiError } from '@/lib/server/errors'
import { can } from '@/lib/server/auth'

type P = { slug: string[] }

async function handle(req: NextRequest, ctx: { params: Promise<P> }) {
  const { slug } = await ctx.params
  // مسارات بدون جلسة (تسجيل الدخول والإعداد الأول)
  const pub = match(PUBLIC_ROUTES, req.method, slug)
  if (pub) {
    try {
      if (req.method !== 'GET' && !sameOrigin(req)) throw new ApiError(403, 'طلب مرفوض')
      return await pub.route.handler({ req, user: null as never, ip: clientIp(req.headers), params: pub.params, query: req.nextUrl.searchParams })
    } catch (e) {
      return handleError(e)
    }
  }
  const found = match(ROUTES, req.method, slug)
  if (!found) return json({ ok: false, error: 'المسار غير موجود' }, 404)
  return adminRoute<P>(null, async ({ req: r, user, ip }) => {
    if (found.route.perm && !can(user, found.route.perm)) throw new ApiError(403, 'ليست لديك صلاحية لهذا الإجراء')
    return found.route.handler({ req: r, user, ip, params: found.params, query: r.nextUrl.searchParams })
  })(req, ctx)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
