'use client'

import { useEffect, useRef, useState } from 'react'
import type { CartLineSnapshot, Quote } from '@/lib/shared/types'

export type QuoteOpts = {
  coupon?: string | null
  fulfillment?: 'delivery' | 'pickup' | null
  country?: string | null
  city?: string | null
  isGift?: boolean
  giftWrapId?: number | null
}

export type QuoteResponse = { quote: Quote; suggestions: import('@/lib/shared/types').ProductCard[] }

export async function fetchQuote(lines: CartLineSnapshot[], opts: QuoteOpts, withSuggestions = false): Promise<QuoteResponse> {
  const r = await fetch('/api/cart/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lines: lines.map(({ key, productId, variantId, qty, bundle, personalization }) => ({ key, productId, variantId, qty, bundle, personalization })),
      couponCode: opts.coupon || null,
      fulfillment: opts.fulfillment || null,
      country: opts.country || null,
      city: opts.city || null,
      isGift: !!opts.isGift,
      giftWrapId: opts.giftWrapId || null,
      suggestions: withSuggestions,
    }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'تعذر حساب السلة')
  return data
}

/** يحسب السلة في الخادم عند تغير المحتوى أو الخيارات */
export function useQuote(lines: CartLineSnapshot[], opts: QuoteOpts, enabled = true, withSuggestions = false) {
  const [data, setData] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const sig = JSON.stringify([lines.map((l) => [l.key, l.qty]), opts])

  useEffect(() => {
    if (!enabled) return
    if (!lines.length) {
      setData(null)
      return
    }
    const my = ++seq.current
    setLoading(true)
    const t = setTimeout(() => {
      fetchQuote(lines, opts, withSuggestions)
        .then((d) => {
          if (my === seq.current) {
            setData(d)
            setError(null)
          }
        })
        .catch((e: Error) => my === seq.current && setError(e.message))
        .finally(() => my === seq.current && setLoading(false))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled])

  return { quote: data?.quote || null, suggestions: data?.suggestions || [], loading, error }
}
