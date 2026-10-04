import fs from 'node:fs'
import { z } from 'zod'
import { json, readJson, readFile } from '../api'
import { ApiError } from '../errors'
import { db, nowSql, parseJson } from '../db'
import { audit } from '../auth'
import {
  addEvent,
  cancelOrder,
  extendReservation,
  fillTemplate,
  getOrder,
  getOrderItems,
  recordReturn,
  rereserveOrder,
  updateOrderStatus,
  updatePaymentStatus,
  paymentSummary,
} from '../orders'
import { savePrivateReceipt, getMedia, privateFilePath, UploadError } from '../media'
import { getSetting } from '../settings'
import { listOrders, toCsv } from './queries'
import { ORDER_STATUSES, PAYMENT_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, FULFILLMENT_LABELS } from '../../shared/constants'
import { toCents } from '../../shared/money'
import { formatDateTime } from '../../shared/dates'
import { waLink } from '../../shared/phone'
import { num, type Route } from './router'

const actor = (u: { id: number; name: string }) => ({ id: u.id, name: u.name })

function order(id: string) {
  const o = getOrder(num(id))
  if (!o) throw new ApiError(404, 'الطلب غير موجود')
  return o
}

export const ORDER_ROUTES: Route[] = [
  {
    method: 'POST',
    path: 'orders/:id/status',
    perm: 'orders',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, z.object({ status: z.enum(ORDER_STATUSES), note: z.string().max(1000).optional() }))
      const o = order(params.id)
      const r = b.status === 'cancelled' ? cancelOrder(o.id, actor(user), b.note || '') : updateOrderStatus(o.id, b.status, actor(user), b.note)
      audit(user, 'order_status', 'order', o.id, { from: o.status, to: b.status }, ip)
      return json({ ok: true, order: r })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/payment-status',
    perm: 'payments',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, z.object({ status: z.enum(PAYMENT_STATUSES), note: z.string().max(1000).optional() }))
      const o = order(params.id)
      const r = updatePaymentStatus(o.id, b.status, actor(user), b.note)
      audit(user, 'payment_status', 'order', o.id, { from: o.payment_status, to: b.status }, ip)
      return json({ ok: true, order: r })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/attachments',
    perm: 'payments',
    handler: async ({ req, user, params, ip }) => {
      const o = order(params.id)
      const { buf, name, form } = await readFile(req)
      let mediaId: number
      try {
        mediaId = await savePrivateReceipt(buf, name, user.id)
      } catch (e) {
        if (e instanceof UploadError) throw new ApiError(400, e.message)
        throw e
      }
      const label = String(form.get('label') || 'سند تحويل').slice(0, 100)
      const id = Number(
        db().prepare('INSERT INTO order_attachments(order_id,media_id,label,uploaded_by,uploaded_by_name) VALUES(?,?,?,?,?)').run(o.id, mediaId, label, user.id, user.name)
          .lastInsertRowid,
      )
      addEvent(o.id, 'attachment', `تم إرفاق نسخة من السند داخل لوحة التحكم (${label})`, actor(user), false)
      audit(user, 'receipt_upload', 'order', o.id, { attachment: id }, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'GET',
    path: 'receipts/:id',
    perm: 'payments',
    handler: ({ params, user, ip }) => {
      const a = db().prepare('SELECT * FROM order_attachments WHERE id=?').get(num(params.id)) as { media_id: number; order_id: number } | undefined
      if (!a) throw new ApiError(404, 'غير موجود')
      const m = getMedia(a.media_id)
      const file = m ? privateFilePath(m) : null
      if (!m || !file) throw new ApiError(404, 'الملف غير موجود')
      audit(user, 'receipt_view', 'order', a.order_id, { attachment: Number(params.id) }, ip)
      return new Response(fs.readFileSync(file), {
        headers: {
          'Content-Type': m.mime,
          'Content-Disposition': `inline; filename="receipt-${params.id}.${m.ext}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        },
      })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/payments',
    perm: 'payments',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(
        req,
        z.object({
          methodId: z.number().int().nullable().optional(),
          amount: z.number().positive(),
          transferDate: z.string().max(30).optional().nullable(),
          reference: z.string().max(100).optional().nullable(),
          senderName: z.string().max(120).optional().nullable(),
          notes: z.string().max(1000).optional().nullable(),
          attachmentId: z.number().int().nullable().optional(),
        }),
      )
      const o = order(params.id)
      const amount = toCents(b.amount)!
      const m = b.methodId ? (db().prepare('SELECT id, name FROM transfer_methods WHERE id=?').get(b.methodId) as { id: number; name: string } | undefined) : undefined
      if (b.attachmentId) {
        const att = db().prepare('SELECT id FROM order_attachments WHERE id=? AND order_id=?').get(b.attachmentId, o.id)
        if (!att) throw new ApiError(400, 'المرفق غير مرتبط بهذا الطلب')
      }
      db()
        .prepare(
          'INSERT INTO payments(order_id,method_id,method_name,amount,transfer_date,reference,sender_name,notes,attachment_id,recorded_by,recorded_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(o.id, m?.id ?? null, m?.name ?? null, amount, b.transferDate || null, b.reference?.trim() || null, b.senderName?.trim() || null, b.notes || null, b.attachmentId ?? null, user.id, user.name)
      const cur = getSetting('store').currency
      addEvent(o.id, 'payment', `تسجيل تحويل مستلم بمبلغ ${(amount / 100).toLocaleString('en-US')} ${cur.symbol}${b.reference ? ` (مرجع ${b.reference})` : ''}`, actor(user), false)
      audit(user, 'payment_record', 'order', o.id, { amount, reference: b.reference }, ip)
      const sum = paymentSummary(o.id, o.total)
      const suggestion = sum.received >= o.total ? 'paid' : sum.received > 0 ? 'partially_paid' : o.payment_status
      return json({ ok: true, summary: sum, suggestion })
    },
  },
  {
    method: 'DELETE',
    path: 'orders/:id/payments/:pid',
    perm: 'payments',
    handler: ({ user, params, ip }) => {
      const o = order(params.id)
      const p = db().prepare('SELECT * FROM payments WHERE id=? AND order_id=?').get(num(params.pid), o.id) as { amount: number; reference: string | null } | undefined
      if (!p) throw new ApiError(404, 'غير موجود')
      db().prepare('DELETE FROM payments WHERE id=?').run(num(params.pid))
      addEvent(o.id, 'payment', `حذف تسجيل تحويل (${p.amount / 100})`, actor(user), false)
      audit(user, 'payment_delete', 'order', o.id, p, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/refunds',
    perm: 'payments',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, z.object({ amount: z.number().positive(), method: z.string().max(100).optional(), reference: z.string().max(100).optional(), reason: z.string().max(500).optional() }))
      const o = order(params.id)
      const amount = toCents(b.amount)!
      const sum = paymentSummary(o.id, o.total)
      if (amount > sum.net) throw new ApiError(400, 'مبلغ الاسترداد أكبر من صافي المبلغ المستلم')
      db().prepare('INSERT INTO refunds(order_id,amount,method,reference,reason,created_by,created_by_name) VALUES(?,?,?,?,?,?,?)').run(o.id, amount, b.method || null, b.reference || null, b.reason || null, user.id, user.name)
      addEvent(o.id, 'refund', `تسجيل استرداد بمبلغ ${amount / 100}${b.reason ? `: ${b.reason}` : ''}`, actor(user), false)
      audit(user, 'refund', 'order', o.id, { amount }, ip)
      const after = paymentSummary(o.id, o.total)
      return json({ ok: true, summary: after, suggestion: after.net <= 0 ? 'refunded' : 'partially_refunded' })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/returns',
    perm: 'orders',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(
        req,
        z.object({ items: z.array(z.object({ orderItemId: z.number().int(), qty: z.number().int().min(0) })), restock: z.boolean(), reason: z.string().max(500).optional() }),
      )
      const o = order(params.id)
      const saved = recordReturn(o.id, b.items, b.restock, b.reason || '', actor(user))
      audit(user, 'return', 'order', o.id, saved, ip)
      return json({ ok: true, saved })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/reservation',
    perm: ['orders', 'payments'],
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, z.object({ action: z.enum(['extend', 'rereserve']), hours: z.number().int().min(1).max(240).optional() }))
      const o = order(params.id)
      const r = b.action === 'extend' ? extendReservation(o.id, b.hours || 24, actor(user)) : rereserveOrder(o.id, actor(user))
      audit(user, `reservation_${b.action}`, 'order', o.id, b, ip)
      return json({ ok: true, order: r })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/shipping',
    perm: 'orders',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(
        req,
        z.object({ carrier: z.string().max(100).optional(), trackingNumber: z.string().max(100).optional(), trackingUrl: z.string().max(500).optional(), markShipped: z.boolean().optional() }),
      )
      const o = order(params.id)
      const url = (b.trackingUrl || '').trim()
      if (url && !/^https?:\/\//.test(url)) throw new ApiError(400, 'رابط التتبع يجب أن يبدأ بـ https://')
      db().prepare('UPDATE orders SET shipping_carrier=?, tracking_number=?, tracking_url=?, updated_at=? WHERE id=?').run(b.carrier?.trim() || null, b.trackingNumber?.trim() || null, url || null, nowSql(), o.id)
      addEvent(o.id, 'shipping', `تحديث بيانات الشحن${b.carrier ? `: ${b.carrier}` : ''}${b.trackingNumber ? ` — رقم التتبع ${b.trackingNumber}` : ''}`, actor(user), true)
      if (b.markShipped && o.status !== 'shipped' && o.status !== 'completed') updateOrderStatus(o.id, 'shipped', actor(user))
      audit(user, 'shipping', 'order', o.id, b, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/notes',
    perm: ['orders', 'payments'],
    handler: async ({ req, user, params }) => {
      const { body } = await readJson(req, z.object({ body: z.string().min(1).max(2000) }))
      const o = order(params.id)
      db().prepare('INSERT INTO order_notes(order_id,user_id,user_name,body) VALUES(?,?,?,?)').run(o.id, user.id, user.name, body.trim())
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'orders/:id/message',
    perm: ['orders', 'payments'],
    handler: async ({ req, user, params }) => {
      const b = await readJson(req, z.object({ key: z.string().max(60).optional(), body: z.string().max(5000).optional(), to: z.enum(['customer', 'recipient']).optional(), log: z.boolean().optional() }))
      const o = order(params.id)
      const tpl = getSetting('messages').find((m) => m.key === b.key)
      const origin = req.nextUrl.origin
      const text = b.body ?? (tpl ? fillTemplate(tpl.body, o, origin) : '')
      const phone = b.to === 'recipient' && o.recipient_phone ? o.recipient_phone : o.customer_phone
      if (b.log) addEvent(o.id, 'message', `فتح موظف رسالة واتساب «${tpl?.title || 'رسالة'}» للمراجعة والإرسال اليدوي`, actor(user), false)
      return json({ ok: true, text, url: waLink(phone, text) })
    },
  },
  {
    method: 'GET',
    path: 'orders/export',
    perm: ['orders', 'payments'],
    handler: ({ query, user, ip }) => {
      const f = Object.fromEntries(query.entries())
      const { rows } = listOrders({ ...f, page: 1, perPage: 200000 })
      const store = getSetting('store')
      const fmt = (s: string | null) => formatDateTime(s, store.timezone)
      const items = db().prepare('SELECT order_id, name, sku, qty, options, personalization_text FROM order_items').all() as {
        order_id: number; name: string; sku: string; qty: number; options: string; personalization_text: string | null
      }[]
      const byOrder = new Map<number, string[]>()
      for (const i of items) {
        const opts = parseJson<{ value: string }[]>(i.options, []).map((x) => x.value).join('/')
        const t = `${i.name}${opts ? ` (${opts})` : ''} [${i.sku}] ×${i.qty}${i.personalization_text ? ` «${i.personalization_text}»` : ''}`
        if (!byOrder.has(i.order_id)) byOrder.set(i.order_id, [])
        byOrder.get(i.order_id)!.push(t)
      }
      const head = ['رقم الطلب', 'التاريخ', 'العميل', 'الهاتف', 'المدينة', 'طريقة الاستلام', 'المنتجات', 'المجموع', 'الخصم', 'التغليف', 'التخصيص', 'الشحن', 'الإجمالي', 'المستلم', 'العملة', 'حالة الطلب', 'حالة الدفع', 'وسيلة التحويل', 'الكوبون', 'هدية']
      const csv = toCsv([
        head,
        ...rows.map((o) => [
          o.number, fmt(o.created_at), o.customer_name, `+${o.customer_phone}`, o.customer_city || o.recipient_city || '', FULFILLMENT_LABELS[o.fulfillment],
          (byOrder.get(o.id) || []).join(' | '), o.subtotal / 100, o.discount / 100, o.wrap_fee / 100, o.personalization_fee / 100, o.shipping_fee / 100,
          o.total / 100, o.received / 100, o.currency, ORDER_STATUS_LABELS[o.status], PAYMENT_STATUS_LABELS[o.payment_status], o.transfer_method_name || '',
          o.coupon_code || '', o.is_gift ? 'نعم' : '',
        ]),
      ])
      audit(user, 'orders_export', 'order', null, { count: rows.length }, ip)
      return new Response(csv, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' },
      })
    },
  },
  {
    method: 'GET',
    path: 'orders/:id/items',
    perm: ['orders', 'payments'],
    handler: ({ params }) => json({ items: getOrderItems(order(params.id).id) }),
  },
  {
    method: 'POST',
    path: 'customers/:id/notes',
    perm: 'orders',
    handler: async ({ req, params, user, ip }) => {
      const { notes } = await readJson(req, z.object({ notes: z.string().max(2000) }))
      db().prepare("UPDATE customers SET notes=?, updated_at=datetime('now') WHERE id=?").run(notes, num(params.id))
      audit(user, 'customer_notes', 'customer', params.id, null, ip)
      return json({ ok: true })
    },
  },
]
