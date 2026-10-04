'use client'

import Link from 'next/link'
import { useStore } from './StoreProvider'
import { useCards } from './RecentlyViewed'
import { ProductCard } from './ProductCard'
import { EmptyIllustration } from './Deco'

export function FavoritesView() {
  const { favorites, hydrated, config } = useStore()
  const cards = useCards(favorites, hydrated)
  if (!hydrated || cards === null) {
    return (
      <div className="grid-products" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ aspectRatio: '4/6' }} />
        ))}
      </div>
    )
  }
  if (!cards.length) {
    return (
      <div className="empty">
        <EmptyIllustration kind="heart" />
        <h2 style={{ fontSize: '1.2rem' }}>{config.labels.emptyFavorites}</h2>
        <p>اضغط على أيقونة القلب في أي منتج لحفظه هنا. تُحفظ المفضلة على هذا الجهاز دون الحاجة لتسجيل.</p>
        <Link href="/products" className="btn">
          {config.labels.continueShopping}
        </Link>
      </div>
    )
  }
  const missing = favorites.length - cards.length
  return (
    <>
      {missing > 0 && <p className="small muted">بعض المنتجات المحفوظة لم تعد متاحة ({missing}).</p>}
      <div className="grid-products">
        {cards.map((p, i) => (
          <ProductCard key={p.id} p={p} index={i} />
        ))}
      </div>
    </>
  )
}
