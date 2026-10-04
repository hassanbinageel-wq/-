import { getPublicBlob } from '@/lib/server/media'

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

// الملفات العامة فقط (صور المنتجات والبنرات والخطوط). السندات ملفات خاصة لا تُخدم من هنا.
// أسماء الملفات عشوائية ولا تتغير، فتُخزن مؤقتاً لمدة طويلة في المتصفح وشبكة التوزيع.
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  const rel = parts.join('/')
  const type = TYPES[rel.split('.').pop()?.toLowerCase() || '']
  const blob = type ? await getPublicBlob(rel) : null
  if (!blob || !type) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } })
  const body = Buffer.from(blob.data)
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Netlify-CDN-Cache-Control': 'public, max-age=31536000, immutable, durable',
      'X-Content-Type-Options': 'nosniff',
      ...(type.startsWith('font/') ? { 'Access-Control-Allow-Origin': '*' } : {}),
    },
  })
}
