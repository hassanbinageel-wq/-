import { db, nextCounter, nowSql, parseJson } from './db'
import { invalidateCatalog, refreshSearchText, getProductRow, type ProductRow, type VariantRow } from './catalog'
import { adjustStock, type Actor } from './inventory'
import { getSetting } from './settings'
import { ApiError } from './errors'
import { deleteMediaFiles, type MediaRow } from './media'
import { slugify } from '../shared/arabic'
import type { Personalization, ProductOption } from '../shared/types'

export type ProductInput = {
  id?: number | null
  type: 'simple' | 'variable' | 'bundle'
  name: string
  slug?: string | null
  sku?: string | null
  shortDescription?: string | null
  description?: string | null
  categoryId?: number | null
  tagIds?: number[]
  status: 'draft' | 'published' | 'archived'
  price: number
  salePrice?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  trackStock: boolean
  stock?: number
  manualAvailability?: 'in_stock' | 'out_of_stock'
  lowStockThreshold?: number | null
  maxPerOrder?: number | null
  options?: ProductOption[]
  variants?: { id?: number | null; sku?: string | null; options: (string | null)[]; price?: number | null; salePrice?: number | null; stock: number; active: boolean }[]
  images?: { mediaId: number; alt?: string | null; optionValue?: string | null }[]
  material?: string | null
  careInstructions?: string | null
  sizeGuideId?: number | null
  setContents?: string[]
  piecesCount?: number | null
  prepDaysMin?: number | null
  prepDaysMax?: number | null
  giftWrapEligible?: boolean
  personalization?: Personalization | null
  relatedIds?: number[]
  complementaryIds?: number[]
  bundleItems?: { productId: number; variantId?: number | null; qty: number }[]
  seoTitle?: string | null
  seoDescription?: string | null
  isDemo?: boolean
  stockNote?: string | null
  stockReason?: string
}

const t = (s: string | null | undefined, max = 5000) => (s || '').trim().slice(0, max) || null

export function newSku(): string {
  const prefix = (getSetting('store').skuPrefix || 'SKU').replace(/[^\w-]/g, '').toUpperCase() || 'SKU'
  let sku: string
  do {
    sku = `${prefix}-${nextCounter('sku', 1001)}`
  } while (skuTaken(sku))
  return sku
}

export function skuTaken(sku: string, exceptProductId?: number | null, exceptVariantId?: number | null): boolean {
  const d = db()
  const p = d.prepare('SELECT id FROM products WHERE sku=? COLLATE NOCASE').get(sku) as { id: number } | undefined
  if (p && p.id !== exceptProductId) return true
  const v = d.prepare('SELECT id FROM variants WHERE sku=? COLLATE NOCASE').get(sku) as { id: number } | undefined
  if (v && v.id !== exceptVariantId) return true
  return false
}

export function uniqueSlug(base: string, exceptId?: number | null, table: 'products' | 'categories' | 'tags' | 'tag_groups' | 'pages' = 'products'): string {
  const root = slugify(base)
  let slug = root
  let i = 2
  while (true) {
    const row = db().prepare(`SELECT id FROM ${table} WHERE slug=?`).get(slug) as { id: number } | undefined
    if (!row || row.id === exceptId) return slug
    slug = `${root}-${i++}`
  }
}

function normalizeSkuInput(s: string | null | undefined): string | null {
  const v = (s || '').trim().toUpperCase().replace(/\s+/g, '-')
  if (!v) return null
  if (!/^[A-Z0-9][A-Z0-9_.-]{1,39}$/.test(v)) throw new ApiError(400, `رقم المنتج «${s}» غير صالح. استخدم حروفاً إنجليزية وأرقاماً وشرطة فقط`)
  return v
}

