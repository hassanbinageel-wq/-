import Link from 'next/link'
import { Suspense } from 'react'
import { Download, Gift } from 'lucide-react'
import { requirePage } from '@/lib/server/auth'
import { listOrders } from '@/lib/server/admin/queries'
import { getSetting } from '@/lib/server/settings'
import { formatMoney } from '@/lib/shared/money'
import { formatDateTime } from '@/lib/shared/dates'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/shared/constants'
import { PageHead, OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/ui'
import { SearchInput, SelectFilter, DateFilter, PagerLinks, Toolbar } from '@/components/admin/UrlFilters'

export const metadata = { title: 'الطلبات' }

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage(['orders', 'payments'])
  const sp = await searchParams
  const r = listOrders({ q: sp.q, status: sp.status, payment: sp.payment, from: sp.from, to: sp.to, flag: sp.flag, page: Number(sp.page) || 1 })
  const store = getSetting('store')
  const qs = new URLSearchParams(Object.entries(sp).filter(([k]) => k !== 'page')).toString()
  return (
    <>
      <PageHead title="الطلبات" subtitle={<span className="num">{r.total} طلب</span>}>
        <a className="a-btn a-btn--ghost" href={`/api/admin/orders/export${qs ? `?${qs}` : ''}`}>
          <Download size={16} /> تصدير CSV
        </a>
      </PageHead>
      <Suspense>
        <Toolbar>
          <SearchInput placeholder="رقم الطلب، اسم العميل، الهاتف، مرجع التحويل" />
          <SelectFilter param="status" label="كل حالات الطلب" options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))} />
          <SelectFilter param="payment" label="كل حالات الدفع" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
          <DateFilter param="from" label="من" />
          <DateFilter param="to" label="إلى" />
          {Object.keys(sp).length > 0 && (
            <Link className="a-btn a-btn--ghost a-btn--sm" href="/admin/orders">
              مسح الفلاتر
            </Link>
          )}
        </Toolbar>
      </Suspense>
      {sp.flag === 'released' && <div className="a-notice a-notice--warn" style={{ marginBottom: 12 }}>طلبات معلقة انتهت مهلة حجزها وتحررت كمياتها — تحقق من التوفر وأعد الحجز قبل التأكيد.</div>}
      {r.rows.length ? (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>الطلب</th>
                <th>العميل</th>
                <th>الإجمالي</th>
                <th>المستلم</th>
                <th>حالة الطلب</th>
                <th>حالة الدفع</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link className="rowlink" href={`/admin/orders/${o.id}`}>
                      <bdi>{o.number}</bdi>
                    </Link>
                    <div className="small muted">
                      {o.items_count} منتج {o.is_gift ? <Gift size={13} style={{ display: 'inline' }} /> : null}
                      {o.stock_state === 'released' && o.status === 'pending' && <span className="a-badge a-badge--danger" style={{ marginInlineStart: 4 }}>انتهى الحجز</span>}
                    </div>
                  </td>
                  <td>
                    {o.customer_name}
                    <div className="small muted" dir="ltr" style={{ textAlign: 'right' }}>+{o.customer_phone}</div>
                  </td>
                  <td className="num">{formatMoney(o.total, store.currency)}</td>
                  <td className="num">{o.received ? formatMoney(o.received, store.currency) : '—'}</td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td><PaymentStatusBadge status={o.payment_status} /></td>
                  <td className="small muted">{formatDateTime(o.created_at, store.timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="a-card a-empty">لا توجد طلبات مطابقة</div>
      )}
      <Suspense>
        <PagerLinks page={r.page} pages={r.pages} />
      </Suspense>
    </>
  )
}
