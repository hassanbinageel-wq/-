import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, nowSql, parseJson } from './db'
import { randomToken, sha256, verifyPassword, clientIp, rateLimit } from './security'
import type { Permission } from '../shared/constants'

export const SESSION_COOKIE = process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0' ? '__Host-gh_admin' : 'gh_admin'
const SESSION_DAYS = 7

export type AdminUser = {
  id: number
  username: string
  name: string
  permissions: Permission[]
  active: boolean
}

type UserRow = {
  id: number
  username: string
  name: string
  password_hash: string
  permissions: string
  active: number
  failed_logins: number
  locked_until: string | null
}

export function can(user: AdminUser | null, perm: Permission | Permission[]): boolean {
  if (!user || !user.active) return false
  if (user.permissions.includes('owner')) return true
  const list = Array.isArray(perm) ? perm : [perm]
  return list.some((p) => user.permissions.includes(p))
}

function toUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    permissions: parseJson<Permission[]>(row.permissions, []),
    active: !!row.active,
  }
}

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0'
}

export type LoginResult = { ok: true; token: string; user: AdminUser } | { ok: false; error: string }

export async function attemptLogin(username: string, password: string, ip: string, ua: string): Promise<LoginResult> {
  const ipLimit = await rateLimit(`login-ip:${ip}`, 15, 15 * 60)
  if (!ipLimit.ok) return { ok: false, error: `محاولات كثيرة. حاول بعد ${Math.ceil(ipLimit.retryAfter / 60)} دقيقة` }
  const d = db()
  const row = await d.prepare('SELECT * FROM admin_users WHERE lower(username)=lower(?)').get(username.trim()) as UserRow | undefined
  const genericError = 'اسم المستخدم أو كلمة المرور غير صحيحة'
  if (!row) {
    // نحسب hash وهمي لتقليل فرق التوقيت
    verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==')
    return { ok: false, error: genericError }
  }
  if (row.locked_until && new Date(row.locked_until + 'Z') > new Date()) {
    return { ok: false, error: 'تم إيقاف الدخول مؤقتاً لهذا الحساب بسبب محاولات خاطئة متكررة. حاول لاحقاً' }
  }
  if (!verifyPassword(password, row.password_hash)) {
    const r = await d.prepare('UPDATE admin_users SET failed_logins=failed_logins+1 WHERE id=? RETURNING failed_logins').get<{ failed_logins: number }>(row.id)
    if (r && r.failed_logins >= 5) {
      await d.prepare('UPDATE admin_users SET failed_logins=0, locked_until=? WHERE id=?').run(nowSql(new Date(Date.now() + 15 * 60 * 1000)), row.id)
    }
    return { ok: false, error: genericError }
  }
  if (!row.active) return { ok: false, error: 'هذا الحساب معطل. تواصل مع مالك المتجر' }
  const token = randomToken(32)
  await d.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,ip,user_agent) VALUES(?,?,?,?,?)').run(
        sha256(token),
        row.id,
        nowSql(new Date(Date.now() + SESSION_DAYS * 864e5)),
        ip,
        ua.slice(0, 200),
      )
  await d.prepare("UPDATE admin_users SET failed_logins=0, locked_until=NULL, last_login_at=datetime('now') WHERE id=?").run(row.id)
  return { ok: true, token, user: toUser(row) }
}

export async function userFromToken(token: string | undefined | null): Promise<AdminUser | null> {
  if (!token || token.length < 20) return null
  const d = db()
  const row = await d
      .prepare(
        `SELECT u.*, s.id AS sid, s.last_seen_at FROM sessions s JOIN admin_users u ON u.id=s.user_id
       WHERE s.token_hash=? AND s.expires_at > datetime('now')`,
      )
      .get(sha256(token)) as (UserRow & { sid: number; last_seen_at: string }) | undefined
  if (!row || !row.active) return null
  // تحديث آخر نشاط مرة كل 5 دقائق
  if (Date.now() - new Date(row.last_seen_at + 'Z').getTime() > 5 * 60 * 1000) {
    await d.prepare("UPDATE sessions SET last_seen_at=datetime('now') WHERE id=?").run(row.sid)
  }
  return toUser(row)
}

export async function revokeToken(token: string) {
  await db().prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(token))
}

export async function revokeUserSessions(userId: number, exceptToken?: string) {
  if (exceptToken) await db().prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(userId, sha256(exceptToken))
  else await db().prepare('DELETE FROM sessions WHERE user_id=?').run(userId)
}

/** المستخدم الحالي في صفحات الخادم */
export async function currentUser(): Promise<AdminUser | null> {
  const c = await cookies()
  return userFromToken(c.get(SESSION_COOKIE)?.value)
}

/** للصفحات: يعيد التوجيه لتسجيل الدخول أو يعرض رفض الصلاحية */
export async function requirePage(perm?: Permission | Permission[]): Promise<AdminUser> {
  const user = await currentUser()
  if (!user) redirect('/admin/login')
  if (perm && !can(user, perm)) redirect('/admin?denied=1')
  return user
}

export async function requestIp(): Promise<string> {
  return clientIp(await headers())
}

export async function hasAnyUser(): Promise<boolean> {
  return !!await db().prepare('SELECT 1 FROM admin_users LIMIT 1').get()
}

export async function audit(user: { id: number; name: string } | null, action: string, entity?: string, entityId?: string | number | null, details?: unknown, ip?: string) {
  await db()
        .prepare('INSERT INTO audit_log(user_id,user_name,action,entity,entity_id,details,ip) VALUES(?,?,?,?,?,?,?)')
        .run(user?.id ?? null, user?.name ?? null, action, entity ?? null, entityId != null ? String(entityId) : null, details ? JSON.stringify(details) : null, ip ?? null)
}
