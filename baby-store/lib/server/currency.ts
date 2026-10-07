import { cookies } from 'next/headers'
import { getSetting } from './settings'
import { availableCurrencies, type CurrencyConfig } from '../shared/money'
import type { StoreSettings } from '../shared/types'

// عملة العرض التي اختارها العميل تُحفظ في ملف تعريف بسيط (ليست بيانات حساسة)
export const CURRENCY_COOKIE = 'gh_cur'

export function storeCurrencies(store: StoreSettings): CurrencyConfig[] {
  return availableCurrencies(store.currency, store.currencyLabel, store.displayCurrencies)
}

export function pickCurrency(store: StoreSettings, id: string | null | undefined): CurrencyConfig {
  const list = storeCurrencies(store)
  return list.find((c) => c.id === id) || list[0]
}

/** عملة العرض الحالية للزائر في صفحات الخادم */
export async function currentCurrency(): Promise<CurrencyConfig> {
  const store = await getSetting('store')
  return pickCurrency(store, (await cookies()).get(CURRENCY_COOKIE)?.value)
}

type OrderCurrencyCols = {
  currency: string
  currency_symbol: string
  display_currency?: string | null
  display_label?: string | null
  display_symbol?: string | null
  display_decimals?: number | null
  display_rate?: number | null
  display_round_to?: number | null
}

/** العملة الأساسية كما حُفظت في الطلب */
export function orderBaseCurrency(o: OrderCurrencyCols, store: StoreSettings): CurrencyConfig {
  return { ...store.currency, code: o.currency, symbol: o.currency_symbol, id: 'base', label: o.currency === store.currency.code ? store.currencyLabel : o.currency }
}

/** العملة التي اختارها العميل عند الطلب، بسعر الصرف المحفوظ وقتها (لا يتأثر بتغيير السعر لاحقاً) */
export function orderCurrency(o: OrderCurrencyCols, store: StoreSettings): CurrencyConfig {
  if (!o.display_currency || !o.display_rate || o.display_rate <= 0) return orderBaseCurrency(o, store)
  const def = store.displayCurrencies.find((d) => d.id === o.display_currency)
  return {
    id: o.display_currency,
    code: def?.code || o.display_currency.toUpperCase(),
    symbol: o.display_symbol || def?.symbol || '',
    label: o.display_label || def?.label || o.display_currency,
    decimals: o.display_decimals ?? def?.decimals ?? 0,
    numerals: store.currency.numerals,
    rate: o.display_rate,
    roundTo: o.display_round_to ?? 1,
  }
}
