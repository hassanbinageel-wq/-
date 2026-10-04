import { requirePage } from '@/lib/server/auth'
import { getAllSettings } from '@/lib/server/settings'
import { db } from '@/lib/server/db'
import { SettingsForm } from '@/components/admin/SettingsForm'

export const metadata = { title: 'الإعدادات' }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePage('owner')
  const s = getAllSettings()
  const demo = {
    products: (db().prepare('SELECT COUNT(*) n FROM products WHERE is_demo=1').get() as { n: number }).n,
    zones: (db().prepare('SELECT COUNT(*) n FROM shipping_zones WHERE is_demo=1').get() as { n: number }).n,
    coupons: (db().prepare('SELECT COUNT(*) n FROM coupons WHERE is_demo=1').get() as { n: number }).n,
    wraps: (db().prepare('SELECT COUNT(*) n FROM gift_wraps WHERE is_demo=1').get() as { n: number }).n,
  }
  return <SettingsForm initial={s} tab={(await searchParams).tab || 'store'} demo={demo} />
}
