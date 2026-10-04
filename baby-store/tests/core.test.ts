// اختبارات منطق المتجر الأساسي: التسعير والمخزون والطلبات والدفع
// التشغيل: npm test
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'))
process.env.DATA_DIR = tmp

type M = {
  db: typeof import('../lib/server/db')
  products: typeof import('../lib/server/products')
  pricing: typeof import('../lib/server/pricing')
  orders: typeof import('../lib/server/orders')
  inventory: typeof import('../lib/server/inventory')
  catalog: typeof import('../lib/server/catalog')
  settings: typeof import('../lib/server/settings')
  appearance: typeof import('../lib/server/appearance')
}
let m: M
const actor = { id: 1, name: 'مختبر' }
const ids: Record<string, number> = {}
const Y = (n: number) => n * 100
let keyN = 0
const key = () => `test-key-${Date.now()}-${++keyN}-abcdef`

before(async () => {
  m = {
    db: await import('../lib/server/db'),
    products: await import('../lib/server/products'),
    pricing: await import('../lib/server/pricing'),
    orders: await import('../lib/server/orders'),
    inventory: await import('../lib/server/inventory'),
    catalog: await import('../lib/server/catalog'),
    settings: await import('../lib/server/settings'),
    appearance: await import('../lib/server/appearance'),
  }
  m.appearance.ensureAppearance()
  const d = m.db.db()
  const cat = Number(d.prepare("INSERT INTO categories(name,slug) VALUES('ملابس (اختبار)','t-clothes')").run().lastInsertRowid)
  const cat2 = Number(d.prepare("INSERT INTO categories(name,slug) VALUES('هدايا (اختبار)','t-gifts')").run().lastInsertRowid)
  ids.cat = cat
  ids.cat2 = cat2
  ids.simple = m.products.saveProduct({ type: 'simple', name: 'جوارب', status: 'published', price: Y(1000), trackStock: true, stock: 5, categoryId: cat }, actor)
  ids.sale = m.products.saveProduct({ type: 'simple', name: 'دبدوب', status: 'published', price: Y(4000), salePrice: Y(3000), trackStock: true, stock: 3, categoryId: cat2 }, actor)
  ids.variable = m.products.saveProduct(
    {
      type: 'variable', name: 'بدلة', status: 'published', price: Y(3500), trackStock: true, categoryId: cat,
      options: [{ name: 'المقاس', kind: 'size', values: [{ value: 'S' }, { value: 'M' }] }, { name: 'اللون', kind: 'color', values: [{ value: 'وردي', color: '#f4c6d0' }] }],
      variants: [
        { options: ['S', 'وردي'], stock: 2, active: true },
        { options: ['M', 'وردي'], stock: 1, active: true, price: Y(4000) },
      ],
    },
    actor,
  )
  ids.pers = m.products.saveProduct(
    {
      type: 'simple', name: 'مريلة', status: 'published', price: Y(2000), trackStock: true, stock: 10, categoryId: cat,
      personalization: { enabled: true, label: 'اسم المولود', placeholder: '', maxLength: 8, fee: Y(500), extraDays: 2, required: false, help: '' },
      prepDaysMin: 1, prepDaysMax: 2,
    },
    actor,
  )
  ids.bundle = m.products.saveProduct(
    {
      type: 'bundle', name: 'باقة', status: 'published', price: Y(4000), trackStock: false, manualAvailability: 'in_stock', categoryId: cat2,
      bundleItems: [{ productId: ids.variable, variantId: null, qty: 1 }, { productId: ids.simple, variantId: null, qty: 2 }],
    },
    actor,
  )
  ids.untracked = m.products.saveProduct({ type: 'simple', name: 'علبة', status: 'published', price: Y(500), trackStock: false, manualAvailability: 'in_stock' }, actor)
  d.prepare("INSERT INTO shipping_zones(name,country,cities,fee,free_shipping_eligible) VALUES('صنعاء','اليمن','[\"صنعاء\"]',?,1)").run(Y(1000))
  d.prepare("INSERT INTO shipping_zones(name,country,cities,fee,free_shipping_eligible) VALUES('باقي المدن','اليمن','[]',?,0)").run(Y(3000))
  d.prepare("INSERT INTO gift_wraps(name,price) VALUES('تغليف',?)").run(Y(700))
  d.prepare("INSERT INTO coupons(code,type,value,max_discount,usage_limit,combine_with_sale) VALUES('TEN','percent',1000,?,2,0)").run(Y(100000))
  d.prepare("INSERT INTO coupons(code,type,value,min_order,per_customer_limit) VALUES('FIX','fixed',?,?,1)").run(Y(500), Y(3000))
})

