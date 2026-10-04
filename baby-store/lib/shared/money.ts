// المبالغ تُخزن بوحدة السنت (×100). العرض يعتمد على إعدادات العملة.

export type CurrencyConfig = {
  code: string
  symbol: string
  decimals: number
  numerals: 'latn' | 'arab'
}

export const DEFAULT_CURRENCY: CurrencyConfig = { code: 'YER', symbol: 'ر.ي', decimals: 0, numerals: 'latn' }

/** تقريب المبلغ (بالسنت) إلى دقة العملة */
export function roundMoney(cents: number, decimals: number): number {
  const step = Math.pow(10, Math.max(0, 2 - Math.min(2, decimals)))
  return Math.round(cents / step) * step
}

export function formatNumber(n: number, cfg: Pick<CurrencyConfig, 'numerals'>, fractionDigits = 0): string {
  return new Intl.NumberFormat(cfg.numerals === 'arab' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)
}

/** تنسيق مبلغ للعرض مثل: 12,500 ر.ي */
export function formatMoney(cents: number, cfg: CurrencyConfig = DEFAULT_CURRENCY): string {
  const value = cents / 100
  const digits = Math.max(0, Math.min(2, cfg.decimals))
  return `${formatNumber(value, cfg, digits)} ${cfg.symbol}`
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
