import { ApiError } from '../errors'
import type { NextRequest } from 'next/server'
import type { AdminUser } from '../auth'
import type { Permission } from '../../shared/constants'

export type Ctx = {
  req: NextRequest
  user: AdminUser
  ip: string
  params: Record<string, string>
  query: URLSearchParams
}

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string // مثل: orders/:id/status
  perm: Permission | Permission[] | null
  handler: (ctx: Ctx) => Promise<Response> | Response
}

export function match(routes: Route[], method: string, parts: string[]): { route: Route; params: Record<string, string> } | null {
  // نفضّل المسارات الثابتة على المسارات ذات المتغيرات (مثل products/export قبل products/:id)
  let best: { route: Route; params: Record<string, string>; vars: number } | null = null
  for (const r of routes) {
    if (r.method !== method) continue
    const segs = r.path.split('/')
    if (segs.length !== parts.length) continue
    const params: Record<string, string> = {}
    let ok = true
    let vars = 0
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].startsWith(':')) {
        params[segs[i].slice(1)] = parts[i]
        vars++
      } else if (segs[i] !== parts[i]) {
        ok = false
        break
      }
    }
    if (ok && (!best || vars < best.vars)) best = { route: r, params, vars }
  }
  return best ? { route: best.route, params: best.params } : null
}

export const num = (s: string | undefined) => {
  const n = Number(s)
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'معرّف غير صالح')
  return n
}