export function saveProduct(input: ProductInput, actor: Actor): number {
  const d = db()
  return d
    .transaction(() => {
      const existing = input.id ? getProductRow(input.id) : undefined
      if (input.id && !existing) throw new ApiError(404, 'المنتج غير موجود')
      const name = (input.name || '').trim()
      if (name.length < 2) throw new ApiError(400, 'يرجى كتابة اسم المنتج')
      if (!Number.isInteger(input.price) || input.price < 0) throw new ApiError(400, 'السعر غير صحيح')
      if (input.salePrice != null && (input.salePrice < 0 || input.salePrice >= input.price)) {
        throw new ApiError(400, 'سعر التخفيض يجب أن يكون أقل من السعر الأساسي')
      }
      if (input.type === 'bundle' && existing && existing.type !== 'bundle') {
        // مسموح، لكن نتأكد أنه ليس مكوناً في باقة أخرى
      }

      let sku = normalizeSkuInput(input.sku)
      if (existing && !sku) sku = existing.sku
      if (!sku) sku = newSku()
      if (skuTaken(sku, existing?.id)) throw new ApiError(409, `رقم المنتج ${sku} مستخدم لمنتج آخر`)

      const slug = uniqueSlug(input.slug?.trim() || name, existing?.id)
      const options = (input.options || [])
        .map((o) => ({
          name: (o.name || '').trim().slice(0, 40),
          kind: o.kind,
          values: (o.values || [])
            .map((v) => ({ value: (v.value || '').trim().slice(0, 40), ...(v.color ? { color: v.color } : {}) }))
            .filter((v) => v.value),
        }))
        .filter((o) => o.name && o.values.length)
        .slice(0, 3)

      if (input.type === 'variable') {
        if (!options.length) throw new ApiError(400, 'أضف خياراً واحداً على الأقل (مثل المقاس أو اللون) للمنتج متعدد الخيارات')
        if (!input.variants?.length) throw new ApiError(400, 'أنشئ تركيبات الخيارات (المقاسات/الألوان) مع المخزون لكل منها')
      }
      const personalization = input.personalization?.enabled
        ? {
            enabled: true,
            label: (input.personalization.label || 'اسم المولود').slice(0, 40),
            placeholder: (input.personalization.placeholder || '').slice(0, 60),
            maxLength: Math.max(1, Math.min(60, Math.floor(input.personalization.maxLength || 15))),
            fee: Math.max(0, Math.floor(input.personalization.fee || 0)),
            extraDays: Math.max(0, Math.min(60, Math.floor(input.personalization.extraDays || 0))),
            required: !!input.personalization.required,
            help: (input.personalization.help || '').slice(0, 200),
          }
        : null
      const now = nowSql()
      const trackStock = input.type === 'bundle' ? 0 : input.trackStock ? 1 : 0
      const cols = {
        type: input.type,
        sku,
        name: name.slice(0, 150),
        slug,
        short_description: t(input.shortDescription, 500),
        description: t(input.description, 20000),
        category_id: input.categoryId || null,
        status: input.status,
        price: input.price,
        sale_price: input.salePrice ?? null,
        sale_starts_at: input.salePrice != null ? input.saleStartsAt || null : null,
        sale_ends_at: input.salePrice != null ? input.saleEndsAt || null : null,
        track_stock: trackStock,
        manual_availability: input.manualAvailability || 'in_stock',
        low_stock_threshold: input.lowStockThreshold ?? null,
        max_per_order: input.maxPerOrder ?? null,
        options: JSON.stringify(input.type === 'variable' ? options : []),
        material: t(input.material, 500),
        care_instructions: t(input.careInstructions, 2000),
        size_guide_id: input.sizeGuideId || null,
        set_contents: JSON.stringify((input.setContents || []).map((s) => s.trim().slice(0, 120)).filter(Boolean).slice(0, 30)),
        pieces_count: input.piecesCount ?? null,
        prep_days_min: input.prepDaysMin ?? null,
        prep_days_max: input.prepDaysMax ?? null,
        gift_wrap_eligible: input.giftWrapEligible === false ? 0 : 1,
        personalization: personalization ? JSON.stringify(personalization) : null,
        seo_title: t(input.seoTitle, 120),
        seo_description: t(input.seoDescription, 300),
        updated_at: now,
      }
      let id: number
      if (existing) {
        id = existing.id
        const sets = Object.keys(cols).map((k) => `${k}=@${k}`).join(', ')
        d.prepare(`UPDATE products SET ${sets}, published_at=COALESCE(published_at, CASE WHEN @status='published' THEN @updated_at END) WHERE id=@id`).run({ ...cols, id })
      } else {
        const keys = Object.keys(cols)
        id = Number(
          d
            .prepare(`INSERT INTO products(${keys.join(',')}, stock, is_demo, created_at, published_at) VALUES(${keys.map((k) => '@' + k).join(',')}, 0, @is_demo, @updated_at, CASE WHEN @status='published' THEN @updated_at END)`)
            .run({ ...cols, is_demo: input.isDemo ? 1 : 0 }).lastInsertRowid,
        )
      }

      // المخزون للمنتج البسيط
      if (input.type === 'simple' && trackStock) {
        const target = Math.max(0, Math.floor(input.stock || 0))
        const cur = (d.prepare('SELECT stock FROM products WHERE id=?').get(id) as { stock: number }).stock
        if (target !== cur) {
          adjustStock({ productId: id, variantId: null, change: target - cur, reason: input.stockReason || (existing ? 'edit' : 'initial'), actor, note: input.stockNote || null, allowNegative: true })
        }
      }

      // الخيارات (Variants)
      if (input.type === 'variable') {
        const current = d.prepare('SELECT * FROM variants WHERE product_id=?').all(id) as VariantRow[]
        const keep = new Set<number>()
        const seenCombos = new Set<string>()
        const usedSkus = new Set<string>()
        input.variants!.forEach((v, i) => {
          const vals = [0, 1, 2].map((k) => (options[k] ? (v.options[k] || '').trim() || null : null))
          options.forEach((o, k) => {
            if (!vals[k] || !o.values.some((x) => x.value === vals[k])) throw new ApiError(400, `قيمة الخيار «${o.name}» غير محددة في أحد الأسطر`)
          })
          const combo = vals.join('|')
          if (seenCombos.has(combo)) throw new ApiError(400, `التركيبة ${vals.filter(Boolean).join(' / ')} مكررة`)
          seenCombos.add(combo)
          if (v.price != null && v.price < 0) throw new ApiError(400, 'سعر أحد الخيارات غير صحيح')
          const vPrice = v.price ?? null
          const effective = vPrice ?? input.price
          if (v.salePrice != null && v.salePrice >= effective) throw new ApiError(400, `سعر التخفيض للخيار ${vals.filter(Boolean).join(' / ')} يجب أن يكون أقل من سعره`)
          const prev = v.id ? current.find((c) => c.id === v.id) : undefined
          const explicit = normalizeSkuInput(v.sku)
          let vsku: string
          if (explicit && explicit !== prev?.sku) {
            if (explicit === sku || usedSkus.has(explicit) || skuTaken(explicit, null, prev?.id ?? null)) {
              throw new ApiError(409, `رقم الخيار ${explicit} مستخدم مسبقاً`)
            }
            vsku = explicit
          } else if (prev) {
            vsku = prev.sku
          } else {
            let n = i + 1
            vsku = `${sku}-${String(n).padStart(2, '0')}`
            while (usedSkus.has(vsku) || skuTaken(vsku)) vsku = `${sku}-${String(++n).padStart(2, '0')}`
          }
          usedSkus.add(vsku)
          const stock = Math.max(0, Math.floor(v.stock || 0))
          if (prev) {
            d.prepare('UPDATE variants SET sku=?, option1=?, option2=?, option3=?, price=?, sale_price=?, active=?, sort=? WHERE id=?').run(
              vsku, vals[0], vals[1], vals[2], vPrice, v.salePrice ?? null, v.active ? 1 : 0, i, prev.id,
            )
            keep.add(prev.id)
            if (trackStock && stock !== prev.stock) {
              adjustStock({ productId: id, variantId: prev.id, change: stock - prev.stock, reason: input.stockReason || 'edit', actor, note: input.stockNote || null, allowNegative: true })
            }
          } else {
            const vid = Number(
              d
                .prepare('INSERT INTO variants(product_id,sku,option1,option2,option3,price,sale_price,stock,active,sort) VALUES(?,?,?,?,?,?,?,0,?,?)')
                .run(id, vsku, vals[0], vals[1], vals[2], vPrice, v.salePrice ?? null, v.active ? 1 : 0, i).lastInsertRowid,
            )
            keep.add(vid)
            if (trackStock && stock > 0) adjustStock({ productId: id, variantId: vid, change: stock, reason: input.stockReason || 'initial', actor, note: input.stockNote || null, allowNegative: true })
          }
        })
        for (const c of current) {
          if (keep.has(c.id)) continue
          const held = d.prepare('SELECT 1 FROM order_stock_lines WHERE variant_id=? AND deducted>0 LIMIT 1').get(c.id)
          const inBundle = d.prepare('SELECT 1 FROM bundle_items WHERE variant_id=? LIMIT 1').get(c.id)
          if (held || inBundle) d.prepare('UPDATE variants SET active=0 WHERE id=?').run(c.id)
          else d.prepare('DELETE FROM variants WHERE id=?').run(c.id)
        }
      }

      // الصور
      if (input.images) {
        d.prepare('DELETE FROM product_images WHERE product_id=?').run(id)
        const ins = d.prepare('INSERT INTO product_images(product_id,media_id,alt,option_value,sort) VALUES(?,?,?,?,?)')
        input.images.slice(0, 30).forEach((im, i) => {
          const m = d.prepare("SELECT id FROM media WHERE id=? AND kind='public'").get(im.mediaId)
          if (m) ins.run(id, im.mediaId, t(im.alt, 200), t(im.optionValue, 40), i)
        })
      }

      // الوسوم
      if (input.tagIds) {
        d.prepare('DELETE FROM product_tags WHERE product_id=?').run(id)
        const ins = d.prepare('INSERT OR IGNORE INTO product_tags(product_id,tag_id) VALUES(?,?)')
        for (const tid of input.tagIds) if (d.prepare('SELECT 1 FROM tags WHERE id=?').get(tid)) ins.run(id, tid)
      }

      // المنتجات المرتبطة والمكملة
      for (const [kind, ids] of [['related', input.relatedIds], ['complementary', input.complementaryIds]] as const) {
        if (!ids) continue
        d.prepare('DELETE FROM product_relations WHERE product_id=? AND kind=?').run(id, kind)
        const ins = d.prepare('INSERT OR IGNORE INTO product_relations(product_id,related_id,kind,sort) VALUES(?,?,?,?)')
        ids.filter((x) => x !== id).slice(0, 20).forEach((rid, i) => {
          if (d.prepare('SELECT 1 FROM products WHERE id=?').get(rid)) ins.run(id, rid, kind, i)
        })
      }

      // مكونات الباقة
      if (input.type === 'bundle') {
        const items = (input.bundleItems || []).filter((b) => b.productId && b.qty > 0)
        if (!items.length) throw new ApiError(400, 'أضف منتجات الباقة (مكون واحد على الأقل)')
        d.prepare('DELETE FROM bundle_items WHERE bundle_id=?').run(id)
        const ins = d.prepare('INSERT INTO bundle_items(bundle_id,product_id,variant_id,qty,sort) VALUES(?,?,?,?,?)')
        items.slice(0, 20).forEach((b, i) => {
          const p = getProductRow(b.productId)
          if (!p) throw new ApiError(400, 'أحد مكونات الباقة غير موجود')
          if (p.type === 'bundle') throw new ApiError(400, 'لا يمكن وضع باقة داخل باقة أخرى')
          if (p.id === id) throw new ApiError(400, 'لا يمكن أن تحتوي الباقة على نفسها')
          let vid: number | null = null
          if (b.variantId) {
            const v = d.prepare('SELECT id FROM variants WHERE id=? AND product_id=?').get(b.variantId, p.id) as { id: number } | undefined
            if (!v) throw new ApiError(400, `الخيار المحدد لا يتبع المنتج «${p.name}»`)
            vid = v.id
          }
          ins.run(id, p.id, vid, Math.min(50, Math.floor(b.qty)), i)
        })
      } else {
        d.prepare('DELETE FROM bundle_items WHERE bundle_id=?').run(id)
      }

      refreshSearchText(id)
      invalidateCatalog()
      return id
    })
    .immediate()
}

