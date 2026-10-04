import { notFound } from 'next/navigation'
import { requirePage, can } from '@/lib/server/auth'
import { db, parseJson } from '@/lib/server/db'
import { getOrder, getOrderItems, paymentSummary, trackingUrl } from '@/lib/server/orders'
import { getSetting } from '@/lib/server/settings'
import { OrderDetail } from '@/components/admin/OrderDetail'

export const metadata = { title: 'تفاصيل الطلب' }

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage(['orders', 'payments'])
  const o = await getOrder(Number((await params).id))
  if (!o) notFound()
  const d = db()
  const items = (await getOrderItems(o.id)).map((i) => ({
    ...i,
    options: parseJson<{ name: string; value: string }[]>(i.options, []),
    components: parseJson<{ name: string; sku: string; qty: number; options: { name: string; value: string }[] }[]>(i.components, []),
  }))
  const stockLines = await d.prepare('SELECT * FROM order_stock_lines WHERE order_id=?').all(o.id) as { id: number; order_item_id: number; sku: string; name: string; qty: number; deducted: number }[]
  const payments = await d.prepare('SELECT * FROM payments WHERE order_id=? ORDER BY id').all(o.id) as {
    id: number; method_name: string | null; amount: number; transfer_date: string | null; reference: string | null; sender_name: string | null
    notes: string | null; attachment_id: number | null; recorded_by_name: string | null; created_at: string
  }[]
  const refunds = await d.prepare('SELECT * FROM refunds WHERE order_id=? ORDER BY id').all(o.id) as { id: number; amount: number; method: string | null; reference: string | null; reason: string | null; created_by_name: string | null; created_at: string }[]
  const attachments = await d.prepare('SELECT a.id, a.label, a.uploaded_by_name, a.created_at, m.mime FROM order_attachments a JOIN media m ON m.id=a.media_id WHERE a.order_id=? ORDER BY a.id').all(o.id) as {
    id: number; label: string | null; uploaded_by_name: string | null; created_at: string; mime: string
  }[]
  const notes = await d.prepare('SELECT * FROM order_notes WHERE order_id=? ORDER BY id DESC').all(o.id) as { id: number; user_name: string | null; body: string; created_at: string }[]
  const events = await d.prepare('SELECT * FROM order_events WHERE order_id=? ORDER BY id DESC').all(o.id) as { id: number; type: string; message: string; public: number; user_name: string | null; created_at: string }[]
  const returns = await d.prepare('SELECT * FROM order_returns WHERE order_id=? ORDER BY id DESC').all(o.id) as { id: number; items: string; reason: string | null; restocked: number; created_by_name: string | null; created_at: string }[]
  const methods = await d.prepare('SELECT id, name, active FROM transfer_methods ORDER BY sort, id').all() as { id: number; name: string; active: number }[]
  const customerOrders = o.customer_id ? (await d.prepare('SELECT COUNT(*) n FROM orders WHERE customer_id=?').get(o.customer_id) as { n: number }).n : 1
  const store = await getSetting('store')
  return (
    <OrderDetail
      o={o}
      items={items}
      stockLines={stockLines}
      payments={payments}
      refunds={refunds}
      attachments={attachments}
      notes={notes}
      events={events}
      returns={returns.map((r) => ({ ...r, items: parseJson<{ name: string; qty: number; restocked: number }[]>(r.items, []) }))}
      methods={methods}
      templates={(await getSetting('messages')).map((m) => ({ key: m.key, title: m.title }))}
      summary={await paymentSummary(o.id, o.total)}
      customerOrders={customerOrders}
      trackingLink={trackingUrl(o)}
      timezone={store.timezone}
      perms={{ orders: can(user, 'orders'), payments: can(user, 'payments') }}
    />
  )
}
