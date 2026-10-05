import { AsyncLocalStorage } from 'node:async_hooks'
import crypto from 'node:crypto'
import path from 'node:path'
import { MIGRATIONS, PRELUDE } from './schema'
import { bootstrapContent } from './bootstrap'

// قاعدة البيانات: PostgreSQL.
// - الإنتاج: متغير DATABASE_URL (مثل Supabase عبر مجمّع الاتصالات Transaction pooler).
// - التطوير والاختبارات: بدون DATABASE_URL تُستخدم PGlite (PostgreSQL مضمّن) في مجلد DATA_DIR أو في الذاكرة.
// كل الجداول في المخطط store، والتواريخ نصوص UTC بصيغة 'YYYY-MM-DD HH:MM:SS'.

export type Row = Record<string, unknown>
type Params = unknown[]
type Result = { rows: Row[]; count: number }

interface Conn {
  query(sql: string, params: Params): Promise<Result>
  exec(sql: string): Promise<void>
  begin<T>(fn: (c: Conn) => Promise<T>): Promise<T>
}

type Driver = Conn & { close(): Promise<void> }

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR || './data')
}

export function dataPath(...parts: string[]): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), ...parts)
}

// ————— المشغّلات —————

/**
 * خيارات الاتصال من DATABASE_URL. sslmode=require يعني تشفيراً دون التحقق من الشهادة (كما في libpq)،
 * وverify-full يتحقق منها. بدون sslmode: تشفير لخوادم Supabase فقط.
 */
export function pgConfig(url: string) {
  const u = new URL(url)
  const mode = u.searchParams.get('sslmode') || (/\.supabase\.(com|co)$/i.test(u.hostname) ? 'require' : 'disable')
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)) || 'postgres',
    ssl: mode === 'disable' ? false : mode === 'verify-full' || mode === 'verify-ca' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  }
}

async function postgresDriver(url: string): Promise<Driver> {
  // node-postgres يرسل كل استعلام دفعة واحدة تنتهي بـ Sync، فيعمل مع مجمّع الاتصالات (transaction mode)
  // دون جمل مُحضّرة مسماة ودون جولات وصف منفصلة
  const { default: pg } = await import('pg')
  const num = (x: string) => Number(x)
  const types = {
    getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
      oid === 20 || oid === 1700 ? num : pg.types.getTypeParser(oid, format as 'text')) as typeof pg.types.getTypeParser,
  }
  const connect = (u: string) => {
    const pool = new pg.Pool({
      ...pgConfig(u),
      max: Number(process.env.DB_POOL_MAX || 3),
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
      allowExitOnIdle: true,
      types,
    })
    // خطأ في اتصال خامل (انقطاع الشبكة) لا يُسقط العملية؛ يُستبدل الاتصال عند الطلب التالي
    pool.on('error', () => {})
    return pool
  }
  let pool = connect(url)
  // مجمّع Supabase موزع على عنقودين (aws-0 / aws-1): إن رُفض المستخدم نجرب الآخر
  try {
    await pool.query('SELECT 1')
  } catch (e) {
    const m = url.match(/@aws-(\d)-([a-z0-9-]+)\.pooler\.supabase\.com/)
    if (!m || !/tenant or user not found/i.test(String((e as Error).message))) throw e
    await pool.end().catch(() => {})
    pool = connect(url.replace(`@aws-${m[1]}-`, `@aws-${m[1] === '0' ? '1' : '0'}-`))
    await pool.query('SELECT 1')
  }
  type Q = { query: (text: string, values?: unknown[]) => Promise<{ rows: Row[]; rowCount: number | null }> }
  const wrap = (s: Q): Conn => ({
    async query(text, params) {
      const r = await s.query(text, params.length ? params : undefined)
      return { rows: r.rows, count: r.rowCount ?? r.rows.length }
    },
    async exec(text) {
      await s.query(text)
    },
    begin() {
      throw new Error('nested begin')
    },
  })
  const p = pool
  return {
    ...wrap(p as unknown as Q),
    async begin(fn) {
      const client = await p.connect()
      let broken: Error | undefined
      try {
        await client.query('BEGIN')
        const out = await fn(wrap(client as unknown as Q))
        await client.query('COMMIT')
        return out
      } catch (e) {
        await client.query('ROLLBACK').catch((err: Error) => (broken = err))
        throw e
      } finally {
        client.release(broken)
      }
    },
    close: () => p.end(),
  }
}

