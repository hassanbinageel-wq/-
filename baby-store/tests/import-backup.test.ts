// اختبارات استيراد/تصدير CSV والنسخ الاحتياطي والاستعادة
// التشغيل: npm test
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-io-'))
process.env.DATA_DIR = tmp

type M = {
  db: typeof import('../lib/server/db')
  csv: typeof import('../lib/server/csv')
  products: typeof import('../lib/server/products')
  backup: typeof import('../lib/server/backup')
  appearance: typeof import('../lib/server/appearance')
}
let m: M
const actor = { id: 1, name: 'مختبر' }

before(async () => {
  m = {
    db: await import('../lib/server/db'),
    csv: await import('../lib/server/csv'),
    products: await import('../lib/server/products'),
    backup: await import('../lib/server/backup'),
    appearance: await import('../lib/server/appearance'),
  }
  m.appearance.ensureAppearance()
  // قسم «ملابس المواليد» يُنشأ تلقائياً مع قاعدة البيانات الجديدة
})

const HEADER = 'type,sku,parent_sku,name,category,status,price,sale_price,stock,track_stock,option1_name,option1_value,option2_name,option2_value'

test('قاعدة بيانات جديدة تحتوي هيكل المتجر الأساسي دون منتجات', () => {
  const d = m.db.db()
  const n = (sql: string) => (d.prepare(sql).get() as { n: number }).n
  assert.equal(n('SELECT COUNT(*) n FROM categories'), 5)
  assert.equal(n("SELECT COUNT(*) n FROM pages WHERE slug IN ('privacy','shipping','returns') AND status='published'"), 3)
  assert.ok(n('SELECT COUNT(*) n FROM faqs') > 0)
  assert.ok(n("SELECT COUNT(*) n FROM tags t JOIN tag_groups g ON g.id=t.group_id WHERE g.kind='age'") > 0)
  assert.equal(n('SELECT COUNT(*) n FROM products'), 0)
  assert.equal(n('SELECT COUNT(*) n FROM transfer_methods'), 0)
  // لا يعاد إنشاء ما يحذفه المالك
  d.prepare('DELETE FROM faqs').run()
  m.db.closeDb()
  assert.equal((m.db.db().prepare('SELECT COUNT(*) n FROM faqs').get() as { n: number }).n, 0)
})

