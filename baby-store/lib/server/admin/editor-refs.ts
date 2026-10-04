import { db } from '../db'
import { getMedia, mediaUrl } from '../media'
import { getVariants, getProductRow } from '../catalog'
import { MOVEMENT_REASON_LABELS } from '../../shared/constants'
import type { ProductInput } from '../products'
import type { EditorRefs } from '@/components/admin/ProductEditor'

export async function editorRefs(p: ProductInput | null): Promise<EditorRefs> {
  const d = db()
  const groups = await d.prepare('SELECT id, name FROM tag_groups ORDER BY sort, id').all() as { id: number; name: string }[]
  const tags = await d.prepare('SELECT id, group_id, name FROM tags ORDER BY sort, id').all() as { id: number; group_id: number; name: string }[]
  const imageUrls: Record<number, string> = {}
  for (const im of p?.images || []) imageUrls[im.mediaId] = mediaUrl(await getMedia(im.mediaId), 320) || ''
  const ids = new Set<number>([...(p?.relatedIds || []), ...(p?.complementaryIds || []), ...(p?.bundleItems || []).map((b) => b.productId)])
  const products: EditorRefs['products'] = {}
  for (const id of ids) {
    const r = await getProductRow(id)
    if (!r) continue
    const img = await d.prepare('SELECT media_id FROM product_images WHERE product_id=? ORDER BY sort LIMIT 1').get(id) as { media_id: number } | undefined
    products[id] = {
      name: r.name,
      sku: r.sku,
      type: r.type,
      image: img ? mediaUrl(await getMedia(img.media_id), 320) : null,
      variants: r.type === 'variable' ? (await getVariants(id)).map((v) => ({ id: v.id, sku: v.sku, label: [v.option1, v.option2, v.option3].filter(Boolean).join(' / ') })) : [],
    }
  }
  return {
    categories: await d.prepare('SELECT id, name FROM categories ORDER BY sort, id').all() as { id: number; name: string }[],
    tagGroups: groups.map((g) => ({ ...g, tags: tags.filter((t) => t.group_id === g.id) })),
    sizeGuides: await d.prepare('SELECT id, name FROM size_guides ORDER BY id').all() as { id: number; name: string }[],
    imageUrls,
    products,
    movements: p?.id
      ? (await d.prepare('SELECT * FROM stock_movements WHERE product_id=? ORDER BY id DESC LIMIT 12').all(p.id) as EditorRefs['movements'])
      : [],
    reasonLabels: MOVEMENT_REASON_LABELS,
  }
}