async function pgliteDriver(): Promise<Driver> {
  // استيراد غير مُتتبَّع: PGlite للتطوير المحلي فقط، فلا تُضمَّن في حزمة الخادم السحابية
  const pkg = '@electric-sql/pglite'
  const { PGlite, types } = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ pkg)) as typeof import('@electric-sql/pglite')
  const dir = process.env.PGLITE_DIR || dataPath('pglite')
  if (dir !== 'memory://') (await import('node:fs')).mkdirSync(dir, { recursive: true })
  const pg = await PGlite.create(dir === 'memory://' ? undefined : dir, {
    parsers: { [types.INT8]: (x: string) => Number(x), [types.NUMERIC]: (x: string) => Number(x) },
  })
  await pg.exec("CREATE SCHEMA IF NOT EXISTS store; SET search_path TO store, public; SET TIME ZONE 'UTC';")
  type Tx = Parameters<Parameters<typeof pg.transaction>[0]>[0]
  const wrap = (s: typeof pg | Tx): Conn => ({
    async query(text, params) {
      const r = await s.query(text, params)
      return { rows: r.rows as Row[], count: r.affectedRows ?? r.rows.length }
    },
    async exec(text) {
      await s.exec(text)
    },
    begin() {
      throw new Error('nested begin')
    },
  })
  return {
    ...wrap(pg),
    begin: (fn) => pg.transaction((t) => fn(wrap(t))) as never,
    close: () => pg.close(),
  }
}

// ————— الاتصال والترحيل —————

type GlobalDb = { __storeDb?: Promise<Driver> }
const g = globalThis as unknown as GlobalDb
const txStore = new AsyncLocalStorage<Conn>()

async function open(): Promise<Driver> {
  const url = process.env.DATABASE_URL
  const d = url ? await postgresDriver(url) : await pgliteDriver()
  await migrate(d)
  return d
}

async function driver(): Promise<Driver> {
  if (!g.__storeDb) {
    g.__storeDb = open()
    g.__storeDb.catch(() => {
      g.__storeDb = undefined
    })
  }
  return g.__storeDb
}

async function conn(): Promise<Conn> {
  return txStore.getStore() || (await driver())
}

const MIGRATION_LOCK = 72_001

export async function migrate(d: Driver) {
  // مسار سريع عند الإقلاع: المخطط محدث والهيكل الأساسي منشأ
  try {
    const r = await d.query("SELECT key, value FROM meta WHERE key IN ('schema_version','bootstrapped')", [])
    const m = new Map(r.rows.map((x) => [x.key as string, x.value as string]))
    if (Number(m.get('schema_version')) === MIGRATIONS.length && m.has('bootstrapped')) return
  } catch {}
  await d.begin(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK])
    await c.exec(PRELUDE)
    const row = (await c.query("SELECT value FROM meta WHERE key='schema_version'", [])).rows[0] as { value: string } | undefined
    let version = row ? Number(row.value) : 0
    while (version < MIGRATIONS.length) {
      await c.exec(MIGRATIONS[version])
      version++
      await c.query(
        "INSERT INTO meta(key,value) VALUES('schema_version',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [String(version)],
      )
    }
    await txStore.run(c, () => bootstrapContent())
  })
}

export function schemaVersion(): number {
  return MIGRATIONS.length
}

/** يغلق الاتصال الحالي (للسكربتات والاختبارات) */
export async function closeDb() {
  const p = g.__storeDb
  g.__storeDb = undefined
  if (p) await (await p).close().catch(() => {})
}

// ————— واجهة الاستعلام (على نمط prepare/get/all/run) —————

/** يحول علامات ? إلى $1..$n (مع تجاهل ما بين علامات التنصيص) ويدعم المعاملات المسماة @name */
export function toPg(sql: string, args: unknown[]): { text: string; params: unknown[] } {
  const named = args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0]) && !(args[0] instanceof Uint8Array)
  const obj = named ? (args[0] as Record<string, unknown>) : null
  const params: unknown[] = []
  let out = ''
  let i = 0
  let n = 0
  while (i < sql.length) {
    const c = sql[i]
    if (c === "'") {
      const j = sql.indexOf("'", i + 1)
      let end = j < 0 ? sql.length : j
      while (sql[end + 1] === "'") end = sql.indexOf("'", end + 2)
      out += sql.slice(i, end + 1)
      i = end + 1
      continue
    }
    if (c === '?' && !obj) {
      out += `$${++n}`
      params.push(norm(args[n - 1]))
      i++
      continue
    }
    if (c === '@' && obj && /[A-Za-z_]/.test(sql[i + 1] || '')) {
      const m = /^@([A-Za-z_][A-Za-z0-9_]*)/.exec(sql.slice(i))!
      params.push(norm(obj[m[1]]))
      out += `$${params.length}`
      i += m[0].length
      continue
    }
    out += c
    i++
  }
  if (!obj && n !== args.length) throw new Error(`عدد المعاملات (${args.length}) لا يطابق الاستعلام (${n})`)
  return { text: out, params }
}

