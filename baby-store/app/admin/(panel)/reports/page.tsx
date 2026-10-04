import { Suspense } from 'react'
import { requirePage } from '@/lib/server/auth'
import { getSetting } from '@/lib/server/settings'
import { dailySeries, moneyStats, resolveRange, statusBreakdown, topProducts } from '@/lib/server/admin/stats'
import { formatMoney } from '@/lib/shared/money'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/shared/constants'
import { PageHead } from '@/components/admin/ui'
import { RangePicker } from '@/components/admin/UrlFilters'
import { DailyChart, CsvDownload } from '@/components/admin/DailyChart'

export const metadata = { title: 'التقارير' }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage('owner')
  const r = resolveRange(await searchParams)
  const store = getSetting('store')
  const m = (c: number) => formatMoney(c, store.currency)
  const s = moneyStats(r)
  const series = dailySeries(r)
  const top = topProducts(r, 15)
  const br = statusBreakdown(r)
  return (
    <>
      <PageHead title="التقارير" subtitle={r.label}>
        <Suspense>
          <RangePicker />
        </Suspense>
        <CsvDownload
          name={`report-${r.from}-${r.to}.csv`}
          label="تصدير CSV"
          rows={[['اليوم', 'عدد الطلبات', 'قيمة الطلبات', 'المحصل'], ...series.map((d) => [d.date, d.orders, d.value / 100, d.collected / 100])]}
        />
      </PageHead>
      <div className="a-stats" style={{ marginBottom: '1rem' }}>
        <div className="a-stat">
          <span>عدد الطلبات (غير الملغاة)</span>
          <b className="num">{s.ordersCount}</b>
        </div>
        <div className="a-stat">
          <span>قيمة الطلبات</span>
          <b className="num">{m(s.ordersValue)}</b>
        </div>
        <div className="a-stat a-stat--ok">
          <span>قيمة المكتملة</span>
          <b className="num">{m(s.completedValue)}</b>
        </div>
        <div className="a-stat a-stat--ok">
          <span>المحصل (بعد الاستردادات)</span>
          <b className="num">{m(s.collected - s.refunded)}</b>
        </div>
        <div className="a-stat a-stat--warn">
          <span>المتبقي على الطلبات المفتوحة</span>
          <b className="num">{m(s.outstanding)}</b>
        </div>
        <div className="a-stat">
          <span>متوسط قيمة الطلب</span>
          <b className="num">{m(s.ordersCount ? Math.round(s.ordersValue / s.ordersCount) : 0)}</b>
        </div>
        <div className="a-stat">
          <span>طلبات ملغاة</span>
          <b className="num">{s.cancelled}</b>
        </div>
      </div>
      <div className="a-card" style={{ marginBottom: '1rem' }}>
        <h2>قيمة الطلبات اليومية</h2>
        <DailyChart data={series} />
      </div>
      <div className="a-grid a-grid--3">
        <div className="a-card">
          <h2>الأكثر طلباً</h2>
          <table className="a-table">
            <tbody>
              {top.map((t) => (
                <tr key={`${t.product_id}-${t.name}`}>
                  <td>{t.name}</td>
                  <td className="num">{t.qty}</td>
                  <td className="num small">{m(t.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!top.length && <p className="muted small">لا بيانات</p>}
        </div>
        <div className="a-card">
          <h2>حالات الطلبات</h2>
          <table className="a-table">
            <tbody>
              {br.orders.map((x) => (
                <tr key={x.k}>
                  <td>{ORDER_STATUS_LABELS[x.k as keyof typeof ORDER_STATUS_LABELS] || x.k}</td>
                  <td className="num">{x.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="a-card">
          <h2>حالات الدفع</h2>
          <table className="a-table">
            <tbody>
              {br.payments.map((x) => (
                <tr key={x.k}>
                  <td>{PAYMENT_STATUS_LABELS[x.k as keyof typeof PAYMENT_STATUS_LABELS] || x.k}</td>
                  <td className="num">{x.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        المحصل = التحويلات التي سجلها الموظفون بعد مراجعة السندات خلال الفترة. القيم المعروضة بعملة المتجر الحالية.
      </p>
    </>
  )
}
