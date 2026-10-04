// تطبيق ترحيلات قاعدة البيانات (تُطبق تلقائياً أيضاً عند تشغيل التطبيق)
import { db, schemaVersion, dataPath } from '../lib/server/db'
import { ensureAppearance } from '../lib/server/appearance'
db()
ensureAppearance()
console.log(`✓ قاعدة البيانات جاهزة (الإصدار ${schemaVersion()}) في ${dataPath('store.db')}`)
