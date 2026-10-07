import { cookies } from 'next/headers'
import { db, nowSql } from './db'
import { hashPassword, verifyPassword, randomToken, sha256, rateLimit } from './security'
import { ApiError } from './errors'
import { cookieSecure } from './auth'
import { validatePhone } from '../shared/phone'

// حسابات العملاء: الدخول برقم الجوال وكلمة مرور. لا يوجد تحقق برسائل SMS،
// لذلك لا تُربط بالحساب إلا الطلبات التي أُنشئت وهو مسجل، أو التي أنشأها نفس المتصفح بنفس الرقم.
export const CUSTOMER_COOKIE = cookieSecure() ? '__Host-gh_acct' : 'gh_acct'
const SESSION_DAYS = 90

export type Account = {
  id: number
  phone: string
  name: string
  country: string | null
  city: string | null
  area: string | null
  address: string | null
  landmark: string | null
  map_url: string | null
  created_at: string
}

type Row = Account & { password_hash: string; active: number; failed_logins: number; locked_until: string | null }

const PUBLIC_COLS = 'a.id, a.phone, a.name, a.country, a.city, a.area, a.address, a.landmark, a.map_url, a.created_at'

export function customerPasswordProblem(pw: string): string | null {
  if (pw.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل'
  if (pw.length > 200) return 'كلمة المرور طويلة جداً'
  return null
}

export function sessionCookie(token: string) {
  return { name: CUSTOMER_COOKIE, value: token, httpOnly: true, sameSite: 'lax' as const, secure: cookieSecure(), path: '/', maxAge: SESSION_DAYS * 86400 }
}

async function newSession(accountId: number): Promise<string> {
  const token = randomToken(32)
  await db()
    .prepare('INSERT INTO customer_sessions(token_hash,account_id,expires_at) VALUES(?,?,?)')
    .run(sha256(token), accountId, nowSql(new Date(Date.now() + SESSION_DAYS * 864e5)))
  await db().prepare("UPDATE customer_accounts SET last_login_at=datetime('now'), failed_logins=0, locked_until=NULL WHERE id=?").run(accountId)
  return token
}

const clean = (s: string | null | undefined, max = 300) =>
  (s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max)

export type Profile = { name: string; country?: string | null; city?: string | null; area?: string | null; address?: string | null; landmark?: string | null; mapUrl?: string | null }

export async function registerAccount(
  input: { phoneCode: string; phone: string; password: string } & Profile,
  ip: string,
): Promise<{ token: string; account: Account }> {
  const lim = await rateLimit(`acct-reg:${ip}`, 10, 60 * 60)
  if (!lim.ok) throw new ApiError(429, 'محاولات كثيرة من هذا الجهاز. حاول لاحقاً')
  const fieldErrors: Record<string, string> = {}
  const name = clean(input.name, 80)
  if (name.length < 3) fieldErrors.name = 'يرجى كتابة الاسم الكامل'
  const ph = validatePhone(input.phoneCode, input.phone)
  if (!ph.ok) fieldErrors.phone = ph.error
  const pw = customerPasswordProblem(input.password || '')
  if (pw) fieldErrors.password = pw
  if (Object.keys(fieldErrors).length) throw new ApiError(422, 'يرجى مراجعة البيانات', 'FIELDS', { fieldErrors })
  const phone = (ph as { intl: string }).intl
  if (await db().prepare('SELECT 1 FROM customer_accounts WHERE phone=?').get(phone)) {
    throw new ApiError(409, 'يوجد حساب مسجل بهذا الرقم. سجّل الدخول بكلمة المرور، أو تواصل معنا عبر واتساب إن نسيتها', 'EXISTS', {
      fieldErrors: { phone: 'هذا الرقم مسجل مسبقاً' },
    })
  }
  const row = await db()
    .prepare('INSERT INTO customer_accounts(phone,name,password_hash,country,city,area,address,landmark,map_url) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(phone) DO NOTHING RETURNING id')
    .get<{ id: number }>(
      phone,
      name,
      hashPassword(input.password),
      clean(input.country, 60) || null,
      clean(input.city, 60) || null,
      clean(input.area, 120) || null,
      clean(input.address, 500) || null,
      clean(input.landmark, 200) || null,
      clean(input.mapUrl, 500) || null,
    )
  if (!row) throw new ApiError(409, 'يوجد حساب مسجل بهذا الرقم. سجّل الدخول بكلمة المرور', 'EXISTS')
  const token = await newSession(row.id)
  return { token, account: (await getAccount(row.id))! }
}

export async function loginAccount(phoneCode: string, phoneLocal: string, password: string, ip: string): Promise<{ token: string; account: Account }> {
  const lim = await rateLimit(`acct-login:${ip}`, 20, 15 * 60)
  if (!lim.ok) throw new ApiError(429, `محاولات كثيرة. حاول بعد ${Math.ceil(lim.retryAfter / 60)} دقيقة`)
  const generic = 'رقم الجوال أو كلمة المرور غير صحيحة'
  const ph = validatePhone(phoneCode, phoneLocal)
  if (!ph.ok) throw new ApiError(422, ph.error, 'FIELDS', { fieldErrors: { phone: ph.error } })
  const d = db()
  const row = await d.prepare('SELECT * FROM customer_accounts WHERE phone=?').get<Row>(ph.intl)
  if (!row) {
    verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==')
    throw new ApiError(401, generic)
  }
  if (row.locked_until && new Date(row.locked_until + 'Z') > new Date()) {
    throw new ApiError(429, 'تم إيقاف الدخول مؤقتاً بسبب محاولات خاطئة متكررة. حاول بعد 15 دقيقة')
  }
  if (!verifyPassword(password, row.password_hash)) {
    const r = await d.prepare('UPDATE customer_accounts SET failed_logins=failed_logins+1 WHERE id=? RETURNING failed_logins').get<{ failed_logins: number }>(row.id)
    if (r && r.failed_logins >= 8) {
      await d.prepare('UPDATE customer_accounts SET failed_logins=0, locked_until=? WHERE id=?').run(nowSql(new Date(Date.now() + 15 * 60 * 1000)), row.id)
    }
    throw new ApiError(401, generic)
  }
  if (!row.active) throw new ApiError(403, 'هذا الحساب موقوف. تواصل معنا عبر واتساب')
  return { token: await newSession(row.id), account: (await getAccount(row.id))! }
}

export async function getAccount(id: number): Promise<Account | null> {
  return (await db().prepare(`SELECT ${PUBLIC_COLS} FROM customer_accounts a WHERE a.id=?`).get<Account>(id)) || null
}

export async function accountFromToken(token: string | undefined | null): Promise<Account | null> {
  if (!token || token.length < 20) return null
  const row = await db()
    .prepare(
      `SELECT ${PUBLIC_COLS} FROM customer_sessions s JOIN customer_accounts a ON a.id=s.account_id
       WHERE s.token_hash=? AND s.expires_at > datetime('now') AND a.active=1`,
    )
    .get<Account>(sha256(token))
  return row || null
}

/** الحساب الحالي في صفحات الخادم */
export async function currentAccount(): Promise<Account | null> {
  return accountFromToken((await cookies()).get(CUSTOMER_COOKIE)?.value)
}

export async function logoutAccount(token: string | undefined | null) {
  if (token) await db().prepare('DELETE FROM customer_sessions WHERE token_hash=?').run(sha256(token))
}

export async function updateProfile(id: number, p: Profile) {
  const name = clean(p.name, 80)
  if (name.length < 3) throw new ApiError(422, 'يرجى كتابة الاسم الكامل', 'FIELDS', { fieldErrors: { name: 'يرجى كتابة الاسم الكامل' } })
  await db()
    .prepare("UPDATE customer_accounts SET name=?, country=?, city=?, area=?, address=?, landmark=?, map_url=?, updated_at=datetime('now') WHERE id=?")
    .run(name, clean(p.country, 60) || null, clean(p.city, 60) || null, clean(p.area, 120) || null, clean(p.address, 500) || null, clean(p.landmark, 200) || null, clean(p.mapUrl, 500) || null, id)
}

/** حفظ آخر عنوان استُخدم في طلب (لا يمسح الحقول المحفوظة إن تُركت فارغة) */
export async function rememberAddress(id: number, p: Profile) {
  await db()
    .prepare(
      `UPDATE customer_accounts SET name=COALESCE(NULLIF(?,''),name), country=COALESCE(NULLIF(?,''),country), city=COALESCE(NULLIF(?,''),city),
       area=COALESCE(NULLIF(?,''),area), address=COALESCE(NULLIF(?,''),address), landmark=COALESCE(NULLIF(?,''),landmark),
       map_url=COALESCE(NULLIF(?,''),map_url), updated_at=datetime('now') WHERE id=?`,
    )
    .run(clean(p.name, 80), clean(p.country, 60), clean(p.city, 60), clean(p.area, 120), clean(p.address, 500), clean(p.landmark, 200), clean(p.mapUrl, 500), id)
}

export async function changeAccountPassword(id: number, current: string, next: string, keepToken?: string) {
  const row = await db().prepare('SELECT password_hash FROM customer_accounts WHERE id=?').get<{ password_hash: string }>(id)
  if (!row || !verifyPassword(current, row.password_hash)) throw new ApiError(400, 'كلمة المرور الحالية غير صحيحة')
  const p = customerPasswordProblem(next)
  if (p) throw new ApiError(400, p)
  await db().prepare("UPDATE customer_accounts SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(hashPassword(next), id)
  if (keepToken) await db().prepare('DELETE FROM customer_sessions WHERE account_id=? AND token_hash<>?').run(id, sha256(keepToken))
}

/** يعيّن المالك كلمة مرور مؤقتة للعميل (مثلاً بعد التحقق منه عبر واتساب) ويُخرج جميع جلساته */
export async function adminResetAccountPassword(id: number, next: string) {
  const p = customerPasswordProblem(next)
  if (p) throw new ApiError(400, p)
  await db().prepare("UPDATE customer_accounts SET password_hash=?, failed_logins=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?").run(hashPassword(next), id)
  await db().prepare('DELETE FROM customer_sessions WHERE account_id=?').run(id)
}

/** ربط طلبات أنشأها هذا المتصفح بنفس رقم الحساب (إثبات الحيازة عبر ملف التعريف الموقّع) */
export async function claimOwnedOrders(account: Pick<Account, 'id' | 'phone'>, ownedIds: number[]) {
  if (!ownedIds.length) return
  const ph = ownedIds.map(() => '?').join(',')
  await db().prepare(`UPDATE orders SET account_id=? WHERE account_id IS NULL AND customer_phone=? AND id IN (${ph})`).run(account.id, account.phone, ...ownedIds)
}

export type AccountOrder = { id: number; number: string; token: string; total: number; status: string; payment_status: string; created_at: string; items: number; display_currency: string | null; display_rate: number | null; display_symbol: string | null; display_label: string | null; display_decimals: number | null; display_round_to: number | null; currency: string; currency_symbol: string }

export async function accountOrders(id: number): Promise<AccountOrder[]> {
  return db()
    .prepare(
      `SELECT o.id, o.number, o.token, o.total, o.status, o.payment_status, o.created_at, o.currency, o.currency_symbol,
        o.display_currency, o.display_rate, o.display_symbol, o.display_label, o.display_decimals, o.display_round_to,
        (SELECT COALESCE(SUM(qty),0) FROM order_items i WHERE i.order_id=o.id) AS items
       FROM orders o WHERE o.account_id=? ORDER BY o.id DESC LIMIT 100`,
    )
    .all<AccountOrder>(id)
}
