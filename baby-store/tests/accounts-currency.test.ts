// اختبارات عملات العرض وحسابات العملاء وأدوار صور الشماعة
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

process.env.PGLITE_DIR = 'memory://'

type M = {
  db: typeof import('../lib/server/db')
  products: typeof import('../lib/server/products')
  orders: typeof import('../lib/server/orders')
  settings: typeof import('../lib/server/settings')
  appearance: typeof import('../lib/server/appearance')
  currency: typeof import('../lib/server/currency')
  money: typeof import('../lib/shared/money')
  accounts: typeof import('../lib/server/customer-auth')
  catalog: typeof import('../lib/server/catalog')
  media: typeof import('../lib/server/media')
}
let m: M
const actor = { id: 1, name: 'مختبر' }
let productId = 0
let n = 0
const key = () => `acc-key-${Date.now()}-${++n}-abcdef`

before(async () => {
  m = {
    db: await import('../lib/server/db'),
    products: await import('../lib/server/products'),
    orders: await import('../lib/server/orders'),
    settings: await import('../lib/server/settings'),
    appearance: await import('../lib/server/appearance'),
    currency: await import('../lib/server/currency'),
    money: await import('../lib/shared/money'),
    accounts: await import('../lib/server/customer-auth'),
    catalog: await import('../lib/server/catalog'),
    media: await import('../lib/server/media'),
  }
  await m.appearance.ensureAppearance()
  productId = await m.products.saveProduct({ type: 'simple', name: 'بدلة قطنية', status: 'published', price: 12550, trackStock: false, manualAvailability: 'in_stock' }, actor)
  await m.db.db().prepare("INSERT INTO shipping_zones(name,country,cities,fee,free_shipping_eligible) VALUES('صنعاء','اليمن','[\"صنعاء\"]',?,1)").run(1500)
})

const customer = (phone: string) => ({ name: 'سارة أحمد', phoneCode: '967', phone, country: 'اليمن', city: 'صنعاء', area: 'حدة', address: 'شارع حدة بجوار المسجد' })

async function orderInput(phone: string) {
  const base = {
    idempotencyKey: key(),
    lines: [{ key: `k-${Math.random()}`, productId, variantId: null, qty: 2, bundle: [], personalization: null }],
    fulfillment: 'delivery' as const,
    customer: customer(phone),
    expectedTotal: 0,
  }
  base.expectedTotal = (await m.orders.quoteForOrder(base, null)).total
  return base
}

test('تحويل وتنسيق المبالغ: العملة الأساسية بالهللات، والريال اليمني بسعر الصرف والتقريب', () => {
  const { formatMoney, convertMoney, plainAmount, DEFAULT_CURRENCY } = m.money
  assert.equal(formatMoney(12550, DEFAULT_CURRENCY), '125.50 ر.س')
  assert.equal(formatMoney(12500, DEFAULT_CURRENCY), '125 ر.س')
  const yer = { code: 'YER', symbol: 'ر.ي', decimals: 0, numerals: 'latn' as const, rate: 140, roundTo: 1 }
  assert.equal(convertMoney(12550, yer), 1757000)
  assert.equal(formatMoney(12550, yer), '17,570 ر.ي')
  assert.equal(formatMoney(12550, { ...yer, roundTo: 50 }), '17,550 ر.ي')
  assert.equal(plainAmount(12550, yer), '17570')
})

test('العملات اليمنية لا تظهر للعميل قبل إدخال سعر الصرف وتفعيلها', async () => {
  const store = await m.settings.getSetting('store')
  assert.deepEqual(m.currency.storeCurrencies(store).map((c) => c.id), ['base'])
  assert.ok(store.displayCurrencies.some((c) => c.label === 'ريال يمني/صنعاء' && c.rate === 0 && !c.enabled))
  // اختيار عملة غير مفعلة يعود للأساسية
  assert.equal(m.currency.pickCurrency(store, 'yer_sanaa').id, 'base')
})

test('الطلب يحفظ عملة العرض وسعر الصرف وقته، ولا يتأثر بتغيير السعر لاحقاً', async () => {
  const store = await m.settings.getSetting('store')
  const list = store.displayCurrencies.map((c) => (c.id === 'yer_sanaa' ? { ...c, rate: 140, enabled: true } : c))
  await m.settings.setSetting('store', { ...store, displayCurrencies: list })
  m.settings.clearSettingsCache()
  const r = await m.orders.createOrder(await orderInput('775600001'), { ipHash: 'x', currencyId: 'yer_sanaa' })
  const o = (await m.orders.getOrder(r.id))!
  assert.equal(o.total, 12550 * 2 + 1500)
  assert.equal(o.display_currency, 'yer_sanaa')
  assert.equal(o.display_rate, 140)
  assert.equal(o.display_total, (12550 * 2 + 1500) * 140)
  const text = (await m.orders.orderWhatsappLink(o, await m.orders.getOrderItems(r.id))).text
  assert.ok(text.includes('الإجمالي المطلوب: 37,240 ر.ي (ريال يمني/صنعاء)'), text)
  assert.ok(text.includes('ما يعادل: 266 ر.س'))
  // تغيير سعر الصرف لا يغير مبلغ الطلب السابق
  const s2 = await m.settings.getSetting('store')
  await m.settings.setSetting('store', { ...s2, displayCurrencies: s2.displayCurrencies.map((c) => (c.id === 'yer_sanaa' ? { ...c, rate: 150 } : c)) })
  m.settings.clearSettingsCache()
  const cur = m.currency.orderCurrency(o, await m.settings.getSetting('store'))
  assert.equal(m.money.formatMoney(o.total, cur), '37,240 ر.ي')
  // بدون اختيار عملة: بالعملة الأساسية
  const r2 = await m.orders.createOrder(await orderInput('775600002'), { ipHash: 'x' })
  assert.equal((await m.orders.getOrder(r2.id))!.display_currency, null)
})