/** تحويل منتج محفوظ إلى بيانات المحرر */
export function productToInput(id: number): ProductInput | null {
  const d = db()
  const p = getProductRow(id)
  if (!p) return null
  const variants = d.prepare('SELECT * FROM variants WHERE product_id=? ORDER BY sort, id').all(id) as VariantRow[]
  const images = d.prepare('SELECT media_id, alt, option_value FROM product_images WHERE product_id=? ORDER BY sort, id').all(id) as {
    media_id: number; alt: string | null; option_value: string | null
  }[]
  const tags = (d.prepare('SELECT tag_id FROM product_tags WHERE product_id=?').all(id) as { tag_id: number }[]).map((r) => r.tag_id)
  const rel = d.prepare('SELECT related_id, kind FROM product_relations WHERE product_id=? ORDER BY sort').all(id) as { related_id: number; kind: string }[]
  const bundle = d.prepare('SELECT product_id, variant_id, qty FROM bundle_items WHERE bundle_id=? ORDER BY sort, id').all(id) as {
    product_id: number; variant_id: number | null; qty: number
  }[]
  return {
    id: p.id,
    type: p.type,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.short_description,
    description: p.description,
    categoryId: p.category_id,
    tagIds: tags,
    status: p.status,
    price: p.price,
    salePrice: p.sale_price,
    saleStartsAt: p.sale_starts_at,
    saleEndsAt: p.sale_ends_at,
    trackStock: !!p.track_stock,
    stock: p.stock,
    manualAvailability: p.manual_availability,
    lowStockThreshold: p.low_stock_threshold,
    maxPerOrder: p.max_per_order,
    options: parseJson<ProductOption[]>(p.options, []),
    variants: variants.map((v) => ({ id: v.id, sku: v.sku, options: [v.option1, v.option2, v.option3], price: v.price, salePrice: v.sale_price, stock: v.stock, active: !!v.active })),
    images: images.map((i) => ({ mediaId: i.media_id, alt: i.alt, optionValue: i.option_value })),
    material: p.material,
    careInstructions: p.care_instructions,
    sizeGuideId: p.size_guide_id,
    setContents: parseJson<string[]>(p.set_contents, []),
    piecesCount: p.pieces_count,
    prepDaysMin: p.prep_days_min,
    prepDaysMax: p.prep_days_max,
    giftWrapEligible: !!p.gift_wrap_eligible,
    personalization: parseJson<Personalization | null>(p.personalization, null),
    relatedIds: rel.filter((r) => r.kind === 'related').map((r) => r.related_id),
    complementaryIds: rel.filter((r) => r.kind === 'complementary').map((r) => r.related_id),
    bundleItems: bundle.map((b) => ({ productId: b.product_id, variantId: b.variant_id, qty: b.qty })),
    seoTitle: p.seo_title,
    seoDescription: p.seo_description,
    isDemo: !!p.is_demo,
  }
}

