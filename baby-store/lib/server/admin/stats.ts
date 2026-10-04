import { db } from '../db'
import { localDayBoundary, tzOffsetMinutes } from './queries'
import { getSetting } from '../settings'
import { DEFAULT_PAGES } from '../default-content'

export type Range = { key: string; from: string; to: string; fromSql: string; toSql: string; label: string }

export async function resolveRange(sp: Record<string, string | undefined>): Promise<Range> {
  const tz = (await getSetting('store')).timezone || 'UTC'
  const now = new Date()
  const today = new Date(now.getTime() + tzOffsetMinutes(tz, now) * 60000).toISOString().slice(0, 10)
  const shift = (days: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() - days * 864e5).toISOString().slice(0, 10)
  const key = sp.range || '30d'
  let from = shift(29)
  let to = today
  let label = 'آخر 30 يوماً'
  if (key === 'today') [from, label] = [today, 'اليوم']
  else if (key === '7d') [from, label] = [shift(6), 'آخر 7 أيام']
  else if (key === '90d') [from, label] = [shift(89), 'آخر 90 يوماً']
  else if (key === 'year') [from, label] = [`${today.slice(0, 4)}-01-01`, 'هذه السنة']
  else if (key === 'custom' && sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) {
    from = sp.from
    to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today
    label = `من ${from} إلى ${to}`
  }
  return { key, from, to, fromSql: await localDayBoundary(from, false), toSql: await localDayBoundary(to, true), label }
}

const one = async (sql: string, ...args: unknown[]) => (await db().prepare(sql).get(...args) as { n: number }).n

export async function liveCounts() {
  return {
    newToday: await one("SELECT COUNT(*) n FROM orders WHERE created_at >= datetime('now','-24 hours')"),
    pending: await one("SELECT COUNT(*) n FROM orders WHERE status='pending'"),
    awaitingTransfer: await one("SELECT COUNT(*) n FROM orders WHERE payment_status='awaiting_transfer' AND status<>'cancelled'"),
    underReview: await one("SELECT COUNT(*) n FROM orders WHERE payment_status IN ('under_review','needs_review') AND status<>'cancelled'"),
    preparing: await one("SELECT COUNT(*) n FROM orders WHERE status IN ('confirmed','preparing')"),
    shipped: await one("SELECT COUNT(*) n FROM orders WHERE status='shipped'"),
    released: await one("SELECT COUNT(*) n FROM orders WHERE status='pending' AND stock_state='released'"),
  }
}

export async function moneyStats(r: Range) {
  const d = db()
  const completed = (await d.prepare("SELECT COALESCE(SUM(total),0) n, COUNT(*) c FROM orders WHERE status='completed' AND created_at BETWEEN ? AND ?").get(r.fromSql, r.toSql) as { n: number; c: number })
  const all = (await d.prepare("SELECT COALESCE(SUM(total),0) n, COUNT(*) c FROM orders WHERE status<>'cancelled' AND created_at BETWEEN ? AND ?").get(r.fromSql, r.toSql) as { n: number; c: number })
  const collected = await one('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE created_at BETWEEN ? AND ?', r.fromSql, r.toSql)
  const refunded = await one('SELECT COALESCE(SUM(amount),0) n FROM refunds WHERE created_at BETWEEN ? AND ?', r.fromSql, r.toSql)
  // المتبقي: لكل طلب نشط غير ملغي، الإجمالي ناقص المستلم (بغض النظر عن الفترة)
  const outstanding = await one(
      `SELECT COALESCE(SUM(GREATEST(o.total - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id=o.id),0), 0)),0) n
     FROM orders o WHERE o.status<>'cancelled' AND o.payment_status NOT IN ('paid','refunded','partially_refunded')`,
    )
  const cancelled = await one("SELECT COUNT(*) n FROM orders WHERE status='cancelled' AND created_at BETWEEN ? AND ?", r.fromSql, r.toSql)
  return { completedValue: completed.n, completedCount: completed.c, ordersValue: all.n, ordersCount: all.c, collected, refunded, outstanding, cancelled }
}

