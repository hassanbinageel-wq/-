import { z } from 'zod'
import { json, readJson } from '../api'
import { ApiError } from '../errors'
import { db, tx } from '../db'
import { audit, revokeUserSessions, revokeToken, SESSION_COOKIE } from '../auth'
import { getSetting, setSetting } from '../settings'
import { hashPassword, passwordProblem, verifyPassword } from '../security'
import { saveDraft, publishDraft, discardDraft, restoreVersionToDraft, getDraftAppearance, listVersions } from '../appearance'
import { deleteDemoData, uniqueSlug } from '../products'
import { invalidateCatalog } from '../catalog'
import { createBackup, listBackups, getBackup, deleteBackup, restoreBackup } from '../backup'
import { PERMISSIONS, HOME_SECTION_TYPES } from '../../shared/constants'
import type { Appearance } from '../../shared/types'
import { num, type Route } from './router'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'لون غير صالح')
const href = z
  .string()
  .max(400)
  .refine((h) => h === '' || /^(\/(?!\/)|https?:\/\/|#|tel:|mailto:)/.test(h), 'الرابط يجب أن يبدأ بـ / أو https://')
const s = (max: number) => z.string().max(max)
const date = z.string().max(40).nullable()
const link = z.object({ label: s(80), href })

const bannerSchema = z.object({
  id: s(40),
  enabled: z.boolean(),
  title: s(120),
  text: s(300),
  buttonText: s(40),
  link: href,
  imageDesktopId: z.number().int().nullable(),
  imageMobileId: z.number().int().nullable(),
  align: z.enum(['start', 'center', 'end']),
  tone: z.enum(['light', 'dark']),
  startsAt: date,
  endsAt: date,
})

const appearanceSchema = z.object({
  brand: z.object({ name: s(60).min(1, 'اسم المتجر مطلوب'), tagline: s(160), logoId: z.number().int().nullable(), faviconId: z.number().int().nullable() }),
  theme: z.object({
    preset: s(30),
    colors: z.object({
      bg: hex, surface: hex, soft: hex, text: hex, muted: hex, primary: hex, onPrimary: hex, accent: hex,
      pink: hex, blue: hex, green: hex, yellow: hex, border: hex, sale: hex,
    }),
    radius: z.number().int().min(0).max(32),
    fontBody: s(20),
    fontHeading: s(20),
    customFontId: z.number().int().nullable(),
    customFontName: s(60),
    baseSize: z.number().int().min(14).max(19),
    decorations: z.boolean(),
  }),
  announcement: z.object({ enabled: z.boolean(), items: z.array(link).max(8), bg: hex, fg: hex, startsAt: date, endsAt: date }),
  header: z.object({ menu: z.array(link).max(12) }),
  home: z.object({
    sections: z
      .array(
        z.object({
          id: s(40),
          type: z.enum(Object.keys(HOME_SECTION_TYPES) as [string, ...string[]]),
          enabled: z.boolean(),
          title: s(120),
          subtitle: s(200),
          limit: z.number().int().min(1).max(48),
          layout: z.enum(['carousel', 'grid']),
          buttonText: s(40),
          buttonLink: href,
          productIds: z.array(z.number().int()).max(48),
          tagGroupId: z.number().int().nullable(),
          banners: z.array(bannerSchema).max(10),
          body: s(5000),
          items: z.array(z.object({ icon: s(20), title: s(60), text: s(140) })).max(8),
          startsAt: date,
          endsAt: date,
        }),
      )
      .max(30),
  }),
  productCard: z.object({
    aspect: z.enum(['1/1', '4/5', '3/4']),
    fit: z.enum(['cover', 'contain']),
    hoverSecondImage: z.boolean(),
    quickView: z.boolean(),
    columnsMobile: z.union([z.literal(1), z.literal(2)]),
    columnsDesktop: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  }),
  labels: z.record(z.string(), s(160)),
  footer: z.object({
    about: s(600),
    columns: z.array(z.object({ title: s(60), links: z.array(link).max(12) })).max(5),
    social: z.object({ instagram: href, tiktok: href, snapchat: href, facebook: href, x: href }),
    copyright: s(120),
  }),
})

const SETTING_SCHEMAS = {
  store: z.object({
    currency: z.object({ code: s(6).min(2), symbol: s(10).min(1), decimals: z.number().int().min(0).max(2), numerals: z.enum(['latn', 'arab']) }),
    timezone: s(60).refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz })
        return true
      } catch {
        return false
      }
    }, 'المنطقة الزمنية غير صحيحة'),
    whatsappCountryCode: z.string().regex(/^\d{1,4}$/, 'مفتاح الدولة أرقام فقط'),
    whatsappNumber: z.string().regex(/^\d{6,14}$/, 'رقم واتساب أرقام فقط (بدون مفتاح الدولة)'),
    phone: s(30),
    email: z.union([z.literal(''), z.string().email('بريد غير صحيح').max(120)]),
    address: s(300),
    workingHours: s(160),
    mapUrl: href,
    orderPrefix: z.string().regex(/^[A-Za-z0-9]{1,8}$/, 'بادئة الطلب حروف إنجليزية وأرقام فقط'),
    skuPrefix: z.string().regex(/^[A-Za-z0-9]{1,8}$/, 'بادئة رقم المنتج حروف إنجليزية وأرقام فقط'),
    defaultCountry: s(60),
    defaultPhoneCode: z.string().regex(/^\d{1,4}$/),
  }),
  checkout: z.object({
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    pickupAddress: s(300),
    pickupNotes: s(500),
    reservationMinutes: z.number().int().min(15).max(14 * 24 * 60),
    autoCancelAfterExpiryHours: z.number().int().min(0).max(24 * 30),
    maxPendingPerPhone: z.number().int().min(0).max(50),
    maxQtyPerLine: z.number().int().min(1).max(999),
    ordersPerIpPer10Min: z.number().int().min(0).max(100),
    notesMax: z.number().int().min(50).max(2000),
  }),
  shipping: z.object({ freeShippingEnabled: z.boolean(), freeShippingThreshold: z.number().int().min(0) }),
  gifts: z.object({
    giftOrderEnabled: z.boolean(),
    giftWrapEnabled: z.boolean(),
    giftMessageEnabled: z.boolean(),
    giftMessageMax: z.number().int().min(20).max(1000),
    recipientEnabled: z.boolean(),
    hidePricesEnabled: z.boolean(),
  }),
  personalization: z.object({ enabled: z.boolean() }),
  inventory: z.object({ lowStockThreshold: z.number().int().min(0).max(1000), showLowStockToCustomers: z.boolean() }),
  maintenance: z.object({ enabled: z.boolean(), title: s(120), message: s(600) }),
  messages: z.array(z.object({ key: s(40), title: s(80), body: s(3000) })).max(30),
  backup: z.object({ autoEnabled: z.boolean(), keep: z.number().int().min(1).max(60), lastAutoAt: z.string().nullable() }),
}

