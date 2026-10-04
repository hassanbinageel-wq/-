import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { db, dataPath, parseJson } from './db'
import type { ImageRef } from '../shared/types'

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const IMAGE_WIDTHS = [320, 640, 1080, 1600]

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
  created_at: string
}

export class UploadError extends Error {}

function newBase(kind: 'public' | 'private'): { rel: string; abs: string } {
  const now = new Date()
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const name = crypto.randomBytes(12).toString('base64url')
  const rel = `${dir}/${name}`
  const absDir = dataPath('uploads', kind, dir)
  fs.mkdirSync(absDir, { recursive: true })
  return { rel, abs: path.join(/*turbopackIgnore: true*/ dataPath('uploads', kind), rel) }
}

function insertMedia(m: Omit<MediaRow, 'id' | 'created_at'> & { created_by?: number | null; is_demo?: number }): number {
  const r = db()
    .prepare(
      'INSERT INTO media(kind,path,ext,mime,width,height,sizes,bytes,original_name,purpose,created_by,is_demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(m.kind, m.path, m.ext, m.mime, m.width, m.height, m.sizes, m.bytes, m.original_name, m.purpose, m.created_by ?? null, m.is_demo ?? 0)
  return Number(r.lastInsertRowid)
}

async function readImageMeta(buf: Buffer) {
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError('حجم الملف أكبر من 12 ميجابايت')
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
  const base = newBase('public')
  const img = sharp(buf, { limitInputPixels: 60_000_000 }).rotate()
  const { width: w0 = 0, height: h0 = 0 } = await img.clone().metadata()
  // بعد التدوير قد تتبدل الأبعاد
  const rotated = (meta.orientation || 1) >= 5
  const width = rotated ? h0 : w0
  const height = rotated ? w0 : h0
  const wanted = (opts.widths || IMAGE_WIDTHS).filter((w) => w < width)
  const sizes = Array.from(new Set([...wanted, Math.min(width, 1600)])).sort((a, b) => a - b)
  let total = 0
  for (const w of sizes) {
    const out = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    fs.writeFileSync(`${base.abs}-${w}.webp`, out)
    total += out.length
  }
  return insertMedia({
    kind: 'public',
    path: base.rel,
    ext: 'webp',
    mime: 'image/webp',
    width,
    height,
    sizes: JSON.stringify(sizes),
    bytes: total,
    original_name: opts.originalName?.slice(0, 200) || null,
    purpose: opts.purpose,
    created_by: opts.userId,
    is_demo: opts.isDemo ? 1 : 0,
  })
}

/** أيقونة المتصفح: PNG بمقاسات 32 و180 و512 */
export async function saveFavicon(buf: Buffer, userId?: number): Promise<number> {
  await readImageMeta(buf)
  const base = newBase('public')
  const sizes = [32, 180, 512]
  let total = 0
  for (const s of sizes) {
    const out = await sharp(buf).rotate().resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    fs.writeFileSync(`${base.abs}-${s}.png`, out)
    total += out.length
  }
  return insertMedia({
    kind: 'public', path: base.rel, ext: 'png', mime: 'image/png', width: 512, height: 512,
    sizes: JSON.stringify(sizes), bytes: total, original_name: null, purpose: 'favicon', created_by: userId,
  })
}

/** سند تحويل (خاص): صورة يعاد ترميزها بدون بيانات وصفية، أو ملف PDF */
export async function savePrivateReceipt(buf: Buffer, originalName: string, userId?: number): Promise<number> {
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError('حجم الملف أكبر من 12 ميجابايت')
  const base = newBase('private')
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    fs.writeFileSync(`${base.abs}.pdf`, buf)
    return insertMedia({
      kind: 'private', path: base.rel, ext: 'pdf', mime: 'application/pdf', width: null, height: null,
      sizes: '[]', bytes: buf.length, original_name: originalName.slice(0, 200), purpose: 'receipt', created_by: userId,
    })
  }
  const meta = await readImageMeta(buf)
  const out = await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
  fs.writeFileSync(`${base.abs}.jpg`, out)
  return insertMedia({
    kind: 'private', path: base.rel, ext: 'jpg', mime: 'image/jpeg', width: meta.width ?? null, height: meta.height ?? null,
    sizes: '[]', bytes: out.length, original_name: originalName.slice(0, 200), purpose: 'receipt', created_by: userId,
  })
}