test('معاينة CSV تكشف الأخطاء دون أي حفظ', () => {
  const text = [
    HEADER,
    'simple,,,,ملابس المواليد,published,abc,,5,1,,,,',
    'simple,,,قبعة,قسم غير موجود,published,500,,2,1,,,,',
    'variant,X-1,NOPARENT,,,published,,,3,,المقاس,0-3,,',
    'gadget,,,شيء,,,100,,,,,,,',
  ].join('\n')
  const p = m.csv.previewImport(text)
  assert.equal(p.summary.errors, 4)
  assert.ok(p.rows[0].errors.some((e) => e.includes('السعر')))
  assert.ok(p.rows[1].errors.some((e) => e.includes('غير موجود')))
  assert.ok(p.rows[2].errors.some((e) => e.includes('المنتج الأصلي')))
  assert.throws(() => m.csv.commitImport(text, actor))
  assert.equal((m.db.db().prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n, 0)

  const missing = m.csv.previewImport('sku,name\nA,B')
  assert.ok(missing.rows[0].errors[0].includes('أعمدة مطلوبة'))
})

test('استيراد منتج بسيط ومنتج بخيارات ثم إعادة الاستيراد تحدّث دون تكرار', () => {
  const text = [
    HEADER,
    'simple,,,جوارب قطنية,ملابس المواليد,published,1500,,10,1,,,,',
    'variable,IMP-100,,بدلة,ملابس المواليد,published,3500,,,1,المقاس,,اللون,',
    'variant,IMP-100-01,IMP-100,,,published,,,5,,المقاس,0-3 أشهر,اللون,وردي',
    'variant,IMP-100-02,IMP-100,,,published,4000,,3,,المقاس,3-6 أشهر,اللون,وردي',
  ].join('\r\n')
  const p = m.csv.previewImport(text)
  assert.equal(p.summary.errors, 0)
  assert.deepEqual(m.csv.commitImport(text, actor), { created: 2, updated: 0 })

  const d = m.db.db()
  const socks = d.prepare("SELECT * FROM products WHERE name='جوارب قطنية'").get() as { sku: string; price: number; stock: number }
  assert.ok(socks.sku, 'رقم المنتج يُنشأ تلقائياً')
  assert.equal(socks.price, 150000)
  assert.equal(socks.stock, 10)
  const vars = d.prepare("SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE p.sku='IMP-100' ORDER BY v.sku").all() as { sku: string; price: number | null; stock: number }[]
  assert.equal(vars.length, 2)
  assert.equal(vars[1].price, 400000)
  assert.equal(vars[0].stock, 5)
  // حركة مخزون مسجلة بسبب الاستيراد
  assert.ok((d.prepare("SELECT COUNT(*) n FROM stock_movements WHERE reason='import'").get() as { n: number }).n >= 1)

  // التصدير ثم إعادة الاستيراد: تحديث فقط، لا منتجات أو خيارات مكررة
  const exported = m.csv.productsCsv()
  const again = m.csv.previewImport(exported)
  assert.equal(again.summary.errors, 0)
  assert.equal(again.summary.create, 0)
  const before = (d.prepare('SELECT COUNT(*) n FROM variants').get() as { n: number }).n
  m.csv.commitImport(exported.replace('1500', '1750'), actor)
  assert.equal((d.prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n, 2)
  assert.equal((d.prepare('SELECT COUNT(*) n FROM variants').get() as { n: number }).n, before)
  assert.equal((d.prepare('SELECT price FROM products WHERE sku=?').get(socks.sku) as { price: number }).price, 175000)
})

test('التصدير يحمي من حقن المعادلات في Excel', () => {
  const id = m.products.saveProduct({ type: 'simple', name: '=HYPERLINK("x")', status: 'draft', price: 100, trackStock: false }, actor)
  const csv = m.csv.productsCsv()
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`))
  m.db.db().prepare('DELETE FROM products WHERE id=?').run(id)
})

test('النسخ الاحتياطي ثم الاستعادة يرجع البيانات والصور ويحتفظ بنسخة أمان', async () => {
  const d = m.db.db()
  const uploads = m.db.dataPath('uploads')
  fs.mkdirSync(uploads, { recursive: true })
  fs.writeFileSync(path.join(uploads, 'marker.txt'), 'original')
  const name = await m.backup.createBackup('test')
  assert.ok(m.backup.backupPath(name))
  assert.equal(m.backup.backupPath('../store.db'), null)

  // تعديلات بعد النسخة
  m.db.db().prepare("UPDATE products SET name='اسم معدل'").run()
  fs.writeFileSync(path.join(uploads, 'marker.txt'), 'changed')
  fs.writeFileSync(path.join(uploads, 'extra.txt'), 'new')
  assert.equal((d.prepare("SELECT COUNT(*) n FROM products WHERE name='اسم معدل'").get() as { n: number }).n, 2)

  const { safety } = await m.backup.restoreBackup(m.backup.backupPath(name)!)
  assert.ok(m.backup.backupPath(safety), 'نسخة أمان قبل الاستعادة')
  const d2 = m.db.db()
  assert.equal((d2.prepare("SELECT COUNT(*) n FROM products WHERE name='اسم معدل'").get() as { n: number }).n, 0)
  assert.equal((d2.prepare("SELECT COUNT(*) n FROM products WHERE name='جوارب قطنية'").get() as { n: number }).n, 1)
  assert.equal(fs.readFileSync(path.join(uploads, 'marker.txt'), 'utf8'), 'original')
  assert.equal(fs.existsSync(path.join(uploads, 'extra.txt')), false)
})

test('الاستعادة ترفض ملفاً ليس نسخة احتياطية', async () => {
  const bad = path.join(tmp, 'bad.tar.gz')
  fs.writeFileSync(bad, 'not an archive')
  await assert.rejects(() => m.backup.restoreBackup(bad))
  // البيانات الحالية سليمة
  assert.equal((m.db.db().prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n, 2)
})
