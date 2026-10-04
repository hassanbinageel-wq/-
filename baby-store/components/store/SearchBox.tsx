'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useStore } from './StoreProvider'

type Result = {
  products: { id: number; name: string; slug: string; sku: string; price: number; compareAt: number | null; image: string | null; available: boolean }[]
  categories: { id: number; name: string; slug: string }[]
  tags: { id: number; name: string; slug: string }[]
}

export function SearchBox({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const { config, money } = useStore()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Result | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setRes(null)
      return
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort()
      const c = new AbortController()
      ctrl.current = c
      setLoading(true)
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: c.signal })
        if (r.ok) {
          setRes(await r.json())
          setActive(-1)
          setOpen(true)
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const items = res ? [...res.products.map((p) => `/product/${encodeURIComponent(p.slug)}`), ...res.categories.map((c) => `/category/${encodeURIComponent(c.slug)}`), ...res.tags.map((t) => `/collection/${encodeURIComponent(t.slug)}`)] : []

  const go = (href: string) => {
    setOpen(false)
    onNavigate?.()
    router.push(href)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (active >= 0 && items[active]) return go(items[active])
    if (q.trim()) go(`/products?q=${encodeURIComponent(q.trim())}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === 'Escape') setOpen(false)
  }

  const empty = res && !res.products.length && !res.categories.length && !res.tags.length
  let idx = -1
  return (
    <div className="search" ref={boxRef}>
      <form role="search" onSubmit={submit}>
        <Search className="search__icon" size={18} />
        <input
          className="input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => res && setOpen(true)}
          onKeyDown={onKey}
          placeholder={config.labels.searchPlaceholder || 'ابحث…'}
          aria-label="البحث في المتجر"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          enterKeyHint="search"
        />
        {loading && <span className="spinner" style={{ position: 'absolute', insetInlineEnd: 14, top: 11, width: 18, height: 18, color: 'var(--c-muted)' }} />}
      </form>
      {open && res && (
        <div className="suggest" id={listId} role="listbox">
          {empty && <p className="muted small" style={{ padding: '0.6rem' }}>لا توجد نتائج مطابقة لـ «{q}». جرّب كلمة أخرى أو رقم المنتج.</p>}
          {!!res.products.length && <div className="suggest__group">المنتجات</div>}
          {res.products.map((p) => {
            idx++
            const i = idx
            return (
              <a
                key={p.id}
                href={items[i]}
                className="suggest__item"
                role="option"
                aria-selected={active === i}
                onClick={(e) => {
                  e.preventDefault()
                  go(items[i])
                }}
              >
                {p.image ? <img src={p.image} alt="" /> : <span style={{ width: 48, height: 56 }} className="skeleton" />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: '0.93rem', fontWeight: 400 }}>{p.name}</b>
                  <span className="small muted">
                    <bdi className="num">{p.sku}</bdi> · <span className="num">{money(p.price)}</span>
                    {!p.available && ' · غير متوفر'}
                  </span>
                </span>
              </a>
            )
          })}
          {(!!res.categories.length || !!res.tags.length) && <div className="suggest__group">الأقسام والتصنيفات</div>}
          <div className="suggest__chips">
            {res.categories.map((c) => {
              idx++
              const i = idx
              return (
                <button key={`c${c.id}`} type="button" className={`chip ${active === i ? 'is-on' : ''}`} onClick={() => go(items[i])}>
                  {c.name}
                </button>
              )
            })}
            {res.tags.map((t) => {
              idx++
              const i = idx
              return (
                <button key={`t${t.id}`} type="button" className={`chip ${active === i ? 'is-on' : ''}`} onClick={() => go(items[i])}>
                  {t.name}
                </button>
              )
            })}
          </div>
          {!empty && (
            <button type="button" className="btn btn--soft btn--sm btn--block" onClick={() => go(`/products?q=${encodeURIComponent(q.trim())}`)}>
              عرض كل النتائج
            </button>
          )}
        </div>
      )}
      {q && (
        <button type="button" className="sr-only" onClick={() => setQ('')}>
          <X /> مسح
        </button>
      )}
    </div>
  )
}