type SettingKey = keyof typeof SETTING_SCHEMAS

function crud(table: string, schema: z.ZodTypeAny, toRow: (b: never) => Record<string, unknown>, perm: Route['perm'], extra?: { beforeDelete?: (id: number) => void; after?: () => void }): Route[] {
  return [
    {
      method: 'POST',
      path: table.replace(/_/g, '-'),
      perm,
      handler: async ({ req, user, ip }) => {
        const row = toRow((await readJson(req, schema)) as never)
        const keys = Object.keys(row)
        const id = Number(
          (await db().prepare(`INSERT INTO ${table}(${keys.join(',')}, sort) VALUES(${keys.map((k) => '@' + k).join(',')}, (SELECT COALESCE(MAX(sort),0)+1 FROM ${table}))`).run(row)).lastInsertRowid,
        )
        extra?.after?.()
        await audit(user, `${table}_create`, table, id, null, ip)
        return json({ ok: true, id })
      },
    },
    {
      method: 'PUT',
      path: `${table.replace(/_/g, '-')}/:id`,
      perm,
      handler: async ({ req, user, params, ip }) => {
        const row = toRow((await readJson(req, schema)) as never)
        const sets = Object.keys(row).map((k) => `${k}=@${k}`).join(', ')
        await db().prepare(`UPDATE ${table} SET ${sets} WHERE id=@id`).run({ ...row, id: num(params.id) })
        extra?.after?.()
        await audit(user, `${table}_update`, table, params.id, null, ip)
        return json({ ok: true })
      },
    },
    {
      method: 'DELETE',
      path: `${table.replace(/_/g, '-')}/:id`,
      perm,
      handler: async ({ user, params, ip }) => {
        const id = num(params.id)
        extra?.beforeDelete?.(id)
        await db().prepare(`DELETE FROM ${table} WHERE id=?`).run(id)
        extra?.after?.()
        await audit(user, `${table}_delete`, table, id, null, ip)
        return json({ ok: true })
      },
    },
    {
      method: 'POST',
      path: `${table.replace(/_/g, '-')}/reorder`,
      perm,
      handler: async ({ req }) => {
        const { ids } = await readJson(req, z.object({ ids: z.array(z.number().int()).max(500) }))
        const st = db().prepare(`UPDATE ${table} SET sort=? WHERE id=?`)
        await tx(async () => {
    for (const [i, id] of ids.entries()) await st.run(i, id)
  })
        return json({ ok: true })
      },
    },
  ]
}

