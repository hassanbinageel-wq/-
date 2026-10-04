// اختبارات استيراد/تصدير CSV والنسخ الاحتياطي والاستعادة
// التشغيل: npm test
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

process.env.PGLITE_DIR = 'memory://'

type M = {
  db: typeof import('../lib/server/db')
  csv: typeof import('../lib/server/csv')
  products: typeof import('../lib/server/products')
  backup: typeof import('../lib/server/backup')
  media: typeof import('../lib/server/media')
  appearance: typeof import('../lib/server/appearance')
}
let m: M
const actor = { id: 1, name: 'مختبر' }
const sharpPng = async (w = 600) => (await import('sharp')).default({ create: { width: w, height: Math.round(w * 0.8), channels: 3, background: '#f4c6d0' } }).png().toBuffer()

before(async () => {
  m = {
    db: await import('../lib/server/db'),
    csv: await import('../lib/server/csv'),
    products: await import('../lib/server/products'),
    backup: await import('../lib/server/backup'),
    media: await import('../lib/server/media'),
    appearance: await import('../lib/server/appearance'),
  }
  await m.appearance.ensureAppearance()
  // قسم «ملابس المواليد» يُنشأ تلقائياً مع قاعدة البيانات الجديدة
})

const HEADER = 'type,sku,parent_sku,name,category,status,price,sale_price,stock,track_stock,option1_name,option1_value,option2_name,option2_value'

test('قاعدة بيانات جديدة تحتوي هيكل المتجر الأساسي دون منتجات', async () => {
  const d = m.db.db()
  const n = async (sql: string) => (await d.prepare(sql).get() as { n: number }).n
  assert.equal(await n('SELECT COUNT(*) n FROM categories'), 5)
  assert.equal(await n("SELECT COUNT(*) n FROM pages WHERE slug IN ('privacy','shipping','returns') AND status='published'"), 3)
  assert.ok(await n('SELECT COUNT(*) n FROM faqs') > 0)
  assert.ok(await n("SELECT COUNT(*) n FROM tags t JOIN tag_groups g ON g.id=t.group_id WHERE g.kind='age'") > 0)
  assert.equal(await n('SELECT COUNT(*) n FROM products'), 0)
  assert.equal(await n('SELECT COUNT(*) n FROM transfer_methods'), 0)
  // لا يعاد إنشاء ما يحذفه المالك
  await d.prepare('DELETE FROM faqs').run()
  await (await import('../lib/server/bootstrap')).bootstrapContent()
  assert.equal(await n('SELECT COUNT(*) n FROM faqs'), 0)
})