const variantId = (opt: string) => m.catalog.getVariants(ids.variable).find((v) => v.option1 === opt)!.id
const line = (productId: number, qty: number, extra: Partial<import('../lib/shared/types').CartLineInput> = {}) => ({
  key: `${productId}-${Math.random()}`,
  productId,
  variantId: null,
  qty,
  bundle: [],
  personalization: null,
  ...extra,
})
const stockOf = (id: number) => (m.db.db().prepare('SELECT stock FROM products WHERE id=?').get(id) as { stock: number }).stock
const vStock = (id: number) => (m.db.db().prepare('SELECT stock FROM variants WHERE id=?').get(id) as { stock: number }).stock

const customer = (phone = '775000111') => ({
  name: 'سارة أحمد', phoneCode: '967', phone, country: 'اليمن', city: 'صنعاء', area: 'حدة', address: 'شارع حدة بجوار المسجد',
})

function orderInput(lines: ReturnType<typeof line>[], extra: Partial<import('../lib/server/orders').CreateOrderInput> = {}) {
  const base = { idempotencyKey: key(), lines, fulfillment: 'delivery' as const, customer: customer(), expectedTotal: 0, ...extra }
  base.expectedTotal = m.orders.quoteForOrder(base, null).total
  return base
}

test('حساب السعر والتخفيض والشحن', () => {
  const q = m.pricing.computeQuote({ lines: [line(ids.simple, 2), line(ids.sale, 1)], fulfillment: 'delivery', country: 'اليمن', city: 'صنعاء' })
  assert.equal(q.hasBlockingErrors, false)
  assert.equal(q.subtotal, Y(2000 + 3000))
  assert.equal(q.shippingFee, Y(1000))
  assert.equal(q.total, Y(6000))
  assert.equal(q.lines[1].compareAt, Y(4000))
})

test('المنتج متعدد الخيارات يتطلب اختيار الخيار وسعر الخيار المستقل', () => {
  const q1 = m.pricing.computeQuote({ lines: [line(ids.variable, 1)] })
  assert.equal(q1.lines[0].ok, false)
  const q2 = m.pricing.computeQuote({ lines: [line(ids.variable, 1, { variantId: variantId('M') })] })
  assert.equal(q2.lines[0].ok, true)
  assert.equal(q2.lines[0].unitPrice, Y(4000))
})

test('منع طلب كمية أكبر من المتاح، وتجميع المخزون بين الأسطر والباقات', () => {
  const q = m.pricing.computeQuote({ lines: [line(ids.simple, 6)] })
  assert.equal(q.lines[0].ok, false)
  assert.equal(q.lines[0].maxQty, 5)
  // الباقة تستهلك 2 جوارب لكل باقة + 1 بدلة S
  const q2 = m.pricing.computeQuote({
    lines: [line(ids.simple, 2), line(ids.bundle, 2, { bundle: [{ itemId: m.catalog.getBundleItems(ids.bundle)[0].id, variantId: variantId('S') }] })],
  })
  assert.equal(q2.lines[0].ok, true)
  assert.equal(q2.lines[1].ok, false, 'الباقة الثانية تحتاج 4 جوارب والمتبقي 3')
  assert.equal(q2.lines[1].maxQty, 1)
})

