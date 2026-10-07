import { db, parseJson, sqlToDate } from './db'
import { bumpCacheVersion, ensureFresh, onInvalidate } from './cache'
import { getMedia, getMediaMap, imageRef, type MediaRow } from './media'
import { getSetting } from './settings'
import { normalizeArabic } from '../shared/arabic'
import type {
  BundleComponentPublic,
  ImageRef,
  Personalization,
  ProductCard,
  ProductDetail,
  ProductOption,
  RailItem,
  VariantPublic,
} from '../shared/types'

export const UNLIMITED = 9999
const NEW_DAYS = 30

export type ProductRow = {
  id: number
  type: 'simple' | 'variable' | 'bundle'
  sku: string
  name: string
  slug: string
  short_description: string | null
  description: string | null
  category_id: number | null
  status: 'draft' | 'published' | 'archived'
  price: number
  sale_price: number | null
  sale_starts_at: string | null
  sale_ends_at: string | null
  track_stock: number
  stock: number
  manual_availability: 'in_stock' | 'out_of_stock'
  low_stock_threshold: number | null
  max_per_order: number | null
  options: string
  material: string | null
  care_instructions: string | null
  size_guide_id: number | null
  set_contents: string
  pieces_count: number | null
  prep_days_min: number | null
  prep_days_max: number | null
  gift_wrap_eligible: number
  personalization: string | null
  seo_title: string | null
  seo_description: string | null
  search_text: string
  is_demo: number
  created_at: string
  updated_at: string
  published_at: string | null
}

export type VariantRow = {
  id: number
  product_id: number
  sku: string
  option1: string | null
  option2: string | null
  option3: string | null
  price: number | null
  sale_price: number | null
  stock: number
  active: number
  sort: number
}

export type BundleItemRow = { id: number; bundle_id: number; product_id: number; variant_id: number | null; qty: number; sort: number }

// ===== الأسعار والتوفر =====

export function saleActive(p: Pick<ProductRow, 'sale_starts_at' | 'sale_ends_at'>, now = new Date()): boolean {
  const s = sqlToDate(p.sale_starts_at)
  const e = sqlToDate(p.sale_ends_at)
  if (s && s > now) return false
  if (e && e < now) return false
  return true
}

export function productPrice(p: ProductRow, now = new Date()): { price: number; compareAt: number | null } {
  if (p.sale_price != null && p.sale_price < p.price && saleActive(p, now)) return { price: p.sale_price, compareAt: p.price }
  return { price: p.price, compareAt: null }
}

export function variantPrice(p: ProductRow, v: VariantRow, now = new Date()): { price: number; compareAt: number | null } {
  if (v.price == null) return productPrice(p, now)
  if (v.sale_price != null && v.sale_price < v.price && saleActive(p, now)) return { price: v.sale_price, compareAt: v.price }
  return { price: v.price, compareAt: null }
}

export function simpleAvailable(p: ProductRow): number {
  if (!p.track_stock) return p.manual_availability === 'in_stock' ? UNLIMITED : 0
  return Math.max(0, p.stock)
}

export function variantAvailable(p: ProductRow, v: VariantRow): number {
  if (!v.active) return 0
  if (!p.track_stock) return p.manual_availability === 'in_stock' ? UNLIMITED : 0
  return Math.max(0, v.stock)
}

// ===== تحميل البيانات =====

export async function getProductRow(id: number): Promise<ProductRow | undefined> {
  return await db().prepare('SELECT * FROM products WHERE id=?').get(id) as ProductRow | undefined
}

export async function getVariants(productId: number): Promise<VariantRow[]> {
  return await db().prepare('SELECT * FROM variants WHERE product_id=? ORDER BY sort, id').all(productId) as VariantRow[]
}

export async function getBundleItems(bundleId: number): Promise<BundleItemRow[]> {
  return await db().prepare('SELECT * FROM bundle_items WHERE bundle_id=? ORDER BY sort, id').all(bundleId) as BundleItemRow[]
}

type ImgRow = { product_id: number; media_id: number; alt: string | null; option_value: string | null; role: string | null }

