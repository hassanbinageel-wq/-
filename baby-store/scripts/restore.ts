// استعادة نسخة احتياطية (أوقف التطبيق أولاً): npm run restore -- ./data/backups/backup-....tar.gz
import fs from 'node:fs'
import { restoreBackup } from '../lib/server/backup'

async function main() {
  const file = process.argv[2]
  if (!file || !fs.existsSync(file)) throw new Error('حدد مسار ملف النسخة الاحتياطية')
  const r = await restoreBackup(file)
  console.log(`✓ تمت الاستعادة. نسخة أمان للبيانات السابقة: ${r.safety}`)
}
main().then(() => process.exit(0), (e) => {
  console.error('✗', e.message)
  process.exit(1)
})
