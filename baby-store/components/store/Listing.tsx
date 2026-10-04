import Link from 'next/link'
import { Suspense } from 'react'
import { listProducts, type ListFilters } from '@/lib/server/catalog'
import { visibleCategories } from '@/lib/server/storefront'
import { ActiveFilters, FilterSidebar, LoadMore, Toolbar } from './Filters'
import { EmptyIllustration, Star } from './Deco'

type SP = Record<string, string | string[] | undefined>

export async function Listing({
  title,
  description,
  filters,
  searchParams,
  scopeQuery,
  crumbs,
  showCategories = false,
}: {
  title: string
  description?: string | null
  filters: ListFilters
  searchParams: SP
  scopeQuery: Record<string, string>
  crumbs: { label: string; href?: string }[]
  showCategories?: boolean
}) {
  const r = await listProducts(filters)
  const cats = showCategories ? (await visibleCategories()).map((c) => ({ name: c.name, slug: c.slug, count: c.count })) : []
  const qp = new URLSearchParams(scopeQuery)
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === 'page' || v === undefined) continue
    qp.set(k, Array.isArray(v) ? v[0] : v)
  }
  const hasFilters = ['q', 't', 'size', 'color', 'min', 'max', 'stock', 'sale'].some((k) => searchParams[k])
  return (
    <div className="container">
      <div className="page-head">
        <nav className="crumbs" aria-label="مسار التنقل">
          <Link href="/">الرئيسية</Link>
          {crumbs.map((c) => (
            <span key={c.label} style={{ display: 'contents' }}>
              <span aria-hidden="true">‹</span>
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
            </span>
          ))}
        </nav>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Star size={22} style={{ color: 'var(--c-accent)' }} /> {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      <div className="listing">
        <Suspense>
          <FilterSidebar facets={r.facets} categories={cats} showCategories={showCategories} />
        </Suspense>
        <div>
          <Suspense>
            <Toolbar total={r.total} facets={r.facets} categories={cats} showCategories={showCategories} />
            <ActiveFilters facets={r.facets} />
          </Suspense>
          {r.items.length ? (
            <LoadMore initial={r.items} page={r.page} pages={r.pages} query={qp.toString()} />
          ) : (
            <div className="empty">
              <EmptyIllustration kind="search" />
              <h2 style={{ fontSize: '1.2rem' }}>{hasFilters ? 'لا توجد منتجات مطابقة' : 'لا توجد منتجات هنا بعد'}</h2>
              <p>{hasFilters ? 'جرّب إزالة بعض الفلاتر أو البحث بكلمة أخرى أو برقم المنتج.' : 'سنضيف منتجات جديدة قريباً بإذن الله.'}</p>
              <Link className="btn btn--ghost" href="/products">
                تصفح جميع المنتجات
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
