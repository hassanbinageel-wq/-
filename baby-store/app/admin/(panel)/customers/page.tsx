import Link from 'next/link'
import { Suspense } from 'react'
import { requirePage } from '@/lib/server/auth'
import { listCustomers } from '@/lib/server/admin/queries'
import { getSetting } from '@/lib/server/settings'
import { formatMoney } from '@/lib/shared/money'
import { formatDate } from '@/lib/shared/dates'
import { formatIntl, waLink } from '@/lib/shared/phone'
import { PageHead } from '@/components/admin/ui'
import { SearchInput, PagerLinks, Toolbar } from '@/components/admin/UrlFilters'

export const metadata = { title: 'العملاء' }

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage('orders')
  const sp = await searchParams
  const r = listCustomers(sp.q || '', Number(sp.page) || 1)
  const store = getSetting('store')
  return (
    <>
      <PageHead title="العملاء" subtitle={<span className="num">{r.total} عميل — يُنشأ العميل تلقائياً عند أول طلب برقم واتساب</span>} />
      <Suspense>
        <Toolbar>
          <SearchInput placeholder="ابحث بالاسم أو رقم الهاتف" />
        </Toolbar>
      </Suspense>
      {r.rows.length ? (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>العميل</th>
                <th>الهاتف</th>
                <th>المدينة</th>
                <th>الطلبات</th>
                <th>قيمة الطلبات</th>
                <th>آخر طلب</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="rowlink" href={`/admin/customers/${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td><bdi className="num">{formatIntl(c.phone)}</bdi></td>
                  <td>{c.city || '—'}</td>
                  <td className="num">{c.orders_count}</td>
                  <td className="num">{formatMoney(c.orders_total, store.currency)}</td>
                  <td className="small muted">{formatDate(c.last_order_at, store.timezone)}</td>
                  <td>
                    <a className="a-btn a-btn--wa a-btn--sm" href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">
                      واتساب
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="a-card a-empty">لا يوجد عملاء مطابقون</div>
      )}
      <Suspense>
        <PagerLinks page={r.page} pages={r.pages} />
      </Suspense>
    </>
  )
}