/** صور المنتجات للبطاقات والمعرض (صور الشماعة المخصصة لا تظهر فيها) */
async function productImages(productIds: number[]): Promise<Map<number, ImageRef[]>> {
  const map = new Map<number, ImageRef[]>()
  if (!productIds.length) return map
  const rows = await db()
    .prepare(
      `SELECT pi.product_id, pi.media_id, pi.alt, pi.option_value, pi.role, m.* FROM product_images pi JOIN media m ON m.id=pi.media_id
       WHERE pi.product_id IN (${productIds.map(() => '?').join(',')}) AND pi.role IS DISTINCT FROM 'rail' ORDER BY pi.product_id, pi.sort, pi.id`,
    )
    .all(...productIds) as (ImgRow & MediaRow)[]
  for (const r of rows) {
    const ref = imageRef({ ...r, id: r.media_id }, r.alt || '', r.option_value, 640)
    if (!ref) continue
    if (!map.has(r.product_id)) map.set(r.product_id, [])
    map.get(r.product_id)!.push(ref)
  }
  return map
}

/**
 * عناصر قسم «على الشماعة»: صورة الأمام (صورة الشماعة إن وُجدت، وإلا الصورة الرئيسية) وصورة الخلف إن حُددت.
 * productIds فارغة = أحدث المنتجات المنشورة.
 */
export async function railItems(productIds: number[], limit: number): Promise<RailItem[]> {
  const idx = await catalogIndex()
  const max = Math.max(1, Math.min(24, limit || 10))
  const chosen = productIds.length
    ? productIds.map((id) => idx.byId.get(id)).filter((x): x is IndexedProduct => !!x)
    : [...idx.items].sort((a, b) => Number(b.card.available) - Number(a.card.available) || b.createdAt - a.createdAt)
  const list = chosen.slice(0, max * 2)
  if (!list.length) return []
  const ids = list.map((x) => x.row.id)
  const rows = await db()
    .prepare(
      `SELECT pi.product_id, pi.media_id, pi.alt, pi.option_value, pi.role, m.* FROM product_images pi JOIN media m ON m.id=pi.media_id
       WHERE pi.product_id IN (${ids.map(() => '?').join(',')}) ORDER BY pi.product_id, pi.sort, pi.id`,
    )
    .all<ImgRow & MediaRow>(...ids)
  const byProduct = new Map<number, (ImgRow & MediaRow)[]>()
  for (const r of rows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, [])
    byProduct.get(r.product_id)!.push(r)
  }
  const items: RailItem[] = []
  for (const x of list) {
    const imgs = byProduct.get(x.row.id) || []
    const railPhoto = imgs.find((r) => r.role === 'rail_photo')
    const rail = railPhoto ? null : imgs.find((r) => r.role === 'rail')
    const front = railPhoto || rail || imgs.find((r) => r.role !== 'back') || imgs[0]
    const frontRef = front ? imageRef({ ...front, id: front.media_id }, front.alt || x.card.name, null, 800) : null
    if (!frontRef) continue
    const nc = x.colors.length
    const colors = nc === 2 ? 'لونان' : nc > 10 ? `${nc} لوناً` : nc > 2 ? `${nc} ألوان` : x.colors[0] || ''
    items.push({
      id: x.row.id,
      slug: x.card.slug,
      name: x.card.name,
      subtitle: [x.card.categoryName, colors].filter(Boolean).join(' · '),
      price: x.card.price,
      compareAt: x.card.compareAt,
      priceFrom: x.card.priceFrom,
      available: x.card.available,
      front: frontRef,
      hanger: railPhoto ? 'photo' : rail ? 'cutout' : 'card',
      isDemo: x.card.isDemo,
    })
    if (items.length >= max) break
  }
  return items
}

// ===== فهرس الكتالوج (في الذاكرة لسرعة التصفية والبحث) =====

export type IndexedProduct = {
  row: ProductRow
  card: ProductCard
  categoryId: number | null
  tagIds: number[]
  sizes: string[]
  colors: string[]
  variantCombos: { size: string | null; color: string | null; available: number }[]
  search: string
  onSale: boolean
  createdAt: number
}

type IndexCache = { builtAt: number; items: IndexedProduct[]; byId: Map<number, IndexedProduct> }
const g = globalThis as unknown as { __catalogIndex?: IndexCache }

