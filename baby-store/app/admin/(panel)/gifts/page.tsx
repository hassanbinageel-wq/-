import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { getSetting } from '@/lib/server/settings'
import { getMediaMap, imageRef } from '@/lib/server/media'
import { GiftsManager } from '@/components/admin/GiftsManager'

export const metadata = { title: 'الهدايا والتخصيص' }

export default async function GiftsPage() {
  await requirePage('owner')
  const wraps = await db().prepare('SELECT * FROM gift_wraps ORDER BY sort, id').all() as { id: number; name: string; description: string | null; price: number; image_id: number | null; active: number }[]
  const media = await getMediaMap(wraps.map((x) => x.image_id))
  return (
    <GiftsManager
      gifts={await getSetting('gifts')}
      personalization={await getSetting('personalization')}
      wraps={wraps.map((w) => ({ id: w.id, name: w.name, description: w.description || '', price: w.price, imageId: w.image_id, imageUrl: imageRef(media.get(w.image_id!), w.name, null, 320)?.url || null, active: !!w.active }))}
    />
  )
}
