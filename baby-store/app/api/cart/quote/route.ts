import { z } from 'zod'
import { publicRoute, json, readJson } from '@/lib/server/api'
import { computeQuote, publicQuote } from '@/lib/server/pricing'
import { relatedCards } from '@/lib/server/catalog'
import { rateLimit } from '@/lib/server/security'
import { ApiError } from '@/lib/server/errors'
import { lineSchema } from '@/lib/server/schemas'
import type { ProductCard } from '@/lib/shared/types'

const schema = z.object({
  lines: z.array(lineSchema).max(50),
  couponCode: z.string().max(40).nullable().optional(),
  fulfillment: z.enum(['delivery', 'pickup']).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  city: z.string().max(60).nullable().optional(),
  isGift: z.boolean().optional(),
  giftWrapId: z.coerce.number().int().nullable().optional(),
  suggestions: z.boolean().optional(),
})

export const POST = publicRoute(async ({ req, ip }) => {
  if (!rateLimit(`quote:${ip}`, 240, 60).ok) throw new ApiError(429, 'طلبات كثيرة، حاول بعد قليل')
  const body = await readJson(req, schema)
  const q = computeQuote({
    lines: body.lines.map((l) => ({ ...l, variantId: l.variantId ?? null, personalization: l.personalization ?? null })),
    couponCode: body.couponCode,
    fulfillment: body.fulfillment ?? null,
    country: body.country,
    city: body.city,
    isGift: body.isGift,
    giftWrapId: body.giftWrapId ?? null,
  })
  let suggestions: ProductCard[] = []
  if (body.suggestions) {
    // منتجات مكملة للسلة (لا تُضاف تلقائياً)
    const inCart = new Set(body.lines.map((l) => l.productId))
    const seen = new Set<number>()
    for (const l of body.lines) {
      for (const c of relatedCards(l.productId, 'complementary', 6)) {
        if (!inCart.has(c.id) && !seen.has(c.id) && c.available) {
          seen.add(c.id)
          suggestions.push(c)
        }
      }
    }
    suggestions = suggestions.slice(0, 8)
  }
  return json({ quote: publicQuote(q), suggestions })
})