export async function topProducts(r: Range, limit = 8) {
  return await db()
      .prepare(
        `SELECT i.product_id, i.name, SUM(i.qty) qty, SUM(i.line_total) value FROM order_items i JOIN orders o ON o.id=i.order_id
       WHERE o.status<>'cancelled' AND o.created_at BETWEEN ? AND ? GROUP BY i.product_id, i.name ORDER BY qty DESC LIMIT ?`,
      )
      .all(r.fromSql, r.toSql, limit) as { product_id: number; name: string; qty: number; value: number }[]
}

export async function dailySeries(r: Range) {
  const tz = (await getSetting('store')).timezone || 'UTC'
  const rows = await db()
      .prepare("SELECT created_at, total, status FROM orders WHERE status<>'cancelled' AND created_at BETWEEN ? AND ?")
      .all(r.fromSql, r.toSql) as { created_at: string; total: number }[]
  const pays = await db().prepare('SELECT created_at, amount FROM payments WHERE created_at BETWEEN ? AND ?').all(r.fromSql, r.toSql) as { created_at: string; amount: number }[]
  const day = (s: string) => {
    const dt = new Date(s.replace(' ', 'T') + 'Z')
    return new Date(dt.getTime() + tzOffsetMinutes(tz, dt) * 60000).toISOString().slice(0, 10)
  }
  const map = new Map<string, { orders: number; value: number; collected: number }>()
  for (let t = new Date(`${r.from}T00:00:00Z`).getTime(); t <= new Date(`${r.to}T00:00:00Z`).getTime(); t += 864e5) {
    map.set(new Date(t).toISOString().slice(0, 10), { orders: 0, value: 0, collected: 0 })
  }
  for (const o of rows) {
    const e = map.get(day(o.created_at))
    if (e) {
      e.orders++
      e.value += o.total
    }
  }
  for (const p of pays) {
    const e = map.get(day(p.created_at))
    if (e) e.collected += p.amount
  }
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }))
}

export async function statusBreakdown(r: Range) {
  return {
    orders: await db().prepare('SELECT status k, COUNT(*) n FROM orders WHERE created_at BETWEEN ? AND ? GROUP BY status').all(r.fromSql, r.toSql) as { k: string; n: number }[],
    payments: await db().prepare("SELECT payment_status k, COUNT(*) n FROM orders WHERE status<>'cancelled' AND created_at BETWEEN ? AND ? GROUP BY payment_status").all(r.fromSql, r.toSql) as { k: string; n: number }[],
  }
}

/** قائمة الإعداد قبل الإطلاق */
export async function setupChecklist() {
  const d = db()
  const store = await getSetting('store')
  let pagesDefault = 0
  for (const p of DEFAULT_PAGES) {
    const row = await d.prepare('SELECT content FROM pages WHERE slug=?').get<{ content: string }>(p.slug)
    if (row && row.content === p.content) pagesDefault++
  }
  return [
    { done: await one('SELECT COUNT(*) n FROM transfer_methods WHERE active=1') > 0, text: 'أضف وسائل التحويل (البنوك والمحافظ) التي يحوّل إليها العملاء', href: '/admin/transfer-methods' },
    { done: await one('SELECT COUNT(*) n FROM shipping_zones WHERE active=1 AND is_demo=0') > 0, text: 'راجع مناطق التوصيل ورسومها (الحالية تجريبية)', href: '/admin/shipping' },
    { done: await one('SELECT COUNT(*) n FROM products WHERE is_demo=1') === 0, text: 'أضف منتجاتك ثم احذف المنتجات التجريبية', href: '/admin/settings?tab=demo' },
    { done: pagesDefault === 0, text: 'راجع صفحات السياسات (الشحن، الاستبدال، الخصوصية، من نحن)', href: '/admin/pages' },
    { done: !!store.whatsappNumber, text: `تأكد من رقم واتساب الطلبات (\u2066+${store.whatsappCountryCode} ${store.whatsappNumber}\u2069)`, href: '/admin/settings' },
    { done: await one("SELECT COUNT(*) n FROM appearance_versions WHERE status='published' AND data LIKE '%\"logoId\":null%'") === 0, text: 'ارفع شعار المتجر وأيقونة المتصفح (اختياري)', href: '/admin/appearance' },
    { done: await one('SELECT COUNT(*) n FROM admin_users WHERE active=1') > 1, text: 'أنشئ حسابات الموظفين بصلاحيات منفصلة (اختياري)', href: '/admin/users' },
  ]
}