const zoneSchema = z.object({
  name: s(80).min(1),
  country: s(60).min(1),
  cities: z.array(s(60)).max(200),
  fee: z.number().int().min(0),
  freeShippingEligible: z.boolean(),
  etaText: s(80),
  active: z.boolean(),
})
const wrapSchema = z.object({ name: s(80).min(1), description: s(300), price: z.number().int().min(0), imageId: z.number().int().nullable(), active: z.boolean() })
const methodSchema = z.object({
  name: s(80).min(1, 'اسم البنك أو المحفظة مطلوب'),
  type: z.enum(['bank', 'wallet', 'exchange', 'other']),
  beneficiary: s(120).min(1, 'اسم المستفيد مطلوب'),
  accountNumber: s(80).min(1, 'رقم الحساب أو المحفظة مطلوب'),
  extraInfo: s(500),
  currency: s(80),
  instructions: s(1000),
  qrMediaId: z.number().int().nullable(),
  active: z.boolean(),
})
const couponSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{3,30}$/, 'الرمز حروف إنجليزية وأرقام فقط (3-30)'),
  description: s(200),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1),
  minOrder: z.number().int().min(0).nullable(),
  maxDiscount: z.number().int().min(0).nullable(),
  startsAt: date,
  endsAt: date,
  usageLimit: z.number().int().min(1).nullable(),
  perCustomerLimit: z.number().int().min(1).nullable(),
  categoryIds: z.array(z.number().int()).max(100),
  productIds: z.array(z.number().int()).max(200),
  combineWithSale: z.boolean(),
  active: z.boolean(),
})
const pageSchema = z.object({ slug: s(80), title: s(120).min(1), content: s(30000), status: z.enum(['draft', 'published']), showInFooter: z.boolean(), seoTitle: s(120), seoDescription: s(300) })
const faqSchema = z.object({ question: s(300).min(1), answer: s(3000).min(1), category: s(80), published: z.boolean() })

