import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { getSetting } from '@/lib/server/settings'
import { formatMoney } from '@/lib/shared/money'
import { formatDateTime } from '@/lib/shared/dates'
import { formatIntl, waLink } from '@/lib/shared/phone'
import { PageHead, OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/ui'
import { CustomerNotes } from '@/components/admin/CustomerNotes'
import type { OrderRow } from '@/lib/server/orders'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('orders')
  const id = Number((await params).id)
  const c = db().prepare('SELECT * FROM customers WHERE id=?').get(id) as
    | { id: number; name: string; phone: string; country: string | null; city: string | null; area: string | null; address: string | null; notes: string | null; created_at: string }
    | undefined
  if (!c) notFound()
  const orders = db().prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC').all(id) as OrderRow[]
  const store = getSetting('store')
  const m = (v: number) => formatMoney(v, store.currency)
  const totalValue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  return (
    <>
      <PageHead title={c.name} subtitle={<bdi className="num">{formatIntl(c.phone)}</bdi>}>
        <a className="a-btn a-btn--wa" href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">
          تواصل عبر واتساب
        </a>
      </PageHead>
      <div className="a-grid a-grid--side">
        <div className="a-card">
          <h2>سجل الطلبات ({orders.length})</h2>
          <div className="a-table-wrap" style={{ border: 0 }}>
            <table className="a-table">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="rowlink" href={`/admin/orders/${o.id}`}>
                        <bdi>{o.number}</bdi>
                      </Link>
                      <div className="small muted">{formatDateTime(o.created_at, store.timezone)}</div>
                    </td>
                    <td className="num">{m(o.total)}</td>
                    <td>
                      <OrderStatusBadge status={o.status} /> <PaymentStatusBadge status={o.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="a-grid">
          <div className="a-card">
            <h2>البيانات</h2>
            <dl className="a-kv">
              <dt>المدينة</dt>
              <dd>{[c.country, c.city, c.area].filter(Boolean).join('، ') || '—'}</dd>
              <dt>آخر عنوان</dt>
              <dd>{c.address || '—'}</dd>
              <dt>قيمة الطلبات</dt>
              <dd className="num">{m(totalValue)}</dd>
              <dt>أول طلب</dt>
              <dd>{formatDateTime(c.created_at, store.timezone)}</dd>
            </dl>
          </div>
          <CustomerNotes id={c.id} notes={c.notes || ''} />
        </div>
      </div>
    </>
  )
}
