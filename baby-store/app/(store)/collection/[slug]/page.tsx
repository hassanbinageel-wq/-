import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Listing } from '@/components/store/Listing'
import { parseListParams } from '@/lib/server/list-params'
import { db } from '@/lib/server/db'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

async function getTag(slug: string) {
  return await db()
      .prepare('SELECT t.id, t.name, t.slug, t.description, g.name AS group_name FROM tags t JOIN tag_groups g ON g.id=t.group_id WHERE t.slug=? AND t.visible=1')
      .get(decodeURIComponent(slug)) as { id: number; name: string; slug: string; description: string | null; group_name: string } | undefined
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTag((await params).slug)
  if (!t) return { title: 'غير موجود' }
  return { title: `${t.group_name}: ${t.name}`, description: t.description || undefined, alternates: { canonical: `/collection/${encodeURIComponent(t.slug)}` } }
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const t = await getTag((await params).slug)
  if (!t) notFound()
  const sp = await searchParams
  const f = { ...await parseListParams(sp), tagIds: [t.id] }
  return (
    <Listing
      title={t.name}
      description={t.description || `${t.group_name}: ${t.name}`}
      filters={f}
      searchParams={sp}
      scopeQuery={{ scope_tag: t.slug }}
      crumbs={[{ label: 'جميع المنتجات', href: '/products' }, { label: `${t.group_name}: ${t.name}` }]}
      showCategories
    />
  )
}
