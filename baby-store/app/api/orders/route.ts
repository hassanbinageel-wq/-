import { publicRoute, json, readJson } from '@/lib/server/api'
import { createOrderSchema } from '@/lib/server/schemas'
import { createOrder } from '@/lib/server/orders'
import { getSetting } from '@/lib/server/settings'
import { rateLimit, ipHash } from '@/lib/server/security'
import { ApiError } from '@/lib/server/errors'
import { SESSION_COOKIE, userFromToken, cookieSecure } from '@/lib/server/auth'
import { OWNER_COOKIE, addOwned } from '@/lib/server/order-access'
import { CURRENCY_COOKIE } from '@/lib/server/currency'
import { CUSTOMER_COOKIE, accountFromToken, registerAccount, rememberAddress, sessionCookie, claimOwnedOrders } from '@/lib/server/customer-auth'

export const POST = publicRoute(async ({ req, ip }) => {
  const isAdmin = !!await userFromToken(req.cookies.get(SESSION_COOKIE)?.value)
  if ((await getSetting('maintenance')).enabled && !isAdmin) throw new ApiError(503, 'المتجر في وضع الصيانة حالياً. تواصل معنا عبر واتساب')
  const body = await readJson(req, createOrderSchema)
  const limit = (await getSetting('checkout')).ordersPerIpPer10Min
  if (limit > 0 && !(await rateLimit(`order:${ip}`, limit, 600)).ok) {
    throw new ApiError(429, 'تم إنشاء عدة طلبات من هذا الجهاز خلال وقت قصير. حاول بعد دقائق أو تواصل معنا عبر واتساب')
  }
  const account = await accountFromToken(req.cookies.get(CUSTOMER_COOKIE)?.value)
  const r = await createOrder(
      {
        ...body,
        lines: body.lines.map((l) => ({ ...l, variantId: l.variantId ?? null, personalization: l.personalization ?? null })),
      },
      {
        ipHash: await ipHash(ip),
        currencyId: req.cookies.get(CURRENCY_COOKIE)?.value || null,
        accountId: account?.id ?? null,
      },
    )
  const c = body.customer
  const savedProfile = {
    name: c.name,
    ...(body.fulfillment === 'delivery' && !body.gift?.toRecipient
      ? { country: c.country, city: c.city, area: c.area, address: c.address, landmark: c.landmark, mapUrl: c.mapUrl }
      : {}),
  }
  // حفظ البيانات في الحساب: للمسجل نحدّث عنوانه، وللزائر الذي اختار كلمة مرور ننشئ حساباً (لا يفشل الطلب إن تعذر ذلك)
  let accountNote: string | null = null
  let newSession: string | null = null
  if (account && !r.existing) await rememberAddress(account.id, savedProfile)
  else if (!account && body.accountPassword && !r.existing) {
    try {
      const reg = await registerAccount({ ...savedProfile, phoneCode: c.phoneCode, phone: c.phone, password: body.accountPassword }, ip)
      await claimOwnedOrders(reg.account, [r.id])
      newSession = reg.token
    } catch (e) {
      accountNote = e instanceof ApiError ? e.message : 'تعذر إنشاء الحساب، ويمكنك إنشاؤه لاحقاً من صفحة حسابي'
    }
  }
  const res = json({ ok: true, token: r.token, number: r.number, existing: r.existing, accountCreated: !!newSession, accountNote })
  if (newSession) res.cookies.set(sessionCookie(newSession))
  res.cookies.set(OWNER_COOKIE, await addOwned(req.cookies.get(OWNER_COOKIE)?.value, r.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  })
  return res
})
