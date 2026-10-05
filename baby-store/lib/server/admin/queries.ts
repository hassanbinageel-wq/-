import { db, nowSql } from '../db'
import { getSetting } from '../settings'

/** فرق التوقيت (بالدقائق) لمنطقة زمنية في تاريخ معين */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value || 'GMT'
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part)
  if (!m) return 0
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0))
}

/** بداية أو نهاية يوم بتوقيت المتجر محولة إلى صيغة قاعدة البيانات (UTC) */
export async function localDayBoundary(day: string, end: boolean): Promise<string> {
  const tz = (await getSetting('store')).timezone || 'UTC'
  const base = new Date(`${day}T${end ? '23:59:59' : '00:00:00'}Z`)
  return nowSql(new Date(base.getTime() - tzOffsetMinutes(tz, base) * 60000))
}
import { normalizeArabic, toLatinDigits } from '../../shared/arabic'
import type { OrderRow } from '../orders'

export type OrderFilters = {
  q?: string
  status?: string
  payment?: string
  from?: string // YYYY-MM-DD
  to?: string
  page?: number
  perPage?: number
  flag?: string // reserved_expiring | released
}

export async function orderWhere(f: OrderFilters): Promise<{ sql: string; args: unknown[] }> {
  const w: string[] = []
  const args: unknown[] = []
  if (f.status) {
    w.push('o.status=?')
    args.push(f.status)
  }
  if (f.payment) {
    w.push('o.payment_status=?')
    args.push(f.payment)
  }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) {
    w.push('o.created_at >= ?')
    args.push(await localDayBoundary(f.from, false))
  }
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) {
    w.push('o.created_at <= ?')
    args.push(await localDayBoundary(f.to, true))
  }
  if (f.flag === 'released') w.push("o.stock_state='released' AND o.status='pending'")
  if (f.q && f.q.trim()) {
    const raw = toLatinDigits(f.q.trim())
    const digits = raw.replace(/\D/g, '')
    const like = `%${raw.toUpperCase()}%`
    const parts = ['UPPER(o.number) ILIKE ?', 'o.customer_name ILIKE ?', 'EXISTS (SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.reference ILIKE ?)']
    args.push(like, `%${raw}%`, `%${raw}%`)
    if (digits.length >= 4) {
      parts.push('o.customer_phone ILIKE ?', 'o.recipient_phone ILIKE ?')
      args.push(`%${digits.replace(/^0+/, '')}%`, `%${digits.replace(/^0+/, '')}%`)
    }
    w.push(`(${parts.join(' OR ')})`)
  }
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', args }
}

