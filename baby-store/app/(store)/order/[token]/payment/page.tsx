import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { CheckCircle2, Clock, PackageSearch } from 'lucide-react'
import { getOrderByToken, getOrderItems, orderWhatsappLink } from '@/lib/server/orders'
import { activeMethods, publicItems } from '@/lib/server/order-view'
import { getSetting, storeWhatsapp } from '@/lib/server/settings'
import { OWNER_COOKIE, readOwned } from '@/lib/server/order-access'
import { PaymentActions } from '@/components/store/PaymentActions'
import { formatMoney } from '@/lib/shared/money'
import { formatDateTime, toDate } from '@/lib/shared/dates'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/shared/constants'
import { Star, Cloud } from '@/components/store/Deco'

export const metadata: Metadata = { title: 'تعليمات التحويل', robots: { index: false, follow: false } }

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const o = getOrderByToken(token)
  if (!o) notFound()
  const store = getSetting('store')
  const cur = { ...store.currency, symbol: o.currency_symbol }
  const owner = readOwned((await cookies()).get(OWNER_COOKIE)?.value).includes(o.id)
  const link = orderWhatsappLink(o, getOrderItems(o.id), { masked: !owner })
  const items = publicItems(o)
  const deadline = o.stock_state === 'reserved' ? toDate(o.reservation_expires_at) : null
  const awaiting = ['awaiting_transfer', 'needs_review', 'partially_paid'].includes(o.payment_status) && o.status !== 'cancelled'
  const firstName = o.customer_name.split(' ')[0]
  const totalRaw = (o.total / 100).toFixed(Math.min(2, store.currency.decimals))

  return (
    <div className="container" style={{ paddingTop: '1.2rem', paddingBottom: '3rem', maxWidth: 860 }}>
      <ol className="steps" aria-label="خطوات الطلب">
        <li className="is-done">السلة</li>
        <li className="is-done">البيانات</li>
        <li className="is-done">المراجعة</li>
        <li className="is-current">التحويل</li>
      </ol>
      <div className="pay-hero" style={{ marginBottom: '1rem' }}>
        <Cloud className="deco deco--float" size={90} style={{ top: 10, insetInlineStart: 20, opacity: 0.8 }} />
        <Star className="deco deco--twinkle" size={16} style={{ top: 20, insetInlineEnd: 40 }} />
        <CheckCircle2 size={44} style={{ margin: '0 auto 6px', color: 'var(--c-success)' }} />
        <h1>شكراً {firstName}، تم حفظ طلبك</h1>
        <p style={{ margin: '0 0 0.6rem' }}>
          رقم الطلب: <b className="num"><bdi>{o.number}</bdi></b>
        </p>
        <div className="status-chips">
          <span className="badge">حالة الطلب: {ORDER_STATUS_LABELS[o.status]}</span>
          <span className="badge badge--warn">حالة الدفع: {PAYMENT_STATUS_LABELS[o.payment_status]}</span>
        </div>
      </div>

      {o.status === 'cancelled' ? (
        <div className="notice notice--danger">هذا الطلب ملغي. للاستفسار تواصل معنا عبر واتساب.</div>
      ) : !awaiting ? (
        <div className="notice notice--ok">
          حالة الدفع الحالية: {PAYMENT_STATUS_LABELS[o.payment_status]}. يمكنك متابعة طلبك من{' '}
          <Link className="link" href={`/order/${o.token}`}>
            صفحة المتابعة
          </Link>
          .
        </div>
      ) : (
        <>
          {deadline && (
            <div className="notice notice--warn" style={{ marginBottom: '1rem' }}>
              <Clock size={18} />
              <span>
                المنتجات محجوزة لطلبك حتى <b>{formatDateTime(deadline, store.timezone, store.currency.numerals)}</b>. يرجى التحويل وإرسال السند قبل هذا الموعد، وبعده قد تتحرر الكميات ويراجع فريقنا التوفر قبل تأكيد الطلب.
              </span>
            </div>
          )}
          <PaymentActions
            token={o.token}
            totalText={formatMoney(o.total, cur)}
            totalRaw={totalRaw}
            methods={activeMethods()}
            selectedId={o.transfer_method_id}
            initialMessage={link.text}
            initialUrl={link.url}
            canSelect={awaiting}
            storeNumber={storeWhatsapp()}
          />
        </>
      )}

      <section className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>ملخص الطلب</h2>
        {items.map((i) => (
          <div key={i.id} className="row" style={{ alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px dashed var(--c-border)', flexWrap: 'nowrap' }}>
            {i.image && <img src={i.image} alt="" style={{ width: 52, height: 64, objectFit: 'cover', borderRadius: 10 }} />}
            <span className="grow small">
              <b style={{ fontWeight: 400 }}>{i.name}</b> × {i.qty}
              <span className="muted" style={{ display: 'block' }}>
                <bdi className="num">{i.sku}</bdi>
                {i.options.length > 0 && ` — ${i.options.map((x) => `${x.name}: ${x.value}`).join('، ')}`}
              </span>
              {i.components.length > 0 && <span className="muted" style={{ display: 'block' }}>{i.components.map((c) => `${c.name}${c.options.length ? ` (${c.options.map((x) => x.value).join('/')})` : ''}`).join('، ')}</span>}
              {i.personalization && <span className="muted" style={{ display: 'block' }}>{i.personalization}</span>}
            </span>
            <b className="small num">{formatMoney(i.lineTotal, cur)}</b>
          </div>
        ))}
        <dl className="summary" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem 1rem', marginTop: '0.8rem' }}>
          <dt className="muted">مجموع المنتجات</dt>
          <dd className="num" style={{ margin: 0 }}>{formatMoney(o.subtotal, cur)}</dd>
          {o.discount > 0 && (<><dt className="muted">الخصم</dt><dd className="num" style={{ margin: 0 }}>-{formatMoney(o.discount, cur)}</dd></>)}
          {o.wrap_fee > 0 && (<><dt className="muted">التغليف</dt><dd className="num" style={{ margin: 0 }}>{formatMoney(o.wrap_fee, cur)}</dd></>)}
          {o.personalization_fee > 0 && (<><dt className="muted">التخصيص</dt><dd className="num" style={{ margin: 0 }}>{formatMoney(o.personalization_fee, cur)}</dd></>)}
          {o.fulfillment === 'delivery' && (<><dt className="muted">الشحن</dt><dd className="num" style={{ margin: 0 }}>{o.shipping_fee ? formatMoney(o.shipping_fee, cur) : 'مجاني'}</dd></>)}
          <dt style={{ fontWeight: 700 }}>الإجمالي المطلوب</dt>
          <dd className="num" style={{ margin: 0, fontWeight: 700 }}>{formatMoney(o.total, cur)}</dd>
        </dl>
      </section>

      <div className="row" style={{ marginTop: '1rem', justifyContent: 'center' }}>
        <Link className="btn btn--ghost" href={`/order/${o.token}`}>
          <PackageSearch size={18} /> متابعة حالة الطلب
        </Link>
      </div>
      <p className="small muted center" style={{ marginTop: '0.8rem' }}>
        احتفظ برابط هذه الصفحة لمتابعة طلبك. الرابط خاص بك ولا يظهر فيه بياناتك الشخصية كاملة.
      </p>
    </div>
  )
}
