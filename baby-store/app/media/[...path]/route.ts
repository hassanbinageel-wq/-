import fs from 'node:fs'
import path from 'node:path'
import { resolvePublicFile } from '@/lib/server/media'

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}

// الملفات العامة فقط (صور المنتجات والبنرات والخطوط). السندات محفوظة في مجلد خاص لا يُخدم من هنا
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  const rel = parts.join('/')
  const file = resolvePublicFile(rel)
  const type = TYPES[path.extname(rel).toLowerCase()]
  if (!file || !type) return new Response('Not found', { status: 404 })
  const stat = fs.statSync(file)
  const body = fs.readFileSync(file)
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ...(type.startsWith('font/') ? { 'Access-Control-Allow-Origin': '*' } : {}),
    },
  })
}
