import { publicRoute, json } from '@/lib/server/api'
import { cardsByIds, listProducts } from '@/lib/server/catalog'
import { parseListParams } from '@/lib/server/list-params'

// ?ids=1,2,3 → بطاقات منتجات (للمفضلة وشاهدت مؤخراً) | غير ذلك: صفحة من نتائج التصفية
export const GET = publicRoute(({ req }) => {
  const sp = req.nextUrl.searchParams
  const ids = sp.get('ids')
  if (ids !== null) {
    const list = ids.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60)
    return json({ items: cardsByIds(list) })
  }
  const f = parseListParams(Object.fromEntries(sp.entries()))
  const r = listProducts(f)
  return json({ items: r.items, page: r.page, pages: r.pages, total: r.total })
})
