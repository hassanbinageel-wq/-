import { requirePage } from '@/lib/server/auth'
import { getSetting } from '@/lib/server/settings'
import { getPublishedAppearance } from '@/lib/server/appearance'
import { db } from '@/lib/server/db'
import { sweep } from '@/lib/server/storefront'
import { AdminProvider } from '@/components/admin/ui'
import { AdminShell } from '@/components/admin/Shell'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage()
  sweep()
  const counts = {
    pending: (db().prepare("SELECT COUNT(*) n FROM orders WHERE status='pending'").get() as { n: number }).n,
    review: (db().prepare("SELECT COUNT(*) n FROM orders WHERE payment_status='under_review' AND status<>'cancelled'").get() as { n: number }).n,
  }
  return (
    <AdminProvider user={{ id: user.id, name: user.name, permissions: user.permissions }} currency={getSetting('store').currency}>
      <AdminShell storeName={getPublishedAppearance().brand.name} counts={counts}>
        {children}
      </AdminShell>
    </AdminProvider>
  )
}
