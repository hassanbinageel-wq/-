import type { Metadata } from 'next'
import { Listing } from '@/components/store/Listing'
import { parseListParams } from '@/lib/server/list-params'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  return {
    title: q ? `نتائج البحث عن: ${q}` : sp.type === 'bundle' ? 'باقات الهدايا' : sp.sale === '1' ? 'العروض' : 'جميع المنتجات',
    alternates: { canonical: '/products' },
    robots: q ? { index: false } : undefined,
  }
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams
  const f = await parseListParams(sp)
  const q = typeof sp.q === 'string' ? sp.q : ''
  const title = q ? `نتائج البحث عن «${q}»` : f.type === 'bundle' ? 'باقات الهدايا' : f.sale ? 'العروض' : 'جميع المنتجات'
  return <Listing title={title} filters={f} searchParams={sp} scopeQuery={{}} crumbs={[{ label: title }]} showCategories />
}
