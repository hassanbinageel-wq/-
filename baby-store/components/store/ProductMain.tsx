'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { ProductDetail } from '@/lib/shared/types'
import { Gallery } from './Gallery'
import { Purchase } from './Purchase'
import { useStore } from './StoreProvider'
import { Modal } from './Modal'

export function ProductMain({ p, productUrl, header, details }: { p: ProductDetail; productUrl: string; header: ReactNode; details: ReactNode }) {
  const [focus, setFocus] = useState<string | null>(null)
  return (
    <div className="pdp">
      <div>
        <Gallery images={p.images} name={p.name} focusValue={focus} />
      </div>
      <div className="pdp__info">
        {header}
        <Purchase p={p} onFocusValue={setFocus} productUrl={productUrl} />
        {details}
      </div>
    </div>
  )
}

/** نافذة النظرة السريعة: تعرض الصور والخيارات وتضيف للسلة دون مغادرة الصفحة */
export function QuickView() {
  const { quickViewId, openQuickView, config } = useStore()
  const [p, setP] = useState<ProductDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)

  useEffect(() => {
    if (!quickViewId) return
    setP(null)
    setError(null)
    const c = new AbortController()
    fetch(`/api/products/${quickViewId}`, { signal: c.signal })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'تعذر تحميل المنتج')
        setP(d.product)
      })
      .catch((e) => e.name !== 'AbortError' && setError(e.message))
    return () => c.abort()
  }, [quickViewId])

  if (!quickViewId) return null
  const url = p ? `${config.siteUrl}/product/${encodeURIComponent(p.slug)}` : ''
  return (
    <Modal onClose={() => openQuickView(null)} label={p?.name || 'نظرة سريعة'}>
      {error && <div className="notice notice--danger">{error}</div>}
      {!p && !error && (
        <div className="quickview" aria-busy="true">
          <div className="skeleton" style={{ aspectRatio: '4/5' }} />
          <div className="stack">
            <div className="skeleton" style={{ height: 28, width: '70%' }} />
            <div className="skeleton" style={{ height: 22, width: '40%' }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </div>
      )}
      {p && (
        <div className="quickview">
          <Gallery images={p.images} name={p.name} focusValue={focus} compact />
          <div>
            <h2 style={{ fontSize: '1.35rem', marginTop: 6, paddingInlineEnd: 40 }}>{p.name}</h2>
            <div className="pdp__meta">
              <span>
                رقم المنتج: <bdi className="num">{p.sku}</bdi>
              </span>
              {p.isDemo && <span className="badge badge--demo">منتج تجريبي</span>}
            </div>
            {p.shortDescription && <p className="pdp__short" style={{ marginTop: 8 }}>{p.shortDescription}</p>}
            <Purchase p={p} compact onFocusValue={setFocus} productUrl={url} />
            <Link href={`/product/${encodeURIComponent(p.slug)}`} className="link small" style={{ display: 'inline-flex', gap: 4, marginTop: 14 }} onClick={() => openQuickView(null)}>
              عرض كل التفاصيل <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}
    </Modal>
  )
}
