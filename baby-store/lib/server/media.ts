import crypto from 'node:crypto'
import sharp from 'sharp'
import { db, parseJson, tx } from './db'
import type { ImageRef } from '../shared/types'

// الصور والملفات تُحفظ داخل قاعدة البيانات (جدول media_blobs) فلا تحتاج خدمة تخزين خارجية.
// العامة تُخدم من /media/... مع تخزين مؤقت طويل في المتصفح وشبكة التوزيع، والخاصة (السندات) لمستخدم مخوّل فقط.
// الصور التجريبية ملفات ثابتة في public/demo (المسار يبدأ بـ static/).

/** الحد الأقصى لحجم الملف المرفوع (حدود الاستضافة السحابية ~6 ميجابايت للطلب) */
export const MAX_UPLOAD_BYTES = 5.5 * 1024 * 1024
const IMAGE_WIDTHS = [400, 800, 1400]

export type MediaRow = {
  id: number
  kind: 'public' | 'private'
  path: string
  ext: string
  mime: string
  width: number | null
  height: number | null
  sizes: string
  bytes: number
  original_name: string | null
  purpose: string
  is_demo?: number
  created_at: string
}

export class UploadError extends Error {}

function newPath(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomBytes(12).toString('base64url')}`
}

type NewMedia = Omit<MediaRow, 'id' | 'created_at'> & { created_by?: number | null; is_demo?: number }

/** يحفظ سجل الوسائط وملفاته في معاملة واحدة */
async function storeMedia(m: NewMedia, files: { key: string; mime: string; data: Buffer }[]): Promise<number> {
  return tx(async () => {
    const r = await db()
      .prepare(
        'INSERT INTO media(kind,path,ext,mime,width,height,sizes,bytes,original_name,purpose,created_by,is_demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
      )
      .get<{ id: number }>(m.kind, m.path, m.ext, m.mime, m.width, m.height, m.sizes, m.bytes, m.original_name, m.purpose, m.created_by ?? null, m.is_demo ?? 0)
    const id = r!.id
    for (const f of files) {
      await db().prepare('INSERT INTO media_blobs(key,media_id,mime,bytes,data) VALUES(?,?,?,?,?) RETURNING key').get(f.key, id, f.mime, f.data.length, f.data)
    }
    return id
  })
}

async function readImageMeta(buf: Buffer) {
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError('حجم الملف أكبر من 5 ميجابايت')
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>
  try {
    meta = await sharp(buf, { limitInputPixels: 60_000_000 }).metadata()
  } catch {
    throw new UploadError('الملف ليس صورة صالحة')
  }
  if (!meta.format || !['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'].includes(meta.format)) {
    throw new UploadError('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP')
  }
  return meta
}

/** صورة عامة (منتج، بانر، قسم، شعار...) تُحول إلى WEBP بعدة مقاسات وتُزال بياناتها الوصفية */
export async function saveImage(
  buf: Buffer,
  opts: { purpose: string; originalName?: string; userId?: number | null; isDemo?: boolean; widths?: number[] },
): Promise<number> {
  const meta = await readImageMeta(buf)
  const path = newPath()
  const img = sharp(buf, { limitInputPixels: 60_000_000 }).rotate()
  const { width: w0 = 0, height: h0 = 0 } = await img.clone().metadata()
  // بعد التدوير قد تتبدل الأبعاد
  const rotated = (meta.orientation || 1) >= 5
  const width = rotated ? h0 : w0
  const height = rotated ? w0 : h0
  const max = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]
  const wanted = (opts.widths || IMAGE_WIDTHS).filter((w) => w < width)
  const sizes = Array.from(new Set([...wanted, Math.min(width, max)])).sort((a, b) => a - b)
  const files: { key: string; mime: string; data: Buffer }[] = []
  for (const w of sizes) {
    const data = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    files.push({ key: `public/${path}-${w}.webp`, mime: 'image/webp', data })
  }
  return storeMedia(
    {
      kind: 'public',
      path,
      ext: 'webp',
      mime: 'image/webp',
      width,
      height,
      sizes: JSON.stringify(sizes),
      bytes: files.reduce((s, f) => s + f.data.length, 0),
      original_name: opts.originalName?.slice(0, 200) || null,
      purpose: opts.purpose,
      created_by: opts.userId,
      is_demo: opts.isDemo ? 1 : 0,
    },
    files,
  )
}

/** أيقونة المتصفح: PNG بمقاسات 32 و180 و512 */
export async function saveFavicon(buf: Buffer, userId?: number): Promise<number> {
  await readImageMeta(buf)
  const path = newPath()
  const sizes = [32, 180, 512]
  const files: { key: string; mime: string; data: Buffer }[] = []
  for (const s of sizes) {
    const data = await sharp(buf).rotate().resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    files.push({ key: `public/${path}-${s}.png`, mime: 'image/png', data })
  }
  return storeMedia(
    {
      kind: 'public', path, ext: 'png', mime: 'image/png', width: 512, height: 512,
      sizes: JSON.stringify(sizes), bytes: files.reduce((s, f) => s + f.data.length, 0), original_name: null, purpose: 'favicon', created_by: userId,
    },
    files,
  )
}

/** سند تحويل (خاص): صورة يعاد ترميزها بدون بيانات وصفية، أو ملف PDF */
export async function savePrivateReceipt(buf: Buffer, originalName: string, userId?: number): Promise<number> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError('حجم الملف أكبر من 5 ميجابايت')
  const path = newPath()
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    return storeMedia(
      {
        kind: 'private', path, ext: 'pdf', mime: 'application/pdf', width: null, height: null,
        sizes: '[]', bytes: buf.length, original_name: originalName.slice(0, 200), purpose: 'receipt', created_by: userId,
      },
      [{ key: `private/${path}.pdf`, mime: 'application/pdf', data: buf }],
    )
  }
  const meta = await readImageMeta(buf)
  const out = await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  return storeMedia(
    {
      kind: 'private', path, ext: 'jpg', mime: 'image/jpeg', width: meta.width ?? null, height: meta.height ?? null,
      sizes: '[]', bytes: out.length, original_name: originalName.slice(0, 200), purpose: 'receipt', created_by: userId,
    },
    [{ key: `private/${path}.jpg`, mime: 'image/jpeg', data: out }],
  )
}

const FONT_SIGS: { sig: string; ext: string; mime: string }[] = [
  { sig: 'wOF2', ext: 'woff2', mime: 'font/woff2' },
  { sig: 'wOFF', ext: 'woff', mime: 'font/woff' },
  { sig: 'OTTO', ext: 'otf', mime: 'font/otf' },
  { sig: '\x00\x01\x00\x00', ext: 'ttf', mime: 'font/ttf' },
  { sig: 'true', ext: 'ttf', mime: 'font/ttf' },
]

export async function saveFont(buf: Buffer, originalName: string, userId?: number): Promise<number> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError('حجم ملف الخط كبير جداً')
  const head = buf.subarray(0, 4).toString('latin1')
  const t = FONT_SIGS.find((f) => f.sig === head)
  if (!t) throw new UploadError('ملف الخط غير صالح. الصيغ المدعومة: TTF, OTF, WOFF, WOFF2')
  const path = newPath()
  return storeMedia(
    {
      kind: 'public', path, ext: t.ext, mime: t.mime, width: null, height: null,
      sizes: '[]', bytes: buf.length, original_name: originalName.slice(0, 200), purpose: 'font', created_by: userId,
    },
    [{ key: `public/${path}.${t.ext}`, mime: t.mime, data: buf }],
  )
}

export async function getMedia(id: number | null | undefined): Promise<MediaRow | null> {
  if (!id) return null
  return (await db().prepare('SELECT * FROM media WHERE id=?').get<MediaRow>(id)) || null
}

/** تحميل عدة سجلات وسائط دفعة واحدة */
export async function getMediaMap(ids: (number | null | undefined)[]): Promise<Map<number, MediaRow>> {
  const list = Array.from(new Set(ids.filter((x): x is number => !!x)))
  if (!list.length) return new Map()
  const rows = await db().prepare(`SELECT * FROM media WHERE id IN (${list.map(() => '?').join(',')})`).all<MediaRow>(...list)
  return new Map(rows.map((r) => [r.id, r]))
}

/** رابط ملف عام بمقاس معين (الصور التجريبية الثابتة مسارها static/...) */
function fileUrl(m: MediaRow, size: number | null): string {
  const suffix = size ? `-${size}` : ''
  if (m.path.startsWith('static/')) return `/${m.path.slice(7)}${suffix}.${m.ext}`
  return `/media/${m.path}${suffix}.${m.ext}`
}

export function mediaUrl(m: MediaRow | null, preferWidth = 1080): string | null {
  if (!m) return null
  if (m.kind !== 'public') return null
  const sizes = parseJson<number[]>(m.sizes, [])
  if (!sizes.length) return fileUrl(m, null)
  const w = sizes.find((s) => s >= preferWidth) ?? sizes[sizes.length - 1]
  return fileUrl(m, w)
}

export function mediaSrcset(m: MediaRow | null): string {
  if (!m || m.kind !== 'public') return ''
  const sizes = parseJson<number[]>(m.sizes, [])
  return sizes.map((w) => `${fileUrl(m, w)} ${w}w`).join(', ')
}

export function imageRef(m: MediaRow | null | undefined, alt = '', optionValue: string | null = null, preferWidth = 1080): ImageRef | null {
  if (!m) return null
  return { id: m.id, url: mediaUrl(m, preferWidth) || '', srcset: mediaSrcset(m), w: m.width, h: m.height, alt, optionValue }
}

export async function imageRefById(id: number | null | undefined, alt = '', preferWidth = 1080): Promise<ImageRef | null> {
  return imageRef(await getMedia(id), alt, null, preferWidth)
}

/** ملف عام يُطلب عبر /media/... */
export async function getPublicBlob(rel: string): Promise<{ mime: string; data: Uint8Array } | null> {
  if (!/^[\w/.-]+$/.test(rel) || rel.includes('..')) return null
  const row = await db().prepare('SELECT mime, data FROM media_blobs WHERE key=?').get<{ mime: string; data: Uint8Array }>(`public/${rel}`)
  return row || null
}

/** ملف خاص (سند) — يُستدعى فقط بعد التحقق من الصلاحية */
export async function getPrivateBlob(m: MediaRow): Promise<{ mime: string; data: Uint8Array } | null> {
  if (m.kind !== 'private') return null
  const row = await db().prepare('SELECT mime, data FROM media_blobs WHERE key=?').get<{ mime: string; data: Uint8Array }>(`private/${m.path}.${m.ext}`)
  return row || null
}

export async function deleteMediaFiles(m: MediaRow) {
  await db().prepare('DELETE FROM media_blobs WHERE media_id=?').run(m.id)
}
