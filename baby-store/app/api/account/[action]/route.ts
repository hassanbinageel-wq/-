import { z } from 'zod'
import { publicRoute, json, readJson } from '@/lib/server/api'
import { ApiError } from '@/lib/server/errors'
import { OWNER_COOKIE, readOwned } from '@/lib/server/order-access'
import {
  CUSTOMER_COOKIE,
  accountFromToken,
  changeAccountPassword,
  claimOwnedOrders,
  loginAccount,
  logoutAccount,
  registerAccount,
  sessionCookie,
  updateProfile,
} from '@/lib/server/customer-auth'

const str = (max: number) => z.string().max(max).optional().nullable()
const profile = {
  name: z.string().max(120),
  country: str(60),
  city: str(60),
  area: str(120),
  address: str(600),
  landmark: str(250),
  mapUrl: str(600),
}

export const POST = publicRoute<{ action: string }>(async ({ req, ip, params }) => {
  const token = req.cookies.get(CUSTOMER_COOKIE)?.value
  const owned = await readOwned(req.cookies.get(OWNER_COOKIE)?.value)

  switch (params.action) {
    case 'register': {
      const b = await readJson(req, z.object({ ...profile, phoneCode: z.string().max(6), phone: z.string().max(30), password: z.string().max(200) }))
      const r = await registerAccount(b, ip)
      await claimOwnedOrders(r.account, owned)
      const res = json({ ok: true, name: r.account.name })
      res.cookies.set(sessionCookie(r.token))
      return res
    }
    case 'login': {
      const b = await readJson(req, z.object({ phoneCode: z.string().max(6), phone: z.string().max(30), password: z.string().max(200) }))
      const r = await loginAccount(b.phoneCode, b.phone, b.password, ip)
      await claimOwnedOrders(r.account, owned)
      const res = json({ ok: true, name: r.account.name })
      res.cookies.set(sessionCookie(r.token))
      return res
    }
    case 'logout': {
      await logoutAccount(token)
      const res = json({ ok: true })
      res.cookies.set({ ...sessionCookie(''), maxAge: 0 })
      return res
    }
    case 'profile': {
      const acct = await accountFromToken(token)
      if (!acct) throw new ApiError(401, 'سجّل الدخول أولاً')
      await updateProfile(acct.id, await readJson(req, z.object(profile)))
      return json({ ok: true })
    }
    case 'password': {
      const acct = await accountFromToken(token)
      if (!acct) throw new ApiError(401, 'سجّل الدخول أولاً')
      const b = await readJson(req, z.object({ current: z.string().max(200), next: z.string().max(200) }))
      await changeAccountPassword(acct.id, b.current, b.next, token)
      return json({ ok: true })
    }
  }
  throw new ApiError(404, 'غير موجود')
})
