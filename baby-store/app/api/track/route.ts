import { z } from 'zod'
import { publicRoute, json, readJson } from '@/lib/server/api'
import { db } from '@/lib/server/db'
import { ApiError } from '@/lib/server/errors'
import { rateLimit } from '@/lib/server/security'
import { digitsOnly } from '@/lib/shared/phone'
import { toLatinDigits } from '@/lib/shared/arabic'

// البحث عن طلب برقم الطلب + آخر أرقام هاتف العميل (محدود المحاولات)
export const POST = publicRoute(async ({ req, ip }) => {
  if (!rateLimit(`track:${ip}`, 10, 900).ok) throw new ApiError(429, 'محاولات كثيرة. حاول بعد 15 دقيقة أو تواصل معنا عبر واتساب')
  const { number, phone } = await readJson(req, z.object({ number: z.string().max(40), phone: z.string().max(30) }))
  const num = toLatinDigits(number).trim().toUpperCase().replace(/\s+/g, '')
  const digits = digitsOnly(phone).replace(/^0+/, '')
  if (num.length < 3 || digits.length < 7) throw new ApiError(400, 'أدخل رقم الطلب ورقم واتساب المستخدم في الطلب')
  const row = db().prepare('SELECT token, customer_phone FROM orders WHERE UPPER(number)=? OR number=?').get(num, `${num}`) as
    | { token: string; customer_phone: string }
    | undefined
  if (!row || !row.customer_phone.endsWith(digits.slice(-9))) throw new ApiError(404, 'لم نجد طلباً بهذه البيانات. تأكد من رقم الطلب ورقم واتساب')
  return json({ ok: true, url: `/order/${row.token}` })
})
