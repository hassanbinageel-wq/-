import { db, parseJson, tx } from './db'
import { productToInput, saveProduct, type ProductInput } from './products'
import { getVariants, type VariantRow } from './catalog'
import { toCsv } from './admin/queries'
import { toCents } from '../shared/money'
import { normalizeArabic } from '../shared/arabic'
import type { Actor } from './inventory'
import type { ProductOption } from '../shared/types'

/** محلل CSV حسب RFC 4180 (يدعم الحقول بين علامات تنصيص والأسطر داخلها) */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export const PRODUCT_COLUMNS = [
  'type', 'sku', 'parent_sku', 'name', 'category', 'status', 'price', 'sale_price', 'stock', 'track_stock',
  'option1_name', 'option1_value', 'option2_name', 'option2_value', 'option3_name', 'option3_value',
  'short_description', 'description', 'material', 'care_instructions', 'tags', 'pieces_count', 'prep_days_min', 'prep_days_max',
] as const

export const COLUMN_HELP: Record<string, string> = {
  type: 'simple (منتج بسيط) أو variable (منتج بخيارات) أو variant (سطر خيار تابع لمنتج)',
  sku: 'رقم المنتج أو الخيار (فريد). اتركه فارغاً لمنتج جديد ليُنشأ تلقائياً',
  parent_sku: 'لأسطر variant فقط: رقم المنتج الأصلي',
  status: 'draft أو published أو archived',
  price: 'السعر بالأرقام (مثل 3500)',
  track_stock: '1 لتتبع المخزون أو 0 لعدم التتبع',
  tags: 'أسماء التصنيفات مفصولة بالرمز |',
}

export async function productsCsv(): Promise<string> {
  const d = db()
  const products = await d.prepare("SELECT * FROM products WHERE type<>'bundle' ORDER BY id").all() as Record<string, unknown>[]
  const cats = new Map((await d.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[]).map((c) => [c.id, c.name]))
  const tagRows = await d.prepare('SELECT pt.product_id, t.name FROM product_tags pt JOIN tags t ON t.id=pt.tag_id').all() as { product_id: number; name: string }[]
  const tagMap = new Map<number, string[]>()
  for (const t of tagRows) {
    if (!tagMap.has(t.product_id)) tagMap.set(t.product_id, [])
    tagMap.get(t.product_id)!.push(t.name)
  }
  const money = (v: unknown) => (v === null || v === undefined ? '' : Number(v) / 100)
  const out: unknown[][] = [[...PRODUCT_COLUMNS]]
  for (const p of products) {
    const opts = parseJson<ProductOption[]>(p.options as string, [])
    out.push([
      p.type, p.sku, '', p.name, cats.get(p.category_id as number) || '', p.status, money(p.price), money(p.sale_price),
      p.type === 'simple' ? p.stock : '', p.track_stock ? 1 : 0,
      opts[0]?.name || '', '', opts[1]?.name || '', '', opts[2]?.name || '', '',
      p.short_description || '', p.description || '', p.material || '', p.care_instructions || '',
      (tagMap.get(p.id as number) || []).join('|'), p.pieces_count ?? '', p.prep_days_min ?? '', p.prep_days_max ?? '',
    ])
    if (p.type === 'variable') {
      for (const v of await getVariants(p.id as number)) {
        out.push([
          'variant', v.sku, p.sku, '', '', v.active ? 'published' : 'draft', money(v.price), money(v.sale_price), v.stock, '',
          opts[0]?.name || '', v.option1 || '', opts[1]?.name || '', v.option2 || '', opts[2]?.name || '', v.option3 || '',
          '', '', '', '', '', '', '', '',
        ])
      }
    }
  }
  return toCsv(out)
}

