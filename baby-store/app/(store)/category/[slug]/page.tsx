import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Listing } from '@/components/store/Listing'
import { parseListParams } from '@/lib/server/list-params'
import { db } from '@/lib/server/db'
import { imageRefById } from '@/lib/server/media'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
type Cat = { id: number; name: string; slug: string; description: string | null; image_id: number | null; seo_title: string | null; seo_description: string | null }

function getCat(slug: string) {
  return db().prepare('SELECT * FROM categories WHERE slug=?').get(decodeURIComponent(slug)) as Cat | undefined
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCat((await params).slug)
  if (!c) return { title: 'القسم غير موجود' }
  const img = imageRefById(c.image_id, c.name, 1080)
  return {
    title: c.seo_title || c.name,
    description: c.seo_description || c.description || undefined,
    alternates: { canonical: `/category/${encodeURIComponent(c.slug)}` },
    openGraph: img ? { images: [img.url] } : undefined,
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const c = getCat((await params).slug)
  if (!c) notFound()
  const sp = await searchParams
  const f = { ...parseListParams(sp), categoryId: c.id }
  return (
    <Listing
      title={c.name}
      description={c.description}
      filters={f}
      searchParams={sp}
      scopeQuery={{ category: c.slug }}
      crumbs={[{ label: 'جميع المنتجات', href: '/products' }, { label: c.name }]}
    />
  )
}
