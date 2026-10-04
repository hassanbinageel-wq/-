import type { MetadataRoute } from 'next'
import { db } from '@/lib/server/db'
import { siteUrl } from '@/lib/server/settings'

export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const d = db()
  const products = d.prepare("SELECT slug, updated_at FROM products WHERE status='published' AND is_demo=0").all() as { slug: string; updated_at: string }[]
  const cats = d.prepare('SELECT slug, updated_at FROM categories WHERE visible=1').all() as { slug: string; updated_at: string }[]
  const tags = d.prepare('SELECT slug FROM tags WHERE visible=1').all() as { slug: string }[]
  const pages = d.prepare("SELECT slug, updated_at FROM pages WHERE status='published'").all() as { slug: string; updated_at: string }[]
  const iso = (s: string) => new Date(s.replace(' ', 'T') + 'Z')
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.4 },
    ...cats.map((c) => ({ url: `${base}/category/${encodeURIComponent(c.slug)}`, lastModified: iso(c.updated_at), priority: 0.8 })),
    ...tags.map((t) => ({ url: `${base}/collection/${encodeURIComponent(t.slug)}`, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/product/${encodeURIComponent(p.slug)}`, lastModified: iso(p.updated_at), priority: 0.7 })),
    ...pages.filter((p) => p.slug !== 'contact').map((p) => ({ url: `${base}/pages/${encodeURIComponent(p.slug)}`, lastModified: iso(p.updated_at), priority: 0.3 })),
  ]
}