export function templateCsv(): string {
  return toCsv([
    [...PRODUCT_COLUMNS],
    ['simple', '', '', 'جوارب قطنية (مثال)', 'الإكسسوارات', 'draft', 1500, '', 10, 1, '', '', '', '', '', '', 'وصف مختصر', 'وصف تفصيلي', '', '', 'حديثو الولادة (0-3 أشهر)', 3, '', ''],
    ['variable', 'EX-100', '', 'بدلة بخيارات (مثال)', 'ملابس المواليد', 'draft', 3500, '', '', 1, 'المقاس', '', 'اللون', '', '', '', '', '', '', '', '', '', '', ''],
    ['variant', 'EX-100-01', 'EX-100', '', '', 'published', '', '', 5, '', 'المقاس', '0-3 أشهر', 'اللون', 'وردي', '', '', '', '', '', '', '', '', '', ''],
    ['variant', 'EX-100-02', 'EX-100', '', '', 'published', 4000, '', 3, '', 'المقاس', '3-6 أشهر', 'اللون', 'وردي', '', '', '', '', '', '', '', '', '', ''],
  ])
}

type Row = Record<(typeof PRODUCT_COLUMNS)[number], string> & { _line: number }

export type PreviewRow = { line: number; type: string; sku: string; name: string; action: 'create' | 'update' | 'error'; errors: string[]; warnings: string[] }

type Plan = {
  rows: PreviewRow[]
  groups: { sku: string; existingId: number | null; head: Row | null; variants: Row[] }[]
}

