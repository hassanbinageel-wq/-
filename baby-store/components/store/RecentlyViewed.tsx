'use client'

import { useEffect, useState } from 'react'
import type { ProductCard as Card } from '@/lib/shared/types'
import { useStore } from './StoreProvider'
import { ProductSection } from './Sections'

/** يعرض منتجات من قائمة محفوظة في المتصفح (شاهدت مؤخراً / المفضلة) مع بيانات محدثة من الخادم */
export function useCards(ids: number[], enabled: boolean) {
  const [cards, setCards] = useState<Card[] | null>(null)
  const sig = ids.join(',')
  useEffect(() => {
    if (!enabled) return
    if (!ids.length) {
      setCards([])
      return
    }
    const c = new AbortController()
    fetch(`/api/products?ids=${sig}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setCards(d.items || []))
      .catch(() => {})
    return () => c.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled])
  return cards
}

export function RecentlyViewed({ title, excludeId, subtitle }: { title: string; excludeId?: number; subtitle?: string }) {
  const { recent, hydrated } = useStore()
  const ids = recent.filter((id) => id !== excludeId).slice(0, 12)
  const cards = useCards(ids, hydrated)
  if (!cards || !cards.length) return null
  return <ProductSection title={title} subtitle={subtitle} items={cards} />
}
