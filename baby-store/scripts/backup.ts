// نسخة احتياطية من سطر الأوامر: تُحفظ في قاعدة البيانات وتُكتب نسخة منها في ملف محلي
// npm run backup                  → ./backups/backup-....json.gz
// npm run backup -- --out ملف.gz  → مسار مخصص
import fs from 'node:fs'
import path from 'node:path'
import { createBackup, getBackup } from '../lib/server/backup'
import { closeDb } from '../lib/server/db'

async function main() {
  const name = await createBackup('cli')
  const i = process.argv.indexOf('--out')
  const out = i > 0 ? process.argv[i + 1] : path.join('backups', name)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, (await getBackup(name))!)
  console.log(`✓ ${out}`)
  await closeDb()
}
main().catch((e) => {
  console.error('✗', e.message)
  process.exit(1)
})
