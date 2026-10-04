'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { X, Truck } from 'lucide-react'
import { useStore } from './StoreProvider'
import { useQuote } from './useQuote'
import { CartLineView } from './CartLine'
import { EmptyIllustration } from './Deco'

export function FreeShippingBar({ remaining, threshold }: { remaining: number | null; threshold: number }) {
  const { money } = useStore()
  if (threshold <= 0) return null
  const done = remaining == null || remaining <= 0
  const pct = done ? 100 : Math.max(4, Math.min(100, ((threshold - remaining!) / threshold) * 100))
  return (
    <div style={{ display: 'grid', gap: 6, margin: '0.4rem 0 0.8rem' }}>
      <span className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Truck size={16} />
        {done ? 'طلبك مؤهل للشحن المجاني في المناطق المشمولة' : <>أضف <b className="num">{money(remaining!)}</b> للحصول على شحن مجاني (للمناطق المشمولة)</>}
      </span>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, money, config, coupon } = useStore()
  const { quote, loading } = useQuote(cart, { coupon }, cartOpen)

  useEffect(() => {
    if (!cartOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCartOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [cartOpen, setCartOpen])

  if (!cartOpen) return null
  const byKey = new Map(quote?.lines.map((l) => [l.key, l]) || [])
  const blocking = quote?.lines.some((l) => !l.ok)
  return (
    <>
      <div className="drawer-backdrop" onClick={() => setCartOpen(false)} />
      <aside className="drawer drawer--end" role="dialog" aria-modal="true" aria-label="سلة التسوق">
        <div className="drawer__head">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>سلة التسوق</h2>
          <button type="button" className="icon-btn" aria-label="إغلاق السلة" onClick={() => setCartOpen(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="drawer__body">
          {!cart.length ? (
            <div className="empty">
              <EmptyIllustration kind="cart" />
              <p>{config.labels.emptyCart}</p>
              <Link className="btn" href="/products" onClick={() => setCartOpen(false)}>
                {config.labels.continueShopping}
              </Link>
            </div>
          ) : (
            <>
              {config.freeShipping.enabled && <FreeShippingBar remaining={quote?.shipping.freeRemaining ?? null} threshold={config.freeShipping.threshold} />}
              {cart.map((l) => (
                <CartLineView key={l.key} line={l} q={byKey.get(l.key)} compact />
              ))}
            </>
          )}
        </div>
        {!!cart.length && (
          <div className="drawer__foot">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.7rem' }}>
              <span>مجموع المنتجات</span>
              <b className="num">{quote ? money(quote.subtotal + quote.personalizationTotal) : loading ? '…' : ''}</b>
            </div>
            <p className="small muted" style={{ marginTop: -6 }}>
              الشحن والتغليف والخصومات تُحسب في الخطوة التالية.
            </p>
            {blocking && <div className="notice notice--danger small" style={{ marginBottom: 8 }}>راجع المنتجات المظللة قبل المتابعة.</div>}
            <div className="row">
              <Link className="btn btn--ghost grow" href="/cart" onClick={() => setCartOpen(false)}>
                عرض السلة
              </Link>
              <Link
                className="btn grow"
                href="/checkout"
                aria-disabled={blocking}
                onClick={(e) => {
                  if (blocking) e.preventDefault()
                  else setCartOpen(false)
                }}
              >
                {config.labels.checkout}
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
