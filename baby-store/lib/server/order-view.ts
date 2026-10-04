import { db, parseJson } from './db'
import { getMedia, mediaUrl } from './media'
import { getOrderItems, type OrderRow } from './orders'
import { TRANSFER_TYPE_LABELS } from '../shared/constants'
import type { MethodView } from '@/components/store/PaymentActions'

export function activeMethods(): MethodView[] {
  const rows = db().prepare('SELECT * FROM transfer_methods WHERE active=1 ORDER BY sort, id').all() as {
    id: number; name: string; type: string; beneficiary: string; account_number: string; extra_info: string | null
    currency: string | null; instructions: string | null; qr_media_id: number | null
  }[]
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    typeLabel: TRANSFER_TYPE_LABELS[m.type] || m.type,
    beneficiary: m.beneficiary,
    accountNumber: m.account_number,
    extraInfo: m.extra_info,
    currency: m.currency,
    instructions: m.instructions,
    qr: mediaUrl(getMedia(m.qr_media_id), 640),
  }))
}

export function publicItems(o: OrderRow) {
  return getOrderItems(o.id).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    image: i.image,
    qty: i.qty,
    unitPrice: i.unit_price,
    lineTotal: i.line_total,
    options: parseJson<{ name: string; value: string }[]>(i.options, []),
    components: parseJson<{ name: string; qty: number; options: { name: string; value: string }[] }[]>(i.components, []),
    personalization: i.personalization_text ? `${i.personalization_label || 'تخصيص'}: «${i.personalization_text}»` : null,
  }))
}

export function publicEvents(orderId: number) {
  return db().prepare('SELECT message, created_at FROM order_events WHERE order_id=? AND public=1 ORDER BY id DESC').all(orderId) as { message: string; created_at: string }[]
}
