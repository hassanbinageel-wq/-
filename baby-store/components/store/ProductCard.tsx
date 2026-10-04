'use client'

import Link from 'next/link'
import { Eye, Heart } from 'lucide-react'
import type { ProductCard as Card } from '@/lib/shared/types'
import { useStore } from './StoreProvider'

export function Price({ price, compareAt, from, className = '' }: { price: number; compareAt?: number | null; from?: boolean; className?: string }) {
  const { money } = useStore()
  const sale = compareAt != null && compareAt > price
  return (
    <span className={`price ${sale ? 'price--sale' : ''} ${className}`}>
      {from && <span className="price__from">يبدأ من</span>}
      <span className="price__now num">{money(price)}</span>
      {sale && (
        <s className="price__was num" aria-label={`السعر قبل التخفيض ${money(compareAt!)}`}>
          {money(compareAt!)}
        </s>
      )}
    </span>
  )
}

export function ProductCard({ p, index = 0, priority = false }: { p: Card; index?: number; priority?: boolean }) {
  const { config, isFavorite, toggleFavorite, openQuickView, hydrated } = useStore()
  const L = config.labels
  const main = p.images[0]
  const alt = config.productCard.hoverSecondImage ? p.images[1] : undefined
  const fav = hydrated && isFavorite(p.id)
  const discount = p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0
  return (
    <article className={`pcard reveal ${alt ? 'has-alt' : ''} ${p.available ? '' : 'is-out'}`} style={{ ['--d' as string]: `${(index % 4) * 70}ms` }}>
      <Link href={`/product/${encodeURIComponent(p.slug)}`} className="pcard__media" tabIndex={-1} aria-hidden="true">
        {main ? (
          <img
            className="img-main"
            src={main.url}
            srcSet={main.srcset}
            sizes="(min-width:1100px) 25vw, (min-width:700px) 33vw, 50vw"
            alt={main.alt || p.name}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            width={main.w || undefined}
            height={main.h || undefined}
          />
        ) : (
          <span className="center muted" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            لا توجد صورة
          </span>
        )}
        {alt && <img className="img-alt" src={alt.url} srcSet={alt.srcset} sizes="(min-width:1100px) 25vw, 50vw" alt="" loading="lazy" decoding="async" />}
      </Link>
      <div className="pcard__badges">
        {!p.available && <span className="badge badge--out">{L.outOfStock || 'غير متوفر'}</span>}
        {p.available && discount > 0 && <span className="badge badge--sale">{L.saleBadge || 'عرض'} ‎-{discount}%</span>}
        {p.type === 'bundle' && <span className="badge badge--bundle">{L.bundleBadge || 'باقة'}</span>}
        {p.isNew && p.available && !discount && p.type !== 'bundle' && <span className="badge badge--new">{L.newBadge || 'جديد'}</span>}
      </div>
      <button
        type="button"
        className="icon-btn pcard__fav"
        aria-pressed={fav}
        aria-label={fav ? `إزالة ${p.name} من المفضلة` : `إضافة ${p.name} إلى المفضلة`}
        onClick={() => toggleFavorite(p.id, p.name)}
      >
        <Heart size={20} />
      </button>
      {config.productCard.quickView && (
        <>
          <button type="button" className="btn btn--white btn--sm pcard__quick" onClick={() => openQuickView(p.id)}>
            <Eye size={17} /> {L.quickView || 'نظرة سريعة'}
          </button>
          <button type="button" className="icon-btn pcard__quick-m" aria-label={`نظرة سريعة على ${p.name}`} onClick={() => openQuickView(p.id)}>
            <Eye size={18} />
          </button>
        </>
      )}
      <div className="pcard__body">
        <span className="pcard__cat">
          {p.categoryName}
          {p.isDemo && <span className="demo-tag">تجريبي</span>}
        </span>
        <h3 className="pcard__name" style={{ fontFamily: 'var(--font-body)', fontWeight: 400, margin: 0, fontSize: '0.97rem' }}>
          <Link href={`/product/${encodeURIComponent(p.slug)}`}>{p.name}</Link>
        </h3>
        <div className="pcard__foot">
          <Price price={p.price} compareAt={p.compareAt} from={p.priceFrom} />
          {p.colors.length > 1 && (
            <span className="swatches" aria-label={`الألوان المتاحة: ${p.colors.map((c) => c.value).join('، ')}`}>
              {p.colors.slice(0, 4).map((c) => (
                <i key={c.value} className="swatch-dot" style={{ background: c.color || 'var(--c-soft)' }} title={c.value} />
              ))}
            </span>
          )}
        </div>
        {p.lowStock != null && <span className="low-stock">متبقٍ {p.lowStock} فقط</span>}
      </div>
    </article>
  )
}
