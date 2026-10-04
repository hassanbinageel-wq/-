import { requirePage } from '@/lib/server/auth'
import { db, parseJson } from '@/lib/server/db'
import { getSetting } from '@/lib/server/settings'
import { ShippingManager } from '@/components/admin/ShippingManager'

export const metadata = { title: 'التوصيل والاستلام' }

export default async function ShippingPage() {
  await requirePage('owner')
  const zones = db().prepare('SELECT * FROM shipping_zones ORDER BY sort, id').all() as {
    id: number; name: string; country: string; cities: string; fee: number; free_shipping_eligible: number; eta_text: string | null; active: number; is_demo: number
  }[]
  return (
    <ShippingManager
      checkout={getSetting('checkout')}
      shipping={getSetting('shipping')}
      zones={zones.map((z) => ({ id: z.id, name: z.name, country: z.country, cities: parseJson<string[]>(z.cities, []), fee: z.fee, freeShippingEligible: !!z.free_shipping_eligible, etaText: z.eta_text || '', active: !!z.active, isDemo: !!z.is_demo }))}
    />
  )
}
