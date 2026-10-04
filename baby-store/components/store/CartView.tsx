'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Tag, X, Lock } from 'lucide-react'
import { useStore } from './StoreProvider'
import { useQuote } from './useQuote'
import { CartLineView } from './CartLine'
import { FreeShippingBar } from './CartDrawer'
import { EmptyIllustration } from './Deco'
import { ProductSection } from './Sections'

export function CouponBox() {
  const { coupon, setCoupon } = useStore()
  const [code, setCode] = useState('')
  if (coupon) {
    return (
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="chip is-on">
          <Tag size={15} /> <bdi className="num">{coupon}</bdi>
        </span>
        <button type="button" className="link small" onClick={() => setCoupon(null)}>
          <X size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> إزالة الكوبون
        </button>
      </div>
    )
  }
  return (
    <form
      className="input-group"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) setCoupon(code.trim().toUpperCase())
      }}
    >
      <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="رمز الخصم" aria-label="رمز الخصم" style={{ direction: 'ltr', textAlign: 'right' }} />
      <button type="submit" className="btn btn--soft">
        تطبيق
      </button>
    </form>
  )
}

export function CartView() {
  const { cart, hydrated, money, coupon, config, setCoupon } = useStore()
  const { quote, suggestions, loading, error } = useQuote(cart, { coupon }, hydrated, true)
  if (!hydrated) return <div className="skeleton" style={{ height: 240 }} />
  if (!cart.length) {
    return (
      <div className="empty">
        <EmptyIllustration kind="cart" />
        <h2 style={{ fontSize: '1.25rem' }}>{config.labels.emptyCart}</h2>
        <Link className="btn" href="/products">
          {config.labels.continueShopping}
        </Link>
      </div>
    )
  }
  const byKey = new Map(quote?.lines.map((l) => [l.key, l]) || [])
  const blocking = !quote || quote.lines.some((l) => !l.ok)
  return (
    <>
      <div className="cart-layout">
        <div className="card">
          <h2 style={{ fontSize: '1.15rem' }}>
            المنتجات (<span className="num">{cart.reduce((s, l) => s + l.qty, 0)}</span>)
          </h2>
          {config.freeShipping.enabled && <FreeShippingBar remaining={quote?.shipping.freeRemaining ?? null} threshold={config.freeShipping.threshold} />}
          {cart.map((l) => (
            <CartLineView key={l.key} line={l} q={byKey.get(l.key)} />
          ))}
        </div>
        <aside className="summary">
          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>ملخص السلة</h2>
            <CouponBox />
            {quote?.coupon && !quote.coupon.valid && (
              <div className="notice notice--danger small">
                {quote.coupon.message}
                <button type="button" className="link" style={{ marginInlineStart: 'auto' }} onClick={() => setCoupon(null)}>
                  إزالة
                </button>
              </div>
            )}
            {quote?.coupon?.valid && <div className="notice notice--ok small">{quote.coupon.message}</div>}
            {error && <div className="notice notice--danger small">{error}</div>}
            <dl aria-busy={loading}>
              <dt>مجموع المنتجات</dt>
              <dd className="num">{quote ? money(quote.subtotal) : '…'}</dd>
              {!!quote?.discount && (
                <>
                  <dt>الخصم</dt>
                  <dd className="num" style={{ color: 'var(--c-sale)' }}>
                    -{money(quote.discount)}
                  </dd>
                </>
              )}
              {!!quote?.personalizationTotal && (
                <>
                  <dt>التخصيص</dt>
                  <dd className="num">{money(quote.personalizationTotal)}</dd>
                </>
              )}
              <dt>الشحن والتغليف</dt>
              <dd className="small muted" style={{ fontWeight: 400 }}>
                يُحسب عند إتمام الطلب
              </dd>
              <dt className="total">الإجمالي الحالي</dt>
              <dd className="total num">{quote ? money(quote.total) : '…'}</dd>
            </dl>
            {blocking && quote && <div className="notice notice--warn small">عدّل المنتجات المظللة في السلة قبل المتابعة.</div>}
            <Link className="btn btn--lg btn--block" href="/checkout" aria-disabled={blocking} onClick={(e) => blocking && e.preventDefault()}>
              <Lock size={18} /> {config.labels.checkout}
            </Link>
            <Link className="btn btn--ghost btn--block" href="/products">
              {config.labels.continueShopping}
            </Link>
            <p className="small muted" style={{ margin: 0 }}>
              الدفع بالتحويل ثم إرسال صورة السند عبر واتساب. السلة محفوظة على هذا الجهاز.
            </p>
          </div>
        </aside>
      </div>
      <ProductSection title="منتجات مكملة لسلتك" subtitle="اقتراحات فقط — لن تُضاف إلا إذا اخترتها" items={suggestions} soft />
    </>
  )
}