/** يُستدعى بعد أي تعديل على المنتجات أو الأقسام أو المخزون */
export async function invalidateCatalog() {
  g.__catalogIndex = undefined
  await bumpCacheVersion()
}
onInvalidate(() => {
  g.__catalogIndex = undefined
})

function optionIndexOf(options: ProductOption[], kind: 'size' | 'color'): number {
  return options.findIndex((o) => o.kind === kind)
}

export async function buildIndex(): Promise<IndexCache> {
  const d = db()
  const now = new Date()
  const rows = await d.prepare("SELECT * FROM products WHERE status='published'").all() as ProductRow[]
  const ids = rows.map((r) => r.id)
  const imgs = await productImages(ids)
  const variants = await d.prepare("SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE p.status='published' ORDER BY v.sort, v.id").all() as VariantRow[]
  const varMap = new Map<number, VariantRow[]>()
  for (const v of variants) {
    if (!varMap.has(v.product_id)) varMap.set(v.product_id, [])
    varMap.get(v.product_id)!.push(v)
  }
  const tagRows = await d.prepare('SELECT product_id, tag_id FROM product_tags').all() as { product_id: number; tag_id: number }[]
  const tagMap = new Map<number, number[]>()
  for (const t of tagRows) {
    if (!tagMap.has(t.product_id)) tagMap.set(t.product_id, [])
    tagMap.get(t.product_id)!.push(t.tag_id)
  }
  const cats = new Map<number, { name: string; visible: number }>(
    (await d.prepare('SELECT id, name, visible FROM categories').all() as { id: number; name: string; visible: number }[]).map((c) => [c.id, c]),
  )
  const lowGlobal = (await getSetting('inventory')).lowStockThreshold
  const showLow = (await getSetting('inventory')).showLowStockToCustomers
  const allRowsById = new Map(rows.map((r) => [r.id, r]))

  const items: IndexedProduct[] = []
  const byId = new Map<number, IndexedProduct>()

  // التوفر للمكونات قد يحتاج منتجات غير منشورة (مكونات الباقات)
  const componentRow = async (id: number) => allRowsById.get(id) || await getProductRow(id)
  const componentVariants = async (id: number) => varMap.get(id) || await getVariants(id)

  for (const r of rows) {
    const options = parseJson<ProductOption[]>(r.options, [])
    const vs = varMap.get(r.id) || []
    let price: number
    let compareAt: number | null
    let priceFrom = false
    let available = 0
    const sizeIdx = optionIndexOf(options, 'size')
    const colorIdx = optionIndexOf(options, 'color')
    const combos: IndexedProduct['variantCombos'] = []

    if (r.type === 'variable' && vs.length) {
      const active = vs.filter((v) => v.active)
      const priced = active.map((v) => ({ v, ...variantPrice(r, v, now), avail: variantAvailable(r, v) }))
      const minP = priced.length ? Math.min(...priced.map((x) => x.price)) : r.price
      const cheapest = priced.find((x) => x.price === minP)
      price = minP
      compareAt = cheapest?.compareAt ?? null
      priceFrom = new Set(priced.map((x) => x.price)).size > 1
      available = priced.reduce((s, x) => Math.min(UNLIMITED, s + x.avail), 0)
      for (const x of priced) {
        const vals = [x.v.option1, x.v.option2, x.v.option3]
        combos.push({ size: sizeIdx >= 0 ? vals[sizeIdx] : null, color: colorIdx >= 0 ? vals[colorIdx] : null, available: x.avail })
      }
    } else if (r.type === 'bundle') {
      ;({ price, compareAt } = productPrice(r, now))
      available = r.manual_availability === 'in_stock' ? await bundleAvailability(r.id, componentRow, componentVariants) : 0
    } else {
      ;({ price, compareAt } = productPrice(r, now))
      available = simpleAvailable(r)
    }

    const colorsSeen = new Map<string, { value: string; color?: string }>()
    if (colorIdx >= 0) for (const v of options[colorIdx].values) colorsSeen.set(v.value, v)
    const sizes = sizeIdx >= 0 ? options[sizeIdx].values.map((v) => v.value) : []
    const threshold = r.low_stock_threshold ?? lowGlobal
    const card: ProductCard = {
      id: r.id,
      slug: r.slug,
      sku: r.sku,
      name: r.name,
      type: r.type,
      price,
      compareAt,
      priceFrom,
      images: (imgs.get(r.id) || []).slice(0, 2),
      available: available > 0,
      lowStock: showLow && available > 0 && available < UNLIMITED && available <= threshold ? available : null,
      colors: Array.from(colorsSeen.values()).slice(0, 6),
      isNew: now.getTime() - (sqlToDate(r.published_at || r.created_at)?.getTime() || 0) < NEW_DAYS * 864e5,
      isDemo: !!r.is_demo,
      categoryName: r.category_id ? cats.get(r.category_id)?.name || null : null,
    }
    const item: IndexedProduct = {
      row: r,
      card,
      categoryId: r.category_id,
      tagIds: tagMap.get(r.id) || [],
      sizes,
      colors: Array.from(colorsSeen.keys()),
      variantCombos: combos,
      search: r.search_text,
      onSale: compareAt != null,
      createdAt: sqlToDate(r.published_at || r.created_at)?.getTime() || 0,
    }
    items.push(item)
    byId.set(r.id, item)
  }
  const cache = { builtAt: Date.now(), items, byId }
  g.__catalogIndex = cache
  return cache
}

