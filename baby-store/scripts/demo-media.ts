// صور البيانات التجريبية: تُرسم من SVG وتُحفظ ملفات ثابتة في public/demo (تُرفع مع المشروع)
// فتعمل البيانات التجريبية دون رفع صور إلى قاعدة البيانات. تُحذف سجلاتها مع البيانات التجريبية.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { db } from '../lib/server/db'

const DIR = path.join(process.cwd(), 'public', 'demo')

export async function demoMedia(svg: string, opts: { name: string; purpose: string; widths: number[] }): Promise<number> {
  const key = `${opts.name}-${crypto.createHash('sha1').update(svg).digest('hex').slice(0, 8)}`
  fs.mkdirSync(DIR, { recursive: true })
  const meta = await sharp(Buffer.from(svg)).metadata()
  const w0 = meta.width || opts.widths[opts.widths.length - 1]
  const h0 = meta.height || w0
  const sizes = opts.widths.filter((w) => w <= w0)
  for (const w of sizes) {
    const file = path.join(DIR, `${key}-${w}.webp`)
    if (!fs.existsSync(file)) await sharp(Buffer.from(svg)).resize({ width: w }).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(file)
  }
  const largest = sizes[sizes.length - 1]
  const r = await db()
    .prepare(
      "INSERT INTO media(kind,path,ext,mime,width,height,sizes,bytes,original_name,purpose,is_demo) VALUES('public',?,'webp','image/webp',?,?,?,0,?,?,1) RETURNING id",
    )
    .get<{ id: number }>(`static/demo/${key}`, largest, Math.round((h0 * largest) / w0), JSON.stringify(sizes), `${opts.name}.webp`, opts.purpose)
  return r!.id
}
