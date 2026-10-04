import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPage } from '@/lib/server/pages'
import { getStoreContext } from '@/lib/server/storefront'
import { Markdown, plainText } from '@/lib/shared/markdown'
import { SectionTitle } from '@/components/store/Sections'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getPage(decodeURIComponent((await params).slug))
  if (!p) return { title: 'الصفحة غير موجودة' }
  return { title: p.seo_title || p.title, description: p.seo_description || plainText(p.content), alternates: { canonical: `/pages/${encodeURIComponent(p.slug)}` } }
}

export default async function CmsPage({ params }: Props) {
  const ctx = await getStoreContext()
  const p = getPage(decodeURIComponent((await params).slug), ctx.isAdmin)
  if (!p) notFound()
  return (
    <div className="container" style={{ paddingTop: '1.6rem', paddingBottom: '3rem' }}>
      {p.status !== 'published' && <div className="notice notice--warn" style={{ marginBottom: 12 }}>هذه الصفحة مسودة ولا يراها الزوار.</div>}
      <SectionTitle title={p.title} as="h1" />
      <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)' }}>
        <Markdown text={p.content} />
      </div>
    </div>
  )
}
