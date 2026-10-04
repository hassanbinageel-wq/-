import { publicRoute, json, ApiError } from '@/lib/server/api'
import { getProductDetailById } from '@/lib/server/catalog'

export const GET = publicRoute<{ id: string }>(async ({ params }) => {
  const p = await getProductDetailById(Number(params.id))
  if (!p) throw new ApiError(404, 'المنتج غير متاح')
  return json({ product: p })
})
