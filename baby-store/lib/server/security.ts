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
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000)
  // عملية واحدة ذرية: تبدأ نافذة جديدة إن انتهت السابقة، وإلا تزيد العداد
  const row = await db()
    .prepare(
      `INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
       RETURNING count, reset_at`,
    )
    .get<{ count: number; reset_at: number }>(key, now + windowSec, now, now)
  if (row!.count > limit) return { ok: false, retryAfter: Math.max(1, row!.reset_at - now) }
  return { ok: true, retryAfter: 0 }
}

export async function cleanupRateLimits() {
  await db().prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(Math.floor(Date.now() / 1000))
}

// ===== عنوان IP =====
/** نعمل على Netlify؟ (الدوال تعمل على AWS Lambda) */
export const onNetlify = () => !!(process.env.NETLIFY || process.env.SITE_ID || process.env.AWS_LAMBDA_FUNCTION_NAME)

export function clientIp(headers: Headers): string {
  // Netlify تضع عنوان الزائر الحقيقي في هذا الترويسة ولا يمكن للزائر تزويرها
  if (onNetlify()) {
    const nf = headers.get('x-nf-client-connection-ip')
    if (nf) return nf.trim()
  }
  if (process.env.TRUST_PROXY === '1' || onNetlify()) {
    const xff = headers.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
    const real = headers.get('x-real-ip') || headers.get('cf-connecting-ip')
    if (real) return real.trim()
  }
  return headers.get('x-real-ip') || 'local'
}

export async function ipHash(ip: string): Promise<string> {
  return (await hmac('ip:' + ip)).slice(0, 24)
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