export async function listOrders(f: OrderFilters) {
  const { sql, args } = await orderWhere(f)
  const perPage = Math.min(200, f.perPage || 30)
  const page = Math.max(1, f.page || 1)
  const total = (await db().prepare(`SELECT COUNT(*) n FROM orders o ${sql}`).get(...args) as { n: number }).n
  const rows = await db()
      .prepare(
        `SELECT o.*, (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.order_id=o.id) AS received,
        (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS items_count
       FROM orders o ${sql} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, perPage, (page - 1) * perPage) as (OrderRow & { received: number; items_count: number })[]
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)) }
}

export async function listCustomers(q: string, page = 1) {
  const perPage = 30
  const w: string[] = []
  const args: unknown[] = []
  if (q.trim()) {
    const raw = toLatinDigits(q.trim())
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
    w.push(digits.length >= 4 ? '(c.name ILIKE ? OR c.phone ILIKE ?)' : 'c.name ILIKE ?')
    args.push(`%${raw}%`)
    if (digits.length >= 4) args.push(`%${digits}%`)
  }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : ''
  const total = (await db().prepare(`SELECT COUNT(*) n FROM customers c ${where}`).get(...args) as { n: number }).n
  const rows = await db()
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id) AS orders_count,
        (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.customer_id=c.id AND o.status<>'cancelled') AS orders_total
       FROM customers c ${where} ORDER BY COALESCE(c.last_order_at, c.created_at) DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, perPage, (page - 1) * perPage) as {
    id: number; phone: string; name: string; city: string | null; country: string | null; area: string | null; address: string | null
    notes: string | null; created_at: string; last_order_at: string | null; orders_count: number; orders_total: number
  }[]
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)) }
}

export type AdminProductFilters = { q?: string; status?: string; category?: number; type?: string; stock?: string; page?: number }

export async function listAdminProducts(f: AdminProductFilters) {
  const w: string[] = []
  const args: unknown[] = []
  if (f.status) {
    w.push('p.status=?')
    args.push(f.status)
  } else w.push("p.status<>'archived'")
  if (f.category) {
    w.push('p.category_id=?')
    args.push(f.category)
  }
  if (f.type) {
    w.push('p.type=?')
    args.push(f.type)
  }
  if (f.q && f.q.trim()) {
    w.push('(p.search_text ILIKE ? OR p.sku ILIKE ?)')
    args.push(`%${normalizeArabic(f.q)}%`, `%${f.q.trim()}%`)
  }
  const stockExpr = `CASE WHEN p.type='variable' THEN (SELECT COALESCE(SUM(stock),0) FROM variants v WHERE v.product_id=p.id AND v.active=1) ELSE p.stock END`
  if (f.stock === 'low') {
    w.push(`p.track_stock=1 AND p.type<>'bundle' AND ${stockExpr} <= COALESCE(p.low_stock_threshold, ?)`)
    args.push(await lowThreshold())
  }
  if (f.stock === 'out') w.push(`p.track_stock=1 AND p.type<>'bundle' AND ${stockExpr} <= 0`)
  const where = w.length ? `WHERE ${w.join(' AND ')}` : ''
  const perPage = 40
  const page = Math.max(1, f.page || 1)
  const total = (await db().prepare(`SELECT COUNT(*) n FROM products p ${where}`).get(...args) as { n: number }).n
  const rows = await db()
      .prepare(
        `SELECT p.id, p.type, p.sku, p.name, p.slug, p.status, p.price, p.sale_price, p.track_stock, p.is_demo, p.updated_at,
        c.name AS category_name, ${stockExpr} AS stock_total,
        (SELECT COUNT(*) FROM variants v WHERE v.product_id=p.id) AS variants_count,
        (SELECT (CASE WHEN m.path LIKE 'static/%' THEN '/' || substr(m.path, 8) ELSE '/media/' || m.path END) || '-' || (m.sizes::jsonb->>0) || '.' || m.ext
          FROM product_images pi JOIN media m ON m.id=pi.media_id WHERE pi.product_id=p.id AND pi.role IS DISTINCT FROM 'rail' ORDER BY pi.sort LIMIT 1) AS thumb
       FROM products p LEFT JOIN categories c ON c.id=p.category_id ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, perPage, (page - 1) * perPage) as {
    id: number; type: string; sku: string; name: string; slug: string; status: string; price: number; sale_price: number | null
    track_stock: number; is_demo: number; updated_at: string; category_name: string | null; stock_total: number; variants_count: number; thumb: string | null
  }[]
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)) }
}

async function lowThreshold(): Promise<number> {
  const row = await db().prepare("SELECT value FROM settings WHERE key='inventory'").get() as { value: string } | undefined
  try {
    return row ? JSON.parse(row.value).lowStockThreshold ?? 3 : 3
  } catch {
    return 3
  }
}

/** المخزون المنخفض: منتجات بسيطة وخيارات بمخزون أقل من الحد */
export async function lowStockItems(limit = 50) {
  const t = await lowThreshold()
  return await db()
      .prepare(
        `SELECT * FROM (
        SELECT p.id AS product_id, NULL AS variant_id, p.name, p.sku, NULL AS label, p.stock, COALESCE(p.low_stock_threshold, ?) AS threshold
        FROM products p WHERE p.type='simple' AND p.track_stock=1 AND p.status='published'
        UNION ALL
        SELECT p.id, v.id, p.name, v.sku, TRIM(COALESCE(v.option1,'') || ' ' || COALESCE(v.option2,'') || ' ' || COALESCE(v.option3,'')), v.stock, COALESCE(p.low_stock_threshold, ?)
        FROM variants v JOIN products p ON p.id=v.product_id WHERE p.type='variable' AND p.track_stock=1 AND p.status='published' AND v.active=1
      ) WHERE stock <= threshold ORDER BY stock ASC, name LIMIT ?`,
      )
      .all(t, t, limit) as { product_id: number; variant_id: number | null; name: string; sku: string; label: string | null; stock: number; threshold: number }[]
}

export function csvEscape(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  // منع حقن المعادلات في Excel للنصوص فقط (الأرقام تبقى كما هي)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
}