/** نسخ منتج: رقم جديد، رابط جديد، حالة مسودة، ومخزون صفري */
export function duplicateProduct(id: number, actor: Actor): number {
  const src = productToInput(id)
  if (!src) throw new ApiError(404, 'المنتج غير موجود')
  return saveProduct(
    {
      ...src,
      id: null,
      name: `${src.name} (نسخة)`,
      slug: null,
      sku: null,
      status: 'draft',
      stock: 0,
      isDemo: false,
      variants: src.variants?.map((v) => ({ ...v, id: null, sku: null, stock: 0 })),
    },
    actor,
  )
}

export function bulkUpdateProducts(
  ids: number[],
  op: { status?: 'draft' | 'published' | 'archived'; categoryId?: number | null; priceMode?: 'percent' | 'set' | 'add'; priceValue?: number; clearSale?: boolean; salePercent?: number },
) {
  const d = db()
  const cur = getSetting('store').currency
  const step = Math.pow(10, Math.max(0, 2 - cur.decimals))
  const round = (c: number) => Math.max(0, Math.round(c / step) * step)
  d.transaction(() => {
    for (const id of ids) {
      const p = getProductRow(id)
      if (!p) continue
      if (op.status) d.prepare("UPDATE products SET status=?, updated_at=datetime('now'), published_at=COALESCE(published_at, CASE WHEN ?='published' THEN datetime('now') END) WHERE id=?").run(op.status, op.status, id)
      if (op.categoryId !== undefined) d.prepare('UPDATE products SET category_id=? WHERE id=?').run(op.categoryId, id)
      if (op.priceMode && op.priceValue != null) {
        const calc = (price: number) =>
          op.priceMode === 'percent' ? round(price * (1 + op.priceValue! / 100)) : op.priceMode === 'add' ? round(price + op.priceValue!) : round(op.priceValue!)
        const np = calc(p.price)
        d.prepare('UPDATE products SET price=?, sale_price=CASE WHEN sale_price IS NOT NULL AND sale_price>=? THEN NULL ELSE sale_price END WHERE id=?').run(np, np, id)
        const vs = d.prepare('SELECT id, price FROM variants WHERE product_id=? AND price IS NOT NULL').all(id) as { id: number; price: number }[]
        for (const v of vs) {
          const vp = calc(v.price)
          d.prepare('UPDATE variants SET price=?, sale_price=CASE WHEN sale_price IS NOT NULL AND sale_price>=? THEN NULL ELSE sale_price END WHERE id=?').run(vp, vp, v.id)
        }
      }
      if (op.clearSale) {
        d.prepare('UPDATE products SET sale_price=NULL, sale_starts_at=NULL, sale_ends_at=NULL WHERE id=?').run(id)
        d.prepare('UPDATE variants SET sale_price=NULL WHERE product_id=?').run(id)
      } else if (op.salePercent && op.salePercent > 0 && op.salePercent < 100) {
        const fresh = getProductRow(id)!
        d.prepare('UPDATE products SET sale_price=? WHERE id=?').run(round(fresh.price * (1 - op.salePercent / 100)), id)
        const vs = d.prepare('SELECT id, price FROM variants WHERE product_id=? AND price IS NOT NULL').all(id) as { id: number; price: number }[]
        for (const v of vs) d.prepare('UPDATE variants SET sale_price=? WHERE id=?').run(round(v.price * (1 - op.salePercent / 100)), v.id)
      }
      refreshSearchText(id)
    }
  })()
  invalidateCatalog()
}