let building: Promise<IndexCache> | null = null
export async function catalogIndex(): Promise<IndexCache> {
  await ensureFresh()
  const c = g.__catalogIndex
  if (c && Date.now() - c.builtAt < 60_000) return c
  // طلبات متزامنة تنتظر نفس عملية البناء
  if (!building) building = buildIndex().finally(() => (building = null))
  return building
}

/** أقصى عدد باقات يمكن تكوينه من مخزون المكونات (أفضل حالة عند وجود خيارات) */
export async function bundleAvailability(
  bundleId: number,
  rowOf: (id: number) => Promise<ProductRow | undefined> = getProductRow,
  variantsOf: (id: number) => Promise<VariantRow[]> = getVariants,
): Promise<number> {
  const items = await getBundleItems(bundleId)
  if (!items.length) return 0
  let min = UNLIMITED
  for (const it of items) {
    const p = await rowOf(it.product_id)
    if (!p || p.status === 'archived') return 0
    let avail: number
    if (p.type === 'variable') {
      const vs = await variantsOf(p.id)
      if (it.variant_id) {
        const v = vs.find((x) => x.id === it.variant_id)
        avail = v ? variantAvailable(p, v) : 0
      } else {
        avail = vs.reduce((m, v) => Math.max(m, variantAvailable(p, v)), 0)
      }
    } else {
      avail = simpleAvailable(p)
    }
    min = Math.min(min, Math.floor(avail / it.qty))
  }
  return min
}

// ===== تفاصيل المنتج =====

