import { db, parseJson, sqlToDate } from './db'
import {
  getProductRow,
  getVariants,
  getBundleItems,
  productPrice,
  variantPrice,
  simpleAvailable,
  variantAvailable,
  parsePersonalization,
  type ProductRow,
  type VariantRow,
} from './catalog'
import { getSetting } from './settings'
import { getMedia, mediaUrl } from './media'
import { normalizeArabic } from '../shared/arabic'
import { roundMoney, formatMoney } from '../shared/money'
import type { CartLineInput, ProductOption, Quote, QuoteLine } from '../shared/types'

export type QuoteInput = {
  lines: CartLineInput[]
  couponCode?: string | null
  fulfillment?: 'delivery' | 'pickup' | null
  country?: string | null
  city?: string | null
  isGift?: boolean
  giftWrapId?: number | null
  phone?: string | null
}

export type StockNeed = { key: string; productId: number; variantId: number | null; qty: number; sku: string; name: string; lineKey: string }

export type QuoteResult = Quote & {
  stockNeeds: StockNeed[]
  couponId: number | null
  zoneId: number | null
}

type ZoneRow = {
  id: number
  name: string
  country: string
  cities: string
  fee: number
  free_shipping_eligible: number
  eta_text: string | null
  active: number
  sort: number
}

export async function activeZones(): Promise<ZoneRow[]> {
  return await db().prepare('SELECT * FROM shipping_zones WHERE active=1 ORDER BY sort, id').all() as ZoneRow[]
}

/** خيارات الدول والمدن لصفحة الطلب */
export async function shippingOptions() {
  const zones = await activeZones()
  const countries = new Map<string, { cities: Set<string>; other: boolean }>()
  for (const z of zones) {
    if (!countries.has(z.country)) countries.set(z.country, { cities: new Set(), other: false })
    const c = countries.get(z.country)!
    const cities = parseJson<string[]>(z.cities, [])
    if (!cities.length) c.other = true
    cities.forEach((x) => c.cities.add(x))
  }
  return Array.from(countries.entries()).map(([country, v]) => ({ country, cities: Array.from(v.cities), allowOther: v.other }))
}

export async function resolveZone(country: string | null | undefined, city: string | null | undefined): Promise<ZoneRow | null> {
  if (!country) return null
  const zones = (await activeZones()).filter((z) => z.country === country)
  const nc = normalizeArabic(city || '')
  if (nc) {
    const exact = zones.find((z) => parseJson<string[]>(z.cities, []).some((c) => normalizeArabic(c) === nc))
    if (exact) return exact
  }
  return zones.find((z) => parseJson<string[]>(z.cities, []).length === 0) || null
}