test('الباقة تتطلب اختيار خيارات مكوناتها', () => {
  const q = m.pricing.computeQuote({ lines: [line(ids.bundle, 1)] })
  assert.equal(q.lines[0].ok, false)
  assert.match(q.lines[0].errors[0], /اختيار خيارات/)
})

test('التخصيص: الرسوم والحد الأقصى للنص والأيام الإضافية', () => {
  const q = m.pricing.computeQuote({ lines: [line(ids.pers, 2, { personalization: 'ليان' })] })
  assert.equal(q.lines[0].ok, true)
  assert.equal(q.personalizationTotal, Y(1000))
  assert.equal(q.prepDaysMax, 4)
  const bad = m.pricing.computeQuote({ lines: [line(ids.pers, 1, { personalization: 'اسم طويل جداً' })] })
  assert.equal(bad.lines[0].ok, false)
})

test('الكوبونات: النسبة لا تجمع مع العروض، والحد الأدنى للطلب', () => {
  const q = m.pricing.computeQuote({ lines: [line(ids.simple, 1), line(ids.sale, 1)], couponCode: 'ten' })
  assert.equal(q.coupon?.valid, true)
  assert.equal(q.discount, Y(100), 'الخصم على المنتج غير المخفض فقط')
  const q2 = m.pricing.computeQuote({ lines: [line(ids.simple, 2)], couponCode: 'FIX' })
  assert.equal(q2.coupon?.valid, false, 'أقل من الحد الأدنى')
  const q3 = m.pricing.computeQuote({ lines: [line(ids.simple, 3)], couponCode: 'FIX' })
  assert.equal(q3.discount, Y(500))
})

test('الشحن المجاني يطبق على المناطق المشمولة فقط والتغليف يضاف', () => {
  m.settings.setSetting('shipping', { freeShippingEnabled: true, freeShippingThreshold: Y(2500) })
  const q = m.pricing.computeQuote({ lines: [line(ids.simple, 2)], fulfillment: 'delivery', country: 'اليمن', city: 'صنعاء', isGift: true, giftWrapId: 1 })
  assert.equal(q.shipping.freeRemaining, Y(500))
  assert.equal(q.wrapFee, Y(700))
  const q2 = m.pricing.computeQuote({ lines: [line(ids.simple, 3)], fulfillment: 'delivery', country: 'اليمن', city: 'صنعاء' })
  assert.equal(q2.shippingFee, 0)
  const q3 = m.pricing.computeQuote({ lines: [line(ids.simple, 3)], fulfillment: 'delivery', country: 'اليمن', city: 'إب' })
  assert.equal(q3.shippingFee, Y(3000), 'منطقة غير مشمولة بالشحن المجاني')
  m.settings.setSetting('shipping', { freeShippingEnabled: false, freeShippingThreshold: 0 })
})

test('إنشاء الطلب: حجز المخزون ومنع التكرار بمفتاح ثابت', () => {
  const before = stockOf(ids.simple)
  const input = orderInput([line(ids.simple, 2)])
  const a = m.orders.createOrder(input, { ipHash: 'x' })
  const b = m.orders.createOrder(input, { ipHash: 'x' })
  assert.equal(a.id, b.id)
  assert.equal(b.existing, true)
  assert.equal(stockOf(ids.simple), before - 2, 'المخزون خُصم مرة واحدة فقط')
  const o = m.orders.getOrder(a.id)!
  assert.equal(o.status, 'pending')
  assert.equal(o.payment_status, 'awaiting_transfer')
  assert.equal(o.stock_state, 'reserved')
  assert.ok(o.token.length >= 30, 'رمز متابعة طويل يصعب تخمينه')
  assert.match(o.number, /^GH-\d+$/)
})

test('رفض الطلب إذا تغير الإجمالي عن المعروض للعميل', () => {
  const input = orderInput([line(ids.sale, 1)])
  input.expectedTotal = input.expectedTotal - 100
  assert.throws(() => m.orders.createOrder(input, { ipHash: 'x' }), (e: { code?: string }) => e.code === 'PRICE_CHANGED')
})