export const SETTINGS_ROUTES: Route[] = [
  // ===== الحساب =====
  {
    method: 'POST',
    path: 'auth/logout',
    perm: null,
    handler: async ({ req, user, ip }) => {
      const t = req.cookies.get(SESSION_COOKIE)?.value
      if (t) await revokeToken(t)
      await audit(user, 'logout', 'user', user.id, null, ip)
      const res = json({ ok: true })
      res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
      return res
    },
  },
  {
    method: 'POST',
    path: 'account/password',
    perm: null,
    handler: async ({ req, user, ip }) => {
      const b = await readJson(req, z.object({ current: s(200), next: s(200) }))
      const row = await db().prepare('SELECT password_hash FROM admin_users WHERE id=?').get(user.id) as { password_hash: string }
      if (!verifyPassword(b.current, row.password_hash)) throw new ApiError(400, 'كلمة المرور الحالية غير صحيحة')
      const p = passwordProblem(b.next)
      if (p) throw new ApiError(400, p)
      await db().prepare("UPDATE admin_users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(hashPassword(b.next), user.id)
      await revokeUserSessions(user.id, req.cookies.get(SESSION_COOKIE)?.value)
      await audit(user, 'password_change', 'user', user.id, null, ip)
      return json({ ok: true })
    },
  },
  // ===== الإشعارات =====
  {
    method: 'GET',
    path: 'notifications',
    perm: null,
    handler: async ({ user }) => {
      const perms = user.permissions.includes('owner') ? ['orders', 'payments', 'products', 'owner'] : user.permissions
      const seen = (await db().prepare('SELECT notif_seen_id FROM admin_users WHERE id=?').get(user.id) as { notif_seen_id: number }).notif_seen_id
      const ph = perms.map(() => '?').join(',')
      const items = await db().prepare(`SELECT * FROM notifications WHERE permission IN (${ph}) ORDER BY id DESC LIMIT 20`).all(...perms) as {
        id: number; type: string; title: string; body: string; link: string; created_at: string
      }[]
      const unread = (await db().prepare(`SELECT COUNT(*) n FROM notifications WHERE permission IN (${ph}) AND id>?`).get(...perms, seen) as { n: number }).n
      return json({ items, unread, seen, latestId: items[0]?.id || 0 })
    },
  },
  {
    method: 'POST',
    path: 'notifications/seen',
    perm: null,
    handler: async ({ req, user }) => {
      const { id } = await readJson(req, z.object({ id: z.number().int().min(0) }))
      await db().prepare('UPDATE admin_users SET notif_seen_id=GREATEST(notif_seen_id, ?) WHERE id=?').run(id, user.id)
      return json({ ok: true })
    },
  },
  // ===== الإعدادات =====
  {
    method: 'PUT',
    path: 'settings/:key',
    perm: 'owner',
    handler: async ({ req, user, params, ip }) => {
      const key = params.key as SettingKey
      const schema = SETTING_SCHEMAS[key]
      if (!schema) throw new ApiError(404, 'إعداد غير معروف')
      const value = await readJson(req, schema as z.ZodTypeAny)
      await setSetting(key, value as never)
      if (['inventory', 'personalization', 'checkout'].includes(key)) await invalidateCatalog()
      await audit(user, 'settings_update', 'settings', key, key === 'store' ? { whatsapp: (value as { whatsappNumber: string }).whatsappNumber } : null, ip)
      return json({ ok: true })
    },
  },
  ...crud('shipping_zones', zoneSchema, (b: z.infer<typeof zoneSchema>) => ({
    name: b.name, country: b.country, cities: JSON.stringify(b.cities.map((c) => c.trim()).filter(Boolean)), fee: b.fee,
    free_shipping_eligible: b.freeShippingEligible ? 1 : 0, eta_text: b.etaText || null, active: b.active ? 1 : 0, is_demo: 0,
  }), 'owner'),
  ...crud('gift_wraps', wrapSchema, (b: z.infer<typeof wrapSchema>) => ({
    name: b.name, description: b.description || null, price: b.price, image_id: b.imageId, active: b.active ? 1 : 0,
  }), 'owner'),
  ...crud('transfer_methods', methodSchema, (b: z.infer<typeof methodSchema>) => ({
    name: b.name, type: b.type, beneficiary: b.beneficiary.trim(), account_number: b.accountNumber.trim(), extra_info: b.extraInfo || null,
    currency: b.currency || null, instructions: b.instructions || null, qr_media_id: b.qrMediaId, active: b.active ? 1 : 0, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  }), 'owner'),
  ...crud('coupons', couponSchema, (b: z.infer<typeof couponSchema>) => {
    if (b.type === 'percent' && b.value > 10000) throw new ApiError(400, 'نسبة الخصم لا تتجاوز 100%')
    return {
      code: b.code.toUpperCase(), description: b.description || null, type: b.type, value: b.value, min_order: b.minOrder, max_discount: b.maxDiscount,
      starts_at: b.startsAt, ends_at: b.endsAt, usage_limit: b.usageLimit, per_customer_limit: b.perCustomerLimit,
      category_ids: JSON.stringify(b.categoryIds), product_ids: JSON.stringify(b.productIds), combine_with_sale: b.combineWithSale ? 1 : 0, active: b.active ? 1 : 0, is_demo: 0,
    }
  }, 'owner', {
    beforeDelete: async (id) => {
      if (await db().prepare('SELECT 1 FROM orders WHERE coupon_id=? LIMIT 1').get(id)) throw new ApiError(400, 'الكوبون مستخدم في طلبات سابقة. عطّله بدلاً من حذفه')
    },
  }),
  ...crud('faqs', faqSchema, (b: z.infer<typeof faqSchema>) => ({ question: b.question, answer: b.answer, category: b.category || null, published: b.published ? 1 : 0 }), 'owner'),
  // ===== الصفحات =====
  {
    method: 'POST',
    path: 'pages',
    perm: 'owner',
    handler: async ({ req, user, ip }) => {
      const b = await readJson(req, pageSchema)
      const slug = await uniqueSlug(b.slug || b.title, null, 'pages')
      const id = Number(
        (await db().prepare('INSERT INTO pages(slug,title,content,status,show_in_footer,seo_title,seo_description,sort) VALUES(?,?,?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM pages))')
          .run(slug, b.title, b.content, b.status, b.showInFooter ? 1 : 0, b.seoTitle || null, b.seoDescription || null)).lastInsertRowid,
      )
      await audit(user, 'page_create', 'page', id, { slug }, ip)
      return json({ ok: true, id, slug })
    },
  },
  {
    method: 'PUT',
    path: 'pages/:id',
    perm: 'owner',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, pageSchema)
      const id = num(params.id)
      const cur = await db().prepare('SELECT slug, system FROM pages WHERE id=?').get(id) as { slug: string; system: number } | undefined
      if (!cur) throw new ApiError(404, 'الصفحة غير موجودة')
      const slug = cur.system ? cur.slug : await uniqueSlug(b.slug || b.title, id, 'pages')
      await db().prepare("UPDATE pages SET slug=?, title=?, content=?, status=?, show_in_footer=?, seo_title=?, seo_description=?, updated_at=datetime('now') WHERE id=?")
        .run(slug, b.title, b.content, b.status, b.showInFooter ? 1 : 0, b.seoTitle || null, b.seoDescription || null, id)
      await audit(user, 'page_update', 'page', id, { slug }, ip)
      return json({ ok: true, slug })
    },
  },
  {
    method: 'DELETE',
    path: 'pages/:id',
    perm: 'owner',
    handler: async ({ params, user, ip }) => {
      const p = await db().prepare('SELECT system FROM pages WHERE id=?').get(num(params.id)) as { system: number } | undefined
      if (!p) throw new ApiError(404, 'غير موجودة')
      if (p.system) throw new ApiError(400, 'صفحة أساسية لا يمكن حذفها؛ يمكنك تحويلها لمسودة لإخفائها')
      await db().prepare('DELETE FROM pages WHERE id=?').run(num(params.id))
      await audit(user, 'page_delete', 'page', params.id, null, ip)
      return json({ ok: true })
    },
  },
  // ===== المظهر =====
  {
    method: 'GET',
    path: 'appearance',
    perm: 'owner',
    handler: async () => {
      const d = await getDraftAppearance()
      return json({ ...d, versions: await listVersions() })
    },
  },
  {
    method: 'PUT',
    path: 'appearance',
    perm: 'owner',
    handler: async ({ req, user }) => {
      const b = await readJson(req, appearanceSchema)
      await saveDraft(b as unknown as Appearance, { id: user.id, name: user.name })
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'appearance/publish',
    perm: 'owner',
    handler: async ({ req, user, ip }) => {
      const { note } = await readJson(req, z.object({ note: s(200).optional() }))
      if (!await publishDraft({ id: user.id, name: user.name }, note)) throw new ApiError(400, 'لا توجد مسودة لنشرها. احفظ التعديلات أولاً')
      await invalidateCatalog()
      await audit(user, 'appearance_publish', 'appearance', null, { note }, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'appearance/discard',
    perm: 'owner',
    handler: async ({ user, ip }) => {
      await discardDraft()
      await audit(user, 'appearance_discard', 'appearance', null, null, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'appearance/restore/:id',
    perm: 'owner',
    handler: async ({ user, params, ip }) => {
      if (!await restoreVersionToDraft(num(params.id), { id: user.id, name: user.name })) throw new ApiError(404, 'النسخة غير موجودة')
      await audit(user, 'appearance_restore', 'appearance', params.id, null, ip)
      return json({ ok: true })
    },
  },
  // ===== المستخدمون =====
  {
    method: 'POST',
    path: 'users',
    perm: 'owner',
    handler: async ({ req, user, ip }) => {
      const b = await readJson(
        req,
        z.object({ username: z.string().regex(/^[a-zA-Z0-9_.-]{3,40}$/, 'اسم المستخدم حروف إنجليزية وأرقام (3-40)'), name: s(80).min(2), password: s(200), permissions: z.array(z.enum(PERMISSIONS)).min(1, 'اختر صلاحية واحدة على الأقل') }),
      )
      const p = passwordProblem(b.password)
      if (p) throw new ApiError(400, p)
      const id = Number(
        (await db().prepare('INSERT INTO admin_users(username,name,password_hash,permissions) VALUES(?,?,?,?)').run(b.username, b.name, hashPassword(b.password), JSON.stringify(b.permissions))).lastInsertRowid,
      )
      await audit(user, 'user_create', 'user', id, { username: b.username, permissions: b.permissions }, ip)
      return json({ ok: true, id })
    },
  },
  {
    method: 'PUT',
    path: 'users/:id',
    perm: 'owner',
    handler: async ({ req, user, params, ip }) => {
      const b = await readJson(req, z.object({ name: s(80).min(2), permissions: z.array(z.enum(PERMISSIONS)).min(1), active: z.boolean() }))
      const id = num(params.id)
      if (id === user.id && (!b.active || !b.permissions.includes('owner'))) throw new ApiError(400, 'لا يمكنك إزالة صلاحية المالك أو تعطيل حسابك بنفسك')
      const owners = (await db().prepare("SELECT COUNT(*) n FROM admin_users WHERE active=1 AND permissions LIKE '%owner%' AND id<>?").get(id) as { n: number }).n
      if (owners === 0 && (!b.active || !b.permissions.includes('owner'))) throw new ApiError(400, 'يجب أن يبقى حساب مالك واحد مفعل على الأقل')
      await db().prepare("UPDATE admin_users SET name=?, permissions=?, active=?, updated_at=datetime('now') WHERE id=?").run(b.name, JSON.stringify(b.permissions), b.active ? 1 : 0, id)
      if (!b.active) await revokeUserSessions(id)
      await audit(user, 'user_update', 'user', id, b, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'users/:id/password',
    perm: 'owner',
    handler: async ({ req, user, params, ip }) => {
      const { password } = await readJson(req, z.object({ password: s(200) }))
      const p = passwordProblem(password)
      if (p) throw new ApiError(400, p)
      const id = num(params.id)
      await db().prepare("UPDATE admin_users SET password_hash=?, failed_logins=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?").run(hashPassword(password), id)
      await revokeUserSessions(id)
      await audit(user, 'user_password_reset', 'user', id, null, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'DELETE',
    path: 'users/:id/sessions',
    perm: 'owner',
    handler: async ({ params, user, ip }) => {
      await revokeUserSessions(num(params.id))
      await audit(user, 'user_sessions_revoke', 'user', params.id, null, ip)
      return json({ ok: true })
    },
  },
  // ===== النسخ الاحتياطي =====
  {
    method: 'POST',
    path: 'backups',
    perm: 'owner',
    handler: async ({ user, ip }) => {
      const name = await createBackup('manual')
      await audit(user, 'backup_create', 'backup', name, null, ip)
      return json({ ok: true, name, list: await listBackups() })
    },
  },
  {
    method: 'GET',
    path: 'backups/:name',
    perm: 'owner',
    handler: async ({ params, user, ip }) => {
      const data = await getBackup(params.name)
      if (!data) throw new ApiError(404, 'غير موجودة')
      await audit(user, 'backup_download', 'backup', params.name, null, ip)
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${params.name}"`, 'Cache-Control': 'no-store' },
      })
    },
  },
  {
    method: 'DELETE',
    path: 'backups/:name',
    perm: 'owner',
    handler: async ({ params, user, ip }) => {
      if (!(await deleteBackup(params.name))) throw new ApiError(404, 'غير موجودة')
      await audit(user, 'backup_delete', 'backup', params.name, null, ip)
      return json({ ok: true })
    },
  },
  {
    method: 'POST',
    path: 'backups/restore',
    perm: 'owner',
    handler: async ({ req, user, ip }) => {
      const form = await req.formData()
      const password = String(form.get('password') || '')
      const row = await db().prepare('SELECT password_hash FROM admin_users WHERE id=?').get<{ password_hash: string }>(user.id)
      if (!row || !verifyPassword(password, row.password_hash)) throw new ApiError(403, 'كلمة المرور غير صحيحة')
      const confirm = String(form.get('confirm') || '')
      if (confirm !== 'استعادة') throw new ApiError(400, 'اكتب كلمة «استعادة» للتأكيد')
      const name = String(form.get('name') || '')
      let data: Buffer | null = name ? await getBackup(name) : null
      const f = form.get('file')
      if (!data && f && typeof f !== 'string') {
        const file = f as File
        if (file.size > 5.5 * 1024 * 1024) throw new ApiError(413, 'الملف كبير جداً (الحد 5 ميجابايت)')
        data = Buffer.from(await file.arrayBuffer())
      }
      if (!data) throw new ApiError(400, 'اختر نسخة احتياطية')
      try {
        const r = await restoreBackup(data)
        await audit(user, 'backup_restore', 'backup', name || 'upload', r, ip)
        return json({ ok: true, safety: r.safety })
      } catch (e) {
        throw new ApiError(400, (e as Error).message)
      }
    },
  },
  // ===== البيانات التجريبية =====
  {
    method: 'POST',
    path: 'demo/delete',
    perm: 'owner',
    handler: async ({ req, user, ip }) => {
      const { confirm } = await readJson(req, z.object({ confirm: z.literal('حذف') }))
      void confirm
      const r = await deleteDemoData()
      await audit(user, 'demo_delete', 'product', null, r, ip)
      return json({ ok: true, ...r })
    },
  },
]
