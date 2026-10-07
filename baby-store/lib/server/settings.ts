import { db, parseJson } from './db'
import { bumpCacheVersion, ensureFresh, onInvalidate } from './cache'
import type { AllSettings, MessageTemplate } from '../shared/types'
import { DEFAULT_CURRENCY, DEFAULT_BASE_LABEL, DEFAULT_DISPLAY_CURRENCIES } from '../shared/money'

export const DEFAULT_MESSAGES: MessageTemplate[] = [
  {
    key: 'transfer_details',
    title: 'إرسال بيانات التحويل',
    body:
      'مرحباً {customer_name} 🌸\nشكراً لطلبك من {store_name}.\nرقم الطلب: {order_number}\nالمبلغ المطلوب: {total}\n\nبيانات التحويل:\n{transfer_methods}\n\nبعد التحويل يرجى إرسال صورة السند هنا مع رقم الطلب.\nمتابعة الطلب: {tracking_link}',
  },
  {
    key: 'receipt_reminder',
    title: 'تذكير بإرسال السند',
    body:
      'مرحباً {customer_name}،\nنذكرك بطلبك رقم {order_number} بمبلغ {total}.\nإذا قمت بالتحويل يرجى إرسال صورة السند هنا لنكمل مراجعة الدفع.\nمهلة حجز المنتجات حتى: {reservation_deadline}',
  },
  {
    key: 'clearer_receipt',
    title: 'طلب سند أوضح',
    body:
      'مرحباً {customer_name}،\nبخصوص الطلب رقم {order_number}: صورة السند المرسلة غير واضحة بما يكفي لمراجعة التحويل.\nنرجو إرسال صورة أوضح يظهر فيها المبلغ ورقم العملية والتاريخ. شكراً لتفهمك.',
  },
  {
    key: 'payment_confirmed',
    title: 'تأكيد مراجعة الدفع',
    body:
      'مرحباً {customer_name} 🌸\nتمت مراجعة التحويل الخاص بالطلب رقم {order_number} وتأكيد استلام المبلغ.\nسنبدأ بتجهيز طلبك ونبلغك بأي تحديث.\nمتابعة الطلب: {tracking_link}',
  },
  {
    key: 'order_preparing',
    title: 'تأكيد تجهيز الطلب',
    body: 'مرحباً {customer_name}،\nطلبك رقم {order_number} الآن قيد التجهيز 🎁\nمتابعة الطلب: {tracking_link}',
  },
  {
    key: 'shipping_details',
    title: 'إرسال بيانات الشحن',
    body:
      'مرحباً {customer_name}،\nتم شحن طلبك رقم {order_number} 🚚\nشركة الشحن: {shipping_carrier}\nرقم التتبع: {tracking_number}\n{tracking_url}\nمتابعة الطلب: {tracking_link}',
  },
]

export const DEFAULT_SETTINGS: AllSettings = {
  store: {
    currency: { ...DEFAULT_CURRENCY },
    currencyLabel: DEFAULT_BASE_LABEL,
    displayCurrencies: DEFAULT_DISPLAY_CURRENCIES.map((c) => ({ ...c })),
    timezone: 'Asia/Aden',
    whatsappCountryCode: '967',
    whatsappNumber: '775038900',
    phone: '',
    email: '',
    address: '',
    workingHours: '',
    mapUrl: '',
    orderPrefix: 'GH',
    skuPrefix: 'GH',
    defaultCountry: 'اليمن',
    defaultPhoneCode: '967',
  },
  checkout: {
    deliveryEnabled: true,
    pickupEnabled: false,
    pickupAddress: '',
    pickupNotes: '',
    reservationMinutes: 24 * 60,
    autoCancelAfterExpiryHours: 0,
    maxPendingPerPhone: 3,
    maxQtyPerLine: 20,
    ordersPerIpPer10Min: 5,
    notesMax: 500,
  },
  shipping: { freeShippingEnabled: false, freeShippingThreshold: 0 },
  gifts: {
    giftOrderEnabled: true,
    giftWrapEnabled: true,
    giftMessageEnabled: true,
    giftMessageMax: 250,
    recipientEnabled: true,
    hidePricesEnabled: true,
  },
  personalization: { enabled: true },
  inventory: { lowStockThreshold: 3, showLowStockToCustomers: true },
  maintenance: {
    enabled: false,
    title: 'نجهز المتجر لكم',
    message: 'نعمل حالياً على تحديث المتجر وسنعود قريباً بإذن الله. يمكنكم التواصل معنا عبر واتساب.',
  },
  messages: DEFAULT_MESSAGES,
  backup: { autoEnabled: true, keep: 7, lastAutoAt: null },
}

