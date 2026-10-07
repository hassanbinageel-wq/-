import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Clock, CreditCard, Package, PackageCheck, Truck, XCircle } from 'lucide-react'
import { getOrderByToken } from '@/lib/server/orders'
import { publicItems, publicEvents } from '@/lib/server/order-view'
import { getSetting, storeWhatsapp } from '@/lib/server/settings'
import { formatMoney } from '@/lib/shared/money'
import { orderCurrency } from '@/lib/server/currency'
import { formatDateTime } from '@/lib/shared/dates'
import { maskName, maskPhone, waLink } from '@/lib/shared/phone'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, FULFILLMENT_LABELS } from '@/lib/shared/constants'
import { WhatsAppIcon } from '@/components/store/Deco'

export const metadata: Metadata = { title: 'متابعة الطلب', robots: { index: false, follow: false } }

const FLOW = [
  { key: 'pending', label: 'استلام الطلب', icon: Package },
  { key: 'confirmed', label: 'مؤكد', icon: Check },
  { key: 'preparing', label: 'قيد التجهيز', icon: PackageCheck },
  { key: 'shipped', label: 'تم الشحن', icon: Truck },
  { key: 'completed', label: 'مكتمل', icon: Check },
] as const

export default async function TrackOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const o = await getOrderByToken(token)
  if (!o) notFound()
  const store = await getSetting('store')
  const cur = orderCurrency(o, store)
  const items = await publicItems(o)
  const events = await publicEvents(o.id)
  const stepIdx = FLOW.findIndex((s) => s.key === o.status)
  const hidePrices = !!o.hide_prices
  const awaiting = ['awaiting_transfer', 'needs_review', 'partially_paid'].includes(o.payment_status) && o.status !== 'cancelled'
  const fmt = (s: string | null) => formatDateTime(s, store.timezone, store.currency.numerals)
  const wa = waLink(await storeWhatsapp(), `مرحباً، أستفسر عن طلبي رقم ${o.number}`)

  return (
    <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '3rem', maxWidth: 860 }}>
      <h1 style={{ fontSize: '1.5rem' }}>
        متابعة الطلب <bdi className="num">{o.number}</bdi>
      </h1>
      <p className="muted small">
        تاريخ الطلب: {fmt(o.created_at)} — آخر تحديث: {fmt(o.updated_at)}
      </p>

      <section className="card">
        {o.status === 'cancelled' ? (
          <div className="notice notice--danger">
            <XCircle size={18} /> <span>تم إلغاء هذا الطلب{o.cancel_reason ? `: ${o.cancel_reason}` : ''}.</span>
          </div>
        ) : (
          <ol className="track-steps" aria-label="مراحل الطلب">
            {FLOW.map((s, i) => (
              <li key={s.key} className={i <= stepIdx ? 'is-done' : ''} aria-current={i === stepIdx ? 'step' : undefined}>
                <i>
                  <s.icon size={16} />
                </i>
                {s.label}
              </li>
            ))}
          </ol>
        )}
        <div className="status-chips" style={{ justifyContent: 'flex-start', marginTop: '0.8rem' }}>
          <span className="badge" style={{ background: 'var(--c-soft)' }}>
            حالة الطلب: {ORDER_STATUS_LABELS[o.status]}
          </span>
          <span className={`badge ${o.payment_status === 'paid' ? 'badge--ok' : o.payment_status === 'needs_review' ? 'badge--danger' : 'badge--warn'}`}>
            <CreditCard size={13} /> حالة الدفع: {PAYMENT_STATUS_LABELS[o.payment_status]}
          </span>
        </div>
        {awaiting && (
          <div className="notice notice--warn small" style={{ marginTop: '0.8rem' }}>
            <Clock size={16} />
            <span>
              بانتظار التحويل وإرسال السند عبر واتساب.{' '}
              <Link className="link" href={`/order/${o.token}/payment`}>
                عرض تعليمات التحويل
              </Link>
            </span>
          </div>
        )}
        {(o.shipping_carrier || o.tracking_number) && (
          <div className="notice notice--info" style={{ marginTop: '0.8rem' }}>
            <Truck size={18} />
            <span>
              {o.shipping_carrier && <>شركة الشحن: {o.shipping_carrier}<br /></>}
              {o.tracking_number && <>رقم التتبع: <bdi className="num">{o.tracking_number}</bdi><br /></>}
              {o.tracking_url && /^https?:\/\//.test(o.tracking_url) && (
                <a className="link" href={o.tracking_url} target="_blank" rel="noopener noreferrer">
                  تتبع الشحنة
                </a>
              )}
            </span>
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>المنتجات</h2>
        {items.map((i) => (
          <div key={i.id} className="row" style={{ alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px dashed var(--c-border)', flexWrap: 'nowrap' }}>
            {i.image && <img src={i.image} alt="" style={{ width: 52, height: 64, objectFit: 'cover', borderRadius: 10 }} />}
            <span className="grow small">
              {i.name} × {i.qty}
              <span className="muted" style={{ display: 'block' }}>
                {i.options.map((x) => `${x.name}: ${x.value}`).join('، ')}
              </span>
              {i.personalization && <span className="muted" style={{ display: 'block' }}>{i.personalization}</span>}
            </span>
            {!hidePrices && <b className="small num">{formatMoney(i.lineTotal, cur)}</b>}
          </div>
        ))}
        {!hidePrices && (
          <p style={{ marginTop: '0.8rem', marginBottom: 0 }}>
            الإجمالي: <b className="num">{formatMoney(o.total, cur)}</b>
          </p>
        )}
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>بيانات الاستلام</h2>
        <p style={{ margin: 0 }} className="small">
          {maskName(o.customer_name)} — <bdi className="num">{maskPhone(o.customer_phone)}</bdi>
          <br />
          {FULFILLMENT_LABELS[o.fulfillment]}
          {o.fulfillment === 'delivery' && ` — ${[o.recipient_city || o.customer_city, o.recipient_area || o.customer_area].filter(Boolean).join('، ')}`}
          {o.eta_text && <><br />مدة التوصيل التقريبية: {o.eta_text}</>}
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>تظهر البيانات الشخصية بشكل مخفي جزئياً لحمايتك.</p>
      </section>

      {events.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>سجل التحديثات</h2>
          <ul className="timeline">
            {events.map((e, i) => (
              <li key={i}>
                {e.message}
                <time>{fmt(e.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
        <a className="btn btn--wa" href={wa} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon /> تواصل معنا بخصوص الطلب
        </a>
      </div>
    </div>
  )
}
