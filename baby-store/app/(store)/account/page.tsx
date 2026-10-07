import type { Metadata } from 'next'
import Link from 'next/link'
import { SectionTitle } from '@/components/store/Sections'
import { AccountAuth, AccountProfile } from '@/components/store/Account'
import { currentAccount, accountOrders } from '@/lib/server/customer-auth'
import { orderCurrency } from '@/lib/server/currency'
import { getSetting } from '@/lib/server/settings'
import { shippingOptions } from '@/lib/server/pricing'
import { formatMoney } from '@/lib/shared/money'
import { formatDateTime } from '@/lib/shared/dates'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from '@/lib/shared/constants'

export const metadata: Metadata = { title: 'حسابي', robots: { index: false, follow: false } }

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const safeNext = next && /^\/[\w\-/]*$/.test(next) && !next.startsWith('//') ? next : null
  const store = await getSetting('store')
  const acct = await currentAccount()

  if (!acct) {
    return (
      <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '3rem', maxWidth: 560 }}>
        <SectionTitle title="حسابي" subtitle="ادخل برقم واتساب وكلمة المرور لحفظ بياناتك ومتابعة طلباتك" as="h1" />
        <AccountAuth next={safeNext} defaultPhoneCode={store.defaultPhoneCode} />
      </div>
    )
  }

  const orders = await accountOrders(acct.id)
  return (
    <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '3rem', maxWidth: 900 }}>
      <SectionTitle title={`أهلاً ${acct.name.split(' ')[0]}`} subtitle="طلباتك وبياناتك المحفوظة" as="h1" />
      <div className="account-grid">
        <section className="card stack">
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>طلباتي</h2>
          {!orders.length ? (
            <div className="stack">
              <p className="muted" style={{ margin: 0 }}>
                لا توجد طلبات في حسابك بعد. الطلبات التي تنشئها وأنت مسجل الدخول تظهر هنا تلقائياً.
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                طلب سابق كزائر؟ يمكنك متابعته من <Link className="link" href="/track">صفحة تتبع الطلب</Link>.
              </p>
              <Link className="btn" href="/products">
                تصفح المنتجات
              </Link>
            </div>
          ) : (
            <ul className="account-orders">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/order/${o.token}`}>
                    <span className="grow">
                      <b className="num">
                        <bdi>{o.number}</bdi>
                      </b>
                      <span className="small muted" style={{ display: 'block' }}>
                        {formatDateTime(o.created_at, store.timezone, store.currency.numerals)} — {o.items} قطعة
                      </span>
                    </span>
                    <span style={{ textAlign: 'end' }}>
                      <b className="num">{formatMoney(o.total, orderCurrency(o, store))}</b>
                      <span className="small" style={{ display: 'block' }}>
                        {ORDER_STATUS_LABELS[o.status as OrderStatus]} · {PAYMENT_STATUS_LABELS[o.payment_status as PaymentStatus]}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <AccountProfile
          account={{ name: acct.name, phone: acct.phone, country: acct.country || '', city: acct.city || '', area: acct.area || '', address: acct.address || '', landmark: acct.landmark || '', mapUrl: acct.map_url || '' }}
          countries={(await shippingOptions()).map((s) => s.country)}
        />
      </div>
    </div>
  )
}
