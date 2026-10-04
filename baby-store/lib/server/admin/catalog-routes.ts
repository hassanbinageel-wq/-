import { z } from 'zod'
import { json, readJson, readFile } from '../api'
import { ApiError } from '../errors'
import { db, tx } from '../db'
import { audit } from '../auth'
import { saveProduct, duplicateProduct, bulkUpdateProducts, productToInput, uniqueSlug, type ProductInput } from '../products'
import { adjustStock, setStock, StockError } from '../inventory'
import { invalidateCatalog, refreshSearchText, getProductRow, getVariants } from '../catalog'
import { saveImage, saveFavicon, saveFont, mediaUrl, getMedia, UploadError } from '../media'
import { productsCsv, templateCsv, previewImport, commitImport } from '../csv'
import { normalizeArabic } from '../../shared/arabic'
import { num, type Route } from './router'

const actor = (u: { id: number; name: string }) => ({ id: u.id, name: u.name })
const cents = z.number().int().min(0)
const optText = (max: number) => z.string().max(max).nullable().optional()

const productSchema = z.object({
  type: z.enum(['simple', 'variable', 'bundle']),
  name: z.string().min(1, 'اسم المنتج مطلوب').max(150),
  slug: optText(100),
  sku: optText(40),
  shortDescription: optText(500),
  description: optText(20000),
  categoryId: z.number().int().nullable().optional(),
  tagIds: z.array(z.number().int()).max(50).optional(),
  status: z.enum(['draft', 'published', 'archived']),
  price: cents,
  salePrice: cents.nullable().optional(),
  saleStartsAt: optText(40),
  saleEndsAt: optText(40),
  trackStock: z.boolean(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  manualAvailability: z.enum(['in_stock', 'out_of_stock']).optional(),
  lowStockThreshold: z.number().int().min(0).max(10000).nullable().optional(),
  maxPerOrder: z.number().int().min(1).max(999).nullable().optional(),
  options: z
    .array(
      z.object({
        name: z.string().max(40),
        kind: z.enum(['size', 'color', 'other']),
        values: z.array(z.object({ value: z.string().max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).max(40),
      }),
    )
    .max(3)
    .optional(),
  variants: z
    .array(
      z.object({
        id: z.number().int().nullable().optional(),
        sku: optText(40),
        options: z.array(z.string().max(40).nullable()).max(3),
        price: cents.nullable().optional(),
        salePrice: cents.nullable().optional(),
        stock: z.number().int().min(0).max(1_000_000),
        active: z.boolean(),
      }),
    )
    .max(300)
    .optional(),
  images: z.array(z.object({ mediaId: z.number().int(), alt: optText(200), optionValue: optText(40) })).max(30).optional(),
  material: optText(500),
  careInstructions: optText(2000),
  sizeGuideId: z.number().int().nullable().optional(),
  setContents: z.array(z.string().max(120)).max(30).optional(),
  piecesCount: z.number().int().min(1).max(500).nullable().optional(),
  prepDaysMin: z.number().int().min(0).max(120).nullable().optional(),
  prepDaysMax: z.number().int().min(0).max(120).nullable().optional(),
  giftWrapEligible: z.boolean().optional(),
  personalization: z
    .object({
      enabled: z.boolean(),
      label: z.string().max(40),
      placeholder: z.string().max(60),
      maxLength: z.number().int().min(1).max(60),
      fee: cents,
      extraDays: z.number().int().min(0).max(60),
      required: z.boolean(),
      help: z.string().max(200),
    })
    .nullable()
    .optional(),
  relatedIds: z.array(z.number().int()).max(20).optional(),
  complementaryIds: z.array(z.number().int()).max(20).optional(),
  bundleItems: z.array(z.object({ productId: z.number().int(), variantId: z.number().int().nullable().optional(), qty: z.number().int().min(1).max(50) })).max(20).optional(),
  seoTitle: optText(120),
  seoDescription: optText(300),
  stockNote: optText(200),
})

const categorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: optText(80),
  description: optText(500),
  imageId: z.number().int().nullable().optional(),
  visible: z.boolean(),
  hiddenFilters: z.array(z.string().max(40)).max(20),
  seoTitle: optText(120),
  seoDescription: optText(300),
})

async function reorder(table: string, ids: number[]) {
  const st = db().prepare(`UPDATE ${table} SET sort=? WHERE id=?`)
  await tx(async () => {
    for (const [i, id] of ids.entries()) await st.run(i, id)
  })
}

export const CATALOG_ROUTES: Route[] = [
  // ===== المنتجات =====
  {
    method: 'POST',
    path: 'products',
    perm: 'products',
    handler: async ({ req, user, ip }) => {
      const b = (await readJson(req, productSchema)) as ProductInput
      const id = await saveProduct(b, actor(user))
      await audit(user, 'product_create', 'product', id, { name: b.name }, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'PUT',
    path: 'products/:id',
    perm: 'products',
    handler: async ({ req, user, params, ip }) => {
      const b = (await readJson(req, productSchema)) as ProductInput
      const id = await saveProduct({ ...b, id: num(params.id) }, actor(user))
      await audit(user, 'product_update', 'product', id, { name: b.name, status: b.status }, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'GET',
    path: 'products/:id',
    perm: 'products',
    handler: async ({ params }) => {
      const p = await productToInput(num(params.id))
      if (!p) throw new ApiError(404, 'المنتج غير موجود')
      return json({ product: p })
    },
  },
  {
    method: 'POST',
    path: 'products/:id/duplicate',
    perm: 'products',
    handler: async ({ user, params, ip }) => {
      const id = await duplicateProduct(num(params.id), actor(user))
      await audit(user, 'product_duplicate', 'product', id, { from: params.id }, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'DELETE',
    path: 'products/:id',
    perm: 'products',
    handler: async ({ user, params, ip }) => {
      const id = num(params.id)
      const p = await getProductRow(id)
      if (!p) throw new ApiError(404, 'المنتج غير موجود')
      if (await db().prepare('SELECT 1 FROM bundle_items WHERE product_id=? LIMIT 1').get(id)) throw new ApiError(400, 'المنتج مكون في باقة. أزله من الباقة أولاً أو أرشفه بدلاً من الحذف')
      if (await db().prepare('SELECT 1 FROM order_items WHERE product_id=? LIMIT 1').get(id)) throw new ApiError(400, 'للمنتج طلبات سابقة. استخدم الأرشفة بدلاً من الحذف للحفاظ على السجل')
      await db().prepare('DELETE FROM products WHERE id=?').run(id)
      await invalidateCatalog()
      await audit(user, 'product_delete', 'product', id, { name: p.name, sku: p.sku }, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'products/bulk',
    perm: 'products',
    handler: async ({ req, user, ip }) => {
      const b = await readJson(
        req,
        z.object({
          ids: z.array(z.number().int()).min(1).max(500),
          status: z.enum(['draft', 'published', 'archived']).optional(),
          categoryId: z.number().int().nullable().optional(),
          priceMode: z.enum(['percent', 'set', 'add']).optional(),
          priceValue: z.number().optional(),
          clearSale: z.boolean().optional(),
          salePercent: z.number().min(1).max(95).optional(),
        }),
      )
      if (b.priceMode === 'percent' && b.priceValue != null && (b.priceValue < -90 || b.priceValue > 500)) throw new ApiError(400, 'نسبة التعديل غير منطقية')
      await bulkUpdateProducts(b.ids, {
        status: b.status,
        categoryId: b.categoryId,
        priceMode: b.priceMode,
        priceValue: b.priceMode === 'percent' ? b.priceValue : b.priceValue != null ? Math.round(b.priceValue * 100) : undefined,
        clearSale: b.clearSale,
        salePercent: b.salePercent,
      })
      await audit(user, 'products_bulk', 'product', null, b, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'GET',
    path: 'products-search',
    perm: ['products', 'owner', 'orders'],
    handler: async ({ query }) => {
      const q = normalizeArabic(query.get('q') || '')
      const type = query.get('type')
      const rows = await db()
        .prepare(
          `SELECT id, name, sku, type, status FROM products WHERE (search_text ILIKE ? OR sku ILIKE ?) ${type === 'component' ? "AND type<>'bundle'" : ''} AND status<>'archived' ORDER BY id DESC LIMIT 20`,
        )
        .all(`%${q}%`, `%${(query.get('q') || '').toUpperCase()}%`) as { id: number; name: string; sku: string; type: string; status: string }[]
      const items = []
      for (const r of rows) {
        const img = await db().prepare('SELECT media_id FROM product_images WHERE product_id=? ORDER BY sort LIMIT 1').get<{ media_id: number }>(r.id)
        items.push({
          ...r,
          image: img ? mediaUrl(await getMedia(img.media_id), 320) : null,
          variants:
            r.type === 'variable'
              ? (await getVariants(r.id)).map((v) => ({ id: v.id, sku: v.sku, label: [v.option1, v.option2, v.option3].filter(Boolean).join(' / '), active: !!v.active }))
              : [],
        })
      }
      return json({ items })
    },
  },
  // ===== الوسائط =====
  {
    method: 'POST',
    path: 'media',
    perm: ['products', 'owner'],
    handler: async ({ req, user }) => {
      const { buf, name, form } = await readFile(req)
      const kind = String(form.get('kind') || 'image')
      try {
        if (kind === 'favicon') {
          const id = await saveFavicon(buf, user.id)
          return json({ ok: true, id, url: `${mediaUrl(await getMedia(id))}` })
        }
        if (kind === 'font') {
          const id = await saveFont(buf, name, user.id)
          return json({ ok: true, id, url: mediaUrl(await getMedia(id)) })
        }
        const purpose = String(form.get('purpose') || 'product').slice(0, 30)
        const id = await saveImage(buf, { purpose, originalName: name, userId: user.id, widths: purpose === 'banner' ? [640, 1080, 1600, 2000] : undefined })
        const m = await getMedia(id)
        return json({ ok: true, id, url: mediaUrl(m, 640), width: m?.width, height: m?.height })
      } catch (e) {
        if (e instanceof UploadError) throw new ApiError(400, e.message)
        throw e
      }
    },
  },
  // ===== المخزون =====
  {
    method: 'POST',
    path: 'stock/adjust',
    perm: 'products',
    handler: async ({ req, user, ip }) => {
      const b = await readJson(
        req,
        z.object({ productId: z.number().int(), variantId: z.number().int().nullable(), mode: z.enum(['add', 'set']), value: z.number().int().min(-100000).max(1000000), note: z.string().max(200).optional() }),
      )
      const p = await getProductRow(b.productId)
      if (!p) throw new ApiError(404, 'المنتج غير موجود')
      try {
        const after =
          b.mode === 'set'
            ? await setStock({ productId: b.productId, variantId: b.variantId, value: b.value, reason: 'manual', actor: actor(user), note: b.note })
            : await adjustStock({ productId: b.productId, variantId: b.variantId, change: b.value, reason: 'manual', actor: actor(user), note: b.note })
        await audit(user, 'stock_adjust', 'product', b.productId, b, ip)
        return json({ ok: true, stock: after })
      } catch (e) {
        if (e instanceof StockError) throw new ApiError(400, `لا يمكن أن يصبح المخزون سالباً (المتاح ${e.shortages[0]?.available})`)
        throw e
      }
    },
  },
  // ===== CSV =====
  {
    method: 'GET',
    path: 'products/export',
    perm: 'products',
    handler: async ({ user, ip }) => {
      await audit(user, 'products_export', 'product', null, null, ip)
      return new Response(await productsCsv(), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"` },
      })
    },
  },
  {
    method: 'GET',
    path: 'products/template',
    perm: 'products',
    handler: () => new Response(templateCsv(), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="products-template.csv"' } }),
  },
  {
    method: 'POST',
    path: 'products/import/preview',
    perm: 'products',
    handler: async ({ req }) => {
      const { buf } = await readFile(req)
      if (buf.length > 5 * 1024 * 1024) throw new ApiError(400, 'الملف كبير جداً')
      return json(await previewImport(buf.toString('utf8')))
    },
  },
  {
    method: 'POST',
    path: 'products/import/commit',
    perm: 'products',
    handler: async ({ req, user, ip }) => {
      const { buf } = await readFile(req)
      try {
        const r = await commitImport(buf.toString('utf8'), actor(user))
        await audit(user, 'products_import', 'product', null, r, ip)
        return json({ ok: true, ...r })
      } catch (e) {
        if (e instanceof ApiError) throw e
        throw new ApiError(400, (e as Error).message)
      }
    },
  },
  // ===== الأقسام =====
  {
    method: 'POST',
    path: 'categories',
    perm: 'products',
    handler: async ({ req, user, ip }) => {
      const b = await readJson(req, categorySchema)
      const slug = await uniqueSlug(b.slug || b.name, null, 'categories')
      const sort = (await db().prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM categories').get() as { s: number }).s
      const id = Number(
        (await db()
          .prepare('INSERT INTO categories(name,slug,description,image_id,visible,hidden_filters,seo_title,seo_description,sort) VALUES(?,?,?,?,?,?,?,?,?)')
          .run(b.name, slug, b.description || null, b.imageId || null, b.visible ? 1 : 0, JSON.stringify(b.hiddenFilters), b.seoTitle || null, b.seoDescription || null, sort))
          .lastInsertRowid,
      )
      await invalidateCatalog()
      await audit(user, 'category_create', 'category', id, { name: b.name }, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'PUT',
    path: 'categories/:id',
    perm: 'products',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, categorySchema)
      const id = num(params.id)
      const slug = await uniqueSlug(b.slug || b.name, id, 'categories')
      await db()
        .prepare("UPDATE categories SET name=?, slug=?, description=?, image_id=?, visible=?, hidden_filters=?, seo_title=?, seo_description=?, updated_at=datetime('now') WHERE id=?")
        .run(b.name, slug, b.description || null, b.imageId || null, b.visible ? 1 : 0, JSON.stringify(b.hiddenFilters), b.seoTitle || null, b.seoDescription || null, id)
      for (const p of await db().prepare('SELECT id FROM products WHERE category_id=?').all(id) as { id: number }[]) await refreshSearchText(p.id)
      await invalidateCatalog()
      await audit(user, 'category_update', 'category', id, { name: b.name }, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'DELETE',
    path: 'categories/:id',
    perm: 'products',
    handler: async ({ user, params, ip }) => {
      const id = num(params.id)
      const n = (await db().prepare('SELECT COUNT(*) n FROM products WHERE category_id=?').get(id) as { n: number }).n
      if (n > 0) throw new ApiError(400, `القسم يحتوي ${n} منتج. انقل المنتجات لقسم آخر أو أخفِ القسم بدلاً من حذفه`)
      await db().prepare('DELETE FROM categories WHERE id=?').run(id)
      await invalidateCatalog()
      await audit(user, 'category_delete', 'category', id, null, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'categories/reorder',
    perm: 'products',
    handler: async ({ req }) => {
      const { ids } = await readJson(req, z.object({ ids: z.array(z.number().int()).max(500) }))
      await reorder('categories', ids)
      return json({ ok: true })
    },
  },
  // ===== مجموعات التصنيف والتصنيفات =====
  {
    method: 'POST',
    path: 'tag-groups',
    perm: 'products',
    handler: async ({ req, user, ip }) => {
      const b = await readJson(req, z.object({ name: z.string().min(1).max(60), kind: z.enum(['age', 'occasion', 'custom']), showInFilters: z.boolean() }))
      const id = Number(
        (await db().prepare('INSERT INTO tag_groups(name,slug,kind,show_in_filters,sort) VALUES(?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM tag_groups))').run(b.name, await uniqueSlug(b.name, null, 'tag_groups'), b.kind, b.showInFilters ? 1 : 0))
          .lastInsertRowid,
      )
      await audit(user, 'tag_group_create', 'tag_group', id, b, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'PUT',
    path: 'tag-groups/:id',
    perm: 'products',
    handler: async ({ req, params }) => {
      const b = await readJson(req, z.object({ name: z.string().min(1).max(60), kind: z.enum(['age', 'occasion', 'custom']), showInFilters: z.boolean() }))
      await db().prepare('UPDATE tag_groups SET name=?, kind=?, show_in_filters=? WHERE id=?').run(b.name, b.kind, b.showInFilters ? 1 : 0, num(params.id))
      await invalidateCatalog()
      return json({ ok: true })
    },
  },
  {
    method: 'DELETE',
    path: 'tag-groups/:id',
    perm: 'products',
    handler: async ({ params, user, ip }) => {
      await db().prepare('DELETE FROM tag_groups WHERE id=?').run(num(params.id))
      await invalidateCatalog()
      await audit(user, 'tag_group_delete', 'tag_group', params.id, null, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'tags',
    perm: 'products',
    handler: async ({ req }) => {
      const b = await readJson(req, z.object({ groupId: z.number().int(), name: z.string().min(1).max(60), description: optText(300), imageId: z.number().int().nullable().optional(), visible: z.boolean() }))
      const id = Number(
        (await db()
          .prepare('INSERT INTO tags(group_id,name,slug,description,image_id,visible,sort) VALUES(?,?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM tags))')
          .run(b.groupId, b.name, await uniqueSlug(b.name, null, 'tags'), b.description || null, b.imageId || null, b.visible ? 1 : 0)).lastInsertRowid,
      )
      await invalidateCatalog()
      return json({ ok: true, id })
    },
  },
  {
    method: 'PUT',
    path: 'tags/:id',
    perm: 'products',
    handler: async ({ req, params }) => {
      const b = await readJson(req, z.object({ groupId: z.number().int(), name: z.string().min(1).max(60), description: optText(300), imageId: z.number().int().nullable().optional(), visible: z.boolean() }))
      const id = num(params.id)
      await db().prepare('UPDATE tags SET group_id=?, name=?, description=?, image_id=?, visible=? WHERE id=?').run(b.groupId, b.name, b.description || null, b.imageId || null, b.visible ? 1 : 0, id)
      for (const p of await db().prepare('SELECT product_id FROM product_tags WHERE tag_id=?').all(id) as { product_id: number }[]) await refreshSearchText(p.product_id)
      await invalidateCatalog()
      return json({ ok: true })
    },
  },
  {
    method: 'DELETE',
    path: 'tags/:id',
    perm: 'products',
    handler: async ({ params }) => {
      await db().prepare('DELETE FROM tags WHERE id=?').run(num(params.id))
      await invalidateCatalog()
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'tags/reorder',
    perm: 'products',
    handler: async ({ req }) => {
      const { ids } = await readJson(req, z.object({ ids: z.array(z.number().int()).max(500) }))
      await reorder('tags', ids)
      return json({ ok: true })
    },
  },
  // ===== أدلة المقاسات =====
  {
    method: 'POST',
    path: 'size-guides',
    perm: 'products',
    handler: async ({ req }) => {
      const b = await readJson(req, sizeGuideSchema)
      const id = Number(
        (await db().prepare('INSERT INTO size_guides(name,intro,columns,rows,notes,image_id) VALUES(?,?,?,?,?,?)').run(b.name, b.intro || null, JSON.stringify(b.columns), JSON.stringify(b.rows), b.notes || null, b.imageId || null))
          .lastInsertRowid,
      )
      return json({ ok: true, id })
    },
  },
  {
    method: 'PUT',
    path: 'size-guides/:id',
    perm: 'products',
    handler: async ({ req, params }) => {
      const b = await readJson(req, sizeGuideSchema)
      await db()
        .prepare("UPDATE size_guides SET name=?, intro=?, columns=?, rows=?, notes=?, image_id=?, is_demo=0, updated_at=datetime('now') WHERE id=?")
        .run(b.name, b.intro || null, JSON.stringify(b.columns), JSON.stringify(b.rows), b.notes || null, b.imageId || null, num(params.id))
      return json({ ok: true })
    },
  },
  {
    method: 'DELETE',
    path: 'size-guides/:id',
    perm: 'products',
    handler: async ({ params }) => {
      await db().prepare('UPDATE products SET size_guide_id=NULL WHERE size_guide_id=?').run(num(params.id))
      await db().prepare('DELETE FROM size_guides WHERE id=?').run(num(params.id))
      return json({ ok: true })
    },
  },
]

const sizeGuideSchema = z.object({
  name: z.string().min(1).max(100),
  intro: optText(500),
  columns: z.array(z.string().max(40)).max(10),
  rows: z.array(z.array(z.string().max(60)).max(10)).max(40),
  notes: optText(1000),
  imageId: z.number().int().nullable().optional(),
})