/** حذف جميع البيانات التجريبية (منتجات، صور، مناطق، كوبونات، أدلة مقاسات) */
export function deleteDemoData(): { products: number } {
  const d = db()
  let count = 0
  d.transaction(() => {
    const demo = d.prepare('SELECT id, type FROM products WHERE is_demo=1').all() as { id: number; type: string }[]
    const ids = demo.map((x) => x.id)
    if (ids.length) {
      const ph = ids.map(() => '?').join(',')
      // باقات حقيقية تحتوي مكونات تجريبية: نزيل المكون منها
      d.prepare(`DELETE FROM bundle_items WHERE product_id IN (${ph})`).run(...ids)
      d.prepare(`DELETE FROM products WHERE id IN (${ph}) AND type='bundle'`).run(...ids)
      d.prepare(`DELETE FROM products WHERE id IN (${ph})`).run(...ids)
      count = ids.length
    }
    d.prepare('DELETE FROM shipping_zones WHERE is_demo=1').run()
    d.prepare('DELETE FROM coupons WHERE is_demo=1').run()
    d.prepare('UPDATE products SET size_guide_id=NULL WHERE size_guide_id IN (SELECT id FROM size_guides WHERE is_demo=1)').run()
    d.prepare('DELETE FROM size_guides WHERE is_demo=1').run()
    d.prepare('UPDATE categories SET image_id=NULL WHERE image_id IN (SELECT id FROM media WHERE is_demo=1)').run()
    d.prepare('UPDATE tags SET image_id=NULL WHERE image_id IN (SELECT id FROM media WHERE is_demo=1)').run()
    d.prepare('UPDATE gift_wraps SET image_id=NULL WHERE image_id IN (SELECT id FROM media WHERE is_demo=1)').run()
  })()
  // حذف ملفات الصور التجريبية غير المستخدمة
  const appearanceJson = (d.prepare('SELECT data FROM appearance_versions').all() as { data: string }[]).map((r) => r.data).join(' ')
  const media = d
    .prepare(
      `SELECT * FROM media WHERE is_demo=1 AND id NOT IN (SELECT media_id FROM product_images)
       AND id NOT IN (SELECT image_id FROM categories WHERE image_id IS NOT NULL)
       AND id NOT IN (SELECT image_id FROM tags WHERE image_id IS NOT NULL)`,
    )
    .all() as MediaRow[]
  for (const m of media) {
    if (new RegExp(`"(imageDesktopId|imageMobileId|logoId|faviconId|customFontId)":${m.id}[,}]`).test(appearanceJson)) continue
    deleteMediaFiles(m)
    d.prepare('DELETE FROM media WHERE id=?').run(m.id)
  }
  invalidateCatalog()
  return { products: count }
}

export type { ProductRow }
