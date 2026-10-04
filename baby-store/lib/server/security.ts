import crypto from 'node:crypto'
import { db, hmac } from './db'

// ===== كلمات المرور (scrypt) =====
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltB64, keyB64] = parts
  const expected = Buffer.from(keyB64, 'base64')
  const key = crypto.scryptSync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return key.length === expected.length && crypto.timingSafeEqual(key, expected)
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'كلمة المرور يجب أن تكون 10 أحرف على الأقل'
  if (pw.length > 200) return 'كلمة المرور طويلة جداً'
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return 'استخدم حروفاً وأرقاماً معاً في كلمة المرور'
  return null
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

// ===== تحديد معدل الطلبات (نافذة زمنية ثابتة محفوظة في قاعدة البيانات) =====
export function rateLimit(key: string, limit: number, windowSec: number): { ok: boolean; retryAfter: number } {
  const d = db()
  const now = Math.floor(Date.now() / 1000)
  const row = d.prepare('SELECT count, reset_at FROM rate_limits WHERE key=?').get(key) as { count: number; reset_at: number } | undefined
  if (!row || row.reset_at <= now) {
    d.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1, reset_at=excluded.reset_at').run(
      key,
      now + windowSec,
    )
    return { ok: true, retryAfter: 0 }
  }
  if (row.count >= limit) return { ok: false, retryAfter: row.reset_at - now }
  d.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').run(key)
  return { ok: true, retryAfter: 0 }
}

export function cleanupRateLimits() {
  db().prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(Math.floor(Date.now() / 1000))
}

// ===== عنوان IP =====
export function clientIp(headers: Headers): string {
  if (process.env.TRUST_PROXY === '1') {
    const xff = headers.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
    const real = headers.get('x-real-ip') || headers.get('cf-connecting-ip')
    if (real) return real.trim()
  }
  return headers.get('x-real-ip') || 'local'
}

export function ipHash(ip: string): string {
  return hmac('ip:' + ip).slice(0, 24)
}

/** حماية CSRF لطلبات التعديل: يجب أن يكون المصدر هو نفس الموقع */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = req.headers.get('origin')
  if (!origin) return site === 'same-origin' || site === 'none' || site === null
  try {
    const o = new URL(origin)
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
    return o.host === host
  } catch {
    return false
  }
}
