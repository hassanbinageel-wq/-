import { publicRoute, json } from '@/lib/server/api'
import { getOrderByToken, getOrderItems, orderWhatsappLink } from '@/lib/server/orders'
import { ApiError } from '@/lib/server/errors'
import { OWNER_COOKIE, readOwned } from '@/lib/server/order-access'

// نص رسالة الطلب الجاهزة. بيانات العميل كاملة فقط للمتصفح الذي أنشأ الطلب، وإلا تظهر مخفية جزئياً
export const GET = publicRoute<{ token: string }>(async ({ req, params }) => {
  const o = await getOrderByToken(params.token)
  if (!o) throw new ApiError(404, 'الطلب غير موجود')
  const owner = (await readOwned(req.cookies.get(OWNER_COOKIE)?.value)).includes(o.id)
  const link = await orderWhatsappLink(o, await getOrderItems(o.id), { masked: !owner })
  return json({ text: link.text, url: link.url, number: link.number, masked: !owner })
})