test('معاينة CSV تكشف الأخطاء دون أي حفظ', async () => {
  const text = [
    HEADER,
    'simple,,,,ملابس المواليد,published,abc,,5,1,,,,',
    'simple,,,قبعة,قسم غير موجود,published,500,,2,1,,,,',
    'variant,X-1,NOPARENT,,,published,,,3,,المقاس,0-3,,',
    'gadget,,,شيء,,,100,,,,,,,',
  ].join('\n')
  const p = await m.csv.previewImport(text)
  assert.equal(p.summary.errors, 4)
  assert.ok(p.rows[0].errors.some((e) => e.includes('السعر')))
  assert.ok(p.rows[1].errors.some((e) => e.includes('غير موجود')))
  assert.ok(p.rows[2].errors.some((e) => e.includes('المنتج الأصلي')))
  await assert.rejects(async () => m.csv.commitImport(text, actor))
  assert.equal((await m.db.db().prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n, 0)

  const missing = await m.csv.previewImport('sku,name\nA,B')
  assert.ok(missing.rows[0].errors[0].includes('أعمدة مطلوبة'))
})

test('استيراد منتج بسيط ومنتج بخيارات ثم إعادة الاستيراد تحدّث دون تكرار', async () => {
  const text = [
    HEADER,
    'simple,,,جوارب قطنية,ملابس المواليد,published,1500,,10,1,,,,',
    'variable,IMP-100,,بدلة,ملابس المواليد,published,3500,,,1,المقاس,,اللون,',
    'variant,IMP-100-01,IMP-100,,,published,,,5,,المقاس,0-3 أشهر,اللون,وردي',
    'variant,IMP-100-02,IMP-100,,,published,4000,,3,,المقاس,3-6 أشهر,اللون,وردي',
  ].join('\r\n')
  const p = await m.csv.previewImport(text)
  assert.equal(p.summary.errors, 0)
  assert.deepEqual(await m.csv.commitImport(text, actor), { created: 2, updated: 0 })

  const d = m.db.db()
  const socks = await d.prepare("SELECT * FROM products WHERE name='جوارب قطنية'").get() as { sku: string; price: number; stock: number }
  assert.ok(socks.sku, 'رقم المنتج يُنشأ تلقائياً')
  assert.equal(socks.price, 150000)
  assert.equal(socks.stock, 10)
  const vars = await d.prepare("SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE p.sku='IMP-100' ORDER BY v.sku").all() as { sku: string; price: number | null; stock: number }[]
  assert.equal(vars.length, 2)
  assert.equal(vars[1].price, 400000)
  assert.equal(vars[0].stock, 5)
  // حركة مخزون مسجلة بسبب الاستيراد
  assert.ok((await d.prepare("SELECT COUNT(*) n FROM stock_movements WHERE reason='import'").get() as { n: number }).n >= 1)

  // التصدير ثم إعادة الاستيراد: تحديث فقط، لا منتجات أو خيارات مكررة
  const exported = await m.csv.productsCsv()
  const again = await m.csv.previewImport(exported)
  assert.equal(again.summary.errors, 0)
  assert.equal(again.summary.create, 0)
  const before = (await d.prepare('SELECT COUNT(*) n FROM variants').get() as { n: number }).n
  await m.csv.commitImport(exported.replace('1500', '1750'), actor)
  assert.equal((await d.prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n, 2)
  assert.equal((await d.prepare('SELECT COUNT(*) n FROM variants').get() as { n: number }).n, before)
  assert.equal((await d.prepare('SELECT price FROM products WHERE sku=?').get(socks.sku) as { price: number }).price, 175000)
})

test('التصدير يحمي من حقن المعادلات في Excel', async () => {
  const id = await m.products.saveProduct({ type: 'simple', name: '=HYPERLINK("x")', status: 'draft', price: 100, trackStock: false }, actor)
  const csv = await m.csv.productsCsv()
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`))
  await m.db.db().prepare('DELETE FROM products WHERE id=?').run(id)
})

test('النسخ الاحتياطي ثم الاستعادة يرجع البيانات ويحافظ على الصور ويحتفظ بنسخة أمان', async () => {
  const d = m.db.db()
  const media = await m.media.saveImage(await sharpPng(), { purpose: 'product' })
  const name = await m.backup.createBackup('test')
  assert.ok(await m.backup.getBackup(name))
  assert.equal(await m.backup.getBackup('../x'), null)

  // تعديلات بعد النسخة
  await d.prepare("UPDATE products SET name='اسم معدل'").run()
  await m.products.saveProduct({ type: 'simple', name: 'منتج بعد النسخة', status: 'draft', price: 100, trackStock: false }, actor)
  const later = await m.media.saveImage(await sharpPng(), { purpose: 'product' })
  assert.equal((await d.prepare("SELECT COUNT(*) n FROM products WHERE name='اسم معدل'").get<{ n: number }>())!.n, 2)

  const { safety } = await m.backup.restoreBackup((await m.backup.getBackup(name))!)
  assert.ok(await m.backup.getBackup(safety), 'نسخة أمان قبل الاستعادة')
  assert.equal((await d.prepare("SELECT COUNT(*) n FROM products WHERE name='اسم معدل'").get<{ n: number }>())!.n, 0)
  assert.equal((await d.prepare("SELECT COUNT(*) n FROM products WHERE name='منتج بعد النسخة'").get<{ n: number }>())!.n, 0)
  assert.equal((await d.prepare("SELECT COUNT(*) n FROM products WHERE name='جوارب قطنية'").get<{ n: number }>())!.n, 1)
  // الصور (القديمة واللاحقة) باقية، والأرقام التسلسلية تستمر بعد أعلى رقم
  assert.ok(await m.media.getMedia(media))
  assert.ok(await m.media.getMedia(later))
  const next = await m.products.saveProduct({ type: 'simple', name: 'بعد الاستعادة', status: 'draft', price: 100, trackStock: false }, actor)
  assert.ok(next > 0)
})

test('الاستعادة ترفض ملفاً ليس نسخة احتياطية', async () => {
  await assert.rejects(() => m.backup.restoreBackup(Buffer.from('not an archive')))
  // البيانات الحالية سليمة
  assert.ok((await m.db.db().prepare('SELECT COUNT(*) n FROM products').get<{ n: number }>())!.n >= 2)
})

test('الصور تُحفظ في قاعدة البيانات وتُخدم بمقاسات متعددة، والسندات خاصة', async () => {
  const id = await m.media.saveImage(await sharpPng(1200), { purpose: 'product' })
  const row = (await m.media.getMedia(id))!
  const url = m.media.mediaUrl(row, 800)!
  assert.match(url, /^\/media\/.+-800\.webp$/)
  const blob = await m.media.getPublicBlob(url.replace('/media/', ''))
  assert.equal(blob?.mime, 'image/webp')
  const receipt = await m.media.savePrivateReceipt(await sharpPng(), 'r.png')
  const r = (await m.media.getMedia(receipt))!
  assert.equal(m.media.mediaUrl(r), null)
  assert.equal(await m.media.getPublicBlob(`${r.path}.${r.ext}`), null)
  assert.ok(await m.media.getPrivateBlob(r))
})
