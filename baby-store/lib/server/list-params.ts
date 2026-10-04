import { db } from './db'
import type { ListFilters } from './catalog'

type SP = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ''
const many = (v: string | string[] | undefined) =>
  one(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)

/** تحويل معاملات الرابط إلى فلاتر قائمة المنتجات */
export async function parseListParams(sp: SP): Promise<ListFilters> {
  const num = (k: string) => {
    const n = Number(one(sp[k]))
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
  }
  const sortRaw = one(sp.sort)
  const sort = (['newest', 'price_asc', 'price_desc'] as const).find((s) => s === sortRaw) || 'default'
  let categoryId: number | null = null
  const catSlug = one(sp.category)
  if (catSlug) {
    const c = await db().prepare('SELECT id FROM categories WHERE slug=?').get(catSlug) as { id: number } | undefined
    categoryId = c?.id ?? null
  }
  let tagIds: number[] | undefined
  const scopeTag = one(sp.scope_tag)
  if (scopeTag) {
    const t = await db().prepare('SELECT id FROM tags WHERE slug=?').get(scopeTag) as { id: number } | undefined
    tagIds = t ? [t.id] : [-1]
  }
  return {
    q: one(sp.q).slice(0, 80) || undefined,
    categoryId,
    tagIds,
    filterTags: many(sp.t),
    sizes: many(sp.size),
    colors: many(sp.color),
    min: num('min'),
    max: num('max'),
    inStock: one(sp.stock) === '1',
    sale: one(sp.sale) === '1',
    type: one(sp.type) === 'bundle' ? 'bundle' : null,
    sort,
    page: Math.max(1, Math.min(500, parseInt(one(sp.page), 10) || 1)),
    perPage: 24,
  }
}
