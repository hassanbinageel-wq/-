import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { MIGRATIONS } from './schema'

export type DB = Database.Database

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR || './data')
}

export function dataPath(...parts: string[]): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), ...parts)
}

export function ensureDataDirs() {
  for (const d of ['', 'uploads/public', 'uploads/private', 'backups', 'tmp']) {
    fs.mkdirSync(dataPath(d), { recursive: true })
  }
}

export function openDatabase(file = dataPath('store.db')): DB {
  ensureDataDirs()
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  migrate(db)
  return db
}

export function migrate(db: DB) {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)')
  const row = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value: string } | undefined
  let version = row ? Number(row.value) : 0
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version]
    db.transaction(() => {
      db.exec(sql)
      db.prepare("INSERT INTO meta(key,value) VALUES('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(
        String(version + 1),
      )
    })()
    version++
  }
}

export function schemaVersion(): number {
  return MIGRATIONS.length
}

type GlobalDb = { __storeDb?: DB }
const g = globalThis as unknown as GlobalDb

export function db(): DB {
  if (!g.__storeDb) g.__storeDb = openDatabase()
  return g.__storeDb
}

/** يغلق الاتصال الحالي (يستخدم قبل استعادة نسخة احتياطية) */
export function closeDb() {
  if (g.__storeDb) {
    try {
      g.__storeDb.close()
    } catch {}
    g.__storeDb = undefined
  }
}

/** معاملة كتابة فورية (BEGIN IMMEDIATE) لمنع تعارض الطلبات المتزامنة */
export function tx<T>(fn: () => T): T {
  return db().transaction(fn).immediate()
}

export function nowSql(d = new Date()): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

export function sqlToDate(s: string | null | undefined): Date | null {
  if (!s) return null
  return new Date(s.replace(' ', 'T') + (s.length <= 19 ? 'Z' : ''))
}

export function nextCounter(key: string, start: number): number {
  const d = db()
  const row = d.prepare('SELECT value FROM counters WHERE key=?').get(key) as { value: number } | undefined
  const next = row ? row.value + 1 : start
  d.prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, next)
  return next
}

let cachedSecret: string | null = null
/** مفتاح سري للخادم فقط: من APP_SECRET أو ملف يُنشأ تلقائياً داخل مجلد البيانات */
export function appSecret(): string {
  if (cachedSecret) return cachedSecret
  const env = process.env.APP_SECRET
  if (env && env.length >= 32) {
    cachedSecret = env
    return env
  }
  ensureDataDirs()
  const file = dataPath('.secret')
  if (fs.existsSync(file)) {
    cachedSecret = fs.readFileSync(file, 'utf8').trim()
  } else {
    cachedSecret = crypto.randomBytes(48).toString('base64url')
    fs.writeFileSync(file, cachedSecret, { mode: 0o600 })
  }
  return cachedSecret
}

export function hmac(value: string): string {
  return crypto.createHmac('sha256', appSecret()).update(value).digest('base64url')
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
