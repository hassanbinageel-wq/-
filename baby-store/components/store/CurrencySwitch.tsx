'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useStore } from './StoreProvider'

/** اختيار عملة عرض الأسعار. يُحفظ في ملف تعريف ويُعاد عرض الصفحة من الخادم بالعملة الجديدة */
export function CurrencySwitch({ compact }: { compact?: boolean }) {
  const { config } = useStore()
  const router = useRouter()
  const [pending, start] = useTransition()
  if (config.currencies.length < 2) return null
  const current = config.currency.id || 'base'
  return (
    <label className={`cur-switch ${compact ? 'cur-switch--compact' : ''}`} aria-busy={pending}>
      <span className="sr-only">عملة عرض الأسعار</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          document.cookie = `gh_cur=${encodeURIComponent(e.target.value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
          start(() => router.refresh())
        }}
      >
        {config.currencies.map((c) => (
          <option key={c.id} value={c.id}>
            {compact ? c.symbol : c.label} {compact ? '' : `(${c.symbol})`}
          </option>
        ))}
      </select>
    </label>
  )
}