type Key = keyof AllSettings

type CacheShape = { __settingsCache?: Partial<AllSettings> }
const g = globalThis as unknown as CacheShape

function mergeDefaults<K extends Key>(key: K, value: unknown): AllSettings[K] {
  const def = DEFAULT_SETTINGS[key]
  if (Array.isArray(def)) {
    if (key === 'messages' && Array.isArray(value)) {
      // نضيف القوالب الافتراضية الناقصة مع الحفاظ على تعديلات المالك
      const list = value as MessageTemplate[]
      const keys = new Set(list.map((m) => m.key))
      return [...list, ...(def as MessageTemplate[]).filter((m) => !keys.has(m.key))] as AllSettings[K]
    }
    return (Array.isArray(value) ? value : def) as AllSettings[K]
  }
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const merged = { ...(def as object), ...obj } as Record<string, unknown>
  if (key === 'store') {
    merged.currency = { ...DEFAULT_CURRENCY, ...((obj.currency as object) || {}) }
    // نضمن وجود العملتين اليمنيتين في القائمة حتى لو حُفظت الإعدادات قبل إضافتها
    const saved = Array.isArray(obj.displayCurrencies) ? (obj.displayCurrencies as { id: string }[]) : []
    const ids = new Set(saved.map((c) => c.id))
    merged.displayCurrencies = [...saved, ...DEFAULT_DISPLAY_CURRENCIES.filter((c) => !ids.has(c.id)).map((c) => ({ ...c }))]
  }
  return merged as AllSettings[K]
}

export async function getSetting<K extends Key>(key: K): Promise<AllSettings[K]> {
  await ensureFresh()
  if (!g.__settingsCache) g.__settingsCache = {}
  const cached = g.__settingsCache[key]
  if (cached) return cached as AllSettings[K]
  const row = await db().prepare('SELECT value FROM settings WHERE key=?').get<{ value: string }>(key)
  const value = mergeDefaults(key, row ? parseJson(row.value, null) : null)
  g.__settingsCache[key] = value
  return value
}

export async function setSetting<K extends Key>(key: K, value: AllSettings[K]) {
  await db()
    .prepare(
      "INSERT INTO settings(key,value,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
    )
    .run(key, JSON.stringify(value))
  await bumpCacheVersion()
}

export function clearSettingsCache() {
  g.__settingsCache = {}
}
onInvalidate(clearSettingsCache)

export async function getAllSettings(): Promise<AllSettings> {
  return {
    store: await getSetting('store'),
    checkout: await getSetting('checkout'),
    shipping: await getSetting('shipping'),
    gifts: await getSetting('gifts'),
    personalization: await getSetting('personalization'),
    inventory: await getSetting('inventory'),
    maintenance: await getSetting('maintenance'),
    messages: await getSetting('messages'),
    backup: await getSetting('backup'),
  }
}

/** رقم واتساب المتجر بالصيغة الدولية (أرقام فقط) مثل 967775038900 */
export async function storeWhatsapp(): Promise<string> {
  const s = await getSetting('store')
  const cc = s.whatsappCountryCode.replace(/\D/g, '')
  const n = s.whatsappNumber.replace(/\D/g, '').replace(/^0+/, '')
  if (n.startsWith(cc) && n.length > cc.length + 6) return n
  return cc + n
}

export function siteUrl(fallbackOrigin?: string): string {
  // SITE_URL يدوياً، أو URL الذي توفره Netlify تلقائياً
  const env = process.env.SITE_URL || process.env.URL
  if (env) return env.replace(/\/+$/, '')
  return (fallbackOrigin || 'http://localhost:3000').replace(/\/+$/, '')
}
