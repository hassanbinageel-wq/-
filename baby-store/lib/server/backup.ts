import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { db, schemaVersion, tx } from './db'
import { getSetting, setSetting } from './settings'
import { bumpCacheVersion } from './cache'

// النسخة الاحتياطية = ملف JSON مضغوط (gzip) يضم بيانات كل الجداول.
// الصور محفوظة داخل قاعدة البيانات نفسها ولا تُضمَّن في الملف (حجمها كبير)؛ سجلاتها الوصفية مضمنة.
// النسخ تُحفظ داخل قاعدة البيانات (جدول backups) وتُنزّل من لوحة التحكم للاحتفاظ بنسخة خارجية.

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

/** ترتيب الجداول حسب الاعتماديات (الأب قبل الابن) */
export const BACKUP_TABLES = [
  'settings', 'counters', 'media', 'admin_users', 'audit_log', 'notifications', 'appearance_versions', 'pages', 'faqs',
  'categories', 'tag_groups', 'tags', 'size_guides', 'products', 'product_images', 'variants', 'product_tags', 'product_relations',
  'bundle_items', 'stock_movements', 'gift_wraps', 'shipping_zones', 'transfer_methods', 'coupons', 'customers', 'customer_accounts', 'orders',
  'order_items', 'order_stock_lines', 'order_attachments', 'payments', 'refunds', 'order_returns', 'order_notes', 'order_events',
] as const

const NAME_RE = /^backup-[\w.-]+\.json\.gz$/

type BackupFile = { app: 'baby-store'; format: 2; schema: number; createdAt: string; tables: Record<string, Record<string, unknown>[]> }

export async function exportData(): Promise<Buffer> {
  const tables: BackupFile['tables'] = {}
  for (const t of BACKUP_TABLES) tables[t] = await db().prepare(`SELECT * FROM ${t} ORDER BY 1`).all()
  const file: BackupFile = { app: 'baby-store', format: 2, schema: schemaVersion(), createdAt: new Date().toISOString(), tables }
  return gzip(Buffer.from(JSON.stringify(file)), { level: 9 })
}

export async function createBackup(tag = 'manual'): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const name = `backup-${stamp}-${tag.replace(/[^\w-]/g, '')}.json.gz`
  const data = await exportData()
  await db().prepare('INSERT INTO backups(name,kind,bytes,data) VALUES(?,?,?,?) ON CONFLICT(name) DO NOTHING RETURNING id').get(name, tag, data.length, data)
  return name
}

export async function listBackups() {
  const rows = await db().prepare('SELECT name, kind, bytes, created_at FROM backups ORDER BY id DESC').all<{ name: string; kind: string; bytes: number; created_at: string }>()
  return rows.map((r) => ({ name: r.name, size: r.bytes, createdAt: r.created_at.replace(' ', 'T') + 'Z' }))
}

export async function getBackup(name: string): Promise<Buffer | null> {
  if (!NAME_RE.test(name)) return null
  const row = await db().prepare('SELECT data FROM backups WHERE name=?').get<{ data: Uint8Array }>(name)
  return row ? Buffer.from(row.data) : null
}

export async function deleteBackup(name: string): Promise<boolean> {
  return (await db().prepare('DELETE FROM backups WHERE name=?').run(name)).changes > 0
}

export async function pruneBackups(keep: number) {
  await db()
    .prepare("DELETE FROM backups WHERE kind='auto' AND id NOT IN (SELECT id FROM backups WHERE kind='auto' ORDER BY id DESC LIMIT ?)")
    .run(Math.max(1, keep))
}

async function parseBackup(buf: Buffer): Promise<BackupFile> {
  let json: BackupFile
  try {
    json = JSON.parse((await gunzip(buf)).toString('utf8'))
  } catch {
    throw new Error('الملف ليس نسخة احتياطية صالحة')
  }
  if (json?.app !== 'baby-store' || json.format !== 2 || !json.tables) throw new Error('الملف ليس نسخة احتياطية من هذا المتجر')
  if (json.schema > schemaVersion()) throw new Error('النسخة من إصدار أحدث من التطبيق الحالي')
  return json
}

/**
 * يستبدل بيانات المتجر بمحتوى النسخة (بعد أخذ نسخة أمان من البيانات الحالية).
 * سجلات الصور تُدمج ولا تُحذف حتى لا تضيع الصور المرفوعة بعد تاريخ النسخة.
 */
export async function restoreBackup(buf: Buffer): Promise<{ safety: string }> {
  const file = await parseBackup(buf)
  const safety = await createBackup('before-restore')
  await tx(async () => {
    const d = db()
    const toClear = BACKUP_TABLES.filter((t) => t !== 'media')
    await d.exec(`TRUNCATE ${toClear.join(', ')} RESTART IDENTITY CASCADE`)
    for (const t of BACKUP_TABLES) {
      const rows = file.tables[t] || []
      if (!rows.length) continue
      const cols = (await d.prepare('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?').all<{ column_name: string }>(t)).map((c) => c.column_name)
      // إدخال على دفعات (عدة صفوف في كل استعلام) لتسريع الاستعادة
      const keys = Object.keys(rows[0]).filter((k) => cols.includes(k))
      const conflict = t === 'media' ? ` ON CONFLICT (id) DO UPDATE SET ${keys.filter((k) => k !== 'id').map((k) => `${k}=excluded.${k}`).join(', ')}` : ''
      const per = Math.max(1, Math.min(500, Math.floor(30000 / keys.length)))
      for (let i = 0; i < rows.length; i += per) {
        const chunk = rows.slice(i, i + per)
        const values = chunk.map(() => `(${keys.map(() => '?').join(',')})`).join(',')
        await d.prepare(`INSERT INTO ${t}(${keys.join(',')}) VALUES ${values}${conflict} RETURNING 1`).run(...chunk.flatMap((r) => keys.map((k) => r[k] ?? null)))
      }
      if (cols.includes('id')) {
        await d.prepare(`SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`).get(`${t}`)
      }
    }
  })
  await bumpCacheVersion()
  return { safety }
}

/** نسخة تلقائية يومية إن كانت مفعلة (تُستدعى من المهمة الدورية) */
export async function autoBackupIfDue() {
  const s = await getSetting('backup')
  if (!s.autoEnabled) return
  const last = s.lastAutoAt ? new Date(s.lastAutoAt).getTime() : 0
  if (Date.now() - last < 24 * 3600e3) return
  await setSetting('backup', { ...s, lastAutoAt: new Date().toISOString() })
  try {
    await createBackup('auto')
    await pruneBackups(s.keep)
  } catch (e) {
    console.error('[auto-backup]', e)
  }
}

/** حجم قاعدة البيانات (الخطة المجانية في Supabase حدها 500 ميجابايت) */
export async function databaseSize(): Promise<{ total: number; images: number; backups: number }> {
  const total = (await db().prepare('SELECT pg_database_size(current_database()) n').get<{ n: number }>())!.n
  const images = (await db().prepare('SELECT COALESCE(SUM(bytes),0) n FROM media_blobs').get<{ n: number }>())!.n
  const backups = (await db().prepare('SELECT COALESCE(SUM(bytes),0) n FROM backups').get<{ n: number }>())!.n
  return { total, images, backups }
}
