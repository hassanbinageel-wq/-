import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/server/auth'
import { parseJson } from '@/lib/server/db'
import { getOrder, getOrderItems, paymentSummary } from '@/lib/server/orders'
import { getSetting } from '@/lib/server/settings'
import { getPublishedAppearance } from '@/lib/server/appearance'
import { formatMoney } from '@/lib/shared/money'
import { formatDateTime } from '@/lib/shared/dates'
import { formatIntl } from '@/lib/shared/phone'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, FULFILLMENT_LABELS } from '@/lib/shared/constants'
import { PrintButton } from '@/components/admin/PrintButton'

export const metadata = { title: 'طباعة الطلب' }

export default async function PrintOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ slip?: string }> }) {
  await requirePage(['orders', 'payments'])
  const o = getOrder(Number((await params).id))
  if (!o) notFound()
  const slip = (await searchParams).slip === '1'
  const store = getSetting('store')
  const a = getPublishedAppearance()
  const cur = { ...store.currency, symbol: o.currency_symbol }
  const m = (c: number) => formatMoney(c, cur)
  const items = getOrderItems(o.id)
  const sum = paymentSummary(o.id, o.total)
  const showPrices = !slip
  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '24px', maxWidth: 820, margin: '0 auto', color: '#222' }}>
      <style>{`@page { size: A4; margin: 14mm } @media print { .no-print { display: none !important } body { background: #fff } } table { width: 100%; border-collapse: collapse } th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: start; font-size: 13px; vertical-align: top } th { background: #f6f4f8 }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <PrintButton />
        <span className="small muted">لحفظه PDF اختر «حفظ بتنسيق PDF» من نافذة الطباعة.</span>
      </div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2d2733', paddingBottom: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>{a.brand.name}</h1>
          <div style={{ fontSize: 12, color: '#666' }}>{a.brand.tagline}</div>
          <div style={{ fontSize: 12, color: '#666' }} dir="ltr">
            WhatsApp: +{store.whatsappCountryCode} {store.whatsappNumber}
          </div>
        </div>
        <div style={{ textAlign: 'left', fontSize: 13 }}>
          <b style={{ fontSize: 18 }}>{slip ? 'ورقة الهدية' : 'ملخص الطلب'}</b>
          <div>
            رقم الطلب: <bdi>{o.number}</bdi>
          </div>
          <div>{formatDateTime(o.created_at, store.timezone)}</div>
        </div>
      </header>

      {slip ? (
        <section style={{ marginBottom: 16 }}>
          {o.gift_message && (
            <div style={{ border: '1px dashed #c99', borderRadius: 12, padding: 16, fontSize: 18, textAlign: 'center', marginBottom: 14 }}>«{o.gift_message}»</div>
          )}
          {o.recipient_name && (
            <p style={{ fontSize: 14 }}>
              إلى: <b>{o.recipient_name}</b>
            </p>
          )}
        </section>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13, marginBottom: 14 }}>
          <div>
            <b>العميل</b>
            <div>{o.customer_name}</div>
            <div dir="ltr" style={{ textAlign: 'right' }}>{formatIntl(o.customer_phone)}</div>
            <div>
              {FULFILLMENT_LABELS[o.fulfillment]}
              {o.zone_name && ` — ${o.zone_name}`}
            </div>
            {o.fulfillment === 'delivery' && <div>{[o.customer_country, o.customer_city, o.customer_area, o.customer_address].filter(Boolean).join('، ')}</div>}
            {o.customer_landmark && <div>أقرب معلم: {o.customer_landmark}</div>}
          </div>
          <div>
            {o.is_gift ? (
              <>
                <b>الهدية</b>
                <div>التغليف: {o.gift_wrap_name || 'بدون'}</div>
                {o.recipient_name && (
                  <div>
                    المستلم: {o.recipient_name} (<bdi>{o.recipient_phone ? formatIntl(o.recipient_phone) : ''}</bdi>)
                  </div>
                )}
                {o.recipient_address && <div>{[o.recipient_city, o.recipient_area, o.recipient_address].filter(Boolean).join('، ')}</div>}
                {o.gift_message && <div>الرسالة: «{o.gift_message}»</div>}
                {o.hide_prices ? <div><b>إخفاء الأسعار من ورقة الهدية</b></div> : null}
              </>
            ) : null}
            <div style={{ marginTop: 6 }}>
              حالة الطلب: {ORDER_STATUS_LABELS[o.status]} — حالة الدفع: {PAYMENT_STATUS_LABELS[o.payment_status]}
            </div>
          </div>
        </section>
      )}

      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th>الخيارات / التخصيص</th>
            <th>الكمية</th>
            {showPrices && <th>سعر الوحدة</th>}
            {showPrices && <th>الإجمالي</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const opts = parseJson<{ name: string; value: string }[]>(i.options, [])
            const comps = parseJson<{ name: string; qty: number; options: { value: string }[] }[]>(i.components, [])
            return (
              <tr key={i.id}>
                <td>
                  {i.name}
                  <div style={{ fontSize: 11, color: '#777' }}>
                    <bdi>{i.sku}</bdi>
                  </div>
                </td>
                <td>
                  {opts.map((x) => `${x.name}: ${x.value}`).join('، ')}
                  {comps.length > 0 && <div style={{ fontSize: 12 }}>{comps.map((c) => `${c.name} ×${c.qty}${c.options.length ? ` (${c.options.map((x) => x.value).join('/')})` : ''}`).join('، ')}</div>}
                  {i.personalization_text && <div>{i.personalization_label}: «{i.personalization_text}»</div>}
                </td>
                <td>{i.qty}</td>
                {showPrices && <td>{m(i.unit_price)}</td>}
                {showPrices && <td>{m(i.line_total)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>

      {showPrices && (
        <table style={{ width: 320, marginInlineStart: 'auto', marginTop: 12 }}>
          <tbody>
            <tr><td>مجموع المنتجات</td><td>{m(o.subtotal)}</td></tr>
            {o.discount > 0 && <tr><td>الخصم</td><td>-{m(o.discount)}</td></tr>}
            {o.wrap_fee > 0 && <tr><td>التغليف</td><td>{m(o.wrap_fee)}</td></tr>}
            {o.personalization_fee > 0 && <tr><td>التخصيص</td><td>{m(o.personalization_fee)}</td></tr>}
            <tr><td>الشحن</td><td>{m(o.shipping_fee)}</td></tr>
            <tr><td><b>الإجمالي</b></td><td><b>{m(o.total)}</b></td></tr>
            <tr><td>المستلم</td><td>{m(sum.received)}</td></tr>
            <tr><td>المتبقي</td><td>{m(Math.max(0, sum.balance))}</td></tr>
          </tbody>
        </table>
      )}
      {!slip && o.notes && <p style={{ fontSize: 13 }}>ملاحظات العميل: {o.notes}</p>}
      <p style={{ fontSize: 12, color: '#777', marginTop: 24, textAlign: 'center' }}>{slip ? `مع أطيب التمنيات من ${a.brand.name}` : `شكراً لتسوقكم من ${a.brand.name}`}</p>
    </div>
  )
}
