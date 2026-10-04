import { publicRoute, json } from '@/lib/server/api'
import { suggest } from '@/lib/server/catalog'
import { rateLimit } from '@/lib/server/security'

export const GET = publicRoute(async ({ req, ip }) => {
  const q = (req.nextUrl.searchParams.get('q') || '').slice(0, 80)
  if (!(await rateLimit(`search:${ip}`, 120, 60)).ok) return json({ products: [], categories: [], tags: [] }, 429)
  return json(await suggest(q))
})
