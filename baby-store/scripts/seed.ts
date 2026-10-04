// تهيئة المتجر: الصفحات والأسئلة والأقسام، مع بيانات تجريبية واضحة (يمكن حذفها من لوحة التحكم)
// الاستخدام: npm run db:seed            (مع منتجات تجريبية)
//           npm run db:seed -- --no-demo (هيكل المتجر فقط)
import { db } from '../lib/server/db'
import { ensureAppearance, getPublishedAppearance } from '../lib/server/appearance'
import { demoMedia } from './demo-media'
import { saveProduct } from '../lib/server/products'
import { getVariants } from '../lib/server/catalog'
import { demoSvg, bannerSvg, bannerSvgMobile, garmentSvg, type Art } from './demo-art'
import type { ProductOption } from '../lib/shared/types'

const withDemo = !process.argv.includes('--no-demo')
const d = db()
const actor = { id: 0, name: 'التهيئة' }
const Y = (n: number) => n * 100 // ريال → سنت

async function art(a: Art, color: string, accent: string, bg: string, purpose = 'product') {
  return demoMedia(demoSvg(a, color, accent, bg), { name: a, purpose, widths: [400, 800] })
}

/** صورتا الشماعة (الأمام والخلف) بخلفية شفافة */
async function railArt(a: Art, color: string, accent: string) {
  const front = await demoMedia(garmentSvg(a, color, accent, 'front'), { name: `${a}-front`, purpose: 'product', widths: [400, 800] })
  const back = await demoMedia(garmentSvg(a, color, accent, 'back'), { name: `${a}-back`, purpose: 'product', widths: [400, 800] })
  return { front, back }
}