async function plan(text: string): Promise<Plan> {
  const d = db()
  const table = parseCsv(text)
  if (!table.length) return { rows: [{ line: 1, type: '', sku: '', name: '', action: 'error', errors: ['الملف فارغ'], warnings: [] }], groups: [] }
  const header = table[0].map((h) => h.trim().toLowerCase())
  const missing = ['type', 'name', 'price'].filter((c) => !header.includes(c))
  if (missing.length) return { rows: [{ line: 1, type: '', sku: '', name: '', action: 'error', errors: [`أعمدة مطلوبة غير موجودة: ${missing.join('، ')}`], warnings: [] }], groups: [] }
  const rows: Row[] = table.slice(1, 3001).map((cells, i) => {
    const r = { _line: i + 2 } as Row
    for (const col of PRODUCT_COLUMNS) {
      const idx = header.indexOf(col)
      ;(r as Record<string, unknown>)[col] = idx >= 0 ? (cells[idx] || '').trim() : ''
    }
    r.type = r.type.toLowerCase()
    r.sku = r.sku.toUpperCase()
    r.parent_sku = r.parent_sku.toUpperCase()
    return r
  })
  const cats = await d.prepare('SELECT id, name, slug FROM categories').all() as { id: number; name: string; slug: string }[]
  const tags = await d.prepare('SELECT id, name, slug FROM tags').all() as { id: number; name: string; slug: string }[]
  const out: PreviewRow[] = []
  const groups = new Map<string, Plan['groups'][number]>()
  const seen = new Set<string>()
  let autoN = 0
  for (const r of rows) {
    const errors: string[] = []
    const warnings: string[] = []
    if (!['simple', 'variable', 'variant'].includes(r.type)) errors.push('النوع يجب أن يكون simple أو variable أو variant')
    if (r.sku && !/^[A-Z0-9][A-Z0-9_.-]{1,39}$/.test(r.sku)) errors.push('رقم المنتج يقبل الحروف الإنجليزية والأرقام والشرطة فقط')
    if (r.sku && seen.has(r.sku)) errors.push('رقم مكرر داخل الملف')
    if (r.sku) seen.add(r.sku)
    const price = r.price ? toCents(r.price) : null
    if (r.price && (price === null || price < 0)) errors.push('السعر غير صحيح')
    const sale = r.sale_price ? toCents(r.sale_price) : null
    if (r.sale_price && (sale === null || sale < 0)) errors.push('سعر التخفيض غير صحيح')
    if (r.stock && !/^\d+$/.test(r.stock)) errors.push('المخزون يجب أن يكون رقماً صحيحاً')
    if (r.status && !['draft', 'published', 'archived'].includes(r.status)) errors.push('الحالة غير صحيحة')
    let action: PreviewRow['action'] = 'create'
    if (r.type === 'variant') {
      if (!r.parent_sku) errors.push('حدد parent_sku للخيار')
      if (!r.option1_value) errors.push('حدد قيمة الخيار الأول')
      const v = r.sku ? (await d.prepare('SELECT id, product_id FROM variants WHERE upper(sku)=upper(?)').get(r.sku) as { id: number; product_id: number } | undefined) : undefined
      if (v) action = 'update'
      const parentInFile = rows.some((x) => x.type === 'variable' && x.sku === r.parent_sku)
      const parentDb = await d.prepare("SELECT id, type FROM products WHERE upper(sku)=upper(?)").get(r.parent_sku) as { id: number; type: string } | undefined
      if (!parentInFile && !parentDb) errors.push('المنتج الأصلي غير موجود في الملف أو المتجر')
      if (parentDb && parentDb.type !== 'variable') errors.push('المنتج الأصلي ليس منتجاً بخيارات')
      if (!errors.length) {
        const g = groups.get(r.parent_sku) || { sku: r.parent_sku, existingId: parentDb?.id ?? null, head: null, variants: [] }
        g.variants.push(r)
        groups.set(r.parent_sku, g)
      }
    } else if (r.type === 'simple' || r.type === 'variable') {
      const existing = r.sku ? (await d.prepare('SELECT id, type FROM products WHERE upper(sku)=upper(?)').get(r.sku) as { id: number; type: string } | undefined) : undefined
      if (existing) {
        action = 'update'
        if (existing.type !== r.type) errors.push(`نوع المنتج في المتجر ${existing.type} ولا يمكن تغييره من الملف`)
      } else {
        if (!r.name) errors.push('الاسم مطلوب للمنتج الجديد')
        if (price === null) errors.push('السعر مطلوب للمنتج الجديد')
      }
      if (r.type === 'variable' && !r.option1_name && !existing) errors.push('حدد اسم الخيار الأول (option1_name) للمنتج بخيارات')
      if (r.category && !cats.some((c) => c.name === r.category || c.slug === r.category)) errors.push(`القسم «${r.category}» غير موجود`)
      if (r.tags) {
        const unknown = r.tags.split('|').map((t) => t.trim()).filter((t) => t && !tags.some((x) => x.name === t || x.slug === t))
        if (unknown.length) warnings.push(`تصنيفات غير معروفة ستُتجاهل: ${unknown.join('، ')}`)
      }
      if (!errors.length) {
        const k = r.sku || `__new${++autoN}`
        const g = groups.get(k) || { sku: k, existingId: existing?.id ?? null, head: null, variants: [] }
        g.head = r
        g.existingId = existing?.id ?? null
        groups.set(k, g)
      }
    }
    out.push({ line: r._line, type: r.type, sku: r.sku || (r.type === 'variant' ? '' : '(تلقائي)'), name: r.name, action: errors.length ? 'error' : action, errors, warnings })
  }
  // أسطر خيارات لمنتج جديد في الملف بدون سطر رئيسي صالح
  for (const g of groups.values()) {
    if (!g.head && !g.existingId) {
      for (const v of g.variants) {
        const pr = out.find((x) => x.line === v._line)
        if (pr) {
          pr.action = 'error'
          pr.errors.push('سطر المنتج الأصلي يحتوي أخطاء')
        }
      }
    }
  }
  return { rows: out, groups: Array.from(groups.values()) }
}

export async function previewImport(text: string) {
  const p = await plan(text)
  return {
    rows: p.rows,
    summary: {
      total: p.rows.length,
      create: p.rows.filter((r) => r.action === 'create').length,
      update: p.rows.filter((r) => r.action === 'update').length,
      errors: p.rows.filter((r) => r.action === 'error').length,
    },
  }
}

