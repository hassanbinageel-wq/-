import { db, nowSql, parseJson, tx } from './db'
import { bumpCacheVersion, ensureFresh, onInvalidate } from './cache'
import { defaultAppearance, normalizeAppearance } from '../shared/theme'
import type { Appearance } from '../shared/types'

type Row = { id: number; status: string; data: string; note: string | null; created_by_name: string | null; created_at: string; published_at: string | null }

type CacheShape = { __appearancePublished?: Appearance }
const g = globalThis as unknown as CacheShape

export async function ensureAppearance() {
  const d = db()
  const pub = await d.prepare("SELECT id FROM appearance_versions WHERE status='published' LIMIT 1").get()
  if (!pub) {
    await d.prepare("INSERT INTO appearance_versions(status,data,note,published_at) VALUES('published',?,?,datetime('now'))").run(
      JSON.stringify(defaultAppearance()),
      'الإعداد الافتراضي',
    )
  }
}

export async function getPublishedAppearance(): Promise<Appearance> {
  await ensureFresh()
  if (g.__appearancePublished) return g.__appearancePublished
  await ensureAppearance()
  const row = await db().prepare("SELECT data FROM appearance_versions WHERE status='published' ORDER BY id DESC LIMIT 1").get() as
    | { data: string }
    | undefined
  const a = normalizeAppearance(parseJson(row?.data, null))
  g.__appearancePublished = a
  return a
}

export async function getDraftRow(): Promise<Row | undefined> {
  return await db().prepare("SELECT * FROM appearance_versions WHERE status='draft' ORDER BY id DESC LIMIT 1").get() as Row | undefined
}

export async function getDraftAppearance(): Promise<{ data: Appearance; hasDraft: boolean; updatedAt: string | null }> {
  const row = await getDraftRow()
  if (!row) return { data: await getPublishedAppearance(), hasDraft: false, updatedAt: null }
  return { data: normalizeAppearance(parseJson(row.data, null)), hasDraft: true, updatedAt: row.created_at }
}

export async function saveDraft(data: Appearance, user: { id: number; name: string }) {
  const d = db()
  const json = JSON.stringify(normalizeAppearance(data))
  const row = await getDraftRow()
  if (row) {
    await d.prepare("UPDATE appearance_versions SET data=?, created_by=?, created_by_name=?, created_at=datetime('now') WHERE id=?").run(
      json,
      user.id,
      user.name,
      row.id,
    )
  } else {
    await d.prepare("INSERT INTO appearance_versions(status,data,created_by,created_by_name) VALUES('draft',?,?,?)").run(json, user.id, user.name)
  }
}

/** نشر المسودة: النسخة المنشورة الحالية تصبح مؤرشفة (قابلة للاستعادة) */
export async function publishDraft(user: { id: number; name: string }, note?: string): Promise<boolean> {
  const d = db()
  const row = await getDraftRow()
  if (!row) return false
  await tx(async () => {
    await d.prepare("UPDATE appearance_versions SET status='archived' WHERE status='published'").run()
    await d.prepare("UPDATE appearance_versions SET status='published', published_at=?, note=?, created_by=?, created_by_name=? WHERE id=?").run(
      nowSql(),
      note || null,
      user.id,
      user.name,
      row.id,
    )
    // الاحتفاظ بآخر 20 نسخة مؤرشفة فقط
    await d.prepare(
        "DELETE FROM appearance_versions WHERE status='archived' AND id NOT IN (SELECT id FROM appearance_versions WHERE status='archived' ORDER BY id DESC LIMIT 20)",
      ).run()
  })
  await bumpCacheVersion()
  return true
}

/** حذف المسودة والعودة لآخر نسخة منشورة */
export async function discardDraft() {
  await db().prepare("DELETE FROM appearance_versions WHERE status='draft'").run()
}

/** نسخ نسخة سابقة إلى المسودة لمراجعتها ثم نشرها */
export async function restoreVersionToDraft(id: number, user: { id: number; name: string }): Promise<boolean> {
  const row = await db().prepare("SELECT data FROM appearance_versions WHERE id=? AND status IN ('published','archived')").get(id) as
    | { data: string }
    | undefined
  if (!row) return false
  await saveDraft(normalizeAppearance(parseJson(row.data, null)), user)
  return true
}

export async function listVersions() {
  return await db()
      .prepare(
        "SELECT id, status, note, created_by_name, created_at, published_at FROM appearance_versions WHERE status IN ('published','archived') ORDER BY id DESC LIMIT 20",
      )
      .all() as Omit<Row, 'data'>[]
}

export function clearAppearanceCache() {
  g.__appearancePublished = undefined
}
onInvalidate(clearAppearanceCache)
