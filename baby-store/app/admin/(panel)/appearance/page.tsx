import { requirePage } from '@/lib/server/auth'
import { getDraftAppearance, listVersions } from '@/lib/server/appearance'
import { getMedia, mediaUrl } from '@/lib/server/media'
import { db } from '@/lib/server/db'
import { AppearanceEditor } from '@/components/admin/AppearanceEditor'

export const metadata = { title: 'مظهر المتجر' }

export default async function AppearancePage() {
  await requirePage('owner')
  const d = getDraftAppearance()
  const a = d.data
  const ids = new Set<number>()
  if (a.brand.logoId) ids.add(a.brand.logoId)
  if (a.brand.faviconId) ids.add(a.brand.faviconId)
  for (const s of a.home.sections) for (const b of s.banners) [b.imageDesktopId, b.imageMobileId].forEach((x) => x && ids.add(x))
  const urls: Record<number, string> = {}
  for (const id of ids) urls[id] = mediaUrl(getMedia(id), 640) || ''
  const productIds = Array.from(new Set(a.home.sections.flatMap((s) => s.productIds)))
  const products: Record<number, string> = {}
  for (const id of productIds) {
    const r = db().prepare('SELECT name FROM products WHERE id=?').get(id) as { name: string } | undefined
    if (r) products[id] = r.name
  }
  const font = getMedia(a.theme.customFontId)
  return (
    <AppearanceEditor
      initial={a}
      hasDraft={d.hasDraft}
      updatedAt={d.updatedAt}
      versions={listVersions()}
      urls={urls}
      products={products}
      tagGroups={db().prepare('SELECT id, name FROM tag_groups ORDER BY sort').all() as { id: number; name: string }[]}
      fontFile={font ? font.original_name || 'ملف خط' : null}
    />
  )
}
