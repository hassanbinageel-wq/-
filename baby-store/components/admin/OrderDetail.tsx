'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Printer, Gift, MessageCircle, Copy, ExternalLink, Clock, AlertTriangle, RefreshCw, Trash2, Upload, Truck, RotateCcw, Ban, FileText, Image as ImageIcon, MapPin, User,
} from 'lucide-react'
import { api, useAction, useAdmin, Field, MoneyInput, Modal, OrderStatusBadge, PaymentStatusBadge, confirmAction } from './ui'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, STOCK_STATE_LABELS, FULFILLMENT_LABELS } from '@/lib/shared/constants'
import { formatDateTime, relativeHours, toDate } from '@/lib/shared/dates'
import { formatIntl, waLink } from '@/lib/shared/phone'
import type { OrderRow } from '@/lib/server/orders'

type Item = {
  id: number; name: string; sku: string; image: string | null; qty: number; unit_price: number; compare_price: number | null; line_total: number
  personalization_label: string | null; personalization_text: string | null; personalization_fee: number; returned_qty: number; product_id: number | null
  options: { name: string; value: string }[]; components: { name: string; sku: string; qty: number; options: { name: string; value: string }[] }[]
}

type Props = {
  o: OrderRow
  items: Item[]
  stockLines: { id: number; order_item_id: number; sku: string; name: string; qty: number; deducted: number }[]
  payments: { id: number; method_name: string | null; amount: number; transfer_date: string | null; reference: string | null; sender_name: string | null; notes: string | null; attachment_id: number | null; recorded_by_name: string | null; created_at: string }[]
  refunds: { id: number; amount: number; method: string | null; reference: string | null; reason: string | null; created_by_name: string | null; created_at: string }[]
  attachments: { id: number; label: string | null; uploaded_by_name: string | null; created_at: string; mime: string }[]
  notes: { id: number; user_name: string | null; body: string; created_at: string }[]
  events: { id: number; type: string; message: string; public: number; user_name: string | null; created_at: string }[]
  returns: { id: number; items: { name: string; qty: number; restocked: number }[]; reason: string | null; restocked: number; created_by_name: string | null; created_at: string }[]
  methods: { id: number; name: string; active: number }[]
  templates: { key: string; title: string }[]
  summary: { received: number; refunded: number; net: number; balance: number }
  customerOrders: number
  trackingLink: string
  timezone: string
  perms: { orders: boolean; payments: boolean }
}

