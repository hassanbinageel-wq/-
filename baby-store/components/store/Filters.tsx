'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import type { Facets } from '@/lib/server/catalog'
import type { ProductCard as Card } from '@/lib/shared/types'
import { useStore } from './StoreProvider'
import { ProductCard } from './ProductCard'

type Cat = { name: string; slug: string; count: number }

function useParamsState() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const list = (k: string) => (sp.get(k) || '').split(',').filter(Boolean)
  const push = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString())
    mut(p)
    p.delete('page')
    const qs = p.toString()
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  const toggle = (k: string, v: string) =>
    push((p) => {
      const cur = (p.get(k) || '').split(',').filter(Boolean)
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
      if (next.length) p.set(k, next.join(','))
      else p.delete(k)
    })
  const set = (k: string, v: string | null) => push((p) => (v ? p.set(k, v) : p.delete(k)))
  return { sp, list, toggle, set, push, pending }
}

function FilterBody({ facets, categories, showCategories }: { facets: Facets; categories: Cat[]; showCategories: boolean }) {
  const { sp, list, toggle, set, push } = useParamsState()
  const { money } = useStore()
  const hidden = new Set(facets.hidden)
  const [min, setMin] = useState(sp.get('min') || '')
  const [max, setMax] = useState(sp.get('max') || '')
  useEffect(() => {
    setMin(sp.get('min') || '')
    setMax(sp.get('max') || '')
  }, [sp])
  const tags = list('t')
  const sizes = list('size')
  const colors = list('color')

  return (
    <>
      {showCategories && categories.length > 0 && (
        <details className="filter-group" open>
          <summary>
            الأقسام <ChevronDown size={18} />
          </summary>
          <div className="filter-opts">
            {categories.map((c) => (
              <Link key={c.slug} className="chip" href={`/category/${encodeURIComponent(c.slug)}`}>
                {c.name} <span className="count num">{c.count}</span>
              </Link>
            ))}
          </div>
        </details>
      )}
      {facets.tagGroups
        .filter((g) => !hidden.has(`tag:${g.slug}`))
        .map((g) => (
          <details className="filter-group" open key={g.id}>
            <summary>
              {g.name} <ChevronDown size={18} />
            </summary>
            <div className="filter-opts">
              {g.tags.map((t) => (
                <button type="button" key={t.id} className="chip" aria-pressed={tags.includes(t.slug)} onClick={() => toggle('t', t.slug)}>
                  {t.name} <span className="count num">{t.count}</span>
                </button>
              ))}
            </div>
          </details>
        ))}
      {!hidden.has('size') && facets.sizes.length > 0 && (
        <details className="filter-group" open>
          <summary>
            المقاس <ChevronDown size={18} />
          </summary>
          <div className="filter-opts">
            {facets.sizes.map((s) => (
              <button type="button" key={s} className="chip" aria-pressed={sizes.includes(s)} onClick={() => toggle('size', s)}>
                {s}
              </button>
            ))}
          </div>
        </details>
      )}
      {!hidden.has('color') && facets.colors.length > 0 && (
        <details className="filter-group" open>
          <summary>
            اللون <ChevronDown size={18} />
          </summary>
          <div className="filter-opts">
            {facets.colors.map((c) => (
              <button type="button" key={c.value} className="chip chip--swatch" aria-pressed={colors.includes(c.value)} onClick={() => toggle('color', c.value)}>
                <i style={{ background: c.color || 'var(--c-soft)' }} /> {c.value}
              </button>
            ))}
          </div>
        </details>
      )}
      {!hidden.has('price') && facets.price && facets.price.max > facets.price.min && (
        <details className="filter-group" open>
          <summary>
            السعر <ChevronDown size={18} />
          </summary>
          <p className="small muted" style={{ margin: '0.4rem 0 0' }}>
            من <span className="num">{money(facets.price.min)}</span> إلى <span className="num">{money(facets.price.max)}</span>
          </p>
          <form
            className="price-range"
            onSubmit={(e) => {
              e.preventDefault()
              push((p) => {
                min ? p.set('min', min) : p.delete('min')
                max ? p.set('max', max) : p.delete('max')
              })
            }}
          >
            <input className="input" inputMode="numeric" placeholder="من" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ''))} aria-label="أقل سعر" />
            <input className="input" inputMode="numeric" placeholder="إلى" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ''))} aria-label="أعلى سعر" />
            <button className="btn btn--soft btn--sm" type="submit">
              تطبيق
            </button>
          </form>
        </details>
      )}
      {!hidden.has('stock') && (
        <div className="filter-group">
          <label className="check">
            <input type="checkbox" checked={sp.get('stock') === '1'} onChange={(e) => set('stock', e.target.checked ? '1' : null)} />
            <span>المتوفر فقط</span>
          </label>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={sp.get('sale') === '1'} onChange={(e) => set('sale', e.target.checked ? '1' : null)} />
            <span>العروض والتخفيضات فقط</span>
          </label>
        </div>
      )}
    </>
  )
}

