// المبالغ تُخزن بوحدة السنت (×100) بالعملة الأساسية. العرض قد يكون بعملة أخرى يختارها العميل حسب سعر صرف يحدده المالك.

export type CurrencyConfig = {
  code: string
  symbol: string
  decimals: number
  numerals: 'latn' | 'arab'
  /** لعملات العرض فقط: عدد وحدات هذه العملة مقابل وحدة واحدة من العملة الأساسية */
  rate?: number
  /** تقريب المبلغ المحول لأقرب مضاعف (مثل 10 أو 50 ريال يمني). 1 = بدون */
  roundTo?: number
  /** اسم العملة للعميل مثل «ريال يمني/صنعاء» */
  label?: string
  /** معرف عملة العرض (base للعملة الأساسية) */
  id?: string
}

/** عملة عرض إضافية يحددها المالك من الإعدادات */
export type DisplayCurrency = {
  id: string
  label: string
  code: string
  symbol: string
  decimals: number
  rate: number
  roundTo: number
  enabled: boolean
}

export const DEFAULT_CURRENCY: CurrencyConfig = { code: 'SAR', symbol: 'ر.س', decimals: 2, numerals: 'latn' }
export const DEFAULT_BASE_LABEL = 'ريال سعودي'

// أسعار الصرف تُترك صفراً حتى يدخلها المالك، ولا تظهر العملة للعميل قبل ذلك
export const DEFAULT_DISPLAY_CURRENCIES: DisplayCurrency[] = [
  { id: 'yer', label: 'ريال يمني', code: 'YER', symbol: 'ر.ي', decimals: 0, rate: 0, roundTo: 1, enabled: false },
  { id: 'yer_sanaa', label: 'ريال يمني/صنعاء', code: 'YER', symbol: 'ر.ي', decimals: 0, rate: 0, roundTo: 1, enabled: false },
]

/** تقريب المبلغ (بالسنت) إلى دقة العملة */
export function roundMoney(cents: number, decimals: number): number {
  const step = Math.pow(10, Math.max(0, 2 - Math.min(2, decimals)))
  return Math.round(cents / step) * step
}

/** تحويل مبلغ من العملة الأساسية (سنت) إلى عملة العرض (سنت) مع التقريب حسب إعداداتها */
export function convertMoney(cents: number, cfg: CurrencyConfig = DEFAULT_CURRENCY): number {
  const rate = cfg.rate && cfg.rate > 0 ? cfg.rate : 1
  let v = rate === 1 ? cents : cents * rate
  const roundTo = cfg.roundTo && cfg.roundTo > 1 ? cfg.roundTo * 100 : 0
  if (roundTo && rate !== 1) v = Math.round(v / roundTo) * roundTo
  return roundMoney(Math.round(v), cfg.decimals)
}

export function formatNumber(n: number, cfg: Pick<CurrencyConfig, 'numerals'>, fractionDigits = 0): string {
  return new Intl.NumberFormat(cfg.numerals === 'arab' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)
}

/** تنسيق مبلغ للعرض مثل: 125 ر.س أو 12,500 ر.ي (مع التحويل إن كانت عملة عرض) */
export function formatMoney(cents: number, cfg: CurrencyConfig = DEFAULT_CURRENCY): string {
  const c = convertMoney(cents, cfg)
  const value = c / 100
  let digits = Math.max(0, Math.min(2, cfg.decimals))
  // لا نعرض ".00" للمبالغ الصحيحة
  if (digits > 0 && c % 100 === 0) digits = 0
  return `${formatNumber(value, cfg, digits)} ${cfg.symbol}`
}

/** المبلغ المحول كنص رقمي بسيط للنسخ (بدون فواصل) */
export function plainAmount(cents: number, cfg: CurrencyConfig = DEFAULT_CURRENCY): string {
  const c = convertMoney(cents, cfg)
  const digits = c % 100 === 0 ? 0 : Math.max(0, Math.min(2, cfg.decimals))
  return (c / 100).toFixed(digits)
}

/** عملات العرض المتاحة للعميل: الأساسية أولاً ثم المفعلة التي لها سعر صرف */
export function availableCurrencies(base: CurrencyConfig, baseLabel: string, list: DisplayCurrency[] | undefined): CurrencyConfig[] {
  const out: CurrencyConfig[] = [{ ...base, id: 'base', label: baseLabel || base.code, rate: undefined, roundTo: undefined }]
  for (const d of list || []) {
    if (!d.enabled || !(d.rate > 0)) continue
    out.push({ id: d.id, label: d.label, code: d.code, symbol: d.symbol, decimals: d.decimals, numerals: base.numerals, rate: d.rate, roundTo: d.roundTo })
  }
  return out
}

/** تحويل إدخال المستخدم (نص أو رقم) إلى سنت. يعيد null إذا كان غير صالح */
export function toCents(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[,\s]/g, ''))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

export function fromCents(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null
  return cents / 100
}
