import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ProductCard as Card } from '@/lib/shared/types'
import { ProductCard } from './ProductCard'
import { Carousel } from './Carousel'
import { Star } from './Deco'

export function SectionTitle({ title, subtitle, more, moreLabel = 'عرض الكل', as = 'h2' }: { title: string; subtitle?: string; more?: string; moreLabel?: string; as?: 'h1' | 'h2' }) {
  const H = as
  return (
    <div className="section-title">
      <div>
        <H style={as === 'h1' ? { margin: 0, display: 'flex', alignItems: 'center', gap: '0.55rem' } : undefined}>
          <Star className="orn" size={20} />
          {title}
        </H>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {more && (
        <Link className="more" href={more}>
          {moreLabel} <ChevronLeft size={17} />
        </Link>
      )}
    </div>
  )
}

export function ProductRail({ items, layout = 'carousel', label }: { items: Card[]; layout?: 'carousel' | 'grid'; label: string }) {
  if (layout === 'grid') {
    return (
      <div className="grid-products">
        {items.map((p, i) => (
          <ProductCard key={p.id} p={p} index={i} />
        ))}
      </div>
    )
  }
  return (
    <Carousel label={label}>
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} index={i} />
      ))}
    </Carousel>
  )
}

export function ProductSection({
  title,
  subtitle,
  items,
  more,
  moreLabel,
  layout,
  soft,
}: {
  title: string
  subtitle?: string
  items: Card[]
  more?: string
  moreLabel?: string
  layout?: 'carousel' | 'grid'
  soft?: boolean
}) {
  if (!items.length) return null
  return (
    <section className={`section ${soft ? 'section--soft' : ''}`}>
      <div className="container">
        <SectionTitle title={title} subtitle={subtitle} more={more} moreLabel={moreLabel} />
        <ProductRail items={items} layout={layout} label={title} />
      </div>
    </section>
  )
}
