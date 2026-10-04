import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { imageRefById } from '@/lib/server/media'
import { TransferMethods } from '@/components/admin/TransferMethods'

export const metadata = { title: 'وسائل التحويل' }

export default async function TransferMethodsPage() {
  await requirePage('owner')
  const rows = db().prepare('SELECT * FROM transfer_methods ORDER BY sort, id').all() as {
    id: number; name: string; type: string; beneficiary: string; account_number: string; extra_info: string | null; currency: string | null; instructions: string | null; qr_media_id: number | null; active: number
  }[]
  return (
    <TransferMethods
      initial={rows.map((r) => ({
        id: r.id, name: r.name, type: r.type as 'bank', beneficiary: r.beneficiary, accountNumber: r.account_number, extraInfo: r.extra_info || '',
        currency: r.currency || '', instructions: r.instructions || '', qrMediaId: r.qr_media_id, qrUrl: imageRefById(r.qr_media_id, r.name, 640)?.url || null, active: !!r.active,
      }))}
    />
  )
}