async function main() {
  await ensureAppearance()

  // الصفحات والأسئلة الشائعة والأقسام وتصنيفات العمر والمناسبة تُنشأ تلقائياً مع قاعدة البيانات الجديدة (lib/server/bootstrap.ts)
  const cats: Record<string, number> = {}
  for (const r of await d.prepare('SELECT id, slug FROM categories').all() as { id: number; slug: string }[]) cats[r.slug] = r.id
  const tags: Record<string, number> = {}
  for (const r of await d.prepare('SELECT id, slug FROM tags').all() as { id: number; slug: string }[]) tags[r.slug] = r.id
  console.log('✓ هيكل المتجر (الصفحات، الأسئلة، الأقسام، التصنيفات)')

  if (!withDemo) return
  if ((await d.prepare('SELECT COUNT(*) n FROM products WHERE is_demo=1').get() as { n: number }).n) {
    console.log('البيانات التجريبية موجودة مسبقاً — لم تتم إضافتها مرة أخرى')
    return
  }

  // صور تجريبية للأقسام الأساسية التي ليس لها صورة
  const catArt: Record<string, [Art, string, string, string]> = {
    'baby-clothes': ['onesie', '#F6C9D3', '#FFFFFF', '#FBE6EA'],
    'baby-sets': ['set', '#BFDDF2', '#F6C9D3', '#E3F0F9'],
    accessories: ['hat', '#CDE8D6', '#F6C9D3', '#E5F3EA'],
    gifts: ['gift', '#F6C9D3', '#FFE7A6', '#FCEEF0'],
    essentials: ['blanket', '#FFE7A6', '#BFDDF2', '#FFF6DA'],
  }
  for (const [slug, [a, c, acc, bg]] of Object.entries(catArt)) {
    const row = await d.prepare('SELECT id, image_id FROM categories WHERE slug=?').get(slug) as { id: number; image_id: number | null } | undefined
    if (row && !row.image_id) await d.prepare('UPDATE categories SET image_id=? WHERE id=?').run(await art(a, c, acc, bg, 'category'), row.id)
  }

  // دليل مقاسات نموذجي
  const sizeGuide = Number(
    (await d
      .prepare('INSERT INTO size_guides(name,intro,columns,rows,notes,is_demo) VALUES(?,?,?,?,?,1)')
      .run(
        'دليل مقاسات ملابس المواليد (نموذج)',
        'اختر المقاس حسب طول الطفل ووزنه، وعند التردد بين مقاسين اختر الأكبر.',
        JSON.stringify(['المقاس', 'العمر التقريبي', 'الطول (سم)', 'الوزن (كجم)']),
        JSON.stringify([
          ['0-3 أشهر', 'حتى 3 أشهر', '50 - 62', '3 - 6'],
          ['3-6 أشهر', '3 - 6 أشهر', '62 - 68', '6 - 8'],
          ['6-12 شهراً', '6 - 12 شهراً', '68 - 80', '8 - 10'],
        ]),
        'جدول نموذجي للتوضيح فقط — استبدله بمقاسات منتجاتك الفعلية من لوحة التحكم.',
      )).lastInsertRowid,
  )

  if (!(await d.prepare('SELECT COUNT(*) n FROM gift_wraps').get() as { n: number }).n) {
    const w1 = await art('gift', '#F6C9D3', '#FFFFFF', '#FCEEF0', 'wrap')
    const w2 = await art('gift', '#BFDDF2', '#FFE7A6', '#E3F0F9', 'wrap')
    await d.prepare('INSERT INTO gift_wraps(name,description,price,image_id,sort,is_demo) VALUES(?,?,?,?,?,1)').run('تغليف ناعم (تجريبي)', 'ورق تغليف بلون هادئ مع شريطة', Y(1000), w1, 0)
    await d.prepare('INSERT INTO gift_wraps(name,description,price,image_id,sort,is_demo) VALUES(?,?,?,?,?,1)').run('صندوق هدية (تجريبي)', 'صندوق مقوى مع بطاقة إهداء', Y(2500), w2, 1)
  }

  if (!(await d.prepare('SELECT COUNT(*) n FROM shipping_zones').get() as { n: number }).n) {
    const z = d.prepare('INSERT INTO shipping_zones(name,country,cities,fee,eta_text,sort,is_demo) VALUES(?,?,?,?,?,?,1)')
    await z.run('صنعاء (تجريبي)', 'اليمن', JSON.stringify(['صنعاء', 'أمانة العاصمة']), Y(1000), '1 - 2 يوم عمل', 0)
    await z.run('عدن (تجريبي)', 'اليمن', JSON.stringify(['عدن']), Y(2000), '2 - 4 أيام عمل', 1)
    await z.run('تعز (تجريبي)', 'اليمن', JSON.stringify(['تعز']), Y(2000), '2 - 4 أيام عمل', 2)
    await z.run('باقي المحافظات (تجريبي)', 'اليمن', '[]', Y(3000), '3 - 6 أيام عمل', 3)
  }

  await d.prepare(
    "INSERT INTO coupons(code,description,type,value,min_order,max_discount,usage_limit,per_customer_limit,combine_with_sale,is_demo) VALUES('WELCOME10','خصم ترحيبي 10% (كوبون تجريبي)','percent',1000,?,?,100,1,0,1) ON CONFLICT DO NOTHING",
  ).run(Y(10000), Y(5000))

  const sizeOpt = (values: string[]): ProductOption => ({ name: 'المقاس', kind: 'size', values: values.map((value) => ({ value })) })
  const colorOpt = (values: [string, string][]): ProductOption => ({ name: 'اللون', kind: 'color', values: values.map(([value, color]) => ({ value, color })) })
  const pink: [string, string] = ['وردي', '#F4C6D0']
  const sky: [string, string] = ['سماوي', '#BFDDF2']
  const cream: [string, string] = ['كريمي', '#F3E9D8']
  const mint: [string, string] = ['نعناعي', '#CDE8D6']

  const ids: Record<string, number> = {}
  type Def = Parameters<typeof saveProduct>[0] & {
    key: string
    arts: { a: Art; c: string; acc: string; bg: string; opt?: string }[]
    rail?: { a: Art; c: string; acc: string }
  }
  const variantsFor = (sizes: string[], colors: [string, string][], stock: (s: number, c: number) => number, price?: (s: number) => number | null) =>
    sizes.flatMap((s, si) =>
      colors.map((c, ci) => ({ options: [s, c[0]] as (string | null)[], stock: stock(si, ci), active: true, price: price ? price(si) : null })),
    )

  const defs: Def[] = [
    {
      key: 'bodysuit', type: 'variable', name: 'بدلة قطنية بأكمام قصيرة', status: 'published', price: Y(3500), trackStock: true,
      categoryId: cats['baby-clothes'], tagIds: [tags['age-0-3'], tags['age-3-6'], tags['age-6-12'], tags['for-all'], tags['occ-welcome']],
      shortDescription: 'بدلة يومية ناعمة بأزرار سفلية لتغيير الحفاض بسهولة.',
      description: 'بدلة بأكمام قصيرة وتصميم مريح مع أزرار سفلية تسهّل تغيير الحفاض.\n\n- قصة واسعة عند الرقبة لسهولة الارتداء.\n- رسمة نجمة لطيفة على الصدر.\n\n> منتج تجريبي لعرض طريقة اختيار المقاس واللون — استبدله بمنتجاتك.',
      material: 'قطن (مثال توضيحي — عدّله حسب المنتج الفعلي)', careInstructions: 'يُغسل على درجة حرارة منخفضة (مثال توضيحي)',
      sizeGuideId: sizeGuide, options: [sizeOpt(['0-3 أشهر', '3-6 أشهر', '6-12 شهراً']), colorOpt([pink, sky, cream])],
      variants: variantsFor(['0-3 أشهر', '3-6 أشهر', '6-12 شهراً'], [pink, sky, cream], (s, c) => [6, 4, 0][c] + s, (s) => (s === 2 ? Y(4000) : null)),
      prepDaysMin: 1, prepDaysMax: 2,
      arts: [
        { a: 'onesie', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0', opt: 'وردي' },
        { a: 'onesie', c: '#BFDDF2', acc: '#FFE7A6', bg: '#E8F3FA', opt: 'سماوي' },
        { a: 'onesie', c: '#F3E9D8', acc: '#F4C6D0', bg: '#FBF6EE', opt: 'كريمي' },
      ],
      rail: { a: 'onesie', c: '#F4C6D0', acc: '#FFFFFF' },
    },
    {
      key: 'pajama', type: 'variable', name: 'بيجامة نوم بأزرار وطبعة قمر', status: 'published', price: Y(5500), salePrice: Y(4500), trackStock: true,
      categoryId: cats['baby-clothes'], tagIds: [tags['age-3-6'], tags['age-6-12'], tags['age-12-24'], tags['for-all']],
      shortDescription: 'بيجامة بأكمام وأرجل طويلة لنوم هادئ ودافئ.',
      description: 'بيجامة قطعة واحدة بأزرار أمامية وطبعة نجوم وقمر.\n\n> منتج تجريبي — عدّل الوصف والخامة حسب منتجك الفعلي.',
      sizeGuideId: sizeGuide, options: [sizeOpt(['3-6 أشهر', '6-12 شهراً', '1-2 سنة']), colorOpt([sky, mint])],
      variants: variantsFor(['3-6 أشهر', '6-12 شهراً', '1-2 سنة'], [sky, mint], (s, c) => 3 + s + c),
      arts: [
        { a: 'pajama', c: '#BFDDF2', acc: '#FFE7A6', bg: '#E8F3FA', opt: 'سماوي' },
        { a: 'pajama', c: '#CDE8D6', acc: '#FFFFFF', bg: '#EAF5EE', opt: 'نعناعي' },
      ],
      rail: { a: 'pajama', c: '#BFDDF2', acc: '#FFE7A6' },
    },
    {
      key: 'welcome-set', type: 'simple', name: 'طقم استقبال المولود 5 قطع', status: 'published', price: Y(14500), trackStock: true, stock: 8,
      categoryId: cats['baby-sets'], tagIds: [tags['age-0-3'], tags['occ-welcome'], tags['occ-gift'], tags['for-all']],
      shortDescription: 'طقم متكامل لأول أيام المولود مع إمكانية تطريز الاسم.',
      description: 'طقم استقبال يضم القطع الأساسية للأيام الأولى، ويمكن تطريز اسم المولود على البطانية.\n\n> منتج تجريبي لعرض محتويات الطقم والتخصيص.',
      setContents: ['بدلة بأكمام طويلة', 'قبعة', 'قفازات', 'جوارب', 'بطانية لف صغيرة'], piecesCount: 5,
      prepDaysMin: 1, prepDaysMax: 3,
      personalization: { enabled: true, label: 'اسم المولود للتطريز', placeholder: 'مثال: ليان', maxLength: 12, fee: Y(1500), extraDays: 2, required: false, help: 'يُطرز الاسم على البطانية' },
      arts: [{ a: 'set', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0' }, { a: 'blanket', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FBF6EE' }],
      rail: { a: 'onesie-long', c: '#F4C6D0', acc: '#FFFFFF' },
    },
    {
      key: 'hospital-set', type: 'variable', name: 'طقم الخروج من المستشفى', status: 'published', price: Y(9500), trackStock: true,
      categoryId: cats['baby-sets'], tagIds: [tags['age-0-3'], tags['occ-welcome'], tags['for-boys']],
      shortDescription: 'طقم أنيق لأول خروج للمولود.',
      description: 'طقم من ثلاث قطع للمناسبة الأولى.\n\n> منتج تجريبي.',
      setContents: ['بدلة', 'قبعة', 'جوارب'], piecesCount: 3, sizeGuideId: sizeGuide,
      options: [sizeOpt(['0-3 أشهر', '3-6 أشهر'])],
      variants: [{ options: ['0-3 أشهر', null], stock: 5, active: true }, { options: ['3-6 أشهر', null], stock: 3, active: true }],
      arts: [{ a: 'set', c: '#BFDDF2', acc: '#FFE7A6', bg: '#E8F3FA' }],
      rail: { a: 'onesie-long', c: '#BFDDF2', acc: '#FFE7A6' },
    },
    {
      key: 'hat', type: 'variable', name: 'قبعة قطنية ناعمة', status: 'published', price: Y(1800), trackStock: true,
      categoryId: cats['accessories'], tagIds: [tags['age-0-3'], tags['age-3-6'], tags['for-all']],
      shortDescription: 'قبعة خفيفة مع كرة صغيرة.', description: 'قبعة لطيفة بحافة مزدوجة.\n\n> منتج تجريبي.',
      options: [colorOpt([pink, sky, mint])],
      variants: [pink, sky, mint].map((c, i) => ({ options: [c[0]], stock: [7, 5, 2][i], active: true })),
      arts: [
        { a: 'hat', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0', opt: 'وردي' },
        { a: 'hat', c: '#BFDDF2', acc: '#FFE7A6', bg: '#E8F3FA', opt: 'سماوي' },
        { a: 'hat', c: '#CDE8D6', acc: '#F4C6D0', bg: '#EAF5EE', opt: 'نعناعي' },
      ],
    },
    {
      key: 'socks', type: 'simple', name: 'جوارب مواليد (3 أزواج)', status: 'published', price: Y(1500), trackStock: true, stock: 20,
      categoryId: cats['accessories'], tagIds: [tags['age-0-3'], tags['age-3-6'], tags['for-all']],
      shortDescription: 'ثلاثة أزواج بألوان هادئة.', description: 'جوارب ناعمة بثلاثة ألوان.\n\n> منتج تجريبي.',
      setContents: ['زوج وردي', 'زوج سماوي', 'زوج كريمي'], piecesCount: 3,
      arts: [{ a: 'socks', c: '#F3E9D8', acc: '#F4C6D0', bg: '#FBF6EE' }],
    },
    {
      key: 'bib', type: 'simple', name: 'مريلة مطرزة بالاسم', status: 'published', price: Y(2000), trackStock: true, stock: 12,
      categoryId: cats['accessories'], tagIds: [tags['age-3-6'], tags['age-6-12'], tags['occ-gift'], tags['for-all']],
      shortDescription: 'مريلة لطيفة يمكن تطريز اسم المولود عليها.', description: 'مريلة بإغلاق خلفي.\n\n> منتج تجريبي لعرض التخصيص الاختياري.',
      personalization: { enabled: true, label: 'اسم المولود', placeholder: 'مثال: يوسف', maxLength: 10, fee: Y(800), extraDays: 2, required: false, help: '' },
      prepDaysMin: 1, prepDaysMax: 2,
      arts: [{ a: 'bib', c: '#BFDDF2', acc: '#FFE7A6', bg: '#E8F3FA' }, { a: 'bib', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0' }],
      rail: { a: 'bib', c: '#BFDDF2', acc: '#FFE7A6' },
    },
    {
      key: 'mittens', type: 'simple', name: 'قفازات حماية للمواليد', status: 'published', price: Y(1200), trackStock: true, stock: 2,
      categoryId: cats['accessories'], tagIds: [tags['age-0-3'], tags['for-all']],
      shortDescription: 'قفازات خفيفة لحماية وجه المولود.', description: 'زوج قفازات بحافة مطاطية ناعمة.\n\n> منتج تجريبي (مخزون منخفض لعرض التنبيه).',
      arts: [{ a: 'mittens', c: '#F3E9D8', acc: '#BFDDF2', bg: '#FBF6EE' }],
    },
    {
      key: 'blanket', type: 'variable', name: 'بطانية لف المولود', status: 'published', price: Y(6500), trackStock: true,
      categoryId: cats['essentials'], tagIds: [tags['age-0-3'], tags['occ-welcome'], tags['occ-gift'], tags['for-all']],
      shortDescription: 'بطانية ناعمة بنقشة نجوم، مع خيار تطريز الاسم.', description: 'بطانية مربعة للف المولود.\n\n> منتج تجريبي.',
      options: [colorOpt([pink, sky, cream])],
      variants: [pink, sky, cream].map((c, i) => ({ options: [c[0]], stock: [4, 4, 3][i], active: true })),
      personalization: { enabled: true, label: 'اسم المولود', placeholder: '', maxLength: 12, fee: Y(1500), extraDays: 3, required: false, help: '' },
      arts: [
        { a: 'blanket', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0', opt: 'وردي' },
        { a: 'blanket', c: '#BFDDF2', acc: '#FFFFFF', bg: '#E8F3FA', opt: 'سماوي' },
        { a: 'blanket', c: '#F3E9D8', acc: '#F4C6D0', bg: '#FBF6EE', opt: 'كريمي' },
      ],
    },
    {
      key: 'booties', type: 'variable', name: 'حذاء مواليد ناعم', status: 'published', price: Y(3000), trackStock: true,
      categoryId: cats['accessories'], tagIds: [tags['age-3-6'], tags['age-6-12'], tags['for-girls']],
      shortDescription: 'حذاء قماشي خفيف لأول الخطوات.', description: 'حذاء مرن بنعل ناعم.\n\n> منتج تجريبي.',
      options: [sizeOpt(['0-6 أشهر', '6-12 شهراً'])],
      variants: [{ options: ['0-6 أشهر'], stock: 6, active: true }, { options: ['6-12 شهراً'], stock: 0, active: true }],
      arts: [{ a: 'booties', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0' }],
    },
    {
      key: 'bear', type: 'simple', name: 'دبدوب قطني صغير', status: 'published', price: Y(4000), salePrice: Y(3200), trackStock: true, stock: 10,
      categoryId: cats['gifts'], tagIds: [tags['occ-gift'], tags['occ-eid'], tags['for-all']],
      shortDescription: 'رفيق ناعم لأحلام المولود.', description: 'دبدوب صغير بفيونكة.\n\n> منتج تجريبي.',
      arts: [{ a: 'bear', c: '#E8CBA8', acc: '#F4C6D0', bg: '#FBF6EE' }],
    },
    {
      key: 'bottle', type: 'simple', name: 'رضّاعة أطفال 150 مل', status: 'published', price: Y(2500), trackStock: true, stock: 15,
      categoryId: cats['essentials'], tagIds: [tags['age-0-3'], tags['age-3-6'], tags['for-all']],
      shortDescription: 'رضّاعة بحجم مناسب للأشهر الأولى.', description: 'رضّاعة بسعة 150 مل.\n\n> منتج تجريبي — أضف مواصفات منتجك الفعلية دون ادعاءات غير موثقة.',
      arts: [{ a: 'bottle', c: '#BFDDF2', acc: '#F4C6D0', bg: '#E8F3FA' }],
    },
    {
      key: 'giftbox', type: 'simple', name: 'علبة هدية مع شريطة', status: 'published', price: Y(1500), trackStock: false, manualAvailability: 'in_stock',
      categoryId: cats['gifts'], tagIds: [tags['occ-gift'], tags['occ-aqiqah'], tags['occ-eid']],
      shortDescription: 'علبة جاهزة لتغليف هديتك.', description: 'علبة مقواة بشريطة.\n\n> منتج تجريبي (بدون تتبع مخزون).',
      giftWrapEligible: false,
      arts: [{ a: 'gift', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0' }],
    },
    {
      key: 'jacket', type: 'variable', name: 'سترة شتوية مبطنة', status: 'published', price: Y(8500), trackStock: true,
      categoryId: cats['baby-clothes'], tagIds: [tags['age-6-12'], tags['age-12-24'], tags['for-all']],
      shortDescription: 'سترة دافئة للأيام الباردة.', description: 'سترة بسحاب أمامي وقبعة.\n\n> منتج تجريبي غير متوفر لعرض حالة نفاد الكمية.',
      options: [sizeOpt(['6-12 شهراً', '1-2 سنة'])],
      variants: [{ options: ['6-12 شهراً'], stock: 0, active: true }, { options: ['1-2 سنة'], stock: 0, active: true }],
      arts: [{ a: 'jacket', c: '#CDE8D6', acc: '#FFE7A6', bg: '#EAF5EE' }],
      rail: { a: 'jacket', c: '#CDE8D6', acc: '#FFE7A6' },
    },
    {
      key: 'dress', type: 'variable', name: 'فستان قطني بكشكش', status: 'published', price: Y(6000), trackStock: true,
      categoryId: cats['baby-clothes'], tagIds: [tags['age-3-6'], tags['age-6-12'], tags['for-girls'], tags['occ-eid']],
      shortDescription: 'فستان ناعم بأكمام منفوخة وشريطة على الخصر.',
      description: 'فستان للمناسبات بكشكش عند الحافة وشريطة خلفية.\n\n> منتج تجريبي لعرض قسم «على الشماعة» مع صورتي الأمام والخلف.',
      options: [sizeOpt(['3-6 أشهر', '6-12 شهراً'])],
      variants: [{ options: ['3-6 أشهر'], stock: 4, active: true }, { options: ['6-12 شهراً'], stock: 3, active: true }],
      arts: [{ a: 'dress', c: '#F7D3DC', acc: '#FFFFFF', bg: '#FCEEF0' }],
      rail: { a: 'dress', c: '#F7D3DC', acc: '#FFFFFF' },
    },
    {
      key: 'romper', type: 'simple', name: 'أوفرول قصير بحمالات', status: 'published', price: Y(4800), trackStock: true, stock: 6,
      categoryId: cats['baby-clothes'], tagIds: [tags['age-6-12'], tags['age-12-24'], tags['for-all']],
      shortDescription: 'أوفرول بجيب أمامي وحمالات متقاطعة من الخلف.',
      description: 'أوفرول خفيف للعب اليومي.\n\n> منتج تجريبي.',
      arts: [{ a: 'romper', c: '#F3E2C7', acc: '#F4C6D0', bg: '#FBF6EE' }],
      rail: { a: 'romper', c: '#F3E2C7', acc: '#F4C6D0' },
    },
    {
      key: 'draft', type: 'simple', name: 'منتج مسودة (لا يظهر في المتجر)', status: 'draft', price: Y(1000), trackStock: true, stock: 5,
      categoryId: cats['essentials'], shortDescription: 'مثال على منتج محفوظ كمسودة.',
      arts: [{ a: 'bottle', c: '#F3E9D8', acc: '#BFDDF2', bg: '#FBF6EE' }],
    },
  ]

  for (const def of defs) {
    const images: { mediaId: number; alt: string; optionValue: string | null; role?: 'rail' | 'back' }[] = []
    for (const a of def.arts) images.push({ mediaId: await art(a.a, a.c, a.acc, a.bg), alt: def.name, optionValue: a.opt || null })
    if (def.rail) {
      const r = await railArt(def.rail.a, def.rail.c, def.rail.acc)
      images.push({ mediaId: r.front, alt: def.name, optionValue: null, role: 'rail' })
      images.push({ mediaId: r.back, alt: `${def.name} — من الخلف`, optionValue: null, role: 'back' })
    }
    const { key, arts, rail, ...input } = def
    void arts
    void rail
    ids[key] = await saveProduct({ ...input, images, isDemo: true }, actor)
  }

  const bodysuitVariants = await getVariants(ids['bodysuit'])
  const blanketCream = (await getVariants(ids['blanket'])).find((v) => v.option1 === 'كريمي')
  const bundles: Def[] = [
    {
      key: 'gift-bundle', type: 'bundle', name: 'باقة هدية المولود الجديد', status: 'published', price: Y(10500), trackStock: false, manualAvailability: 'in_stock',
      categoryId: cats['gifts'], tagIds: [tags['occ-gift'], tags['occ-welcome'], tags['age-0-3']],
      shortDescription: 'بدلة وقبعة وجوارب ودبدوب في باقة واحدة بسعر خاص.',
      description: 'باقة هدية متكاملة. اختر مقاس البدلة ولونها ولون القبعة.\n\n> باقة تجريبية لعرض اختيار خيارات المكونات وربط توفرها بمخزونها.',
      bundleItems: [
        { productId: ids['bodysuit'], variantId: null, qty: 1 },
        { productId: ids['hat'], variantId: null, qty: 1 },
        { productId: ids['socks'], variantId: null, qty: 1 },
        { productId: ids['bear'], variantId: null, qty: 1 },
      ],
      prepDaysMin: 1, prepDaysMax: 2,
      arts: [{ a: 'gift', c: '#BFDDF2', acc: '#F4C6D0', bg: '#E8F3FA' }, { a: 'set', c: '#F4C6D0', acc: '#FFFFFF', bg: '#FCEEF0' }],
    },
    {
      key: 'care-bundle', type: 'bundle', name: 'باقة العناية اليومية', status: 'published', price: Y(9000), trackStock: false, manualAvailability: 'in_stock',
      categoryId: cats['essentials'], tagIds: [tags['occ-welcome'], tags['age-0-3']],
      shortDescription: 'مريلة وقفازات وبطانية كريمية ورضّاعة.',
      description: 'باقة لمستلزمات الأيام الأولى بمكونات محددة.\n\n> باقة تجريبية.',
      bundleItems: [
        { productId: ids['bib'], variantId: null, qty: 2 },
        { productId: ids['mittens'], variantId: null, qty: 1 },
        { productId: ids['blanket'], variantId: blanketCream?.id ?? null, qty: 1 },
        { productId: ids['bottle'], variantId: null, qty: 1 },
      ],
      arts: [{ a: 'blanket', c: '#F3E9D8', acc: '#BFDDF2', bg: '#FBF6EE' }],
    },
  ]
  void bodysuitVariants
  for (const def of bundles) {
    const images: { mediaId: number; alt: string; optionValue: string | null }[] = []
    for (const a of def.arts) images.push({ mediaId: await art(a.a, a.c, a.acc, a.bg), alt: def.name, optionValue: null })
    const { key, arts, rail, ...input } = def
    void arts
    void rail
    ids[key] = await saveProduct({ ...input, images, isDemo: true }, actor)
  }

  // منتجات مكملة ومرتبطة
  const rel = d.prepare('INSERT INTO product_relations(product_id,related_id,kind,sort) VALUES(?,?,?,?) ON CONFLICT DO NOTHING')
  await rel.run(ids['bodysuit'], ids['hat'], 'complementary', 0)
  await rel.run(ids['bodysuit'], ids['socks'], 'complementary', 1)
  await rel.run(ids['bodysuit'], ids['bib'], 'complementary', 2)
  await rel.run(ids['welcome-set'], ids['giftbox'], 'complementary', 0)
  await rel.run(ids['blanket'], ids['bear'], 'complementary', 0)
  await rel.run(ids['pajama'], ids['booties'], 'related', 0)

  // صور البنرات ومنتجات مميزة في المظهر المنشور
  const banner = (svg: string, widths: number[]) => demoMedia(svg, { name: 'banner', purpose: 'banner', widths })
  const b1id = await banner(bannerSvg('#FCE4EA', '#E3F0F9', '#FFFFFF', 'onesie', '#F4C6D0'), [800, 1400, 1800])
  const b2id = await banner(bannerSvg('#E3F0F9', '#EAF5EE', '#FFE7A6', 'gift', '#F4C6D0'), [800, 1400, 1800])
  const m1id = await banner(bannerSvgMobile('#FCE4EA', '#E3F0F9', '#FFFFFF', 'onesie', '#F4C6D0'), [480, 900])
  const m2id = await banner(bannerSvgMobile('#E3F0F9', '#EAF5EE', '#FFE7A6', 'gift', '#F4C6D0'), [480, 900])
  const a = await getPublishedAppearance()
  const hero = a.home.sections.find((s) => s.type === 'hero')
  if (hero) {
    hero.banners[0] = { ...hero.banners[0], imageDesktopId: b1id, imageMobileId: m1id }
    if (hero.banners[1]) hero.banners[1] = { ...hero.banners[1], imageDesktopId: b2id, imageMobileId: m2id }
  }
  const railSec = a.home.sections.find((s) => s.type === 'rail')
  if (railSec) railSec.productIds = ['bodysuit', 'dress', 'pajama', 'romper', 'hospital-set', 'jacket', 'welcome-set', 'bib'].map((k) => ids[k]).filter(Boolean)
  const featured = a.home.sections.find((s) => s.type === 'featured')
  if (featured) featured.productIds = [ids['welcome-set'], ids['blanket'], ids['bear'], ids['pajama'], ids['bib']]
  const age = a.home.sections.find((s) => s.id === 'age')
  const occ = a.home.sections.find((s) => s.id === 'occasion')
  const groups = await d.prepare('SELECT id, slug FROM tag_groups').all() as { id: number; slug: string }[]
  if (age) age.tagGroupId = groups.find((g) => g.slug === 'age')?.id ?? null
  if (occ) occ.tagGroupId = groups.find((g) => g.slug === 'occasion')?.id ?? null
  await d.prepare("UPDATE appearance_versions SET data=? WHERE status='published'").run(JSON.stringify(a))

  console.log(`✓ منتجات تجريبية: ${Object.keys(ids).length} (يمكن حذفها من لوحة التحكم ← الإعدادات ← البيانات التجريبية)`)
}

main().then(
  () => {
    console.log('تمت التهيئة بنجاح')
    process.exit(0)
  },
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
