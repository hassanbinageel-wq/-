// نسخة احتياطية من سطر الأوامر (مناسبة للجدولة عبر cron)
// npm run backup            → ينشئ نسخة في data/backups
// npm run backup -- --keep 14 → يحذف النسخ التلقائية الأقدم ويبقي آخر 14
import { createBackup, pruneBackups, backupDir } from '../lib/server/backup'

async function main() {
  const name = await createBackup(process.argv.includes('--keep') ? 'auto' : 'cli')
  const i = process.argv.indexOf('--keep')
  if (i > 0) pruneBackups(Number(process.argv[i + 1]) || 7)
  console.log(`✓ ${backupDir()}/${name}`)
}
main().then(() => process.exit(0), (e) => {
  console.error('✗', e.message)
  process.exit(1)
})
