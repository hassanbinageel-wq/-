import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/store/CheckoutForm'
import { SectionTitle } from '@/components/store/Sections'
import { shippingOptions } from '@/lib/server/pricing'
import { getSetting } from '@/lib/server/settings'
import { db } from '@/lib/server/db'
import { getMediaMap, imageRef } from '@/lib/server/media'

export const metadata: Metadata = { title: 'إتمام الطلب', robots: { index: false } }

export default async function CheckoutPage() {
  const checkout = await getSetting('checkout')
  const gifts = await getSetting('gifts')
  const store = await getSetting('store')
  const wrapRows = await db().prepare('SELECT id, name, description, price, image_id FROM gift_wraps WHERE active=1 ORDER BY sort, id').all<{
    id: number; name: string; description: string | null; price: number; image_id: number | null
  }>()
  const media = await getMediaMap(wrapRows.map((w) => w.image_id))
  const wraps = wrapRows.map((w) => ({ id: w.id, name: w.name, description: w.description, price: w.price, image: imageRef(media.get(w.image_id!), w.name, null, 320)?.url || null }))
  return (
    <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '3rem' }}>
      <SectionTitle title="إتمام الطلب" subtitle="الطلب كزائر بدون إنشاء حساب" as="h1" />
      <CheckoutForm
        shipping={await shippingOptions()}
        deliveryEnabled={checkout.deliveryEnabled}
        pickupEnabled={checkout.pickupEnabled}
        pickupAddress={checkout.pickupAddress}
        pickupNotes={checkout.pickupNotes}
        notesMax={checkout.notesMax}
        reservationMinutes={checkout.reservationMinutes}
        gifts={gifts}
        wraps={wraps}
        defaultCountry={store.defaultCountry}
        defaultPhoneCode={store.defaultPhoneCode}
      />
    </div>
  )
}