test('منع البيع الزائد عند الطلبات المتتالية على آخر قطعة', () => {
  const vid = variantId('M')
  assert.equal(vStock(vid), 1)
  const a = orderInput([line(ids.variable, 1, { variantId: vid })], { customer: customer('775000222') })
  const b = orderInput([line(ids.variable, 1, { variantId: vid })], { customer: customer('775000333') })
  m.orders.createOrder(a, { ipHash: 'x' })
  assert.throws(() => m.orders.createOrder(b, { ipHash: 'x' }), (e: { code?: string }) => e.code === 'CART_INVALID' || e.code === 'OUT_OF_STOCK')
  assert.equal(vStock(vid), 0)
})

test('انتهاء الحجز يحرر المخزون ويمنع التأكيد قبل إعادة الحجز، والإلغاء لا يكرر الإرجاع', () => {
  const before = stockOf(ids.pers)
  const r = m.orders.createOrder(orderInput([line(ids.pers, 3)], { customer: customer('775000444') }), { ipHash: 'x' })
  assert.equal(stockOf(ids.pers), before - 3)
  m.db.db().prepare("UPDATE orders SET reservation_expires_at='2000-01-01 00:00:00' WHERE id=?").run(r.id)
  m.inventory.releaseExpiredReservations()
  assert.equal(stockOf(ids.pers), before)
  assert.equal(m.orders.getOrder(r.id)!.stock_state, 'released')
  assert.throws(() => m.orders.updateOrderStatus(r.id, 'confirmed', actor), (e: { code?: string }) => e.code === 'STOCK_RELEASED')
  m.orders.rereserveOrder(r.id, actor)
  assert.equal(stockOf(ids.pers), before - 3)
  m.orders.updateOrderStatus(r.id, 'confirmed', actor)
  const o = m.orders.getOrder(r.id)!
  assert.equal(o.stock_state, 'committed')
  // تأكيد الدفع لا يخصم المخزون مرة أخرى
  m.orders.updatePaymentStatus(r.id, 'paid', actor)
  assert.equal(stockOf(ids.pers), before - 3)
  assert.equal(m.orders.getOrder(r.id)!.payment_confirmed_by_name, 'مختبر')
  m.orders.cancelOrder(r.id, actor, 'اختبار')
  assert.equal(stockOf(ids.pers), before)
  m.orders.cancelOrder(r.id, actor, 'مرة ثانية')
  assert.equal(stockOf(ids.pers), before, 'لا إرجاع مزدوج')
})

test('المرتجعات تعيد المخزون بحد أقصى الكمية المخصومة', () => {
  const before = stockOf(ids.pers)
  const r = m.orders.createOrder(orderInput([line(ids.pers, 2)], { customer: customer('775000555') }), { ipHash: 'x' })
  m.orders.updateOrderStatus(r.id, 'completed', actor)
  const item = m.orders.getOrderItems(r.id)[0]
  m.orders.recordReturn(r.id, [{ orderItemId: item.id, qty: 1 }], true, 'مقاس غير مناسب', actor)
  assert.equal(stockOf(ids.pers), before - 1)
  assert.throws(() => m.orders.recordReturn(r.id, [{ orderItemId: item.id, qty: 2 }], true, '', actor))
  m.orders.recordReturn(r.id, [{ orderItemId: item.id, qty: 1 }], true, '', actor)
  assert.equal(stockOf(ids.pers), before)
})

test('حد استخدام الكوبون يحتسب الطلبات غير الملغاة فقط', () => {
  const mk = (phone: string) => orderInput([line(ids.untracked, 2)], { couponCode: 'TEN', customer: customer(phone) })
  const o1 = m.orders.createOrder(mk('775100001'), { ipHash: 'x' })
  m.orders.createOrder(mk('775100002'), { ipHash: 'x' })
  assert.throws(() => m.orders.createOrder(mk('775100003'), { ipHash: 'x' }), (e: { code?: string }) => e.code === 'COUPON_INVALID')
  m.orders.cancelOrder(o1.id, actor, 'إلغاء')
  const ok = m.orders.createOrder(mk('775100003'), { ipHash: 'x' })
  assert.ok(ok.id)
})

