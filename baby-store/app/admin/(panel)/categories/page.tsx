import { requirePage } from '@/lib/server/auth'
import { db, parseJson } from '@/lib/server/db'
import { getMediaMap, imageRef } from '@/lib/server/media'
import { CategoriesManager } from '@/components/admin/CategoriesManager'

export const metadata = { title: 'الأقسام' }

export default async function CategoriesPage() {
  await requirePage('products')
  const rows = await db()
      .prepare('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS count FROM categories c ORDER BY c.sort, c.id')
      .all() as { id: number; name: string; slug: string; description: string | null; image_id: number | null; visible: number; hidden_filters: string; seo_title: string | null; seo_description: string | null; count: number }[]
  const groups = await db().prepare('SELECT slug, name FROM tag_groups ORDER BY sort').all() as { slug: string; name: string }[]
  const media = await getMediaMap(rows.map((x) => x.image_id))
  return (
    <CategoriesManager
      groups={groups}
      initial={rows.map((r) => ({
        id: r.id, name: r.name, slug: r.slug, description: r.description || '', imageId: r.image_id, imageUrl: imageRef(media.get(r.image_id!), r.name, null, 320)?.url || null,
        visible: !!r.visible, hiddenFilters: parseJson<string[]>(r.hidden_filters, []), seoTitle: r.seo_title || '', seoDescription: r.seo_description || '', count: r.count,
      }))}
    />
  )
}
