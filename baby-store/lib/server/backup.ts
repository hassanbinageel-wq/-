import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import * as tar from 'tar'
import { closeDb, dataPath, db, schemaVersion } from './db'
import { clearSettingsCache, getSetting, setSetting } from './settings'
import { clearAppearanceCache } from './appearance'
import { invalidateCatalog } from './catalog'

// النسخة الاحتياطية = ملف tar.gz يحتوي قاعدة البيانات (store.db) ومجلد الصور والسندات (uploads)
// لا تتضمن ملف المفتاح السري .secret

const NAME_RE = /^backup-[\w.-]+\.tar\.gz$/

export function backupDir() {
  const d = dataPath('backups')
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function listBackups() {
  return fs
    .readdirSync(backupDir())
    .filter((f) => NAME_RE.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(backupDir(), f))
      return { name: f, size: st.size, createdAt: st.mtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function backupPath(name: string): string | null {
  if (!NAME_RE.test(name)) return null
  const p = path.join(backupDir(), name)
  return fs.existsSync(p) ? p : null
}

export async function createBackup(tag = 'manual'): Promise<string> {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const name = `backup-${stamp}-${tag.replace(/[^\w-]/g, '')}.tar.gz`
  const work = fs.mkdtempSync(path.join(dataPath('tmp'), 'bk-'))
  try {
    await db().backup(path.join(work, 'store.db'))
    fs.writeFileSync(path.join(work, 'backup.json'), JSON.stringify({ app: 'baby-store', schema: schemaVersion(), createdAt: new Date().toISOString() }))
    const uploads = dataPath('uploads')
    const entries = ['store.db', 'backup.json']
    if (fs.existsSync(uploads)) {
      fs.cpSync(uploads, path.join(work, 'uploads'), { recursive: true })
      entries.push('uploads')
    }
    await tar.create({ gzip: true, file: path.join(backupDir(), name), cwd: work, portable: true }, entries)
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
  return name
}

export function pruneBackups(keep: number) {
  const list = listBackups().filter((b) => b.name.includes('-auto'))
  for (const b of list.slice(Math.max(1, keep))) fs.rmSync(path.join(backupDir(), b.name), { force: true })
}

/** يتحقق من الأرشيف ثم يستبدل البيانات الحالية (مع نسخة أمان تلقائية قبل الاستعادة) */
export async function restoreBackup(archive: string): Promise<{ safety: string }> {
  const work = fs.mkdtempSync(path.join(dataPath('tmp'), 'rs-'))
  try {
    await tar.extract({
      file: archive,
      cwd: work,
      strict: true,
      filter: (p) => {
        const n = p.replace(/\\/g, '/')
        return !n.includes('..') && (n === 'store.db' || n === 'backup.json' || n.startsWith('uploads/') || n === 'uploads')
      },
    })
    const dbFile = path.join(work, 'store.db')
    if (!fs.existsSync(dbFile)) throw new Error('الملف ليس نسخة احتياطية صالحة (قاعدة البيانات غير موجودة)')
    const check = new Database(dbFile, { readonly: true })
    try {
      const ok = check.pragma('integrity_check', { simple: true })
      if (ok !== 'ok') throw new Error('قاعدة البيانات في النسخة تالفة')
      const v = check.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value: string } | undefined
      if (!v || Number(v.value) > schemaVersion()) throw new Error('النسخة من إصدار أحدث من التطبيق الحالي')
      if (!check.prepare("SELECT 1 FROM sqlite_master WHERE name='orders'").get()) throw new Error('النسخة لا تحتوي جداول المتجر')
    } finally {
      check.close()
    }
    const safety = await createBackup('before-restore')
    closeDb()
    for (const f of ['store.db', 'store.db-wal', 'store.db-shm']) fs.rmSync(dataPath(f), { force: true })
    fs.copyFileSync(dbFile, dataPath('store.db'))
    const newUploads = path.join(work, 'uploads')
    if (fs.existsSync(newUploads)) {
      const old = dataPath(`uploads-old-${Date.now()}`)
      if (fs.existsSync(dataPath('uploads'))) fs.renameSync(dataPath('uploads'), old)
      fs.cpSync(newUploads, dataPath('uploads'), { recursive: true })
      fs.rmSync(old, { recursive: true, force: true })
    }
    clearSettingsCache()
    clearAppearanceCache()
    invalidateCatalog()
    db() // يعيد الفتح ويطبق أي ترحيلات ناقصة
    return { safety }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

/** نسخة تلقائية يومية إن كانت مفعلة */
export async function autoBackupIfDue() {
  const s = getSetting('backup')
  if (!s.autoEnabled) return
  const last = s.lastAutoAt ? new Date(s.lastAutoAt).getTime() : 0
  if (Date.now() - last < 24 * 3600e3) return
  setSetting('backup', { ...s, lastAutoAt: new Date().toISOString() })
  try {
    await createBackup('auto')
    pruneBackups(s.keep)
  } catch (e) {
    console.error('[auto-backup]', e)
  }
}
