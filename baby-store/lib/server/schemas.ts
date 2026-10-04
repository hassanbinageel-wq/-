import { z } from 'zod'

export const lineSchema = z.object({
  key: z.string().max(300),
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().nullable().optional(),
  qty: z.coerce.number().int().min(1).max(999),
  bundle: z.array(z.object({ itemId: z.coerce.number().int(), variantId: z.coerce.number().int().nullable() })).max(20).optional().default([]),
  personalization: z.string().max(200).nullable().optional(),
})

const str = (max: number) => z.string().max(max).optional().nullable()

export const createOrderSchema = z.object({
  idempotencyKey: z.string().min(16).max(100),
  lines: z.array(lineSchema).min(1, 'السلة فارغة').max(50),
  couponCode: str(40),
  expectedTotal: z.number().int().min(0),
  fulfillment: z.enum(['delivery', 'pickup']),
  customer: z.object({
    name: z.string().max(120),
    phoneCode: z.string().max(6),
    phone: z.string().max(30),
    country: str(60),
    city: str(60),
    area: str(120),
    address: str(600),
    landmark: str(250),
    mapUrl: str(600),
    notes: str(2000),
  }),
  gift: z
    .object({
      isGift: z.boolean(),
      wrapId: z.number().int().nullable().optional(),
      message: str(2000),
      hidePrices: z.boolean().optional(),
      toRecipient: z.boolean().optional(),
      recipient: z
        .object({
          name: z.string().max(120),
          phoneCode: z.string().max(6),
          phone: z.string().max(30),
          country: str(60),
          city: str(60),
          area: str(120),
          address: str(600),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  transferMethodId: z.number().int().nullable().optional(),
  website: z.string().max(0, 'طلب غير صالح').optional(),
})
