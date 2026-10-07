import { cache } from 'react'
import { cookies, draftMode, headers } from 'next/headers'
import { db } from './db'
import { getDraftAppearance, getPublishedAppearance } from './appearance'
import { getSetting, siteUrl, storeWhatsapp } from './settings'
import { currentUser, can } from './auth'
import { imageRefById } from './media'
import { releaseExpiredReservations } from './inventory'
import { isScheduledActive } from '../shared/theme'
import type { Appearance } from '../shared/types'
import type { StoreConfig } from '@/components/store/StoreProvider'
import { storeCurrencies, pickCurrency, CURRENCY_COOKIE } from './currency'
import { currentAccount } from './customer-auth'

export type StoreContext = {
  a: Appearance
  preview: boolean
  isAdmin: boolean
  origin: string
  config: StoreConfig
}

/** سياق الواجهة لكل طلب: المظهر المنشور (أو المسودة للمعاينة) وإعدادات العرض */
export const getStoreContext = cache(async (): Promise<StoreContext> => {
  const dm = await draftMode()
  const user = await currentUser()
  const isAdmin = !!user
  const preview = dm.isEnabled && can(user, 'owner')
  const a = preview ? (await getDraftAppearance()).data : await getPublishedAppearance()
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  const origin = siteUrl(`${proto}://${host}`)
  const store = await getSetting('store')
  const shipping = await getSetting('shipping')
  const jar = await cookies()
  const account = await currentAccount()
  return {
    a,
    preview,
    isAdmin,
    origin,
    config: {
      storeName: a.brand.name,
      currency: pickCurrency(store, jar.get(CURRENCY_COOKIE)?.value),
      currencies: storeCurrencies(store).map((c) => ({ id: c.id!, label: c.label || c.code, symbol: c.symbol })),
      account: account ? { name: account.name } : null,
      labels: a.labels,
      whatsapp: await storeWhatsapp(),
      productCard: a.productCard,
      decorations: a.theme.decorations,
      siteUrl: origin,
      freeShipping: { enabled: shipping.freeShippingEnabled, threshold: shipping.freeShippingThreshold },
    },
  }
})

export async function visibleCategories() {
  return await db()
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, c.image_id,
        (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.status='published') AS count
       FROM categories c WHERE c.visible=1 ORDER BY c.sort, c.id`,
      )
      .all() as { id: number; name: string; slug: string; description: string | null; image_id: number | null; count: number }[]
}

export function announcementFor(a: Appearance) {
  const an = a.announcement
  if (!an.enabled || !an.items.length || !isScheduledActive(an.startsAt, an.endsAt)) return null
  return { items: an.items.filter((i) => i.label), bg: an.bg, fg: an.fg }
}

/** الشعار المرفوع من لوحة التحكم، وإلا شعار غيمة الأفقي الافتراضي */
export async function logoUrl(a: Appearance): Promise<string | null> {
  return (await imageRefById(a.brand.logoId, a.brand.name, 640))?.url || '/brand/ghayma-logo.svg'
}

/** مهمة دورية خفيفة عند الطلبات: تحرير الحجوزات المنتهية (مرة كل دقيقة على الأكثر) */
const g = globalThis as unknown as { __lastSweep?: number }
export async function sweep() {
  const now = Date.now()
  if (g.__lastSweep && now - g.__lastSweep < 60_000) return
  g.__lastSweep = now
  try {
    await releaseExpiredReservations()
  } catch (e) {
    console.error('[sweep]', e)
  }
}