export async function getProductDetailBySlug(slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<ProductDetail | null> {
  const row = await db().prepare('SELECT * FROM products WHERE slug=?').get(slug) as ProductRow | undefined
  if (!row) return null
  if (row.status !== 'published' && !opts.includeUnpublished) return null
  return buildDetail(row)
}

export async function getProductDetailById(id: number, opts: { includeUnpublished?: boolean } = {}): Promise<ProductDetail | null> {
  const row = await getProductRow(id)
  if (!row) return null
  if (row.status !== 'published' && !opts.includeUnpublished) return null
  return buildDetail(row)
}

function variantsPublic(p: ProductRow, vs: VariantRow[], now: Date): VariantPublic[] {
  return vs.map((v) => {
    const pr = variantPrice(p, v, now)
    return {
      id: v.id,
      sku: v.sku,
      options: [v.option1, v.option2, v.option3],
      price: pr.price,
      compareAt: pr.compareAt,
      available: variantAvailable(p, v),
      active: !!v.active,
    }
  })
}

export function parsePersonalization(s: string | null): Personalization | null {
  const p = parseJson<Personalization | null>(s, null)
  if (!p || !p.enabled) return null
  return {
    enabled: true,
    label: p.label || 'اسم المولود',
    placeholder: p.placeholder || '',
    maxLength: Math.max(1, Math.min(60, Number(p.maxLength) || 15)),
    fee: Math.max(0, Number(p.fee) || 0),
    extraDays: Math.max(0, Number(p.extraDays) || 0),
    required: !!p.required,
    help: p.help || '',
  }
}

export async function buildDetail(row: ProductRow): Promise<ProductDetail> {
  const d = db()
  const now = new Date()
  const idx = (await catalogIndex()).byId.get(row.id)
  const images = (await productImages([row.id])).get(row.id) || []
  const mediaMap = await getMediaMap(images.map((im) => im.id))
  const fullImages = images.map((im) => imageRef(mediaMap.get(im.id), im.alt, im.optionValue, 1080) || im)
  const options = parseJson<ProductOption[]>(row.options, [])
  const vs = row.type === 'variable' ? await getVariants(row.id) : []
  const variants = variantsPublic(row, vs, now)
  const { price, compareAt } = row.type === 'variable' && idx ? { price: idx.card.price, compareAt: idx.card.compareAt } : productPrice(row, now)

  let components: BundleComponentPublic[] = []
  let bundleValue: number | null = null
  if (row.type === 'bundle') {
    const items = await getBundleItems(row.id)
    const compImgs = await productImages(items.map((i) => i.product_id))
    let value = 0
    const compRows = new Map<number, { p: ProductRow; vs: VariantRow[] }>()
    for (const it of items) {
      const p = await getProductRow(it.product_id)
      if (p) compRows.set(it.product_id, { p, vs: p.type === 'variable' ? await getVariants(p.id) : [] })
    }
    components = items
      .map((it) => {
        const c = compRows.get(it.product_id)
        if (!c) return null
        const { p, vs: pvs } = c
        const vp = variantsPublic(p, pvs, now)
        const fixed = it.variant_id ? vp.find((v) => v.id === it.variant_id) : null
        const unit = fixed ? fixed.price : p.type === 'variable' && vp.length ? Math.min(...vp.filter((v) => v.active).map((v) => v.price)) : productPrice(p, now).price
        value += unit * it.qty
        return {
          id: it.id,
          productId: p.id,
          name: p.name,
          slug: p.slug,
          sku: fixed?.sku || p.sku,
          qty: it.qty,
          image: compImgs.get(p.id)?.[0] || null,
          options: parseJson<ProductOption[]>(p.options, []),
          fixedVariantId: it.variant_id,
          variants: vp,
          simpleAvailable: p.type === 'variable' ? 0 : simpleAvailable(p),
          type: p.type === 'variable' ? 'variable' : 'simple',
          unitValue: unit,
        } as BundleComponentPublic
      })
      .filter(Boolean) as BundleComponentPublic[]
    bundleValue = value > price ? value : null
  }

  const sg = row.size_guide_id
    ? (await d.prepare('SELECT * FROM size_guides WHERE id=?').get(row.size_guide_id) as
        | { id: number; name: string; intro: string | null; columns: string; rows: string; notes: string | null; image_id: number | null }
        | undefined)
    : undefined
  const cat = row.category_id
    ? (await d.prepare('SELECT id, name, slug FROM categories WHERE id=?').get(row.category_id) as { id: number; name: string; slug: string } | undefined)
    : undefined
  const tags = await d
      .prepare(
        `SELECT t.id, t.name, t.slug, g.name AS "group" FROM product_tags pt JOIN tags t ON t.id=pt.tag_id JOIN tag_groups g ON g.id=t.group_id
       WHERE pt.product_id=? AND t.visible=1 ORDER BY g.sort, t.sort`,
      )
      .all(row.id) as { id: number; name: string; slug: string; group: string }[]

  const simpleAvail = row.type === 'simple' ? simpleAvailable(row) : row.type === 'bundle' ? (row.manual_availability === 'in_stock' ? await bundleAvailability(row.id) : 0) : 0
  const maxQtyLine = (await getSetting('checkout')).maxQtyPerLine
  const personalizationOn = (await getSetting('personalization')).enabled

  const card: ProductCard = idx
    ? { ...idx.card, images: fullImages }
    : {
        id: row.id, slug: row.slug, sku: row.sku, name: row.name, type: row.type, price, compareAt, priceFrom: false,
        images: fullImages,
        available: row.type === 'variable' ? variants.some((v) => v.available > 0) : simpleAvail > 0,
        lowStock: null, colors: [], isNew: false, isDemo: !!row.is_demo, categoryName: cat?.name || null,
      }

  return {
    ...card,
    shortDescription: row.short_description || '',
    description: row.description || '',
    options,
    variants,
    simpleAvailable: simpleAvail,
    maxPerOrder: Math.min(row.max_per_order || maxQtyLine, maxQtyLine),
    lowThreshold: (await getSetting('inventory')).showLowStockToCustomers ? row.low_stock_threshold ?? (await getSetting('inventory')).lowStockThreshold : null,
    material: row.material || '',
    careInstructions: row.care_instructions || '',
    sizeGuide: sg
      ? {
          id: sg.id,
          name: sg.name,
          intro: sg.intro || '',
          columns: parseJson<string[]>(sg.columns, []),
          rows: parseJson<string[][]>(sg.rows, []),
          notes: sg.notes || '',
          image: imageRef(await getMedia(sg.image_id), sg.name),
        }
      : null,
    setContents: parseJson<string[]>(row.set_contents, []).filter(Boolean),
    piecesCount: row.pieces_count,
    prepDaysMin: row.prep_days_min,
    prepDaysMax: row.prep_days_max,
    giftWrapEligible: !!row.gift_wrap_eligible,
    personalization: personalizationOn ? parsePersonalization(row.personalization) : null,
    components,
    bundleValue,
    category: cat || null,
    tags,
    seoTitle: row.seo_title || '',
    seoDescription: row.seo_description || '',
    status: row.status,
  }
}

export async function relatedCards(productId: number, kind: 'related' | 'complementary', limit = 8): Promise<ProductCard[]> {
  const idx = await catalogIndex()
  const rows = await db()
      .prepare('SELECT related_id FROM product_relations WHERE product_id=? AND kind=? ORDER BY sort')
      .all(productId, kind) as { related_id: number }[]
  let cards = rows.map((r) => idx.byId.get(r.related_id)?.card).filter(Boolean) as ProductCard[]
  if (!cards.length && kind === 'related') {
    // اقتراح تلقائي من نفس القسم إذا لم تحدد منتجات مرتبطة
    const me = idx.byId.get(productId)
    if (me?.categoryId) {
      cards = idx.items
        .filter((i) => i.categoryId === me.categoryId && i.row.id !== productId && i.card.available)
        .slice(0, limit)
        .map((i) => i.card)
    }
  }
  return cards.slice(0, limit)
}

// ===== البحث والتصفية =====

export type ListFilters = {
  q?: string
  categoryId?: number | null
  tagIds?: number[] // قيود صفحة التصنيف
  filterTags?: string[] // فلاتر الوسوم المختارة (slug)
  sizes?: string[]
  colors?: string[]
  min?: number | null // سنت
  max?: number | null
  inStock?: boolean
  sale?: boolean
  type?: 'bundle' | null
  ids?: number[]
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'default'
  page?: number
  perPage?: number
}

export type Facets = {
  price: { min: number; max: number } | null
  sizes: string[]
  colors: { value: string; color?: string }[]
  tagGroups: { id: number; name: string; slug: string; kind: string; tags: { id: number; name: string; slug: string; count: number }[] }[]
  hidden: string[]
}

export function searchMatches(item: IndexedProduct, q: string): number {
  const nq = normalizeArabic(q)
  if (!nq) return 1
  const tokens = nq.split(' ').filter(Boolean)
  if (item.row.sku.toLowerCase() === q.trim().toLowerCase()) return 100
  if (!tokens.every((t) => item.search.includes(t))) return 0
  const nameN = normalizeArabic(item.row.name)
  let score = 1
  if (nameN.startsWith(nq)) score += 5
  if (nameN.includes(nq)) score += 3
  return score
}

async function tagMeta() {
  const d = db()
  const groups = await d.prepare('SELECT * FROM tag_groups ORDER BY sort, id').all() as {
    id: number; name: string; slug: string; kind: string; show_in_filters: number
  }[]
  const tags = await d.prepare('SELECT id, group_id, name, slug, visible FROM tags ORDER BY sort, id').all() as {
    id: number; group_id: number; name: string; slug: string; visible: number
  }[]
  return { groups, tags }
}

export async function listProducts(f: ListFilters): Promise<{ items: ProductCard[]; total: number; facets: Facets; page: number; pages: number }> {
  const idx = await catalogIndex()
  const { groups, tags } = await tagMeta()
  const tagBySlug = new Map(tags.map((t) => [t.slug, t]))

  // نطاق الصفحة (قسم / تصنيف / بحث / نوع)
  let scope = idx.items
  if (f.ids) {
    const set = new Set(f.ids)
    scope = scope.filter((i) => set.has(i.row.id))
  }
  if (f.categoryId) scope = scope.filter((i) => i.categoryId === f.categoryId)
  if (f.tagIds?.length) scope = scope.filter((i) => f.tagIds!.every((t) => i.tagIds.includes(t)))
  if (f.type === 'bundle') scope = scope.filter((i) => i.row.type === 'bundle')
  if (f.sale) scope = scope.filter((i) => i.onSale)
  const scored = new Map<number, number>()
  if (f.q && f.q.trim()) {
    scope = scope.filter((i) => {
      const s = searchMatches(i, f.q!)
      if (s > 0) scored.set(i.row.id, s)
      return s > 0
    })
  }

  // الفلاتر المختارة
  const selectedTags = (f.filterTags || []).map((s) => tagBySlug.get(s)).filter(Boolean) as typeof tags
  const tagsByGroup = new Map<number, number[]>()
  for (const t of selectedTags) {
    if (!tagsByGroup.has(t.group_id)) tagsByGroup.set(t.group_id, [])
    tagsByGroup.get(t.group_id)!.push(t.id)
  }
  const sizes = new Set(f.sizes || [])
  const colors = new Set(f.colors || [])

  const passes = (i: IndexedProduct, skip?: 'size' | 'color' | number | 'price') => {
    for (const [gid, ids] of tagsByGroup) {
      if (skip === gid) continue
      if (!ids.some((id) => i.tagIds.includes(id))) return false
    }
    if (skip !== 'price') {
      if (f.min != null && i.card.price < f.min) return false
      if (f.max != null && i.card.price > f.max) return false
    }
    const needSize = skip !== 'size' && sizes.size > 0
    const needColor = skip !== 'color' && colors.size > 0
    if (i.row.type === 'variable' && i.variantCombos.length) {
      if (needSize || needColor || f.inStock) {
        const ok = i.variantCombos.some(
          (c) =>
            (!needSize || (c.size != null && sizes.has(c.size))) &&
            (!needColor || (c.color != null && colors.has(c.color))) &&
            (!f.inStock || c.available > 0),
        )
        if (!ok) return false
      }
    } else {
      if (needSize && !i.sizes.some((s) => sizes.has(s))) return false
      if (needColor && !i.colors.some((c) => colors.has(c))) return false
      if (f.inStock && !i.card.available) return false
    }
    return true
  }

  const filtered = scope.filter((i) => passes(i))

  // الواجهات (Facets) تحسب من النطاق مع تطبيق باقي الفلاتر
  const sizeSet = new Set<string>()
  const colorMap = new Map<string, { value: string; color?: string }>()
  for (const i of scope.filter((x) => passes(x, 'size'))) i.sizes.forEach((s) => sizeSet.add(s))
  for (const i of scope.filter((x) => passes(x, 'color'))) {
    for (const c of i.card.colors) colorMap.set(c.value, c)
    for (const c of i.colors) if (!colorMap.has(c)) colorMap.set(c, { value: c })
  }
  for (const s of sizes) sizeSet.add(s)
  for (const c of colors) if (!colorMap.has(c)) colorMap.set(c, { value: c })
  const priceScope = scope.filter((x) => passes(x, 'price'))
  const prices = priceScope.map((i) => i.card.price)

  const tagGroups: Facets['tagGroups'] = []
  for (const gr of groups.filter((x) => x.show_in_filters)) {
    const inGroup = scope.filter((x) => passes(x, gr.id))
    const list = tags
      .filter((t) => t.group_id === gr.id && t.visible)
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug, count: inGroup.filter((i) => i.tagIds.includes(t.id)).length }))
      .filter((t) => t.count > 0 || selectedTags.some((s) => s.id === t.id))
    if (list.length) tagGroups.push({ id: gr.id, name: gr.name, slug: gr.slug, kind: gr.kind, tags: list })
  }

  let hidden: string[] = []
  if (f.categoryId) {
    const c = await db().prepare('SELECT hidden_filters FROM categories WHERE id=?').get(f.categoryId) as { hidden_filters: string } | undefined
    hidden = parseJson<string[]>(c?.hidden_filters, [])
  }

  const sort = f.sort || (f.q ? 'default' : 'default')
  const sorted = [...filtered].sort((a, b) => {
    if (f.q && sort === 'default') return (scored.get(b.row.id) || 0) - (scored.get(a.row.id) || 0) || b.createdAt - a.createdAt
    if (sort === 'price_asc') return a.card.price - b.card.price
    if (sort === 'price_desc') return b.card.price - a.card.price
    if (sort === 'newest') return b.createdAt - a.createdAt
    // الافتراضي: المتوفر أولاً ثم الأحدث
    return Number(b.card.available) - Number(a.card.available) || b.createdAt - a.createdAt
  })

  const perPage = Math.max(1, Math.min(60, f.perPage || 24))
  const pages = Math.max(1, Math.ceil(sorted.length / perPage))
  const page = Math.max(1, Math.min(pages, f.page || 1))
  return {
    items: sorted.slice((page - 1) * perPage, page * perPage).map((i) => i.card),
    total: sorted.length,
    page,
    pages,
    facets: {
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      sizes: Array.from(sizeSet),
      colors: Array.from(colorMap.values()),
      tagGroups,
      hidden,
    },
  }
}