const FONT_SIGS: { sig: string; ext: string; mime: string }[] = [
  { sig: 'wOF2', ext: 'woff2', mime: 'font/woff2' },
  { sig: 'wOFF', ext: 'woff', mime: 'font/woff' },
  { sig: 'OTTO', ext: 'otf', mime: 'font/otf' },
  { sig: '\x00\x01\x00\x00', ext: 'ttf', mime: 'font/ttf' },
  { sig: 'true', ext: 'ttf', mime: 'font/ttf' },
]

export function saveFont(buf: Buffer, originalName: string, userId?: number): number {
  if (buf.length > 8 * 1024 * 1024) throw new UploadError('حجم ملف الخط كبير جداً')
  const head = buf.subarray(0, 4).toString('latin1')
  const t = FONT_SIGS.find((f) => f.sig === head)
  if (!t) throw new UploadError('ملف الخط غير صالح. الصيغ المدعومة: TTF, OTF, WOFF, WOFF2')
  const base = newBase('public')
  fs.writeFileSync(`${base.abs}.${t.ext}`, buf)
  return insertMedia({
    kind: 'public', path: base.rel, ext: t.ext, mime: t.mime, width: null, height: null,
    sizes: '[]', bytes: buf.length, original_name: originalName.slice(0, 200), purpose: 'font', created_by: userId,
  })
}

export function getMedia(id: number | null | undefined): MediaRow | null {
  if (!id) return null
  return (db().prepare('SELECT * FROM media WHERE id=?').get(id) as MediaRow | undefined) || null
}

export function mediaUrl(m: MediaRow | null, preferWidth = 1080): string | null {
  if (!m) return null
  if (m.kind !== 'public') return null
  const sizes = parseJson<number[]>(m.sizes, [])
  if (!sizes.length) return `/media/${m.path}.${m.ext}`
  const w = sizes.find((s) => s >= preferWidth) ?? sizes[sizes.length - 1]
  return `/media/${m.path}-${w}.${m.ext}`
}

export function mediaSrcset(m: MediaRow | null): string {
  if (!m || m.kind !== 'public') return ''
  const sizes = parseJson<number[]>(m.sizes, [])
  return sizes.map((w) => `/media/${m.path}-${w}.${m.ext} ${w}w`).join(', ')
}

export function imageRef(m: MediaRow | null, alt = '', optionValue: string | null = null, preferWidth = 1080): ImageRef | null {
  if (!m) return null
  return { id: m.id, url: mediaUrl(m, preferWidth) || '', srcset: mediaSrcset(m), w: m.width, h: m.height, alt, optionValue }
}

export function imageRefById(id: number | null | undefined, alt = '', preferWidth = 1080): ImageRef | null {
  return imageRef(getMedia(id), alt, null, preferWidth)
}

/** المسار الفعلي لملف عام يُطلب عبر /media/... مع منع الخروج من المجلد */
export function resolvePublicFile(rel: string): string | null {
  if (!/^[\w/.-]+$/.test(rel) || rel.includes('..')) return null
  const root = dataPath('uploads', 'public')
  const abs = path.resolve(/*turbopackIgnore: true*/ root, rel)
  if (!abs.startsWith(root + path.sep)) return null
  return fs.existsSync(/*turbopackIgnore: true*/ abs) ? abs : null
}

export function privateFilePath(m: MediaRow): string | null {
  const root = dataPath('uploads', 'private')
  const abs = path.resolve(/*turbopackIgnore: true*/ root, `${m.path}.${m.ext}`)
  if (!abs.startsWith(root + path.sep)) return null
  return fs.existsSync(/*turbopackIgnore: true*/ abs) ? abs : null
}

export function deleteMediaFiles(m: MediaRow) {
  const root = dataPath('uploads', m.kind)
  const sizes = parseJson<number[]>(m.sizes, [])
  const files = sizes.length ? sizes.map((w) => `${m.path}-${w}.${m.ext}`) : [`${m.path}.${m.ext}`]
  for (const f of files) {
    const abs = path.resolve(/*turbopackIgnore: true*/ root, f)
    if (abs.startsWith(root + path.sep)) fs.rmSync(abs, { force: true })
  }
}
