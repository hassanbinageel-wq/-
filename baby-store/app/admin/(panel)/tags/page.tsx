import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { TagsManager } from '@/components/admin/TagsManager'

export const metadata = { title: 'العمر والمناسبات' }

export default async function TagsPage() {
  await requirePage('products')
  const groups = await db().prepare('SELECT * FROM tag_groups ORDER BY sort, id').all() as { id: number; name: string; slug: string; kind: string; show_in_filters: number }[]
  const tags = await db()
      .prepare('SELECT t.*, (SELECT COUNT(*) FROM product_tags pt WHERE pt.tag_id=t.id) AS count FROM tags t ORDER BY t.sort, t.id')
      .all() as { id: number; group_id: number; name: string; slug: string; description: string | null; visible: number; count: number }[]
  return (
    <TagsManager
      groups={groups.map((g) => ({ id: g.id, name: g.name, slug: g.slug, kind: g.kind as 'age' | 'occasion' | 'custom', showInFilters: !!g.show_in_filters, tags: tags.filter((t) => t.group_id === g.id).map((t) => ({ id: t.id, name: t.name, slug: t.slug, description: t.description || '', visible: !!t.visible, count: t.count })) }))}
    />
  )
}
