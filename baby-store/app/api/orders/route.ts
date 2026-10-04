import { publicRoute, json, readJson } from '@/lib/server/api'
import { createOrderSchema } from '@/lib/server/schemas'
import { createOrder } from '@/lib/server/orders'
import { getSetting } from '@/lib/server/settings'
import { rateLimit, ipHash } from '@/lib/server/security'
import { ApiError } from '@/lib/server/errors'
import { SESSION_COOKIE, userFromToken, cookieSecure } from '@/lib/server/auth'
import { OWNER_COOKIE, addOwned } from '@/lib/server/order-access'

export const POST = publicRoute(async ({ req, ip }) => {
  const isAdmin = !!await userFromToken(req.cookies.get(SESSION_COOKIE)?.value)
  if ((await getSetting('maintenance')).enabled && !isAdmin) throw new ApiError(503, 'المتجر في وضع الصيانة حالياً. تواصل معنا عبر واتساب')
  const body = await readJson(req, createOrderSchema)
  const limit = (await getSetting('checkout')).ordersPerIpPer10Min
  if (limit > 0 && !(await rateLimit(`order:${ip}`, limit, 600)).ok) {
    throw new ApiError(429, 'تم إنشاء عدة طلبات من هذا الجهاز خلال وقت قصير. حاول بعد دقائق أو تواصل معنا عبر واتساب')
  }
  const r = await createOrder(
      {
        ...body,
        lines: body.lines.map((l) => ({ ...l, variantId: l.variantId ?? null, personalization: l.personalization ?? null })),
      },
      { ipHash: await ipHash(ip) },
    )
  const res = json({ ok: true, token: r.token, number: r.number, existing: r.existing })
  res.cookies.set(OWNER_COOKIE, await addOwned(req.cookies.get(OWNER_COOKIE)?.value, r.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  })
  return res
})