test('حد الطلبات المعلقة لكل رقم', () => {
  m.settings.setSetting('checkout', { ...m.settings.getSetting('checkout'), maxPendingPerPhone: 1 })
  m.orders.createOrder(orderInput([line(ids.untracked, 1)], { customer: customer('775200001') }), { ipHash: 'x' })
  assert.throws(
    () => m.orders.createOrder(orderInput([line(ids.untracked, 1)], { customer: customer('775200001') }), { ipHash: 'x' }),
    (e: { code?: string }) => e.code === 'PENDING_LIMIT',
  )
  m.settings.setSetting('checkout', { ...m.settings.getSetting('checkout'), maxPendingPerPhone: 3 })
})

test('رسالة واتساب: الرقم الصحيح والحقول المطلوبة دون ادعاء الدفع', () => {
  const r = m.orders.createOrder(
    orderInput([line(ids.pers, 1, { personalization: 'ليان' })], {
      customer: { ...customer('775300001'), notes: 'اتصلوا قبل التوصيل' },
      gift: { isGift: true, wrapId: 1, message: 'مبروك المولود', hidePrices: true, toRecipient: false },
    }),
    { ipHash: 'x' },
  )
  const o = m.orders.getOrder(r.id)!
  const link = m.orders.orderWhatsappLink(o, m.orders.getOrderItems(r.id))
  assert.equal(link.number, '967775038900')
  assert.ok(link.url.startsWith('https://wa.me/967775038900?text='))
  const t = link.text
  for (const s of ['طلب جديد من متجر', 'رقم الطلب:', 'بيانات العميل', 'المنتجات', 'التخصيص:', 'ملخص الحساب', 'الإجمالي المطلوب:', 'رسالة الإهداء: مبروك المولود', 'يرجى إرفاق سند التحويل']) {
    assert.ok(t.includes(s), `الرسالة تتضمن: ${s}`)
  }
  assert.ok(!/تم الدفع|تمت مراجعة/.test(t))
  assert.ok(!t.includes('بيانات مستلم الهدية'), 'حذف الحقول غير المستخدمة')
})

test('تعديل المنتج لا يغير بيانات الطلبات السابقة', () => {
  const r = m.orders.createOrder(orderInput([line(ids.untracked, 1)], { customer: customer('775400001') }), { ipHash: 'x' })
  const input = m.products.productToInput(ids.untracked)!
  m.products.saveProduct({ ...input, name: 'علبة جديدة', price: Y(900) }, actor)
  const item = m.orders.getOrderItems(r.id)[0]
  assert.equal(item.name, 'علبة')
  assert.equal(item.unit_price, Y(500))
})

test('نسخ المنتج ينشئ رقماً جديداً وحالة مسودة', () => {
  const copy = m.products.duplicateProduct(ids.variable, actor)
  const a = m.catalog.getProductRow(ids.variable)!
  const b = m.catalog.getProductRow(copy)!
  assert.notEqual(a.sku, b.sku)
  assert.equal(b.status, 'draft')
  const va = m.catalog.getVariants(ids.variable).map((v) => v.sku)
  const vb = m.catalog.getVariants(copy).map((v) => v.sku)
  assert.equal(vb.filter((s) => va.includes(s)).length, 0)
})

test('البحث بالاسم والرقم مع توحيد الحروف العربية', () => {
  const sku = m.catalog.getProductRow(ids.sale)!.sku
  assert.equal(m.catalog.listProducts({ q: sku }).items[0]?.id, ids.sale)
  assert.ok(m.catalog.listProducts({ q: 'دبدوب' }).items.some((p) => p.id === ids.sale))
  const f = m.catalog.listProducts({ categoryId: ids.cat })
  assert.ok(f.facets.sizes.includes('S'))
  assert.ok(f.facets.colors.some((c) => c.value === 'وردي'))
})
