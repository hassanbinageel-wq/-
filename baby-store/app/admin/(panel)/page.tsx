import Link from 'next/link'
import { Suspense } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock, CreditCard, PackageCheck, Truck, ShoppingBag, TrendingUp, Wallet, Hourglass } from 'lucide-react'
import { requirePage, can } from '@/lib/server/auth'
import { getSetting } from '@/lib/server/settings'
import { liveCounts, moneyStats, resolveRange, setupChecklist, topProducts } from '@/lib/server/admin/stats'
import { listOrders, lowStockItems } from '@/lib/server/admin/queries'
import { formatMoney } from '@/lib/shared/money'
import { formatDateTime } from '@/lib/shared/dates'
import { RangePicker } from '@/components/admin/UrlFilters'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/ui'

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePage()
  const sp = await searchParams
  const store = getSetting('store')
  const m = (c: number) => formatMoney(c, store.currency)
  const live = liveCounts()
  const range = resolveRange(sp)
  const showMoney = can(user, ['owner', 'payments'])
  const showOrders = can(user, ['orders', 'payments'])
  const money = showMoney ? moneyStats(range) : null
  const top = showOrders || can(user, 'products') ? topProducts(range, 6) : []
  const low = can(user, 'products') ? lowStockItems(10) : []
  const recent = showOrders ? listOrders({ perPage: 8 }).rows : []
  const checklist = can(user, 'owner') ? setupChecklist() : []
  const todo = checklist.filter((c) => !c.done)

  return (
    <>
      <div className="a-page-head">
        <div>
          <h1>مرحباً {user.name}</h1>
          <p>ملخص المتجر — {range.label}</p>
        </div>
        <Suspense>
          <RangePicker />
        </Suspense>
      </div>
      {sp.denied && <div className="a-notice a-notice--danger" style={{ marginBottom: 12 }}>ليست لديك صلاحية لفتح تلك الصفحة.</div>}

      {todo.length > 0 && (
        <div className="a-card" style={{ marginBottom: '1rem', borderColor: '#f0d58a', background: '#fffcf1' }}>
          <h2>قائمة الإعداد قبل الإطلاق ({checklist.length - todo.length}/{checklist.length})</h2>
          <ul className="a-checklist">
            {checklist.map((c) => (
              <li key={c.text}>
                {c.done ? <CheckCircle2 size={18} color="#23704f" /> : <Circle size={18} color="#8a5a00" />}
                <Link href={c.href} style={{ textDecoration: c.done ? 'line-through' : 'underline', color: c.done ? '#6b6472' : 'inherit' }}>
                  {c.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showOrders && (
        <div className="a-stats" style={{ marginBottom: '1rem' }}>
          <Link href="/admin/orders?status=pending" className="a-stat">
            <span><ShoppingBag size={16} /> طلبات جديدة (24 ساعة)</span>
            <b className="num">{live.newToday}</b>
          </Link>
          <Link href="/admin/orders?payment=awaiting_transfer" className="a-stat a-stat--warn">
            <span><Clock size={16} /> بانتظار التحويل</span>
            <b className="num">{live.awaitingTransfer}</b>
          </Link>
          <Link href="/admin/orders?payment=under_review" className="a-stat a-stat--warn">
            <span><CreditCard size={16} /> مدفوعات قيد المراجعة</span>
            <b className="num">{live.underReview}</b>
          </Link>
          <Link href="/admin/orders?status=preparing" className="a-stat">
            <span><PackageCheck size={16} /> مؤكد وقيد التجهيز</span>
            <b className="num">{live.preparing}</b>
          </Link>
          <Link href="/admin/orders?status=shipped" className="a-stat">
            <span><Truck size={16} /> تم الشحن</span>
            <b className="num">{live.shipped}</b>
          </Link>
          {live.released > 0 && (
            <Link href="/admin/orders?flag=released" className="a-stat a-stat--warn">
              <span><Hourglass size={16} /> انتهى حجزها وتحتاج مراجعة توفر</span>
              <b className="num">{live.released}</b>
            </Link>
          )}
        </div>
      )}

      {money && (
        <div className="a-stats" style={{ marginBottom: '1rem' }}>
          <div className="a-stat a-stat--ok">
            <span><TrendingUp size={16} /> قيمة الطلبات المكتملة</span>
            <b className="num">{m(money.completedValue)}</b>
            <span className="num">{money.completedCount} طلب</span>
          </div>
          <div className="a-stat">
            <span><ShoppingBag size={16} /> قيمة كل الطلبات (غير الملغاة)</span>
            <b className="num">{m(money.ordersValue)}</b>
            <span className="num">{money.ordersCount} طلب</span>
          </div>
          <div className="a-stat a-stat--ok">
            <span><Wallet size={16} /> المبالغ المحصلة (المسجلة)</span>
            <b className="num">{m(money.collected - money.refunded)}</b>
            {money.refunded > 0 && <span className="num">بعد خصم استردادات {m(money.refunded)}</span>}
          </div>
          <div className="a-stat a-stat--warn">
            <span><Hourglass size={16} /> مبالغ متبقية على طلبات مفتوحة</span>
            <b className="num">{m(money.outstanding)}</b>
          </div>
        </div>
      )}

      <div className="a-grid a-grid--2">
        {showOrders && (
          <div className="a-card">
            <div className="a-row a-row--between" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>أحدث الطلبات</h2>
              <Link href="/admin/orders" className="a-btn a-btn--ghost a-btn--sm">كل الطلبات</Link>
            </div>
            {recent.length ? (
              <div className="a-table-wrap" style={{ border: 0 }}>
                <table className="a-table">
                  <tbody>
                    {recent.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link className="rowlink" href={`/admin/orders/${o.id}`}><bdi>{o.number}</bdi></Link>
                          <div className="small muted">{o.customer_name}</div>
                        </td>
                        <td className="num">{m(o.total)}</td>
                        <td><OrderStatusBadge status={o.status} /><br /><PaymentStatusBadge status={o.payment_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="a-empty">لا توجد طلبات بعد</p>
            )}
          </div>
        )}
        <div className="a-grid">
          {top.length > 0 && (
            <div className="a-card">
              <h2>الأكثر طلباً ({range.label})</h2>
              <ol style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
                {top.map((t) => (
                  <li key={`${t.product_id}-${t.name}`} style={{ padding: '0.2rem 0' }}>
                    {t.name} — <b className="num">{t.qty}</b> قطعة {showMoney && <span className="muted small num">({m(t.value)})</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {can(user, 'products') && (
            <div className="a-card">
              <div className="a-row a-row--between" style={{ marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>مخزون منخفض</h2>
                <Link href="/admin/inventory?filter=low" className="a-btn a-btn--ghost a-btn--sm">المخزون</Link>
              </div>
              {low.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {low.map((l) => (
                    <li key={`${l.product_id}-${l.variant_id}`} className="a-row a-row--between" style={{ padding: '0.3rem 0', borderBottom: '1px dashed var(--a-border)' }}>
                      <Link href={`/admin/products/${l.product_id}`}>
                        {l.name} {l.label && <span className="muted small">({l.label})</span>}
                      </Link>
                      <span className={`a-badge ${l.stock <= 0 ? 'a-badge--danger' : 'a-badge--warn'}`}>
                        {l.stock <= 0 ? <AlertTriangle size={12} /> : null} <span className="num">{l.stock}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">لا توجد منتجات منخفضة المخزون 🎉</p>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: '1rem' }}>آخر تحديث: {formatDateTime(new Date(), store.timezone)}</p>
    </>
  )
}