function norm(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Buffer.isBuffer(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
  return v
}

export type RunResult = { changes: number; lastInsertRowid: number }

export interface Statement {
  get<T = Row>(...args: unknown[]): Promise<T | undefined>
  all<T = Row>(...args: unknown[]): Promise<T[]>
  run(...args: unknown[]): Promise<RunResult>
}

export interface DB {
  prepare(sql: string): Statement
  exec(sql: string): Promise<void>
}

async function q(sql: string, args: unknown[]): Promise<Result> {
  const { text, params } = toPg(sql, args)
  const c = await conn()
  try {
    return await c.query(text, params)
  } catch (e) {
    if (e && typeof e === 'object') (e as { sql?: string }).sql = text.slice(0, 300)
    throw e
  }
}

const facade: DB = {
  prepare(sql: string): Statement {
    return {
      async get<T>(...args: unknown[]) {
        return (await q(sql, args)).rows[0] as T | undefined
      },
      async all<T>(...args: unknown[]) {
        return (await q(sql, args)).rows as T[]
      },
      async run(...args: unknown[]) {
        let text = sql.trim().replace(/;+\s*$/, '')
        if (/^insert\s/i.test(text) && !/\breturning\b/i.test(text)) text += ' RETURNING *'
        const r = await q(text, args)
        const first = r.rows[0] as { id?: unknown } | undefined
        return { changes: r.count, lastInsertRowid: first && first.id != null ? Number(first.id) : 0 }
      },
    }
  },
  async exec(sql: string) {
    await (await conn()).exec(sql)
  },
}

export function db(): DB {
  return facade
}

const WRITE_LOCK = 72_002

/**
 * معاملة كتابة متسلسلة (قفل عام) — تكافئ BEGIN IMMEDIATE في SQLite وتمنع
 * تعارض الطلبات المتزامنة على المخزون والكوبونات وأرقام الطلبات.
 * المعاملات المتداخلة تُنفذ داخل المعاملة الحالية.
 */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn()
  const d = await driver()
  return d.begin(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [WRITE_LOCK])
    return txStore.run(c, fn)
  })
}

export function inTx(): boolean {
  return !!txStore.getStore()
}

// ————— أدوات —————

export function nowSql(d = new Date()): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

export function sqlToDate(s: string | null | undefined): Date | null {
  if (!s) return null
  return new Date(s.replace(' ', 'T') + (s.length <= 19 ? 'Z' : ''))
}

export async function nextCounter(key: string, start: number): Promise<number> {
  const r = await db()
    .prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=counters.value+1 RETURNING value')
    .get<{ value: number }>(key, start)
  return r!.value
}

let cachedSecret: string | null = null
/** مفتاح سري للخادم فقط: من APP_SECRET أو يُنشأ تلقائياً مرة واحدة ويُحفظ في قاعدة البيانات */
export async function appSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret
  const env = process.env.APP_SECRET
  if (env && env.length >= 32) return (cachedSecret = env)
  const row = await db().prepare("SELECT value FROM meta WHERE key='app_secret'").get<{ value: string }>()
  if (row) return (cachedSecret = row.value)
  const fresh = crypto.randomBytes(48).toString('base64url')
  await db().prepare("INSERT INTO meta(key,value) VALUES('app_secret',?) ON CONFLICT(key) DO NOTHING").run(fresh)
  const again = await db().prepare("SELECT value FROM meta WHERE key='app_secret'").get<{ value: string }>()
  return (cachedSecret = again!.value)
}

export async function hmac(value: string): Promise<string> {
  return crypto.createHmac('sha256', await appSecret()).update(value).digest('base64url')
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/** هل الخطأ تعارض قيمة فريدة؟ */
export function isUniqueViolation(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === '23505'
}