export function OrderDetail(p: Props) {
  const { o } = p
  const { money } = useAdmin()
  const { run, busy } = useAction()
  const fmt = (s: string | null) => formatDateTime(s, p.timezone)
  const [status, setStatus] = useState(o.status)
  const [statusNote, setStatusNote] = useState('')
  const [pstatus, setPstatus] = useState(o.payment_status)
  const [pnote, setPnote] = useState('')
  const [shortages, setShortages] = useState<{ sku: string; name: string; needed: number; available: number }[] | null>(null)
  const [modal, setModal] = useState<null | 'payment' | 'refund' | 'return' | 'message' | 'shipping' | 'cancel'>(null)
  const [noteText, setNoteText] = useState('')
  const expires = toDate(o.reservation_expires_at)
  const paidSuggestion = p.summary.received >= o.total ? 'paid' : p.summary.received > 0 ? 'partially_paid' : null

  const changeStatus = () =>
    run(async () => {
      try {
        await api('POST', `orders/${o.id}/status`, { status, note: statusNote || undefined })
        setStatusNote('')
      } catch (e) {
        const err = e as Error & { data?: { code?: string } }
        if (err.data?.code === 'STOCK_RELEASED') setStatus(o.status)
        throw e
      }
    }, 'تم تحديث حالة الطلب')

  const rereserve = () =>
    run(async () => {
      try {
        await api('POST', `orders/${o.id}/reservation`, { action: 'rereserve' })
        setShortages(null)
      } catch (e) {
        const err = e as Error & { data?: { shortages?: typeof shortages } }
        if (err.data?.shortages) setShortages(err.data.shortages)
        throw e
      }
    }, 'تمت إعادة حجز المخزون')

  return (
    <>
      <div className="a-page-head">
        <div>
          <h1>
            الطلب <bdi>{o.number}</bdi>
          </h1>
          <p>
            {fmt(o.created_at)} · <OrderStatusBadge status={o.status} /> <PaymentStatusBadge status={o.payment_status} /> {o.is_gift ? <span className="a-badge a-badge--primary"><Gift size={12} /> هدية</span> : null}
          </p>
        </div>
        <div className="a-row">
          <Link className="a-btn a-btn--ghost" href="/admin/orders">
            كل الطلبات
          </Link>
          <a className="a-btn a-btn--ghost" href={`/admin/orders/${o.id}/print`} target="_blank" rel="noopener noreferrer">
            <Printer size={16} /> طباعة / PDF
          </a>
          {o.is_gift ? (
            <a className="a-btn a-btn--ghost" href={`/admin/orders/${o.id}/print?slip=1`} target="_blank" rel="noopener noreferrer">
              <Gift size={16} /> ورقة الهدية
            </a>
          ) : null}
          <button type="button" className="a-btn a-btn--wa" onClick={() => setModal('message')}>
            <MessageCircle size={16} /> رسالة واتساب
          </button>
        </div>
      </div>

      {(o.stock_state === 'reserved' || o.stock_state === 'released') && o.status !== 'cancelled' && (
        <div className={`a-notice ${o.stock_state === 'released' ? 'a-notice--danger' : 'a-notice--warn'}`} style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
          {o.stock_state === 'released' ? <AlertTriangle size={18} /> : <Clock size={18} />}
          <div className="a-grow">
            <b>{STOCK_STATE_LABELS[o.stock_state]}</b>
            {o.stock_state === 'reserved' && expires && (
              <>
                {' '}
                — حتى {fmt(o.reservation_expires_at)} (<span suppressHydrationWarning>{relativeHours(expires)}</span>)
              </>
            )}
            {o.stock_state === 'released' && <div className="small">انتهت مهلة التحويل وتحررت الكميات. إذا وصل التحويل الآن، تحقق من التوفر وأعد الحجز قبل تأكيد تجهيز الطلب.</div>}
            {shortages && (
              <ul className="small" style={{ margin: '6px 0 0' }}>
                {shortages.map((s) => (
                  <li key={s.sku}>
                    {s.name} (<bdi>{s.sku}</bdi>): مطلوب {s.needed} والمتاح {s.available}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="a-row">
            {o.stock_state === 'reserved' &&
              [12, 24, 48].map((h) => (
                <button key={h} type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={busy} onClick={() => run(() => api('POST', `orders/${o.id}/reservation`, { action: 'extend', hours: h }), `تم تمديد الحجز ${h} ساعة`)}>
                  تمديد {h} ساعة
                </button>
              ))}
            {o.stock_state === 'released' && (
              <button type="button" className="a-btn a-btn--sm" disabled={busy} onClick={rereserve}>
                <RefreshCw size={15} /> التحقق من التوفر وإعادة الحجز
              </button>
            )}
          </div>
        </div>
      )}

      <div className="a-grid a-grid--side">
        <div className="a-grid">
          {/* المنتجات */}
          <section className="a-card">
            <h2>المنتجات</h2>
            <div className="a-table-wrap" style={{ border: 0 }}>
              <table className="a-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.image ? <img className="thumb" src={i.image} alt="" /> : null}</td>
                      <td>
                        {i.product_id ? (
                          <Link className="rowlink" href={`/admin/products/${i.product_id}`}>
                            {i.name}
                          </Link>
                        ) : (
                          <b>{i.name}</b>
                        )}
                        <div className="small muted">
                          <bdi>{i.sku}</bdi>
                          {i.options.length > 0 && ` — ${i.options.map((x) => `${x.name}: ${x.value}`).join('، ')}`}
                        </div>
                        {i.components.length > 0 && (
                          <ul className="small" style={{ margin: '4px 0 0', paddingInlineStart: '1rem' }}>
                            {i.components.map((c, k) => (
                              <li key={k}>
                                {c.name} × {c.qty} {c.options.length > 0 && `(${c.options.map((x) => x.value).join(' / ')})`} <bdi className="muted">{c.sku}</bdi>
                              </li>
                            ))}
                          </ul>
                        )}
                        {i.personalization_text && (
                          <div className="a-badge a-badge--primary" style={{ marginTop: 4 }}>
                            {i.personalization_label}: «{i.personalization_text}» {i.personalization_fee ? `(+${money(i.personalization_fee)}/قطعة)` : ''}
                          </div>
                        )}
                        {i.returned_qty > 0 && <div className="a-badge a-badge--danger" style={{ marginTop: 4 }}>مرتجع: {i.returned_qty}</div>}
                      </td>
                      <td className="num">{i.qty}</td>
                      <td className="num">
                        {money(i.unit_price)}
                        {i.compare_price ? <div className="small muted"><s>{money(i.compare_price)}</s></div> : null}
                      </td>
                      <td className="num">{money(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="a-kv" style={{ marginTop: '0.8rem', maxWidth: 360, marginInlineStart: 'auto' }}>
              <dt>مجموع المنتجات</dt>
              <dd className="num">{money(o.subtotal)}</dd>
              {o.discount > 0 && (
                <>
                  <dt>الخصم {o.coupon_code && <bdi>({o.coupon_code})</bdi>}</dt>
                  <dd className="num">-{money(o.discount)}</dd>
                </>
              )}
              {(o.wrap_fee > 0 || o.gift_wrap_name) && (
                <>
                  <dt>التغليف {o.gift_wrap_name && `(${o.gift_wrap_name})`}</dt>
                  <dd className="num">{money(o.wrap_fee)}</dd>
                </>
              )}
              {o.personalization_fee > 0 && (
                <>
                  <dt>التخصيص</dt>
                  <dd className="num">{money(o.personalization_fee)}</dd>
                </>
              )}
              <dt>{o.fulfillment === 'pickup' ? 'الاستلام من المحل' : `الشحن${o.zone_name ? ` (${o.zone_name})` : ''}`}</dt>
              <dd className="num">{money(o.shipping_fee)}</dd>
              <dt>
                <b>الإجمالي</b>
              </dt>
              <dd className="num">
                <b>
                  {money(o.total)} <span className="small muted">{o.currency}</span>
                </b>
              </dd>
            </dl>
            {(o.prep_days_max != null || o.eta_text) && (
              <p className="small muted" style={{ marginBottom: 0 }}>
                {o.prep_days_max != null && <>مدة التجهيز المتوقعة: حتى {o.prep_days_max} أيام عمل. </>}
                {o.eta_text && <>مدة التوصيل: {o.eta_text}</>}
              </p>
            )}
            {p.perms.orders && o.status !== 'cancelled' && (
              <div className="a-row" style={{ marginTop: 10 }}>
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setModal('return')}>
                  <RotateCcw size={15} /> تسجيل مرتجع
                </button>
              </div>
            )}
          </section>

          {/* الدفع */}
          <section className="a-card">
            <div className="a-row a-row--between">
              <h2 style={{ margin: 0 }}>الدفع والتحويلات</h2>
              <PaymentStatusBadge status={o.payment_status} />
            </div>
            <dl className="a-kv" style={{ margin: '0.8rem 0' }}>
              <dt>المطلوب</dt>
              <dd className="num">{money(o.total)}</dd>
              <dt>المستلم (المسجل)</dt>
              <dd className="num">{money(p.summary.received)}</dd>
              {p.summary.refunded > 0 && (
                <>
                  <dt>المسترد</dt>
                  <dd className="num">{money(p.summary.refunded)}</dd>
                </>
              )}
              <dt>{p.summary.balance >= 0 ? 'المتبقي' : 'مبلغ زائد'}</dt>
              <dd className="num" style={{ color: p.summary.balance > 0 ? 'var(--a-warn)' : p.summary.balance < 0 ? 'var(--a-info)' : 'var(--a-ok)', fontWeight: 700 }}>
                {money(Math.abs(p.summary.balance))}
              </dd>
              <dt>وسيلة التحويل المختارة</dt>
              <dd>{o.transfer_method_name || '—'}</dd>
              {o.payment_confirmed_at && (
                <>
                  <dt>تأكيد الدفع</dt>
                  <dd>
                    {o.payment_confirmed_by_name} — {fmt(o.payment_confirmed_at)}
                  </dd>
                </>
              )}
            </dl>
            <div className="a-notice small" style={{ marginBottom: 10 }}>
              السند يصل من العميل عبر واتساب. سجّل التحويل وأرفق نسخة السند هنا بعد مراجعته، ثم حدّث حالة الدفع يدوياً.
            </div>
            {p.payments.length > 0 && (
              <div className="a-table-wrap" style={{ marginBottom: 10 }}>
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>المبلغ</th>
                      <th>الوسيلة</th>
                      <th>المرجع / المحول</th>
                      <th>التاريخ</th>
                      <th>السند</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.payments.map((x) => (
                      <tr key={x.id}>
                        <td className="num">
                          <b>{money(x.amount)}</b>
                        </td>
                        <td>{x.method_name || '—'}</td>
                        <td className="small">
                          {x.reference && <bdi>{x.reference}</bdi>}
                          {x.sender_name && <div className="muted">المحول: {x.sender_name}</div>}
                          {x.notes && <div className="muted">{x.notes}</div>}
                        </td>
                        <td className="small">
                          {x.transfer_date || '—'}
                          <div className="muted">سجله {x.recorded_by_name}</div>
                        </td>
                        <td>
                          {x.attachment_id && p.perms.payments ? (
                            <a className="a-btn a-btn--ghost a-btn--sm" href={`/api/admin/receipts/${x.attachment_id}`} target="_blank" rel="noopener noreferrer">
                              <ImageIcon size={14} /> عرض
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {p.perms.payments && (
                            <button type="button" className="a-icon-btn" aria-label="حذف التسجيل" onClick={() => confirmAction('حذف تسجيل هذا التحويل؟') && run(() => api('DELETE', `orders/${o.id}/payments/${x.id}`), 'تم الحذف')}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {p.perms.payments ? (
              <>
                <div className="a-row" style={{ marginBottom: 12 }}>
                  <button type="button" className="a-btn a-btn--ok a-btn--sm" onClick={() => setModal('payment')}>
                    + تسجيل تحويل مستلم
                  </button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setModal('refund')} disabled={p.summary.net <= 0}>
                    تسجيل استرداد
                  </button>
                  <AttachmentUpload orderId={o.id} />
                </div>
                {p.attachments.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <b className="small">السندات المرفقة (خاصة — لا تظهر للعامة):</b>
                    <div className="a-row" style={{ marginTop: 6 }}>
                      {p.attachments.map((a) => (
                        <a key={a.id} className="a-btn a-btn--ghost a-btn--sm" href={`/api/admin/receipts/${a.id}`} target="_blank" rel="noopener noreferrer" title={`${a.uploaded_by_name || ''} — ${fmt(a.created_at)}`}>
                          {a.mime === 'application/pdf' ? <FileText size={14} /> : <ImageIcon size={14} />} {a.label || 'سند'} #{a.id}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="a-form a-form--2" style={{ alignItems: 'end' }}>
                  <Field label="تغيير حالة الدفع">
                    <select className="a-select" value={pstatus} onChange={(e) => setPstatus(e.target.value as typeof pstatus)}>
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PAYMENT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ملاحظة المراجعة (اختياري)">
                    <input className="a-input" value={pnote} onChange={(e) => setPnote(e.target.value)} />
                  </Field>
                </div>
                {paidSuggestion && paidSuggestion !== o.payment_status && (
                  <p className="small muted">
                    حسب المبالغ المسجلة يمكن أن تكون الحالة: <b>{PAYMENT_STATUS_LABELS[paidSuggestion]}</b>
                  </p>
                )}
                <button
                  type="button"
                  className="a-btn"
                  style={{ marginTop: 8 }}
                  disabled={busy || pstatus === o.payment_status}
                  onClick={() => {
                    if (pstatus === 'paid' && p.summary.received < o.total && !confirmAction('المبلغ المسجل أقل من الإجمالي. تأكيد الدفع الكامل؟')) return
                    run(() => api('POST', `orders/${o.id}/payment-status`, { status: pstatus, note: pnote || undefined }).then(() => setPnote('')), 'تم تحديث حالة الدفع')
                  }}
                >
                  حفظ حالة الدفع
                </button>
              </>
            ) : (
              <p className="small muted">مراجعة التحويلات وتأكيد الدفع من صلاحية مراجع المدفوعات.</p>
            )}
            {p.refunds.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <b className="small">الاستردادات</b>
                <ul className="small" style={{ margin: '4px 0 0' }}>
                  {p.refunds.map((r) => (
                    <li key={r.id}>
                      {money(r.amount)} — {r.reason || 'بدون سبب'} {r.reference && <bdi>({r.reference})</bdi>} — {r.created_by_name} {fmt(r.created_at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* الملاحظات والسجل */}
          <section className="a-card">
            <h2>ملاحظات داخلية</h2>
            <form
              className="a-row"
              onSubmit={(e) => {
                e.preventDefault()
                if (noteText.trim()) run(() => api('POST', `orders/${o.id}/notes`, { body: noteText }).then(() => setNoteText('')), 'تمت إضافة الملاحظة')
              }}
            >
              <input className="a-input a-grow" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="ملاحظة لا يراها العميل" />
              <button className="a-btn a-btn--soft" disabled={busy}>
                إضافة
              </button>
            </form>
            {p.notes.length > 0 && (
              <ul className="a-timeline" style={{ marginTop: 10 }}>
                {p.notes.map((n) => (
                  <li key={n.id}>
                    {n.body}
                    <time>
                      {n.user_name} — {fmt(n.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="a-card">
            <h2>السجل الزمني</h2>
            <ul className="a-timeline">
              {p.events.map((e) => (
                <li key={e.id}>
                  {e.message} {e.public ? <span className="a-badge a-badge--info">يظهر للعميل</span> : null}
                  <time>
                    {e.user_name ? `${e.user_name} — ` : ''}
                    {fmt(e.created_at)}
                  </time>
                </li>
              ))}
            </ul>
            {p.returns.length > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>المرتجعات</h3>
                <ul className="a-timeline">
                  {p.returns.map((r) => (
                    <li key={r.id}>
                      {r.items.map((i) => `${i.name} × ${i.qty}`).join('، ')} {r.restocked ? '(أعيد للمخزون)' : '(لم يُعد للمخزون)'} {r.reason && `— ${r.reason}`}
                      <time>
                        {r.created_by_name} — {fmt(r.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <div className="a-grid a-side-first">
          {/* حالة الطلب */}
          <section className="a-card">
            <h2>حالة الطلب</h2>
            {p.perms.orders && o.status !== 'cancelled' ? (
              <div className="a-form">
                <select className="a-select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {ORDER_STATUSES.filter((s) => s !== 'cancelled').map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input className="a-input" placeholder="ملاحظة داخلية (اختياري)" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
                {status !== 'pending' && o.payment_status !== 'paid' && status !== o.status && (
                  <div className="a-notice a-notice--warn small">تنبيه: لم يتم تأكيد الدفع بعد ({PAYMENT_STATUS_LABELS[o.payment_status]}).</div>
                )}
                <div className="a-row">
                  <button type="button" className="a-btn a-grow" disabled={busy || status === o.status} onClick={changeStatus}>
                    حفظ الحالة
                  </button>
                  <button type="button" className="a-btn a-btn--ghost" onClick={() => setModal('cancel')} disabled={o.status === 'completed'}>
                    <Ban size={15} /> إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0 }}>
                <OrderStatusBadge status={o.status} /> {o.cancel_reason && <span className="small muted">— {o.cancel_reason}</span>}
              </p>
            )}
            <p className="small muted" style={{ marginBottom: 0, marginTop: 8 }}>
              المخزون: {STOCK_STATE_LABELS[o.stock_state]}
            </p>
          </section>

          {/* العميل */}
          <section className="a-card">
            <h2 className="a-row" style={{ gap: 6 }}>
              <User size={18} /> العميل
            </h2>
            <p style={{ margin: 0 }}>
              <b>{o.customer_name}</b>
              <br />
              <bdi className="num">{formatIntl(o.customer_phone)}</bdi>
            </p>
            <div className="a-row" style={{ margin: '8px 0' }}>
              <a className="a-btn a-btn--wa a-btn--sm" href={waLink(o.customer_phone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> واتساب
              </a>
              {o.customer_id && (
                <Link className="a-btn a-btn--ghost a-btn--sm" href={`/admin/customers/${o.customer_id}`}>
                  سجل العميل ({p.customerOrders} طلب)
                </Link>
              )}
            </div>
            <p className="small" style={{ margin: 0 }}>
              <b>{FULFILLMENT_LABELS[o.fulfillment]}</b>
              {o.fulfillment === 'delivery' && (
                <>
                  <br />
                  {[o.customer_country, o.customer_city, o.customer_area].filter(Boolean).join('، ')}
                  {o.customer_address && (
                    <>
                      <br />
                      {o.customer_address}
                    </>
                  )}
                  {o.customer_landmark && (
                    <>
                      <br />
                      أقرب معلم: {o.customer_landmark}
                    </>
                  )}
                </>
              )}
            </p>
            {o.customer_map_url && /^https?:\/\//.test(o.customer_map_url) && (
              <a className="a-btn a-btn--ghost a-btn--sm" style={{ marginTop: 6 }} href={o.customer_map_url} target="_blank" rel="noopener noreferrer">
                <MapPin size={14} /> فتح الموقع على الخريطة
              </a>
            )}
            {o.notes && <div className="a-notice a-notice--warn small" style={{ marginTop: 8 }}>ملاحظة العميل: {o.notes}</div>}
          </section>

          {o.is_gift ? (
            <section className="a-card">
              <h2 className="a-row" style={{ gap: 6 }}>
                <Gift size={18} /> تفاصيل الهدية
              </h2>
              <dl className="a-kv">
                <dt>التغليف</dt>
                <dd>{o.gift_wrap_name || 'بدون'}</dd>
                {o.gift_message && (
                  <>
                    <dt>رسالة الإهداء</dt>
                    <dd>«{o.gift_message}»</dd>
                  </>
                )}
                <dt>إخفاء الأسعار</dt>
                <dd>{o.hide_prices ? 'نعم — لا تُرفق فاتورة بالأسعار' : 'لا'}</dd>
                {o.recipient_name && (
                  <>
                    <dt>المستلم</dt>
                    <dd>
                      {o.recipient_name} — <bdi>{o.recipient_phone ? formatIntl(o.recipient_phone) : ''}</bdi>
                      <br />
                      <span className="small">{[o.recipient_country, o.recipient_city, o.recipient_area, o.recipient_address].filter(Boolean).join('، ')}</span>
                    </dd>
                  </>
                )}
              </dl>
            </section>
          ) : null}

          <section className="a-card">
            <h2 className="a-row" style={{ gap: 6 }}>
              <Truck size={18} /> الشحن
            </h2>
            {o.shipping_carrier || o.tracking_number ? (
              <p className="small" style={{ marginTop: 0 }}>
                {o.shipping_carrier} {o.tracking_number && <bdi>— {o.tracking_number}</bdi>}
                {o.tracking_url && (
                  <>
                    <br />
                    <a href={o.tracking_url} target="_blank" rel="noopener noreferrer">
                      رابط التتبع
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p className="small muted" style={{ marginTop: 0 }}>لم تُضف بيانات الشحن بعد</p>
            )}
            {p.perms.orders && (
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setModal('shipping')}>
                تحديث بيانات الشحن
              </button>
            )}
          </section>

          <section className="a-card">
            <h2>رابط متابعة العميل</h2>
            <p className="small muted" style={{ marginTop: 0 }}>رابط خاص يصعب تخمينه، يعرض الحالة مع إخفاء جزئي للبيانات الشخصية.</p>
            <div className="a-row">
              <a className="a-btn a-btn--ghost a-btn--sm" href={`/order/${o.token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> فتح
              </a>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/order/${o.token}`)}>
                <Copy size={14} /> نسخ الرابط
              </button>
            </div>
          </section>
        </div>
      </div>

      {modal === 'payment' && <PaymentModal o={o} methods={p.methods} remaining={Math.max(0, p.summary.balance)} onClose={() => setModal(null)} />}
      {modal === 'refund' && <RefundModal orderId={o.id} max={p.summary.net} onClose={() => setModal(null)} />}
      {modal === 'return' && <ReturnModal orderId={o.id} items={p.items} onClose={() => setModal(null)} />}
      {modal === 'shipping' && <ShippingModal o={o} onClose={() => setModal(null)} />}
      {modal === 'message' && <MessageModal o={o} templates={p.templates} onClose={() => setModal(null)} />}
      {modal === 'cancel' && <CancelModal o={o} onClose={() => setModal(null)} />}
    </>
  )
}

function AttachmentUpload({ orderId }: { orderId: number }) {
  const { run, busy } = useAction()
  return (
    <label className="a-btn a-btn--ghost a-btn--sm" style={{ cursor: 'pointer' }}>
      <Upload size={14} /> {busy ? 'جارٍ الرفع…' : 'إرفاق سند فقط'}
      <input
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const fd = new FormData()
          fd.append('file', f)
          fd.append('label', 'سند تحويل')
          run(() => api('POST', `orders/${orderId}/attachments`, fd), 'تم إرفاق السند')
          e.target.value = ''
        }}
      />
    </label>
  )
}

function PaymentModal({ o, methods, remaining, onClose }: { o: OrderRow; methods: Props['methods']; remaining: number; onClose: () => void }) {
  const { run, busy } = useAction()
  const { toast } = useAdmin()
  const [f, setF] = useState({ methodId: o.transfer_method_id, amount: remaining || o.total, transferDate: new Date().toISOString().slice(0, 10), reference: '', senderName: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const save = () =>
    run(async () => {
      let attachmentId: number | null = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('label', 'سند تحويل')
        attachmentId = (await api<{ id: number }>('POST', `orders/${o.id}/attachments`, fd)).id
      }
      const r = await api<{ suggestion: string }>('POST', `orders/${o.id}/payments`, { ...f, amount: f.amount / 100, attachmentId })
      if (r.suggestion && r.suggestion !== o.payment_status) toast(`اقتراح: غيّر حالة الدفع إلى «${PAYMENT_STATUS_LABELS[r.suggestion as keyof typeof PAYMENT_STATUS_LABELS]}» بعد التأكد`)
      onClose()
    }, 'تم تسجيل التحويل')
  return (
    <Modal title="تسجيل تحويل مستلم" onClose={onClose}>
      <div className="a-form a-form--2">
        <Field label="وسيلة التحويل">
          <select className="a-select" value={f.methodId ?? ''} onChange={(e) => setF({ ...f, methodId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">غير محدد</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {!m.active && '(معطلة)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المبلغ المستلم">
          <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v || 0 })} />
        </Field>
        <Field label="تاريخ التحويل">
          <input type="date" className="a-input" value={f.transferDate} onChange={(e) => setF({ ...f, transferDate: e.target.value })} />
        </Field>
        <Field label="رقم مرجع العملية">
          <input className="a-input" dir="ltr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <Field label="اسم المحول (إذا اختلف عن العميل)">
          <input className="a-input" value={f.senderName} onChange={(e) => setF({ ...f, senderName: e.target.value })} />
        </Field>
        <Field label="نسخة السند (اختياري)" hint="صورة أو PDF — تُحفظ بشكل خاص">
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
        <Field label="ملاحظات المراجعة" className="a-span-2">
          <textarea className="a-textarea" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      <div className="a-row" style={{ marginTop: 12 }}>
        <button type="button" className="a-btn a-btn--ok" disabled={busy || f.amount <= 0} onClick={save}>
          حفظ التحويل
        </button>
        <span className="small muted">لا تتغير حالة الدفع تلقائياً؛ غيّرها بعد المراجعة.</span>
      </div>
    </Modal>
  )
}

function RefundModal({ orderId, max, onClose }: { orderId: number; max: number; onClose: () => void }) {
  const { run, busy } = useAction()
  const { toast } = useAdmin()
  const [f, setF] = useState({ amount: max, method: '', reference: '', reason: '' })
  return (
    <Modal title="تسجيل استرداد" onClose={onClose}>
      <div className="a-form a-form--2">
        <Field label="المبلغ المسترد">
          <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v || 0 })} />
        </Field>
        <Field label="طريقة الاسترداد">
          <input className="a-input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} />
        </Field>
        <Field label="رقم المرجع">
          <input className="a-input" dir="ltr" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <Field label="السبب">
          <input className="a-input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </Field>
      </div>
      <button
        type="button"
        className="a-btn"
        style={{ marginTop: 12 }}
        disabled={busy || f.amount <= 0 || f.amount > max}
        onClick={() =>
          run(async () => {
            const r = await api<{ suggestion: string }>('POST', `orders/${orderId}/refunds`, { ...f, amount: f.amount / 100 })
            toast(`اقتراح: حالة الدفع «${PAYMENT_STATUS_LABELS[r.suggestion as keyof typeof PAYMENT_STATUS_LABELS]}»`)
            onClose()
          }, 'تم تسجيل الاسترداد')
        }
      >
        حفظ
      </button>
    </Modal>
  )
}

function ReturnModal({ orderId, items, onClose }: { orderId: number; items: Item[]; onClose: () => void }) {
  const { run, busy } = useAction()
  const [qty, setQty] = useState<Record<number, number>>({})
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  return (
    <Modal title="تسجيل مرتجع" onClose={onClose}>
      <div className="a-form">
        {items.map((i) => {
          const left = i.qty - i.returned_qty
          return (
            <div key={i.id} className="a-row a-row--between">
              <span>
                {i.name} <span className="small muted">(متاح للإرجاع {left})</span>
              </span>
              <input className="a-input" style={{ width: 90 }} type="number" min={0} max={left} value={qty[i.id] || 0} disabled={left <= 0} onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(left, Number(e.target.value) || 0)) })} />
            </div>
          )
        })}
        <label className="a-check">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          <span>إعادة الكميات للمخزون (مرة واحدة فقط لكل قطعة مخصومة)</span>
        </label>
        <Field label="السبب">
          <input className="a-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <button
          type="button"
          className="a-btn"
          disabled={busy || !Object.values(qty).some((n) => n > 0)}
          onClick={() => run(() => api('POST', `orders/${orderId}/returns`, { items: Object.entries(qty).map(([k, v]) => ({ orderItemId: Number(k), qty: v })), restock, reason }).then(onClose), 'تم تسجيل المرتجع')}
        >
          حفظ المرتجع
        </button>
        <p className="small muted" style={{ margin: 0 }}>لاسترداد مبلغ للعميل استخدم «تسجيل استرداد» في قسم الدفع.</p>
      </div>
    </Modal>
  )
}

function ShippingModal({ o, onClose }: { o: OrderRow; onClose: () => void }) {
  const { run, busy } = useAction()
  const [f, setF] = useState({ carrier: o.shipping_carrier || '', trackingNumber: o.tracking_number || '', trackingUrl: o.tracking_url || '', markShipped: o.status !== 'shipped' && o.status !== 'completed' })
  return (
    <Modal title="بيانات الشحن" onClose={onClose}>
      <div className="a-form">
        <Field label="شركة الشحن / المندوب">
          <input className="a-input" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} />
        </Field>
        <Field label="رقم التتبع">
          <input className="a-input" dir="ltr" value={f.trackingNumber} onChange={(e) => setF({ ...f, trackingNumber: e.target.value })} />
        </Field>
        <Field label="رابط التتبع (اختياري)">
          <input className="a-input" dir="ltr" value={f.trackingUrl} onChange={(e) => setF({ ...f, trackingUrl: e.target.value })} placeholder="https://" />
        </Field>
        {o.status !== 'shipped' && o.status !== 'completed' && (
          <label className="a-check">
            <input type="checkbox" checked={f.markShipped} onChange={(e) => setF({ ...f, markShipped: e.target.checked })} />
            <span>تغيير حالة الطلب إلى «تم الشحن»</span>
          </label>
        )}
        <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('POST', `orders/${o.id}/shipping`, f).then(onClose), 'تم حفظ بيانات الشحن')}>
          حفظ
        </button>
      </div>
    </Modal>
  )
}

function CancelModal({ o, onClose }: { o: OrderRow; onClose: () => void }) {
  const { run, busy } = useAction()
  const [reason, setReason] = useState('')
  return (
    <Modal title={`إلغاء الطلب ${o.number}`} onClose={onClose}>
      <div className="a-form">
        <div className="a-notice a-notice--warn">سيتم إرجاع أي كميات مخصومة لهذا الطلب إلى المخزون مرة واحدة، ولن يُحتسب استخدام الكوبون.</div>
        <Field label="سبب الإلغاء (يظهر للعميل في صفحة المتابعة)">
          <input className="a-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <button type="button" className="a-btn a-btn--danger" disabled={busy} onClick={() => run(() => api('POST', `orders/${o.id}/status`, { status: 'cancelled', note: reason }).then(onClose), 'تم إلغاء الطلب')}>
          تأكيد الإلغاء
        </button>
      </div>
    </Modal>
  )
}

function MessageModal({ o, templates, onClose }: { o: OrderRow; templates: Props['templates']; onClose: () => void }) {
  const { toast } = useAdmin()
  const [key, setKey] = useState(templates[0]?.key || '')
  const [text, setText] = useState('')
  const [to, setTo] = useState<'customer' | 'recipient'>('customer')
  const [loading, setLoading] = useState(false)
  const load = async (k: string) => {
    setKey(k)
    setLoading(true)
    try {
      const r = await api<{ text: string }>('POST', `orders/${o.id}/message`, { key: k })
      setText(r.text)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }
  const open = async () => {
    const r = await api<{ url: string }>('POST', `orders/${o.id}/message`, { body: text, to, log: true, key })
    window.open(r.url, '_blank', 'noopener,noreferrer')
  }
  return (
    <Modal title="رسالة واتساب للعميل" onClose={onClose} large>
      <div className="a-form">
        <div className="a-row">
          <select className="a-select" style={{ width: 'auto' }} value={key} onChange={(e) => load(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </select>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => load(key)} disabled={loading}>
            {text ? 'إعادة تعبئة القالب' : 'تعبئة القالب'}
          </button>
          {o.recipient_phone && (
            <select className="a-select" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value as 'customer' | 'recipient')}>
              <option value="customer">إلى العميل</option>
              <option value="recipient">إلى مستلم الهدية</option>
            </select>
          )}
        </div>
        <textarea className="a-textarea" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="اختر قالباً واضغط «تعبئة القالب» ثم عدّل النص قبل الفتح" />
        <div className="a-row">
          <button type="button" className="a-btn a-btn--wa" disabled={!text.trim()} onClick={open}>
            <MessageCircle size={16} /> فتح في واتساب للمراجعة والإرسال
          </button>
          <button
            type="button"
            className="a-btn a-btn--ghost"
            disabled={!text.trim()}
            onClick={() => {
              navigator.clipboard.writeText(text)
              toast('تم النسخ')
            }}
          >
            <Copy size={16} /> نسخ
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>تفتح المحادثة برسالة جاهزة فقط؛ الإرسال يتم يدوياً من واتساب ولا يعني الفتح أن الرسالة أُرسلت. يمكن تعديل القوالب من «رسائل واتساب».</p>
      </div>
    </Modal>
  )
}
