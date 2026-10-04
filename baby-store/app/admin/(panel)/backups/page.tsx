import { requirePage } from '@/lib/server/auth'
import { databaseSize, listBackups } from '@/lib/server/backup'
import { getSetting } from '@/lib/server/settings'
import { BackupsManager } from '@/components/admin/BackupsManager'

export const metadata = { title: 'النسخ الاحتياطي' }

export default async function BackupsPage() {
  await requirePage('owner')
  return <BackupsManager list={await listBackups()} settings={await getSetting('backup')} usage={await databaseSize()} />
}