export async function cardsByIds(ids: number[]): Promise<ProductCard[]> {
  const idx = await catalogIndex()
  return ids.map((id) => idx.byId.get(id)?.card).filter(Boolean) as ProductCard[]
}

export async function suggest(q: string) {
  const nq = normalizeArabic(q)
  if (!nq) return { products: [], categories: [], tags: [] }
  const idx = await catalogIndex()
  const products = idx.items
    .map((i) => ({ i, s: searchMatches(i, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map(({ i }) => ({ id: i.row.id, name: i.row.name, slug: i.row.slug, sku: i.row.sku, price: i.card.price, compareAt: i.card.compareAt, image: i.card.images[0]?.url || null, available: i.card.available }))
  const tokens = nq.split(' ')
  const categories = (await db().prepare('SELECT id, name, slug FROM categories WHERE visible=1').all() as { id: number; name: string; slug: string }[])
    .filter((c) => tokens.every((t) => normalizeArabic(c.name).includes(t)))
    .slice(0, 4)
  const tags = (await db().prepare('SELECT id, name, slug FROM tags WHERE visible=1').all() as { id: number; name: string; slug: string }[])
    .filter((c) => tokens.every((t) => normalizeArabic(c.name).includes(t)))
    .slice(0, 4)
  return { products, categories, tags }
}

/** إعادة بناء نص البحث للمنتج (الاسم، الرقم، أرقام الخيارات، القسم، الوسوم) */
export async function refreshSearchText(productId: number) {
  const d = db()
  const p = await getProductRow(productId)
  if (!p) return
  const vs = await d.prepare('SELECT sku, option1, option2, option3 FROM variants WHERE product_id=?').all(productId) as {
    sku: string; option1: string | null; option2: string | null; option3: string | null
  }[]
  const cat = p.category_id ? (await d.prepare('SELECT name FROM categories WHERE id=?').get(p.category_id) as { name: string } | undefined) : undefined
  const tags = await d.prepare('SELECT t.name FROM product_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.product_id=?').all(productId) as { name: string }[]
  const text = normalizeArabic(
    [p.name, p.sku, p.short_description || '', cat?.name || '', ...tags.map((t) => t.name), ...vs.flatMap((v) => [v.sku, v.option1 || '', v.option2 || '', v.option3 || ''])].join(' '),
  )
  await d.prepare('UPDATE products SET search_text=? WHERE id=?').run(text, productId)
}
