// تطبيق ترحيلات قاعدة البيانات (تُطبق تلقائياً أيضاً عند أول اتصال)
import { closeDb, schemaVersion } from '../lib/server/db'
import { ensureAppearance } from '../lib/server/appearance'

async function main() {
  await ensureAppearance()
  console.log(`✓ قاعدة البيانات جاهزة (الإصدار ${schemaVersion()}) — ${process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite محلية'}`)
  await closeDb()
}
main().catch((e) => {
  console.error('✗', e.message)
  process.exit(1)
})