export function ActiveFilters({ facets }: { facets: Facets }) {
  const { sp, toggle, set, push } = useParamsState()
  const { money } = useStore()
  const tagName = new Map(facets.tagGroups.flatMap((g) => g.tags.map((t) => [t.slug, t.name] as const)))
  const chips: { label: string; remove: () => void }[] = []
  const q = sp.get('q')
  if (q) chips.push({ label: `بحث: ${q}`, remove: () => set('q', null) })
  for (const t of (sp.get('t') || '').split(',').filter(Boolean)) chips.push({ label: tagName.get(t) || t, remove: () => toggle('t', t) })
  for (const s of (sp.get('size') || '').split(',').filter(Boolean)) chips.push({ label: `المقاس: ${s}`, remove: () => toggle('size', s) })
  for (const c of (sp.get('color') || '').split(',').filter(Boolean)) chips.push({ label: `اللون: ${c}`, remove: () => toggle('color', c) })
  const min = sp.get('min')
  const max = sp.get('max')
  if (min || max)
    chips.push({
      label: `السعر: ${min ? money(Number(min) * 100) : '…'} - ${max ? money(Number(max) * 100) : '…'}`,
      remove: () =>
        push((p) => {
          p.delete('min')
          p.delete('max')
        }),
    })
  if (sp.get('stock') === '1') chips.push({ label: 'المتوفر فقط', remove: () => set('stock', null) })
  if (sp.get('sale') === '1') chips.push({ label: 'العروض فقط', remove: () => set('sale', null) })
  if (sp.get('type') === 'bundle') chips.push({ label: 'الباقات فقط', remove: () => set('type', null) })
  if (!chips.length) return null
  return (
    <div className="active-filters" aria-label="الفلاتر المستخدمة">
      {chips.map((c) => (
        <button key={c.label} type="button" className="chip" onClick={c.remove} aria-label={`إزالة ${c.label}`}>
          {c.label} <X size={14} />
        </button>
      ))}
      <button
        type="button"
        className="link small"
        onClick={() =>
          push((p) => {
            for (const k of ['q', 't', 'size', 'color', 'min', 'max', 'stock', 'sale', 'type']) p.delete(k)
          })
        }
      >
        مسح الكل
      </button>
    </div>
  )
}

export function Toolbar({ total, facets, categories, showCategories }: { total: number; facets: Facets; categories: Cat[]; showCategories: boolean }) {
  const { sp, set, pending } = useParamsState()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="toolbar">
        <span className="muted small" aria-live="polite">
          {pending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <span className="num">{total}</span>} منتج
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--ghost btn--sm mobile-only" onClick={() => setOpen(true)}>
            <SlidersHorizontal size={17} /> تصفية
          </button>
          <label className="sr-only" htmlFor="sort">
            ترتيب حسب
          </label>
          <select id="sort" className="select" value={sp.get('sort') || 'default'} onChange={(e) => set('sort', e.target.value === 'default' ? null : e.target.value)}>
            <option value="default">الترتيب المقترح</option>
            <option value="newest">الأحدث</option>
            <option value="price_asc">السعر: من الأقل</option>
            <option value="price_desc">السعر: من الأعلى</option>
          </select>
        </div>
      </div>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <aside className="drawer drawer--start" role="dialog" aria-modal="true" aria-label="تصفية المنتجات">
            <div className="drawer__head">
              <b>تصفية المنتجات</b>
              <button type="button" className="icon-btn" aria-label="إغلاق" onClick={() => setOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="drawer__body">
              <FilterBody facets={facets} categories={categories} showCategories={showCategories} />
            </div>
            <div className="drawer__foot">
              <button type="button" className="btn btn--block" onClick={() => setOpen(false)}>
                عرض النتائج (<span className="num">{total}</span>)
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

export function FilterSidebar({ facets, categories, showCategories }: { facets: Facets; categories: Cat[]; showCategories: boolean }) {
  return (
    <aside className="filters desktop-only" aria-label="تصفية المنتجات" style={{ display: 'block' }}>
      <FilterBody facets={facets} categories={categories} showCategories={showCategories} />
    </aside>
  )
}

export function LoadMore({ initial, page, pages, query }: { initial: Card[]; page: number; pages: number; query: string }) {
  const [items, setItems] = useState(initial)
  const [cur, setCur] = useState(page)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    setItems(initial)
    setCur(page)
  }, [initial, page])
  const more = async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/products?${query}${query ? '&' : ''}page=${cur + 1}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setItems((x) => [...x, ...d.items])
      setCur(d.page)
    } catch {
      setErr('تعذر تحميل المزيد. حاول مرة أخرى')
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <div className="grid-products">
        {items.map((p, i) => (
          <ProductCard key={p.id} p={p} index={i} priority={i < 4} />
        ))}
      </div>
      {cur < pages && (
        <div className="load-more">
          <button type="button" className="btn btn--ghost" onClick={more} disabled={loading}>
            {loading ? <span className="spinner" /> : null} عرض المزيد
          </button>
          <noscript>
            <a href={`?${query}${query ? '&' : ''}page=${cur + 1}`}>الصفحة التالية</a>
          </noscript>
          {err && <span className="small" style={{ color: 'var(--c-danger)' }}>{err}</span>}
        </div>
      )}
    </>
  )
}
