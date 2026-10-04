import { db, nowSql } from './db'
import { invalidateCatalog } from './catalog'
import { getSetting } from './settings'

export type Actor = { id: number; name: string } | null

export class StockError extends Error {
  constructor(public shortages: { sku: string; name: string; needed: number; available: number }[]) {
    super('الكمية المطلوبة غير متوفرة')
  }
}

function currentStock(productId: number, variantId: number | null): { stock: number; name: string; sku: string } | null {
  const d = db()
  if (variantId) {
    return (d
      .prepare('SELECT v.stock, p.name, v.sku FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.product_id=?')
      .get(variantId, productId) as { stock: number; name: string; sku: string } | undefined) || null
  }
  return (d.prepare('SELECT stock, name, sku FROM products WHERE id=?').get(productId) as { stock: number; name: string; sku: string } | undefined) || null
}

function logMovement(m: {
  productId: number
  variantId: number | null
  sku: string
  name: string
  change: number
  stockAfter: number
  reason: string
  orderId?: number | null
  actor?: Actor
  note?: string | null
}) {
  db()
    .prepare(
      'INSERT INTO stock_movements(product_id,variant_id,sku,product_name,change,stock_after,reason,order_id,user_id,user_name,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(m.productId, m.variantId, m.sku, m.name, m.change, m.stockAfter, m.reason, m.orderId ?? null, m.actor?.id ?? null, m.actor?.name ?? null, m.note ?? null)
}

/** خصم ذري: ينجح فقط إذا كانت الكمية كافية (يمنع البيع الزائد مع الطلبات المتزامنة) */
function tryDeduct(productId: number, variantId: number | null, qty: number): boolean {
  const d = db()
  const r = variantId
    ? d.prepare('UPDATE variants SET stock=stock-? WHERE id=? AND product_id=? AND stock>=?').run(qty, variantId, productId, qty)
    : d.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?').run(qty, productId, qty)
  return r.changes === 1
}

function addBack(productId: number, variantId: number | null, qty: number) {
  const d = db()
  if (variantId) d.prepare('UPDATE variants SET stock=stock+? WHERE id=?').run(qty, variantId)
  else d.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(qty, productId)
}

/** تعديل يدوي للمخزون (إضافة أو خصم) مع تسجيل الحركة */
export function adjustStock(args: {
  productId: number
  variantId: number | null
  change: number
  reason: string
  actor: Actor
  note?: string | null
  allowNegative?: boolean
}) {
  const cur = currentStock(args.productId, args.variantId)
  if (!cur) throw new Error('المنتج غير موجود')
  if (args.change === 0) return cur.stock
  if (args.change < 0 && !args.allowNegative && cur.stock + args.change < 0) {
    throw new StockError([{ sku: cur.sku, name: cur.name, needed: -args.change, available: cur.stock }])
  }
  const d = db()
  if (args.variantId) d.prepare('UPDATE variants SET stock=stock+? WHERE id=?').run(args.change, args.variantId)
  else d.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(args.change, args.productId)
  const after = cur.stock + args.change
  logMovement({ productId: args.productId, variantId: args.variantId, sku: cur.sku, name: cur.name, change: args.change, stockAfter: after, reason: args.reason, actor: args.actor, note: args.note })
  invalidateCatalog()
  return after
}

export function setStock(args: { productId: number; variantId: number | null; value: number; reason: string; actor: Actor; note?: string | null }) {
  const cur = currentStock(args.productId, args.variantId)
  if (!cur) throw new Error('المنتج غير موجود')
  const value = Math.max(0, Math.floor(args.value))
  return adjustStock({ ...args, change: value - cur.stock, allowNegative: true })
}

type StockLine = { id: number; order_id: number; product_id: number; variant_id: number | null; sku: string | null; name: string | null; qty: number; deducted: number }

function stockLines(orderId: number): StockLine[] {
  return db().prepare('SELECT * FROM order_stock_lines WHERE order_id=?').all(orderId) as StockLine[]
}

/** خصم المخزون لأسطر طلب (يُستدعى داخل معاملة). يرمي StockError عند النقص */
export function deductLines(orderId: number, reason: 'order_reserve' | 'order_rereserve', actor: Actor) {
  const lines = stockLines(orderId).filter((l) => l.deducted < l.qty)
  const shortages: StockError['shortages'] = []
  // تجميع حسب الصنف لاكتشاف النقص قبل أي خصم
  const need = new Map<string, { productId: number; variantId: number | null; qty: number; sku: string; name: string }>()
  for (const l of lines) {
    const k = l.variant_id ? `v${l.variant_id}` : `p${l.product_id}`
    const e = need.get(k) || { productId: l.product_id, variantId: l.variant_id, qty: 0, sku: l.sku || '', name: l.name || '' }
    e.qty += l.qty - l.deducted
    need.set(k, e)
  }
  for (const n of need.values()) {
    const cur = currentStock(n.productId, n.variantId)
    if (!cur || cur.stock < n.qty) shortages.push({ sku: n.sku, name: n.name, needed: n.qty, available: cur?.stock ?? 0 })
  }
  if (shortages.length) throw new StockError(shortages)
  for (const l of lines) {
    const q = l.qty - l.deducted
    if (!tryDeduct(l.product_id, l.variant_id, q)) {
      const cur = currentStock(l.product_id, l.variant_id)
      throw new StockError([{ sku: l.sku || '', name: l.name || '', needed: q, available: cur?.stock ?? 0 }])
    }
    db().prepare('UPDATE order_stock_lines SET deducted=qty WHERE id=?').run(l.id)
    const cur = currentStock(l.product_id, l.variant_id)
    logMovement({ productId: l.product_id, variantId: l.variant_id, sku: l.sku || '', name: l.name || '', change: -q, stockAfter: cur?.stock ?? 0, reason, orderId, actor })
  }
  invalidateCatalog()
}

/** إعادة كل الكميات المخصومة لطلب (انتهاء الحجز أو الإلغاء). آمن من التكرار لأنه يعتمد على عمود deducted */
export function releaseLines(orderId: number, reason: 'order_release' | 'order_cancel', actor: Actor, note?: string) {
  const lines = stockLines(orderId).filter((l) => l.deducted > 0)
  for (const l of lines) {
    addBack(l.product_id, l.variant_id, l.deducted)
    db().prepare('UPDATE order_stock_lines SET deducted=0 WHERE id=?').run(l.id)
    const cur = currentStock(l.product_id, l.variant_id)
    logMovement({ productId: l.product_id, variantId: l.variant_id, sku: l.sku || '', name: l.name || '', change: l.deducted, stockAfter: cur?.stock ?? 0, reason, orderId, actor, note })
  }
  if (lines.length) invalidateCatalog()
  return lines.length
}

/** إرجاع كميات مرتجعة للمخزون بحد أقصى ما تم خصمه فعلياً (يمنع الإرجاع المزدوج) */
export function restockItem(orderId: number, orderItemId: number, units: number, actor: Actor, note?: string): number {
  const itemLines = db().prepare('SELECT * FROM order_stock_lines WHERE order_id=? AND order_item_id=? AND deducted>0').all(orderId, orderItemId) as StockLine[]
  const item = db().prepare('SELECT qty FROM order_items WHERE id=? AND order_id=?').get(orderItemId, orderId) as { qty: number } | undefined
  if (!item) return 0
  let restored = 0
  for (const l of itemLines) {
    const perUnit = Math.max(1, Math.round(l.qty / item.qty))
    const q = Math.min(l.deducted, perUnit * units)
    if (q <= 0) continue
    addBack(l.product_id, l.variant_id, q)
    db().prepare('UPDATE order_stock_lines SET deducted=deducted-? WHERE id=?').run(q, l.id)
    const cur = currentStock(l.product_id, l.variant_id)
    logMovement({ productId: l.product_id, variantId: l.variant_id, sku: l.sku || '', name: l.name || '', change: q, stockAfter: cur?.stock ?? 0, reason: 'return_restock', orderId, actor, note })
    restored += q
  }
  if (restored) invalidateCatalog()
  return restored
}

/** تحرير حجوزات الطلبات المعلقة التي انتهت مهلتها، والإلغاء التلقائي إن كان مفعلاً */
export function releaseExpiredReservations(): number {
  const d = db()
  const now = nowSql()
  const expired = d
    .prepare("SELECT id, number FROM orders WHERE stock_state='reserved' AND status='pending' AND reservation_expires_at IS NOT NULL AND reservation_expires_at < ?")
    .all(now) as { id: number; number: string }[]
  for (const o of expired) {
    d.transaction(() => {
      const cur = d.prepare("SELECT stock_state FROM orders WHERE id=?").get(o.id) as { stock_state: string }
      if (cur.stock_state !== 'reserved') return
      releaseLines(o.id, 'order_release', null, 'انتهت مهلة التحويل')
      d.prepare("UPDATE orders SET stock_state='released', reservation_released_at=?, updated_at=? WHERE id=?").run(now, now, o.id)
      d.prepare('INSERT INTO order_events(order_id,type,message,public) VALUES(?,?,?,0)').run(
        o.id,
        'reservation_released',
        'انتهت مهلة حجز المخزون وتم تحرير الكميات. يلزم التحقق من التوفر قبل تأكيد الطلب',
      )
      d.prepare("INSERT INTO notifications(type,title,body,link,permission) VALUES('reservation','انتهى حجز طلب',?,?,'orders')").run(
        `الطلب ${o.number} انتهت مهلة التحويل وتم تحرير المخزون`,
        `/admin/orders/${o.id}`,
      )
    }).immediate()
  }
  const hours = getSetting('checkout').autoCancelAfterExpiryHours
  if (hours > 0) {
    const cutoff = nowSql(new Date(Date.now() - hours * 3600e3))
    const stale = d
      .prepare(
        "SELECT id FROM orders WHERE status='pending' AND stock_state='released' AND payment_status='awaiting_transfer' AND reservation_released_at < ?",
      )
      .all(cutoff) as { id: number }[]
    for (const o of stale) {
      d.prepare("UPDATE orders SET status='cancelled', cancelled_at=?, cancel_reason=?, updated_at=? WHERE id=? AND status='pending'").run(
        now,
        'إلغاء تلقائي لعدم وصول التحويل',
        now,
        o.id,
      )
      d.prepare("INSERT INTO order_events(order_id,type,message,public) VALUES(?,?,?,1)").run(o.id, 'status', 'تم إلغاء الطلب تلقائياً لعدم وصول التحويل خلال المهلة')
    }
  }
  if (expired.length) invalidateCatalog()
  return expired.length
}