/** تنفيذ الاستيراد (يتطلب عدم وجود أخطاء) */
export async function commitImport(text: string, actor: Actor): Promise<{ created: number; updated: number }> {
  const p = await plan(text)
  if (p.rows.some((r) => r.action === 'error')) throw new Error('يوجد أخطاء في الملف. صححها ثم أعد المعاينة')
  const d = db()
  const cats = await d.prepare('SELECT id, name, slug FROM categories').all() as { id: number; name: string; slug: string }[]
  const tags = await d.prepare('SELECT id, name, slug FROM tags').all() as { id: number; name: string; slug: string }[]
  let created = 0
  let updated = 0
  await tx(async () => {
    for (const g of p.groups) {
      const h = g.head
      let input: ProductInput
      if (g.existingId) {
        input = (await productToInput(g.existingId))!
        updated++
      } else {
        input = { type: (h!.type as 'simple' | 'variable') || 'simple', name: '', status: 'draft', price: 0, trackStock: true, variants: [], options: [] }
        created++
      }
      if (h) {
        if (h.sku) input.sku = h.sku
        if (h.name) input.name = h.name
        if (h.status) input.status = h.status as ProductInput['status']
        if (h.price) input.price = toCents(h.price)!
        if (h.sale_price !== undefined) input.salePrice = h.sale_price ? toCents(h.sale_price) : null
        if (h.track_stock) input.trackStock = h.track_stock !== '0'
        if (h.stock && input.type === 'simple') input.stock = Number(h.stock)
        if (h.category) input.categoryId = cats.find((c) => c.name === h.category || c.slug === h.category)?.id ?? input.categoryId
        if (h.short_description) input.shortDescription = h.short_description
        if (h.description) input.description = h.description
        if (h.material) input.material = h.material
        if (h.care_instructions) input.careInstructions = h.care_instructions
        if (h.pieces_count) input.piecesCount = Number(h.pieces_count) || null
        if (h.prep_days_min) input.prepDaysMin = Number(h.prep_days_min) || null
        if (h.prep_days_max) input.prepDaysMax = Number(h.prep_days_max) || null
        if (h.tags) {
          const ids = h.tags.split('|').map((t) => tags.find((x) => x.name === t.trim() || x.slug === t.trim())?.id).filter(Boolean) as number[]
          input.tagIds = Array.from(new Set([...(input.tagIds || []), ...ids]))
        }
      }
      if (input.type === 'variable') {
        const names = [h?.option1_name || g.variants[0]?.option1_name, h?.option2_name || g.variants[0]?.option2_name, h?.option3_name || g.variants[0]?.option3_name]
        const options: ProductOption[] = (input.options || []).map((o) => ({ ...o, values: [...o.values] }))
        names.forEach((n, i) => {
          if (n && !options[i]) options[i] = { name: n, kind: /لون|color/i.test(n) ? 'color' : /مقاس|عمر|size|age/i.test(n) ? 'size' : 'other', values: [] }
        })
        const variants = [...(input.variants || [])]
        for (const v of g.variants) {
          const vals = [v.option1_value, v.option2_value, v.option3_value].map((x) => x || null)
          vals.forEach((val, i) => {
            if (val && options[i] && !options[i].values.some((x) => x.value === val)) options[i].values.push({ value: val })
          })
          const idx = variants.findIndex((x) => (v.sku && x.sku?.toUpperCase() === v.sku) || normalizeArabic(x.options.join('|')) === normalizeArabic(vals.join('|')))
          const next = {
            id: idx >= 0 ? variants[idx].id : null,
            sku: v.sku || (idx >= 0 ? variants[idx].sku : null),
            options: vals,
            price: v.price ? toCents(v.price) : idx >= 0 ? variants[idx].price ?? null : null,
            salePrice: v.sale_price ? toCents(v.sale_price) : idx >= 0 ? variants[idx].salePrice ?? null : null,
            stock: v.stock ? Number(v.stock) : idx >= 0 ? variants[idx].stock : 0,
            active: v.status ? v.status === 'published' : idx >= 0 ? variants[idx].active : true,
          }
          if (idx >= 0) variants[idx] = next
          else variants.push(next)
        }
        input.options = options.filter(Boolean)
        input.variants = variants
      }
      await saveProduct({ ...input, stockNote: 'استيراد CSV', stockReason: 'import' }, actor)
    }
  })
  return { created, updated }
}

export type { VariantRow }
