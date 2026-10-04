import { z } from 'zod'
import { publicRoute, json, readJson } from '@/lib/server/api'
import { getOrderByToken, addEvent } from '@/lib/server/orders'
import { db, nowSql } from '@/lib/server/db'
import { ApiError } from '@/lib/server/errors'
import { rateLimit } from '@/lib/server/security'

// اختيار العميل لوسيلة التحويل (لا يغير حالة الدفع)
export const POST = publicRoute<{ token: string }>(async ({ req, params, ip }) => {
  if (!(await rateLimit(`method:${ip}`, 60, 600)).ok) throw new ApiError(429, 'حاول بعد قليل')
  const { methodId } = await readJson(req, z.object({ methodId: z.number().int() }))
  const o = await getOrderByToken(params.token)
  if (!o) throw new ApiError(404, 'الطلب غير موجود')
  if (o.status === 'cancelled') throw new ApiError(400, 'الطلب ملغي')
  if (!['awaiting_transfer', 'needs_review', 'partially_paid'].includes(o.payment_status)) return json({ ok: true, unchanged: true })
  const m = await db().prepare('SELECT id, name FROM transfer_methods WHERE id=? AND active=1').get(methodId) as { id: number; name: string } | undefined
  if (!m) throw new ApiError(400, 'وسيلة التحويل غير متاحة')
  if (o.transfer_method_id !== m.id) {
    await db().prepare('UPDATE orders SET transfer_method_id=?, transfer_method_name=?, updated_at=? WHERE id=?').run(m.id, m.name, nowSql(), o.id)
    await addEvent(o.id, 'method', `اختار العميل وسيلة التحويل: ${m.name}`, null, false)
  }
  return json({ ok: true })
})