test('حساب العميل: التسجيل والدخول وحفظ العنوان وربط الطلبات', async () => {
  const reg = await m.accounts.registerAccount({ name: 'منى علي', phoneCode: '967', phone: '0775700001', password: 'secret1' }, '1.1.1.1')
  assert.equal(reg.account.phone, '967775700001')
  assert.ok(await m.accounts.accountFromToken(reg.token))
  await assert.rejects(() => m.accounts.registerAccount({ name: 'شخص آخر', phoneCode: '967', phone: '775700001', password: 'secret2' }, '1.1.1.2'), (e: { code?: string }) => e.code === 'EXISTS')
  await assert.rejects(() => m.accounts.loginAccount('967', '775700001', 'wrong-pass', '1.1.1.3'), (e: { status?: number }) => e.status === 401)
  const login = await m.accounts.loginAccount('967', '775700001', 'secret1', '1.1.1.3')
  assert.equal(login.account.id, reg.account.id)

  // طلب وهو مسجل يُربط بالحساب ويُحفظ عنوانه
  const r = await m.orders.createOrder(await orderInput('775700001'), { ipHash: 'x', accountId: reg.account.id })
  await m.accounts.rememberAddress(reg.account.id, { name: 'منى علي', country: 'اليمن', city: 'صنعاء', area: 'حدة', address: 'شارع حدة بجوار المسجد' })
  const a = (await m.accounts.getAccount(reg.account.id))!
  assert.equal(a.address, 'شارع حدة بجوار المسجد')
  // طلب كزائر بنفس الرقم لا يظهر إلا إذا أنشأه نفس المتصفح (ملف التعريف الموقّع)
  const guest = await m.orders.createOrder(await orderInput('775700001'), { ipHash: 'x' })
  const other = await m.orders.createOrder(await orderInput('775700099'), { ipHash: 'x' })
  assert.deepEqual((await m.accounts.accountOrders(reg.account.id)).map((o) => o.id), [r.id])
  await m.accounts.claimOwnedOrders(a, [guest.id, other.id])
  assert.deepEqual((await m.accounts.accountOrders(reg.account.id)).map((o) => o.id).sort(), [r.id, guest.id].sort())

  // إعادة التعيين من المالك تُخرج الجلسات
  await m.accounts.adminResetAccountPassword(reg.account.id, 'newpass9')
  assert.equal(await m.accounts.accountFromToken(login.token), null)
  await m.accounts.loginAccount('967', '775700001', 'newpass9', '1.1.1.4')
})

test('صورة الشماعة الحقيقية تُعرض بدون رسم شماعة إضافية', async () => {
  const sharp = (await import('sharp')).default
  const png = await sharp({ create: { width: 40, height: 50, channels: 4, background: { r: 200, g: 180, b: 160, alpha: 1 } } }).png().toBuffer()
  const img1 = await m.media.saveImage(png, { purpose: 'product' })
  const img2 = await m.media.saveImage(png, { purpose: 'product' })
  const id = await m.products.saveProduct(
    { type: 'simple', name: 'فستان', status: 'published', price: 9000, trackStock: false, manualAvailability: 'in_stock', images: [{ mediaId: img1 }, { mediaId: img2, role: 'rail_photo' }] },
    actor,
  )
  const card = await m.products.saveProduct(
    { type: 'simple', name: 'قبعة', status: 'published', price: 3000, trackStock: false, manualAvailability: 'in_stock', images: [{ mediaId: img1 }] },
    actor,
  )
  // صورة PNG بخلفية شفافة كصورة رئيسية عادية تُعامل كقطعة مفرغة (بدون إطار أبيض)
  const clear = await sharp({ create: { width: 40, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30"><ellipse cx="10" cy="15" rx="10" ry="15" fill="#c82828"/></svg>'), left: 10, top: 10 }])
    .png()
    .toBuffer()
  const img3 = await m.media.saveImage(clear, { purpose: 'product' })
  const cut = await m.products.saveProduct(
    { type: 'simple', name: 'قميص', status: 'published', price: 3000, trackStock: false, manualAvailability: 'in_stock', images: [{ mediaId: img3 }] },
    actor,
  )
  const items = await m.catalog.railItems([id, card, cut], 10)
  assert.equal(items.find((x) => x.id === id)?.hanger, 'photo')
  assert.equal(items.find((x) => x.id === card)?.hanger, 'card')
  assert.equal(items.find((x) => x.id === cut)?.hanger, 'cutout')
})
