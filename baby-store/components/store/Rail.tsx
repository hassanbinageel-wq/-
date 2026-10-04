'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUpLeft, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { RailItem } from '@/lib/shared/types'
import { Price } from './ProductCard'
import { useStore } from './StoreProvider'

// «على الشماعة»: قطع معلقة على عمود. على الحاسوب: تمرير المؤشر يدير القطعة لتواجهك، والضغط يفتح عرضاً مركّزاً.
// على الجوال: سحب أفقي، والقطعة التي تصل للمنتصف تستدير لتواجهك، والضغط عليها يفتح العرض المركّز.

type Mode = 'hover' | 'scroll'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function Hanger({ big = false }: { big?: boolean }) {
  return (
    <svg className={`rail__hanger ${big ? 'rail__hanger--big' : ''}`} viewBox="0 0 200 60" aria-hidden="true" focusable="false">
      <path d="M100 30 V17 a8.5 8.5 0 1 1 8.5 -8.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" className="rail__hanger-hook" />
      <path d="M100 27 L14 50 Q4 53 10 57 L190 57 Q196 53 186 50 Z" className="rail__hanger-wood" />
    </svg>
  )
}

function Garment({ item, side = 'front', eager = false, sizes }: { item: RailItem; side?: 'front' | 'back'; eager?: boolean; sizes: string }) {
  const img = side === 'back' && item.back ? item.back : item.front
  return (
    <img
      className={`rail__img ${item.cutout ? 'is-cutout' : 'is-card'}`}
      src={img.url}
      srcSet={img.srcset || undefined}
      sizes={sizes}
      alt=""
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}

export function Rail({
  items,
  kicker,
  subtitle,
  buttonText,
  buttonLink,
}: {
  items: RailItem[]
  kicker: string
  subtitle: string
  buttonText: string
  buttonLink: string
}) {
  const [mode, setMode] = useState<Mode>('hover')
  const [active, setActive] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const raf = useRef(0)

  useIsoLayoutEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)')
    const apply = () => setMode(mq.matches ? 'hover' : 'scroll')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // وضع السحب: نحسب بُعد كل قطعة عن منتصف الشريط لتدويرها تدريجياً
  const updateScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const box = track.getBoundingClientRect()
    const mid = box.left + box.width / 2
    let best = 0
    let bestDist = Infinity
    itemRefs.current.forEach((li, i) => {
      if (!li) return
      const r = li.getBoundingClientRect()
      const p = (r.left + r.width / 2 - mid) / r.width
      const clamped = Math.max(-1.6, Math.min(1.6, p))
      li.style.setProperty('--p', clamped.toFixed(3))
      li.style.setProperty('--ap', Math.min(1, Math.abs(p)).toFixed(3))
      if (Math.abs(p) < bestDist) {
        bestDist = Math.abs(p)
        best = i
      }
    })
    setActive((a) => (a === best ? a : best))
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    itemRefs.current.forEach((li) => {
      li?.style.removeProperty('--p')
      li?.style.removeProperty('--ap')
    })
    if (mode !== 'scroll') {
      setActive(null)
      return
    }
    const onScroll = () => {
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(updateScroll)
    }
    // نبدأ من القطعة الثانية حتى يظهر أن الشريط قابل للسحب
    const start = itemRefs.current[Math.min(1, items.length - 1)]
    if (start) track.scrollLeft += start.getBoundingClientRect().left + start.offsetWidth / 2 - (track.getBoundingClientRect().left + track.clientWidth / 2)
    updateScroll()
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf.current)
    }
  }, [mode, items.length, updateScroll])

  const onItemClick = (i: number) => {
    if (mode === 'scroll' && active !== i) {
      itemRefs.current[i]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
      return
    }
    setOpen(i)
  }

  const closeFocus = useCallback(() => {
    setOpen((cur) => {
      if (cur !== null) requestAnimationFrame(() => btnRefs.current[cur]?.focus({ preventScroll: true }))
      return null
    })
  }, [])

  if (!items.length) return null
  const cur = active !== null ? items[active] : null
  // اتجاه دوران القطع غير النشطة: تميل نحو القطعة النشطة أو نحو المنتصف (الترتيب من اليمين لليسار)
  const pivot = active ?? (items.length - 1) / 2

  return (
    <section className="rail-sec" aria-label={kicker || 'على الشماعة'}>
      <div className="container">
        {(kicker || subtitle) && (
          <p className="rail__kicker">
            {kicker && <span>{kicker}</span>}
            {kicker && subtitle && <span className="rail__sep" aria-hidden="true" />}
            {subtitle && <span className="muted">{subtitle}</span>}
          </p>
        )}
      </div>
      <div className={`rail ${mode === 'scroll' ? 'rail--scroll' : 'rail--hover'}`}>
        <div className="rail__rod" aria-hidden="true">
          <span className="rail__bracket" />
          <span className="rail__bracket" />
        </div>
        <ul className="rail__track" ref={trackRef} onMouseLeave={() => mode === 'hover' && setActive(null)}>
          {items.map((it, i) => (
            <li
              key={it.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              className={`rail__item ${i === active ? 'is-active' : ''}`}
              style={{ ['--i' as string]: i, ['--dir' as string]: i < pivot ? 1 : -1 }}
            >
              <button
                ref={(el) => {
                  btnRefs.current[i] = el
                }}
                type="button"
                className="rail__btn"
                aria-label={`${it.name} — عرض القطعة`}
                onMouseEnter={() => mode === 'hover' && setActive(i)}
                onFocus={() => mode === 'hover' && setActive(i)}
                onClick={() => onItemClick(i)}
              >
                <span className="rail__swing">
                  <span className="rail__turn">
                    {it.cutout ? <Hanger /> : <span className="rail__peg" aria-hidden="true" />}
                    <Garment item={it} eager={i < 6} sizes={mode === 'scroll' ? '60vw' : '260px'} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="container rail__foot">
        <div className="rail__caption" aria-live="polite">
          <strong className="rail__name">{cur ? cur.name : kicker || 'على الشماعة'}</strong>
          {cur ? (
            <Price price={cur.price} compareAt={cur.compareAt} from={cur.priceFrom} className="rail__price" />
          ) : null}
          <span className="rail__hint">{mode === 'hover' ? 'مرّر المؤشر لتدوير القطعة · اضغط لاستكشافها' : 'اسحب لتقليب القطع · اضغط على القطعة لاستكشافها'}</span>
        </div>
        {buttonText && (
          <Link href={buttonLink || '/products'} className="btn btn--ghost rail__cta">
            {buttonText} <ArrowUpLeft size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      {open !== null && <RailFocus items={items} index={open} onIndex={setOpen} onClose={closeFocus} />}
    </section>
  )
}

function RailFocus({ items, index, onIndex, onClose }: { items: RailItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const { config } = useStore()
  const it = items[index]
  const [side, setSide] = useState<'front' | 'back'>('front')
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const n = items.length
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex])

  useEffect(() => setSide('front'), [index])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // الواجهة من اليمين لليسار: السهم الأيسر للقطعة التالية
      else if (e.key === 'ArrowLeft') go(1)
      else if (e.key === 'ArrowRight') go(-1)
      else if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('button, a[href]')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const pad = (x: number) => String(x).padStart(2, '0')
  return (
    <div className="rail-focus" role="dialog" aria-modal="true" aria-labelledby="rail-focus-title">
      <div className="rail-focus__backdrop" onClick={onClose} />
      <div
        className="rail-focus__panel"
        ref={panelRef}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current
          touch.current = null
          if (!s) return
          const dx = e.changedTouches[0].clientX - s.x
          const dy = e.changedTouches[0].clientY - s.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx > 0 ? 1 : -1)
        }}
      >
        <button type="button" className="rail-focus__close" onClick={onClose} ref={closeRef}>
          إغلاق <X size={18} aria-hidden="true" />
        </button>
        {n > 1 && (
          <>
            <button type="button" className="rail-focus__nav rail-focus__nav--prev" aria-label="القطعة السابقة" onClick={() => go(-1)}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <button type="button" className="rail-focus__nav rail-focus__nav--next" aria-label="القطعة التالية" onClick={() => go(1)}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          </>
        )}
        <figure className="rail-focus__stage" key={it.id}>
          <span className="rail-focus__string" aria-hidden="true" />
          <div className={`rail-focus__flip ${side === 'back' ? 'is-back' : ''}`}>
            <div className="rail-focus__face">
              {it.cutout ? <Hanger big /> : <span className="rail__peg rail__peg--big" aria-hidden="true" />}
              <Garment item={it} eager sizes="(min-width: 900px) 380px, 70vw" />
            </div>
            {it.back && (
              <div className="rail-focus__face rail-focus__face--back">
                {it.cutout ? <Hanger big /> : <span className="rail__peg rail__peg--big" aria-hidden="true" />}
                <Garment item={it} side="back" eager sizes="(min-width: 900px) 380px, 70vw" />
              </div>
            )}
          </div>
          <figcaption className="sr-only">{it.front.alt || it.name}</figcaption>
        </figure>
        <div className="rail-focus__info">
          <p className="rail-focus__count num" dir="ltr" aria-label={`القطعة ${index + 1} من ${n}`}>
            {pad(index + 1)} / {pad(n)}
          </p>
          <h2 id="rail-focus-title" className="rail-focus__title">
            {it.name}
            {it.isDemo && <span className="demo-tag">تجريبي</span>}
          </h2>
          {it.subtitle && <p className="rail-focus__sub">{it.subtitle}</p>}
          <Price price={it.price} compareAt={it.compareAt} from={it.priceFrom} className="rail-focus__price" />
          {!it.available && <p className="rail-focus__oos">غير متوفر حالياً</p>}
          {it.back && (
            <div className="rail-focus__sides" role="group" aria-label="جهة القطعة">
              <button type="button" aria-pressed={side === 'front'} onClick={() => setSide('front')}>
                الأمام
              </button>
              <button type="button" aria-pressed={side === 'back'} onClick={() => setSide('back')}>
                الخلف
              </button>
            </div>
          )}
          <div className="rail-focus__foot">
            <span>{config.storeName}</span>
            <Link href={`/product/${encodeURIComponent(it.slug)}`} className="rail-focus__link">
              عرض المنتج والطلب <ArrowUpLeft size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
