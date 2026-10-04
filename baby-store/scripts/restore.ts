// استعادة نسخة احتياطية من ملف: npm run restore -- ./backups/backup-....json.gz
import fs from 'node:fs'
import { restoreBackup } from '../lib/server/backup'
import { closeDb } from '../lib/server/db'

async function main() {
  const file = process.argv[2]
  if (!file || !fs.existsSync(file)) throw new Error('حدد مسار ملف النسخة الاحتياطية')
  const r = await restoreBackup(fs.readFileSync(file))
  console.log(`✓ تمت الاستعادة. نسخة أمان للبيانات السابقة: ${r.safety}`)
  await closeDb()
}
main().catch((e) => {
  console.error('✗', e.message)
  process.exit(1)
})
