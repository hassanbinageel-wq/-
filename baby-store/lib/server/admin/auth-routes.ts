import crypto from 'node:crypto'
import { z } from 'zod'
import type { NextResponse } from 'next/server'
import { json, readJson } from '../api'
import { ApiError } from '../errors'
import { db } from '../db'
import { attemptLogin, audit, cookieSecure, hasAnyUser, SESSION_COOKIE } from '../auth'
import { hashPassword, passwordProblem, rateLimit } from '../security'
import type { Route } from './router'

export function sessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: 7 * 24 * 3600 })
}

export const PUBLIC_ROUTES: Route[] = [
  {
    method: 'POST',
    path: 'auth/login',
    perm: null,
    handler: async ({ req, ip }) => {
      const { username, password } = await readJson(req, z.object({ username: z.string().min(1).max(60), password: z.string().min(1).max(200) }))
      const r = attemptLogin(username, password, ip, req.headers.get('user-agent') || '')
      if (!r.ok) {
        audit(null, 'login_failed', 'user', null, { username: username.slice(0, 60) }, ip)
        throw new ApiError(401, r.error)
      }
      audit(r.user, 'login', 'user', r.user.id, null, ip)
      const res = json({ ok: true })
      sessionCookie(res, r.token)
      return res
    },
  },
  {
    method: 'POST',
    path: 'auth/setup',
    perm: null,
    handler: async ({ req, ip }) => {
      if (!rateLimit(`setup:${ip}`, 5, 900).ok) throw new ApiError(429, 'محاولات كثيرة')
      if (hasAnyUser()) throw new ApiError(403, 'تم إنشاء حساب المالك مسبقاً')
      const expected = process.env.SETUP_TOKEN || ''
      const body = await readJson(
        req,
        z.object({ token: z.string().max(200), username: z.string().min(3).max(40), name: z.string().min(2).max(80), password: z.string().max(200) }),
      )
      if (expected.length < 12) throw new ApiError(403, 'الإعداد من المتصفح غير مفعل. استخدم الأمر npm run owner:create أو اضبط SETUP_TOKEN (12 حرفاً على الأقل)')
      const a = Buffer.from(body.token)
      const b = Buffer.from(expected)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ApiError(403, 'رمز الإعداد غير صحيح')
      if (!/^[a-zA-Z0-9_.-]+$/.test(body.username)) throw new ApiError(400, 'اسم المستخدم يقبل الحروف الإنجليزية والأرقام فقط')
      const pw = passwordProblem(body.password)
      if (pw) throw new ApiError(400, pw)
      const id = Number(
        db()
          .prepare("INSERT INTO admin_users(username,name,password_hash,permissions) VALUES(?,?,?,'[\"owner\"]')")
          .run(body.username, body.name, hashPassword(body.password)).lastInsertRowid,
      )
      audit({ id, name: body.name }, 'owner_created', 'user', id, null, ip)
      const r = attemptLogin(body.username, body.password, ip, req.headers.get('user-agent') || '')
      const res = json({ ok: true })
      if (r.ok) sessionCookie(res, r.token)
      return res
    },
  },
]
