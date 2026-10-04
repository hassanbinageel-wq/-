import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/store/CheckoutForm'
import { SectionTitle } from '@/components/store/Sections'
import { shippingOptions } from '@/lib/server/pricing'
import { getSetting } from '@/lib/server/settings'
import { db } from '@/lib/server/db'
import { imageRefById } from '@/lib/server/media'

export const metadata: Metadata = { title: 'إتمام الطلب', robots: { index: false } }

export default function CheckoutPage() {
  const checkout = getSetting('checkout')
  const gifts = getSetting('gifts')
  const store = getSetting('store')
  const wraps = (db().prepare('SELECT id, name, description, price, image_id FROM gift_wraps WHERE active=1 ORDER BY sort, id').all() as {
    id: number; name: string; description: string | null; price: number; image_id: number | null
  }[]).map((w) => ({ id: w.id, name: w.name, description: w.description, price: w.price, image: imageRefById(w.image_id, w.name, 320)?.url || null }))
  return (
    <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '3rem' }}>
      <SectionTitle title="إتمام الطلب" subtitle="الطلب كزائر بدون إنشاء حساب" as="h1" />
      <CheckoutForm
        shipping={shippingOptions()}
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
