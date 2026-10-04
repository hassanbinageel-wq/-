import { db, nowSql, nextCounter, parseJson } from './db'
import { computeQuote, publicQuote, type QuoteResult } from './pricing'
import { deductLines, releaseLines, restockItem, releaseExpiredReservations, StockError, type Actor } from './inventory'
import { getSetting, storeWhatsapp, siteUrl } from './settings'
import { getPublishedAppearance } from './appearance'
import { randomToken } from './security'
import { ApiError } from './errors'
import { validatePhone, formatIntl, maskName, maskPhone, waLink } from '../shared/phone'
import { formatMoney } from '../shared/money'
import { formatDateTime } from '../shared/dates'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, FULFILLMENT_LABELS, type OrderStatus, type PaymentStatus } from '../shared/constants'
import type { CartLineInput } from '../shared/types'

export type OrderRow = {
  id: number
  number: string
  token: string
  idempotency_key: string | null
  customer_id: number | null
  customer_name: string
  customer_phone: string
  customer_country: string | null
  customer_city: string | null
  customer_area: string | null
  customer_address: string | null
  customer_landmark: string | null
  customer_map_url: string | null
  notes: string | null
  fulfillment: 'delivery' | 'pickup'
  zone_id: number | null
  zone_name: string | null
  eta_text: string | null
  is_gift: number
  recipient_name: string | null
  recipient_phone: string | null
  recipient_country: string | null
  recipient_city: string | null
  recipient_area: string | null
  recipient_address: string | null
  gift_message: string | null
  hide_prices: number
  gift_wrap_id: number | null
  gift_wrap_name: string | null
  subtotal: number
  discount: number
  wrap_fee: number
  personalization_fee: number
  shipping_fee: number
  total: number
  currency: string
  currency_symbol: string
  coupon_id: number | null
  coupon_code: string | null
  transfer_method_id: number | null
  transfer_method_name: string | null
  status: OrderStatus
  payment_status: PaymentStatus
  stock_state: 'reserved' | 'committed' | 'released' | 'none'
  reservation_expires_at: string | null
  reservation_released_at: string | null
  prep_days_min: number | null
  prep_days_max: number | null
  shipping_carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  payment_confirmed_by: number | null
  payment_confirmed_by_name: string | null
  payment_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export type OrderItemRow = {
  id: number
  order_id: number
  product_id: number | null
  variant_id: number | null
  product_type: string
  name: string
  sku: string
  options: string
  image: string | null
  unit_price: number
  compare_price: number | null
  qty: number
  line_total: number
  personalization_label: string | null
  personalization_text: string | null
  personalization_fee: number
  components: string
  returned_qty: number
}

export type CreateOrderInput = {
  idempotencyKey: string
  lines: CartLineInput[]
  couponCode?: string | null
  expectedTotal: number
  fulfillment: 'delivery' | 'pickup'
  customer: {
    name: string
    phoneCode: string
    phone: string
    country?: string | null
    city?: string | null
    area?: string | null
    address?: string | null
    landmark?: string | null
    mapUrl?: string | null
    notes?: string | null
  }
  gift?: {
    isGift: boolean
    wrapId?: number | null
    message?: string | null
    hidePrices?: boolean
    toRecipient?: boolean
    recipient?: {
      name: string
      phoneCode: string
      phone: string
      country?: string | null
      city?: string | null
      area?: string | null
      address?: string | null
    } | null
  } | null
  transferMethodId?: number | null
}

const clean = (s: string | null | undefined, max = 300) =>
  (s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)

export type FieldErrors = Record<string, string>

function validateCustomer(input: CreateOrderInput): { errors: FieldErrors; phone: string; recipientPhone: string | null } {
  const errors: FieldErrors = {}
  const c = input.customer
  const checkout = getSetting('checkout')
  const gifts = getSetting('gifts')
  const name = clean(c.name, 80)
  if (name.length < 3) errors['customer.name'] = 'يرجى كتابة الاسم الكامل'
  const ph = validatePhone(c.phoneCode, c.phone)
  if (!ph.ok) errors['customer.phone'] = ph.error
  const toRecipient = !!(input.gift?.isGift && gifts.giftOrderEnabled && gifts.recipientEnabled && input.gift.toRecipient)
  if (input.fulfillment === 'delivery') {
    if (!checkout.deliveryEnabled) errors['fulfillment'] = 'التوصيل غير متاح حالياً'
    if (!toRecipient) {
      if (!clean(c.country)) errors['customer.country'] = 'يرجى اختيار الدولة'
      if (!clean(c.city)) errors['customer.city'] = 'يرجى اختيار المدينة'
      if (!clean(c.area)) errors['customer.area'] = 'يرجى كتابة المنطقة أو الحي'
      if (clean(c.address).length < 6) errors['customer.address'] = 'يرجى كتابة عنوان التوصيل بالتفصيل'
    }
  } else if (!checkout.pickupEnabled) {
    errors['fulfillment'] = 'الاستلام من المحل غير متاح حالياً'
  }
  if (c.mapUrl && clean(c.mapUrl)) {
    try {
      const u = new URL(clean(c.mapUrl, 500))
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
    } catch {
      errors['customer.mapUrl'] = 'رابط الموقع غير صحيح. انسخ الرابط كاملاً من تطبيق الخرائط'
    }
  }
  if (clean(c.notes, 5000).length > checkout.notesMax) errors['customer.notes'] = `الملاحظات يجب ألا تتجاوز ${checkout.notesMax} حرفاً`
  let recipientPhone: string | null = null
  if (input.gift?.isGift && gifts.giftOrderEnabled) {
    if (gifts.giftMessageEnabled && clean(input.gift.message, 5000).length > gifts.giftMessageMax) {
      errors['gift.message'] = `رسالة الإهداء يجب ألا تتجاوز ${gifts.giftMessageMax} حرفاً`
    }
    if (toRecipient) {
      const r = input.gift.recipient
      if (!r || clean(r.name, 80).length < 2) errors['gift.recipient.name'] = 'يرجى كتابة اسم مستلم الهدية'
      const rp = r ? validatePhone(r.phoneCode, r.phone) : { ok: false as const, error: 'يرجى كتابة رقم المستلم' }
      if (!rp.ok) errors['gift.recipient.phone'] = rp.error
      else recipientPhone = rp.intl
      if (input.fulfillment === 'delivery') {
        if (!clean(r?.country)) errors['gift.recipient.country'] = 'يرجى اختيار دولة المستلم'
        if (!clean(r?.city)) errors['gift.recipient.city'] = 'يرجى اختيار مدينة المستلم'
        if (!clean(r?.area)) errors['gift.recipient.area'] = 'يرجى كتابة منطقة المستلم'
        if (clean(r?.address).length < 6) errors['gift.recipient.address'] = 'يرجى كتابة عنوان المستلم بالتفصيل'
      }
    }
  }
  return { errors, phone: ph.ok ? ph.intl : '', recipientPhone }
}

export function quoteForOrder(input: CreateOrderInput, phone?: string | null): QuoteResult {
  const gifts = getSetting('gifts')
  const toRecipient = !!(input.gift?.isGift && gifts.giftOrderEnabled && gifts.recipientEnabled && input.gift.toRecipient)
  const loc = toRecipient ? input.gift?.recipient : input.customer
  return computeQuote({
    lines: input.lines,
    couponCode: input.couponCode,
    fulfillment: input.fulfillment,
    country: clean(loc?.country) || null,
    city: clean(loc?.city) || null,
    isGift: !!input.gift?.isGift && gifts.giftOrderEnabled,
    giftWrapId: input.gift?.wrapId ?? null,
    phone,
  })
}

export function createOrder(input: CreateOrderInput, ctx: { ipHash: string }): { id: number; number: string; token: string; existing: boolean } {
  const d = db()
  if (!input.idempotencyKey || input.idempotencyKey.length < 16 || input.idempotencyKey.length > 100) {
    throw new ApiError(400, 'طلب غير صالح، أعد تحميل الصفحة')
  }
  const prior = d.prepare('SELECT id, number, token FROM orders WHERE idempotency_key=?').get(input.idempotencyKey) as
    | { id: number; number: string; token: string }
    | undefined
  if (prior) return { ...prior, existing: true }

  releaseExpiredReservations()
  const v = validateCustomer(input)
  if (Object.keys(v.errors).length) throw new ApiError(422, 'يرجى مراجعة البيانات المطلوبة', 'FIELDS', { fieldErrors: v.errors })

  const checkout = getSetting('checkout')
  const gifts = getSetting('gifts')
  const store = getSetting('store')

  return d
    .transaction(() => {
      // فحص التكرار مرة أخرى داخل المعاملة
      const again = d.prepare('SELECT id, number, token FROM orders WHERE idempotency_key=?').get(input.idempotencyKey) as
        | { id: number; number: string; token: string }
        | undefined
      if (again) return { ...again, existing: true }

      const pending = (d
        .prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_phone=? AND status='pending' AND payment_status='awaiting_transfer'")
        .get(v.phone) as { n: number }).n
      if (checkout.maxPendingPerPhone > 0 && pending >= checkout.maxPendingPerPhone) {
        throw new ApiError(429, 'لديك طلبات سابقة بانتظار التحويل. أكمل تحويلها أو تواصل معنا عبر واتساب قبل إنشاء طلب جديد', 'PENDING_LIMIT')
      }

      const quote = quoteForOrder(input, v.phone)
      if (quote.coupon && !quote.coupon.valid) {
        throw new ApiError(409, quote.coupon.message, 'COUPON_INVALID', { quote: publicQuote(quote) })
      }
      if (quote.hasBlockingErrors) {
        throw new ApiError(409, quote.errors[0] || 'تغيرت بعض المنتجات في السلة. راجعها قبل المتابعة', 'CART_INVALID', { quote: publicQuote(quote) })
      }
      if (input.fulfillment === 'delivery' && !quote.shipping.zone) {
        throw new ApiError(409, 'عذراً، التوصيل غير متاح لهذه المنطقة حالياً', 'ZONE', { quote: publicQuote(quote) })
      }
      if (Math.round(input.expectedTotal) !== quote.total) {
        throw new ApiError(409, 'تغير إجمالي الطلب (سعر أو توفر أو رسوم). راجع الملخص المحدث ثم أكد الطلب', 'PRICE_CHANGED', {
          quote: publicQuote(quote),
        })
      }

      let methodName: string | null = null
      let methodId: number | null = null
      if (input.transferMethodId) {
        const m = d.prepare('SELECT id, name FROM transfer_methods WHERE id=? AND active=1').get(input.transferMethodId) as
          | { id: number; name: string }
          | undefined
        if (m) {
          methodId = m.id
          methodName = m.name
        }
      }

      const c = input.customer
      const isGift = !!input.gift?.isGift && gifts.giftOrderEnabled
      const toRecipient = isGift && gifts.recipientEnabled && !!input.gift?.toRecipient
      const r = toRecipient ? input.gift?.recipient : null
      const now = nowSql()

      // العميل (حسب رقم الهاتف)
      const existingCustomer = d.prepare('SELECT id FROM customers WHERE phone=?').get(v.phone) as { id: number } | undefined
      let customerId: number
      if (existingCustomer) {
        customerId = existingCustomer.id
        d.prepare(
          'UPDATE customers SET name=?, country=COALESCE(?,country), city=COALESCE(?,city), area=COALESCE(?,area), address=COALESCE(?,address), updated_at=?, last_order_at=? WHERE id=?',
        ).run(clean(c.name, 80), clean(c.country) || null, clean(c.city) || null, clean(c.area) || null, clean(c.address, 500) || null, now, now, customerId)
      } else {
        customerId = Number(
          d
            .prepare('INSERT INTO customers(phone,name,country,city,area,address,last_order_at) VALUES(?,?,?,?,?,?,?)')
            .run(v.phone, clean(c.name, 80), clean(c.country) || null, clean(c.city) || null, clean(c.area) || null, clean(c.address, 500) || null, now)
            .lastInsertRowid,
        )
      }

      const seq = nextCounter('order', 1001)
      const number = `${(store.orderPrefix || 'ORD').replace(/[^\w]/g, '')}-${seq}`
      const token = randomToken(24)
      const hasStock = quote.stockNeeds.length > 0
      const expires = hasStock ? nowSql(new Date(Date.now() + checkout.reservationMinutes * 60000)) : null

      const orderId = Number(
        d
          .prepare(
            `INSERT INTO orders(number,token,idempotency_key,customer_id,customer_name,customer_phone,customer_country,customer_city,customer_area,
             customer_address,customer_landmark,customer_map_url,notes,fulfillment,zone_id,zone_name,eta_text,is_gift,recipient_name,recipient_phone,
             recipient_country,recipient_city,recipient_area,recipient_address,gift_message,hide_prices,gift_wrap_id,gift_wrap_name,subtotal,discount,
             wrap_fee,personalization_fee,shipping_fee,total,currency,currency_symbol,coupon_id,coupon_code,transfer_method_id,transfer_method_name,
             status,payment_status,stock_state,reservation_expires_at,prep_days_min,prep_days_max,ip_hash,created_at,updated_at)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','awaiting_transfer',?,?,?,?,?,?,?)`,
          )
          .run(
            number,
            token,
            input.idempotencyKey,
            customerId,
            clean(c.name, 80),
            v.phone,
            clean(c.country) || null,
            clean(c.city) || null,
            clean(c.area) || null,
            clean(c.address, 500) || null,
            clean(c.landmark, 200) || null,
            clean(c.mapUrl, 500) || null,
            clean(c.notes, checkout.notesMax) || null,
            input.fulfillment,
            quote.shipping.zone?.id ?? null,
            quote.shipping.zone?.name ?? null,
            quote.shipping.zone?.eta ?? null,
            isGift ? 1 : 0,
            r ? clean(r.name, 80) : null,
            r ? v.recipientPhone : null,
            r ? clean(r.country) || null : null,
            r ? clean(r.city) || null : null,
            r ? clean(r.area) || null : null,
            r ? clean(r.address, 500) || null : null,
            isGift && gifts.giftMessageEnabled ? clean(input.gift?.message, gifts.giftMessageMax) || null : null,
            isGift && gifts.hidePricesEnabled && input.gift?.hidePrices ? 1 : 0,
            quote.wrap?.id ?? null,
            quote.wrap?.name ?? null,
            quote.subtotal,
            quote.discount,
            quote.wrapFee,
            quote.personalizationTotal,
            quote.shippingFee,
            quote.total,
            store.currency.code,
            store.currency.symbol,
            quote.couponId,
            quote.couponId ? quote.coupon?.code ?? null : null,
            methodId,
            methodName,
            hasStock ? 'reserved' : 'none',
            expires,
            quote.prepDaysMin,
            quote.prepDaysMax,
            ctx.ipHash,
            now,
            now,
          ).lastInsertRowid,
      )

      const insItem = d.prepare(
        `INSERT INTO order_items(order_id,product_id,variant_id,product_type,name,sku,options,image,unit_price,compare_price,qty,line_total,
         personalization_label,personalization_text,personalization_fee,components) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      const insLine = d.prepare('INSERT INTO order_stock_lines(order_id,order_item_id,product_id,variant_id,sku,name,qty,deducted) VALUES(?,?,?,?,?,?,?,0)')
      for (const l of quote.lines.filter((x) => x.ok)) {
        const itemId = Number(
          insItem.run(
            orderId,
            l.productId,
            l.variantId,
            l.type,
            l.name,
            l.sku,
            JSON.stringify(l.options),
            l.image,
            l.unitPrice,
            l.compareAt,
            l.qty,
            l.lineTotal,
            l.personalization?.label ?? null,
            l.personalization?.text ?? null,
            l.personalization?.feeUnit ?? 0,
            JSON.stringify(l.components),
          ).lastInsertRowid,
        )
        for (const n of quote.stockNeeds.filter((s) => s.lineKey === l.key)) {
          insLine.run(orderId, itemId, n.productId, n.variantId, n.sku, n.name, n.qty)
        }
      }

      try {
        if (hasStock) deductLines(orderId, 'order_reserve', null)
      } catch (e) {
        if (e instanceof StockError) {
          throw new ApiError(409, 'نفدت كمية بعض المنتجات أثناء إنشاء الطلب. راجع السلة', 'OUT_OF_STOCK', {
            quote: publicQuote(quoteForOrder(input, v.phone)),
          })
        }
        throw e
      }

      d.prepare('INSERT INTO order_events(order_id,type,message,public) VALUES(?,?,?,1)').run(orderId, 'created', 'تم استلام الطلب وهو بانتظار التأكيد والتحويل')
      d.prepare("INSERT INTO notifications(type,title,body,link,permission) VALUES('order','طلب جديد',?,?,'orders')").run(
        `${number} — ${clean(c.name, 80)} — ${formatMoney(quote.total, store.currency)}`,
        `/admin/orders/${orderId}`,
      )
      return { id: orderId, number, token, existing: false }
    })
    .immediate()
}

// ===== القراءة =====

export function getOrder(id: number): OrderRow | undefined {
  return db().prepare('SELECT * FROM orders WHERE id=?').get(id) as OrderRow | undefined
}

export function getOrderByToken(token: string): OrderRow | undefined {
  if (!token || token.length < 20 || token.length > 64) return undefined
  return db().prepare('SELECT * FROM orders WHERE token=?').get(token) as OrderRow | undefined
}

export function getOrderItems(orderId: number): OrderItemRow[] {
  return db().prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(orderId) as OrderItemRow[]
}

export function paymentSummary(orderId: number, total: number) {
  const d = db()
  const received = (d.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE order_id=?').get(orderId) as { s: number }).s
  const refunded = (d.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM refunds WHERE order_id=?').get(orderId) as { s: number }).s
  return { received, refunded, net: received - refunded, balance: total - received }
}

export function addEvent(orderId: number, type: string, message: string, actor: Actor, isPublic = false, data?: unknown) {
  db()
    .prepare('INSERT INTO order_events(order_id,type,message,data,public,user_id,user_name) VALUES(?,?,?,?,?,?,?)')
    .run(orderId, type, message, data ? JSON.stringify(data) : null, isPublic ? 1 : 0, actor?.id ?? null, actor?.name ?? null)
  db().prepare('UPDATE orders SET updated_at=? WHERE id=?').run(nowSql(), orderId)
}

// ===== إجراءات الموظفين =====

const ACTIVE_FLOW: OrderStatus[] = ['confirmed', 'preparing', 'shipped', 'completed']

export function updateOrderStatus(orderId: number, to: OrderStatus, actor: Actor, note?: string) {
  const d = db()
  return d
    .transaction(() => {
      const o = getOrder(orderId)
      if (!o) throw new ApiError(404, 'الطلب غير موجود')
      if (o.status === to) return o
      if (o.status === 'cancelled') throw new ApiError(400, 'لا يمكن تعديل حالة طلب ملغي')
      if (to === 'cancelled') return cancelOrderTx(o, actor, note || '')
      const now = nowSql()
      if (ACTIVE_FLOW.includes(to)) {
        if (o.stock_state === 'released') {
          throw new ApiError(
            409,
            'انتهت مهلة حجز المخزون لهذا الطلب. استخدم «إعادة حجز المخزون» للتحقق من توفر المنتجات قبل تأكيد الطلب',
            'STOCK_RELEASED',
          )
        }
        if (o.stock_state === 'reserved') d.prepare("UPDATE orders SET stock_state='committed', reservation_expires_at=NULL WHERE id=?").run(o.id)
      }
      d.prepare(
        `UPDATE orders SET status=?, updated_at=?, shipped_at=CASE WHEN ?='shipped' AND shipped_at IS NULL THEN ? ELSE shipped_at END,
         completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END WHERE id=?`,
      ).run(to, now, to, now, to, now, o.id)
      addEvent(o.id, 'status', `تم تحديث حالة الطلب إلى: ${ORDER_STATUS_LABELS[to]}`, actor, true, { from: o.status, to })
      if (note) addEvent(o.id, 'note', note, actor, false)
      return getOrder(o.id)!
    })
    .immediate()
}

function cancelOrderTx(o: OrderRow, actor: Actor, reason: string) {
  const d = db()
  if (o.status === 'completed') throw new ApiError(400, 'الطلب مكتمل. استخدم تسجيل المرتجعات بدلاً من الإلغاء')
  const released = releaseLines(o.id, 'order_cancel', actor, reason || 'إلغاء الطلب')
  const now = nowSql()
  d.prepare(
    "UPDATE orders SET status='cancelled', stock_state=CASE WHEN stock_state='none' THEN 'none' ELSE 'released' END, reservation_expires_at=NULL, cancelled_at=?, cancel_reason=?, updated_at=? WHERE id=?",
  ).run(now, reason || null, now, o.id)
  addEvent(o.id, 'status', `تم إلغاء الطلب${reason ? `: ${reason}` : ''}`, actor, true, { from: o.status, to: 'cancelled', restoredLines: released })
  return getOrder(o.id)!
}

export function cancelOrder(orderId: number, actor: Actor, reason: string) {
  return db()
    .transaction(() => {
      const o = getOrder(orderId)
      if (!o) throw new ApiError(404, 'الطلب غير موجود')
      if (o.status === 'cancelled') return o
      return cancelOrderTx(o, actor, reason)
    })
    .immediate()
}

export function updatePaymentStatus(orderId: number, to: PaymentStatus, actor: Actor, note?: string) {
  const d = db()
  const o = getOrder(orderId)
  if (!o) throw new ApiError(404, 'الطلب غير موجود')
  if (o.payment_status === to) return o
  const now = nowSql()
  if (to === 'paid') {
    d.prepare('UPDATE orders SET payment_status=?, payment_confirmed_by=?, payment_confirmed_by_name=?, payment_confirmed_at=?, updated_at=? WHERE id=?').run(
      to,
      actor?.id ?? null,
      actor?.name ?? null,
      now,
      now,
      o.id,
    )
  } else {
    d.prepare('UPDATE orders SET payment_status=?, updated_at=? WHERE id=?').run(to, now, o.id)
  }
  addEvent(o.id, 'payment_status', `حالة الدفع: ${PAYMENT_STATUS_LABELS[to]}`, actor, true, { from: o.payment_status, to })
  if (note) addEvent(o.id, 'note', note, actor, false)
  return getOrder(o.id)!
}

export function extendReservation(orderId: number, hours: number, actor: Actor) {
  const o = getOrder(orderId)
  if (!o) throw new ApiError(404, 'الطلب غير موجود')
  if (o.stock_state !== 'reserved') throw new ApiError(400, 'لا يوجد حجز نشط لتمديده')
  const base = Math.max(Date.now(), new Date((o.reservation_expires_at || nowSql()).replace(' ', 'T') + 'Z').getTime())
  const until = nowSql(new Date(base + hours * 3600e3))
  db().prepare('UPDATE orders SET reservation_expires_at=?, updated_at=? WHERE id=?').run(until, nowSql(), o.id)
  addEvent(o.id, 'reservation', `تم تمديد حجز المخزون ${hours} ساعة`, actor, false)
  return getOrder(o.id)!
}

export function rereserveOrder(orderId: number, actor: Actor) {
  const d = db()
  return d
    .transaction(() => {
      const o = getOrder(orderId)
      if (!o) throw new ApiError(404, 'الطلب غير موجود')
      if (o.status === 'cancelled') throw new ApiError(400, 'الطلب ملغي')
      if (o.stock_state !== 'released') throw new ApiError(400, 'المخزون محجوز لهذا الطلب بالفعل')
      try {
        deductLines(o.id, 'order_rereserve', actor)
      } catch (e) {
        if (e instanceof StockError) {
          throw new ApiError(409, 'الكمية غير كافية لإعادة الحجز', 'SHORTAGE', { shortages: e.shortages })
        }
        throw e
      }
      const minutes = getSetting('checkout').reservationMinutes
      d.prepare("UPDATE orders SET stock_state='reserved', reservation_expires_at=?, reservation_released_at=NULL, updated_at=? WHERE id=?").run(
        nowSql(new Date(Date.now() + minutes * 60000)),
        nowSql(),
        o.id,
      )
      addEvent(o.id, 'reservation', 'تمت إعادة حجز المخزون بعد التحقق من التوفر', actor, false)
      return getOrder(o.id)!
    })
    .immediate()
}

export function recordReturn(orderId: number, items: { orderItemId: number; qty: number }[], restock: boolean, reason: string, actor: Actor) {
  const d = db()
  return d
    .transaction(() => {
      const o = getOrder(orderId)
      if (!o) throw new ApiError(404, 'الطلب غير موجود')
      const orderItems = getOrderItems(orderId)
      const saved: { orderItemId: number; name: string; qty: number; restocked: number }[] = []
      for (const it of items) {
        const oi = orderItems.find((x) => x.id === it.orderItemId)
        if (!oi) throw new ApiError(400, 'منتج غير موجود في الطلب')
        const q = Math.floor(it.qty)
        if (q <= 0) continue
        if (q > oi.qty - oi.returned_qty) throw new ApiError(400, `كمية المرتجع لـ «${oi.name}» أكبر من المتبقي (${oi.qty - oi.returned_qty})`)
        d.prepare('UPDATE order_items SET returned_qty=returned_qty+? WHERE id=?').run(q, oi.id)
        const restocked = restock ? restockItem(orderId, oi.id, q, actor, reason) : 0
        saved.push({ orderItemId: oi.id, name: oi.name, qty: q, restocked })
      }
      if (!saved.length) throw new ApiError(400, 'حدد كمية مرتجعة واحدة على الأقل')
      d.prepare('INSERT INTO order_returns(order_id,items,reason,restocked,created_by,created_by_name) VALUES(?,?,?,?,?,?)').run(
        orderId,
        JSON.stringify(saved),
        reason || null,
        restock ? 1 : 0,
        actor?.id ?? null,
        actor?.name ?? null,
      )
      addEvent(orderId, 'return', `تسجيل مرتجع: ${saved.map((s) => `${s.name} × ${s.qty}`).join('، ')}${restock ? ' (أعيد للمخزون)' : ''}`, actor, false)
      return saved
    })
    .immediate()
}

// ===== رسائل واتساب =====

const LRM = '‎'
const ltr = (s: string) => `${LRM}${s}${LRM}`

export function storeName(): string {
  return getPublishedAppearance().brand.name
}

export function buildOrderWhatsappMessage(o: OrderRow, items: OrderItemRow[], opts: { masked?: boolean; methodName?: string | null } = {}): string {
  const store = getSetting('store')
  const cur = { ...store.currency, symbol: o.currency_symbol }
  const m = (c: number) => formatMoney(c, cur)
  const masked = !!opts.masked
  const L: string[] = []
  L.push(`طلب جديد من متجر ${storeName()}`)
  L.push(`رقم الطلب: ${ltr(o.number)}`)
  L.push(`تاريخ الطلب: ${formatDateTime(o.created_at, store.timezone, store.currency.numerals)}`)
  L.push('')
  L.push('بيانات العميل')
  L.push(`الاسم: ${masked ? maskName(o.customer_name) : o.customer_name}`)
  L.push(`رقم واتساب: ${ltr(masked ? maskPhone(o.customer_phone) : formatIntl(o.customer_phone))}`)
  L.push(`طريقة الاستلام: ${FULFILLMENT_LABELS[o.fulfillment]}${o.zone_name ? ` — ${o.zone_name}` : ''}`)
  const addr = [o.customer_country, o.customer_city, o.customer_area, masked ? null : o.customer_address].filter(Boolean).join('، ')
  if (o.fulfillment === 'delivery' && addr) L.push(`العنوان: ${addr}`)
  if (o.fulfillment === 'delivery' && o.customer_landmark && !masked) L.push(`أقرب معلم: ${o.customer_landmark}`)
  if (o.fulfillment === 'delivery' && o.customer_map_url && !masked) L.push(`الموقع على الخريطة: ${o.customer_map_url}`)
  if (o.is_gift && o.recipient_name) {
    L.push('')
    L.push('بيانات مستلم الهدية')
    L.push(`الاسم: ${masked ? maskName(o.recipient_name) : o.recipient_name}`)
    if (o.recipient_phone) L.push(`الرقم: ${ltr(masked ? maskPhone(o.recipient_phone) : formatIntl(o.recipient_phone))}`)
    const raddr = [o.recipient_country, o.recipient_city, o.recipient_area, masked ? null : o.recipient_address].filter(Boolean).join('، ')
    if (raddr) L.push(`العنوان: ${raddr}`)
  }
  L.push('')
  L.push('المنتجات')
  items.forEach((it, i) => {
    L.push('')
    L.push(`${i + 1}. ${it.name}`)
    L.push(`رقم المنتج: ${ltr(it.sku)}`)
    const opts = parseJson<{ name: string; value: string }[]>(it.options, [])
    const sizeLike = opts.filter((x) => !/لون/.test(x.name))
    const color = opts.find((x) => /لون/.test(x.name))
    if (sizeLike.length) L.push(sizeLike.map((x) => `${x.name}: ${x.value}`).join(' — '))
    if (color) L.push(`اللون: ${color.value}`)
    const comps = parseJson<{ name: string; sku: string; qty: number; options: { name: string; value: string }[] }[]>(it.components, [])
    if (comps.length) {
      L.push('محتويات الباقة:')
      for (const c of comps) {
        const o2 = c.options.map((x) => `${x.name}: ${x.value}`).join('، ')
        L.push(`- ${c.name} × ${c.qty}${o2 ? ` (${o2})` : ''} [${ltr(c.sku)}]`)
      }
    }
    L.push(`الكمية: ${it.qty}`)
    L.push(`سعر الوحدة: ${m(it.unit_price)}`)
    L.push(`الإجمالي: ${m(it.line_total)}`)
    if (it.personalization_text) {
      L.push(`التخصيص: ${it.personalization_label || 'نص'}: «${it.personalization_text}»${it.personalization_fee ? ` (+${m(it.personalization_fee * it.qty)})` : ''}`)
    }
  })
  L.push('')
  L.push('ملخص الحساب')
  L.push(`مجموع المنتجات: ${m(o.subtotal)}`)
  if (o.discount) L.push(`الخصم: -${m(o.discount)}${o.coupon_code ? ` (${ltr(o.coupon_code)})` : ''}`)
  if (o.wrap_fee || o.gift_wrap_name) L.push(`التغليف: ${o.gift_wrap_name ? `${o.gift_wrap_name} — ` : ''}${m(o.wrap_fee)}`)
  if (o.personalization_fee) L.push(`التخصيص: ${m(o.personalization_fee)}`)
  if (o.fulfillment === 'delivery') L.push(`الشحن: ${o.shipping_fee ? m(o.shipping_fee) : 'مجاني'}`)
  L.push(`الإجمالي المطلوب: ${m(o.total)} (${o.currency})`)
  const method = opts.methodName ?? o.transfer_method_name
  if (method) L.push(`وسيلة التحويل المختارة: ${method}`)
  if (o.notes && !masked) L.push(`ملاحظات الطلب: ${o.notes}`)
  if (o.is_gift && o.gift_message) L.push(`رسالة الإهداء: ${o.gift_message}`)
  if (o.is_gift && o.hide_prices) L.push('ملاحظة: يرجى إخفاء الأسعار من الورقة المرفقة بالهدية')
  L.push('')
  L.push('يرجى إرفاق سند التحويل مع رقم الطلب لإتمام مراجعة الدفع.')
  return L.join('\n')
}

export function orderWhatsappLink(o: OrderRow, items: OrderItemRow[], opts: { masked?: boolean } = {}) {
  const text = buildOrderWhatsappMessage(o, items, opts)
  return { text, url: waLink(storeWhatsapp(), text), number: storeWhatsapp() }
}

export function trackingUrl(o: Pick<OrderRow, 'token'>, origin?: string) {
  return `${siteUrl(origin)}/order/${o.token}`
}

/** تعبئة قالب رسالة للموظف */
export function fillTemplate(body: string, o: OrderRow, origin?: string): string {
  const store = getSetting('store')
  const cur = { ...store.currency, symbol: o.currency_symbol }
  const methods = db().prepare('SELECT * FROM transfer_methods WHERE active=1 ORDER BY sort, id').all() as {
    name: string; beneficiary: string; account_number: string; currency: string | null; extra_info: string | null
  }[]
  const methodsText = methods.length
    ? methods
        .map((x) => `• ${x.name}\nالمستفيد: ${x.beneficiary}\nالرقم: ${LRM}${x.account_number}${LRM}${x.currency ? `\nالعملة: ${x.currency}` : ''}${x.extra_info ? `\n${x.extra_info}` : ''}`)
        .join('\n\n')
    : '(لم تُضف وسائل تحويل بعد في لوحة التحكم)'
  const sum = paymentSummary(o.id, o.total)
  const vars: Record<string, string> = {
    customer_name: o.customer_name.split(' ')[0] || o.customer_name,
    customer_full_name: o.customer_name,
    order_number: ltr(o.number),
    total: formatMoney(o.total, cur),
    remaining_amount: formatMoney(Math.max(0, sum.balance), cur),
    store_name: storeName(),
    tracking_link: trackingUrl(o, origin),
    transfer_methods: methodsText,
    reservation_deadline: o.reservation_expires_at ? formatDateTime(o.reservation_expires_at, store.timezone, store.currency.numerals) : '—',
    shipping_carrier: o.shipping_carrier || '—',
    tracking_number: o.tracking_number ? ltr(o.tracking_number) : '—',
    tracking_url: o.tracking_url || '',
    order_status: ORDER_STATUS_LABELS[o.status],
    payment_status: PAYMENT_STATUS_LABELS[o.payment_status],
  }
  return body.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? vars[k] : all)).replace(/\n{3,}/g, '\n\n')
}

export const TEMPLATE_VARIABLES: Record<string, string> = {
  customer_name: 'الاسم الأول للعميل',
  customer_full_name: 'اسم العميل الكامل',
  order_number: 'رقم الطلب',
  total: 'إجمالي الطلب',
  remaining_amount: 'المبلغ المتبقي',
  store_name: 'اسم المتجر',
  tracking_link: 'رابط متابعة الطلب',
  transfer_methods: 'وسائل التحويل المفعلة',
  reservation_deadline: 'نهاية مهلة الحجز',
  shipping_carrier: 'شركة الشحن',
  tracking_number: 'رقم التتبع',
  tracking_url: 'رابط التتبع',
  order_status: 'حالة الطلب',
  payment_status: 'حالة الدفع',
}