const PERSONALIZATION_RE = /^[\p{L}\p{M}\p{N} .'&-]+$/u

export function cleanPersonalization(text: string | null | undefined): string {
  return (text || '').replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
}

export type CouponRow = {
  id: number
  code: string
  description: string | null
  type: 'percent' | 'fixed'
  value: number
  min_order: number | null
  max_discount: number | null
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  per_customer_limit: number | null
  category_ids: string
  product_ids: string
  combine_with_sale: number
  active: number
}

export async function couponUsage(couponId: number, phone?: string | null): Promise<{ total: number; byCustomer: number }> {
  const d = db()
  const total = (await d.prepare("SELECT COUNT(*) AS n FROM orders WHERE coupon_id=? AND status<>'cancelled'").get(couponId) as { n: number }).n
  const byCustomer = phone
    ? (await d.prepare("SELECT COUNT(*) AS n FROM orders WHERE coupon_id=? AND status<>'cancelled' AND customer_phone=?").get(couponId, phone) as { n: number }).n
    : 0
  return { total, byCustomer }
}

async function evaluateCoupon(
  code: string,
  lines: QuoteLine[],
  categoryOf: Map<number, number | null>,
  phone: string | null | undefined,
): Promise<{ coupon: CouponRow | null; discount: number; valid: boolean; message: string }> {
  const c = await db().prepare('SELECT * FROM coupons WHERE upper(code)=upper(?)').get(code.trim()) as CouponRow | undefined
  const cur = (await getSetting('store')).currency
  if (!c || !c.active) return { coupon: null, discount: 0, valid: false, message: 'رمز الخصم غير صحيح' }
  const now = new Date()
  const s = sqlToDate(c.starts_at)
  const e = sqlToDate(c.ends_at)
  if (s && s > now) return { coupon: c, discount: 0, valid: false, message: 'رمز الخصم لم يبدأ بعد' }
  if (e && e < now) return { coupon: c, discount: 0, valid: false, message: 'انتهت صلاحية رمز الخصم' }
  const usage = await couponUsage(c.id, phone)
  if (c.usage_limit != null && usage.total >= c.usage_limit) return { coupon: c, discount: 0, valid: false, message: 'تم استخدام رمز الخصم بالحد الأقصى' }
  if (phone && c.per_customer_limit != null && usage.byCustomer >= c.per_customer_limit)
    return { coupon: c, discount: 0, valid: false, message: 'استخدمت هذا الرمز من قبل بالحد المسموح' }
  const cats = parseJson<number[]>(c.category_ids, [])
  const prods = parseJson<number[]>(c.product_ids, [])
  const okLines = lines.filter((l) => l.ok)
  const subtotalAll = okLines.reduce((s, l) => s + l.lineTotal, 0)
  if (c.min_order != null && subtotalAll < c.min_order)
    return { coupon: c, discount: 0, valid: false, message: `الحد الأدنى لاستخدام الرمز ${formatMoney(c.min_order, cur)}` }
  const eligible = okLines.filter((l) => {
    if (cats.length || prods.length) {
      const inScope = prods.includes(l.productId) || (cats.length > 0 && cats.includes(categoryOf.get(l.productId) ?? -1))
      if (!inScope) return false
    }
    if (!c.combine_with_sale && (l.onSale || l.type === 'bundle')) return false
    return true
  })
  const base = eligible.reduce((s, l) => s + l.lineTotal, 0)
  if (base <= 0) {
    return {
      coupon: c,
      discount: 0,
      valid: false,
      message: c.combine_with_sale ? 'رمز الخصم لا ينطبق على منتجات السلة' : 'رمز الخصم لا يجمع مع العروض ولا ينطبق على منتجات السلة الحالية',
    }
  }
  // النسبة تُخزن بأجزاء المئة (10% = 1000)
  let discount = c.type === 'percent' ? Math.round((base * Math.min(10000, c.value)) / 10000) : Math.min(c.value, base)
  if (c.max_discount != null) discount = Math.min(discount, c.max_discount)
  discount = roundMoney(Math.min(discount, base), cur.decimals)
  return { coupon: c, discount, valid: true, message: c.description || 'تم تطبيق الخصم' }
}

function optionPairs(options: ProductOption[], values: (string | null)[]): { name: string; value: string }[] {
  return options.map((o, i) => ({ name: o.name, value: values[i] || '' })).filter((x) => x.value)
}

/** حساب السلة بالكامل في الخادم: الأسعار والتوفر والخصم والتغليف والتخصيص والشحن */
export async function computeQuote(input: QuoteInput): Promise<QuoteResult> {
  const settings = {
    checkout: await getSetting('checkout'),
    shipping: await getSetting('shipping'),
    gifts: await getSetting('gifts'),
    personalization: await getSetting('personalization'),
    store: await getSetting('store'),
  }
  const now = new Date()
  const cur = settings.store.currency
  const errors: string[] = []
  const lines: QuoteLine[] = []
  const stockNeeds: StockNeed[] = []
  const categoryOf = new Map<number, number | null>()
  let prepMin: number | null = null
  let prepMax: number | null = null

  // المخزون المتبقي لكل مفتاح أثناء التوزيع على الأسطر
  const remaining = new Map<string, number>()
  const availOf = (key: string, compute: () => number) => {
    if (!remaining.has(key)) remaining.set(key, compute())
    return remaining.get(key)!
  }

  const rawLines = (input.lines || []).slice(0, 50)
  for (const li of rawLines) {
    const lineErrors: string[] = []
    const warnings: string[] = []
    const p: ProductRow | undefined = await getProductRow(Number(li.productId))
    const base: QuoteLine = {
      key: li.key,
      ok: false,
      errors: lineErrors,
      warnings,
      productId: Number(li.productId),
      variantId: li.variantId ?? null,
      type: 'simple',
      name: 'منتج غير متاح',
      slug: '',
      sku: '',
      image: null,
      options: [],
      components: [],
      unitPrice: 0,
      compareAt: null,
      qty: Math.max(0, Math.floor(Number(li.qty) || 0)),
      maxQty: 0,
      lineTotal: 0,
      personalization: null,
      personalizationTotal: 0,
      onSale: false,
      giftWrapEligible: true,
    }
    if (!p || p.status !== 'published') {
      lineErrors.push('هذا المنتج لم يعد متاحاً للبيع')
      lines.push(base)
      continue
    }
    categoryOf.set(p.id, p.category_id)
    base.type = p.type
    base.name = p.name
    base.slug = p.slug
    base.sku = p.sku
    base.giftWrapEligible = !!p.gift_wrap_eligible
    const img = await db().prepare('SELECT media_id FROM product_images WHERE product_id=? ORDER BY sort, id LIMIT 1').get(p.id) as { media_id: number } | undefined
    base.image = img ? mediaUrl(await getMedia(img.media_id), 320) : null
    const options = parseJson<ProductOption[]>(p.options, [])
    const limit = Math.min(p.max_per_order || settings.checkout.maxQtyPerLine, settings.checkout.maxQtyPerLine)
    const needs: { key: string; productId: number; variantId: number | null; per: number; avail: number; sku: string; name: string }[] = []

    if (p.type === 'variable') {
      const v = li.variantId ? ((await getVariants(p.id)).find((x) => x.id === Number(li.variantId)) as VariantRow | undefined) : undefined
      if (!v) {
        lineErrors.push('يرجى اختيار المقاس/اللون المطلوب')
      } else if (!v.active) {
        lineErrors.push('الخيار المختار لم يعد متاحاً')
      } else {
        const pr = variantPrice(p, v, now)
        base.unitPrice = pr.price
        base.compareAt = pr.compareAt
        base.sku = v.sku
        base.options = optionPairs(options, [v.option1, v.option2, v.option3])
        // صورة الخيار (مثل صورة اللون المختار) إن وجدت
        const vals = [v.option1, v.option2, v.option3].filter(Boolean) as string[]
        if (vals.length) {
          const vi = await db()
            .prepare(`SELECT media_id FROM product_images WHERE product_id=? AND option_value IN (${vals.map(() => '?').join(',')}) ORDER BY sort, id LIMIT 1`)
            .get(p.id, ...vals) as { media_id: number } | undefined
          if (vi) base.image = mediaUrl(await getMedia(vi.media_id), 320)
        }
        const key = p.track_stock ? `v${v.id}` : `nv${v.id}`
        needs.push({ key, productId: p.id, variantId: v.id, per: 1, avail: availOf(key, () => variantAvailable(p, v)), sku: v.sku, name: p.name })
      }
    } else if (p.type === 'bundle') {
      const pr = productPrice(p, now)
      base.unitPrice = pr.price
      base.compareAt = pr.compareAt
      if (p.manual_availability !== 'in_stock') lineErrors.push('هذه الباقة غير متوفرة حالياً')
      const items = await getBundleItems(p.id)
      if (!items.length) lineErrors.push('هذه الباقة غير مكتملة')
      for (const it of items) {
        const cp = await getProductRow(it.product_id)
        if (!cp || cp.status === 'archived') {
          lineErrors.push('أحد مكونات الباقة لم يعد متاحاً')
          continue
        }
        const copts = parseJson<ProductOption[]>(cp.options, [])
        if (cp.type === 'variable') {
          const chosenId = it.variant_id || li.bundle?.find((b) => Number(b.itemId) === it.id)?.variantId
          const v = chosenId ? (await getVariants(cp.id)).find((x) => x.id === Number(chosenId)) : undefined
          if (!v || !v.active) {
            lineErrors.push(`يرجى اختيار خيارات «${cp.name}» داخل الباقة`)
            continue
          }
          base.components.push({ name: cp.name, sku: v.sku, qty: it.qty, options: optionPairs(copts, [v.option1, v.option2, v.option3]) })
          const key = cp.track_stock ? `v${v.id}` : `nv${v.id}`
          needs.push({ key, productId: cp.id, variantId: v.id, per: it.qty, avail: availOf(key, () => variantAvailable(cp, v)), sku: v.sku, name: cp.name })
        } else {
          base.components.push({ name: cp.name, sku: cp.sku, qty: it.qty, options: [] })
          const key = cp.track_stock ? `p${cp.id}` : `np${cp.id}`
          needs.push({ key, productId: cp.id, variantId: null, per: it.qty, avail: availOf(key, () => simpleAvailable(cp)), sku: cp.sku, name: cp.name })
        }
      }
    } else {
      const pr = productPrice(p, now)
      base.unitPrice = pr.price
      base.compareAt = pr.compareAt
      const key = p.track_stock ? `p${p.id}` : `np${p.id}`
      needs.push({ key, productId: p.id, variantId: null, per: 1, avail: availOf(key, () => simpleAvailable(p)), sku: p.sku, name: p.name })
    }
    base.onSale = base.compareAt != null

    // التخصيص
    const pers = settings.personalization.enabled ? parsePersonalization(p.personalization) : null
    const text = cleanPersonalization(li.personalization)
    if (pers) {
      if (text) {
        if (text.length > pers.maxLength) lineErrors.push(`نص التخصيص يجب ألا يتجاوز ${pers.maxLength} حرفاً`)
        else if (!PERSONALIZATION_RE.test(text)) lineErrors.push('نص التخصيص يحتوي على رموز غير مسموحة')
        else base.personalization = { label: pers.label, text, feeUnit: pers.fee }
      } else if (pers.required) {
        lineErrors.push(`يرجى كتابة ${pers.label}`)
      }
    } else if (text) {
      warnings.push('التخصيص غير متاح لهذا المنتج حالياً ولن يُضاف')
    }

    // الكمية والمخزون
    if (base.qty < 1) {
      lineErrors.push('الكمية غير صحيحة')
      base.qty = 1
    }
    let maxByStock = limit
    for (const n of needs) {
      const rem = remaining.get(n.key) ?? n.avail
      maxByStock = Math.min(maxByStock, Math.floor(rem / n.per))
    }
    base.maxQty = Math.max(0, maxByStock)
    if (!lineErrors.length) {
      if (base.maxQty <= 0) {
        lineErrors.push('نفدت الكمية المتاحة من هذا المنتج')
      } else if (base.qty > base.maxQty) {
        lineErrors.push(base.maxQty < limit ? `الكمية المتاحة حالياً ${base.maxQty} فقط` : `الحد الأقصى لكل طلب ${base.maxQty}`)
      }
    }
    if (!lineErrors.length) {
      for (const n of needs) {
        remaining.set(n.key, (remaining.get(n.key) ?? n.avail) - n.per * base.qty)
        if (!n.key.startsWith('n')) {
          stockNeeds.push({ key: n.key, productId: n.productId, variantId: n.variantId, qty: n.per * base.qty, sku: n.sku, name: n.name, lineKey: li.key })
        }
      }
      base.ok = true
      base.lineTotal = base.unitPrice * base.qty
      base.personalizationTotal = base.personalization ? base.personalization.feeUnit * base.qty : 0
      const extra = base.personalization ? parsePersonalization(p.personalization)?.extraDays || 0 : 0
      if (p.prep_days_min != null) prepMin = Math.max(prepMin ?? 0, p.prep_days_min + extra)
      if (p.prep_days_max != null || extra) prepMax = Math.max(prepMax ?? 0, (p.prep_days_max ?? p.prep_days_min ?? 0) + extra)
    }
    lines.push(base)
  }

  const okLines = lines.filter((l) => l.ok)
  const subtotal = okLines.reduce((s, l) => s + l.lineTotal, 0)
  const personalizationTotal = okLines.reduce((s, l) => s + l.personalizationTotal, 0)

  // الكوبون
  let discount = 0
  let coupon: Quote['coupon'] = null
  let couponId: number | null = null
  if (input.couponCode && input.couponCode.trim()) {
    const r = await evaluateCoupon(input.couponCode, lines, categoryOf, input.phone)
    coupon = { code: input.couponCode.trim().toUpperCase(), valid: r.valid, message: r.message, discount: r.discount }
    if (r.valid) {
      discount = r.discount
      couponId = r.coupon!.id
    }
  }

  // التغليف
  let wrapFee = 0
  let wrap: Quote['wrap'] = null
  if (input.isGift && settings.gifts.giftOrderEnabled && settings.gifts.giftWrapEnabled && input.giftWrapId) {
    const w = await db().prepare('SELECT id, name, price FROM gift_wraps WHERE id=? AND active=1').get(input.giftWrapId) as
      | { id: number; name: string; price: number }
      | undefined
    if (w) {
      wrap = w
      wrapFee = w.price
    } else {
      errors.push('خيار التغليف المحدد لم يعد متاحاً')
    }
  }

  // الشحن
  const shipping: Quote['shipping'] = {
    method: input.fulfillment || null,
    zone: null,
    free: false,
    freeEnabled: settings.shipping.freeShippingEnabled,
    freeThreshold: settings.shipping.freeShippingThreshold,
    freeRemaining: null,
    freeAppliesToZone: null,
  }
  let shippingFee = 0
  let zoneId: number | null = null
  const afterDiscount = subtotal - discount
  if (input.fulfillment === 'pickup') {
    if (!settings.checkout.pickupEnabled) errors.push('الاستلام من المحل غير متاح حالياً')
  } else if (input.fulfillment === 'delivery') {
    if (!settings.checkout.deliveryEnabled) errors.push('التوصيل غير متاح حالياً')
    const zone = await resolveZone(input.country, input.city)
    if (input.country && !zone) errors.push('عذراً، التوصيل غير متاح لهذه المنطقة حالياً')
    if (zone) {
      zoneId = zone.id
      shipping.zone = { id: zone.id, name: zone.name, fee: zone.fee, eta: zone.eta_text }
      shipping.freeAppliesToZone = !!zone.free_shipping_eligible
      shippingFee = zone.fee
      if (settings.shipping.freeShippingEnabled && zone.free_shipping_eligible) {
        if (afterDiscount >= settings.shipping.freeShippingThreshold) {
          shipping.free = true
          shippingFee = 0
        } else {
          shipping.freeRemaining = settings.shipping.freeShippingThreshold - afterDiscount
        }
      }
    }
  }
  if (!input.fulfillment && settings.shipping.freeShippingEnabled && afterDiscount < settings.shipping.freeShippingThreshold) {
    shipping.freeRemaining = settings.shipping.freeShippingThreshold - afterDiscount
  }

  const total = Math.max(0, subtotal - discount + wrapFee + personalizationTotal + shippingFee)
  const lineErrors = lines.some((l) => !l.ok)
  if (!lines.length) errors.push('السلة فارغة')

  return {
    lines,
    itemsCount: okLines.reduce((s, l) => s + l.qty, 0),
    subtotal,
    discount,
    coupon,
    personalizationTotal,
    wrapFee,
    wrap,
    shippingFee,
    shipping,
    total,
    errors,
    hasBlockingErrors: lineErrors || errors.length > 0,
    prepDaysMin: prepMin,
    prepDaysMax: prepMax,
    stockNeeds,
    couponId,
    zoneId,
  }
}

/** نسخة آمنة للإرسال للمتصفح (بدون تفاصيل المخزون الداخلية) */
export function publicQuote(q: QuoteResult): Quote {
  const { stockNeeds, couponId, zoneId, ...rest } = q
  void stockNeeds
  void couponId
  void zoneId
  return rest
}
