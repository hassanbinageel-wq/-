import { requirePage } from '@/lib/server/auth'
import { db, parseJson } from '@/lib/server/db'
import { getMediaMap, imageRef } from '@/lib/server/media'
import { SizeGuides } from '@/components/admin/SizeGuides'

export const metadata = { title: 'أدلة المقاسات' }

export default async function SizeGuidesPage() {
  await requirePage('products')
  const rows = await db().prepare('SELECT g.*, (SELECT COUNT(*) FROM products p WHERE p.size_guide_id=g.id) AS count FROM size_guides g ORDER BY g.id').all() as {
    id: number; name: string; intro: string | null; columns: string; rows: string; notes: string | null; image_id: number | null; is_demo: number; count: number
  }[]
  const media = await getMediaMap(rows.map((x) => x.image_id))
  return (
    <SizeGuides
      initial={rows.map((r) => ({ id: r.id, name: r.name, intro: r.intro || '', columns: parseJson<string[]>(r.columns, []), rows: parseJson<string[][]>(r.rows, []), notes: r.notes || '', imageId: r.image_id, imageUrl: imageRef(media.get(r.image_id!), r.name, null, 640)?.url || null, isDemo: !!r.is_demo, count: r.count }))}
    />
  )
}
