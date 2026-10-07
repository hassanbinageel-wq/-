'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUpLeft, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { RailItem } from '@/lib/shared/types'
import { Price } from './ProductCard'
import { useStore } from './StoreProvider'

// «على الشماعة»: قطع معلقة على عمود. على الحاسوب: تمرير المؤشر يدير القطعة لتواجهك، والضغط يفتح عرضاً مركّزاً.
// على الجوال: سحب أفقي، والقطعة التي تصل للمنتصف تستدير لتواجهك، والضغط عليها يفتح العرض المركّز.

type Mode = 'hover' | 'scroll'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** شماعة خشبية واقعية: خطاف معدني ورقبة وكتفان خشبيان (للصور المفرغة بدون شماعة) أو عارضة بمشبكين (للصور العادية) */
function Hanger({ kind, big = false }: { kind: 'shoulder' | 'clip'; big?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const wood = `hw-${uid}`
  const metal = `hm-${uid}`
  return (
    <svg
      className={`rail__hanger rail__hanger--${kind} ${big ? 'rail__hanger--big' : ''}`}
      viewBox={kind === 'shoulder' ? '0 0 200 62' : '0 0 200 60'}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={wood} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2b884" />
          <stop offset="0.45" stopColor="#c08b52" />
          <stop offset="1" stopColor="#8d5b2e" />
        </linearGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f8a92" />
          <stop offset="0.45" stopColor="#f2f0f3" />
          <stop offset="1" stopColor="#7d7880" />
        </linearGradient>
      </defs>
      <path d="M100 31 V17.5 a8.6 8.6 0 1 1 8.6 -8.6" fill="none" stroke={`url(#${metal})`} strokeWidth="3.2" strokeLinecap="round" />
      <rect x="96.6" y="25.5" width="6.8" height="6.5" rx="1.6" fill={`url(#${metal})`} />
      {kind === 'shoulder' ? (
        <g>
          <path d="M10 59 Q3.5 57 8 51.8 Q50 35 100 29.5 Q150 35 192 51.8 Q196.5 57 190 59 Q150 45 100 39.6 Q50 45 10 59 Z" fill={`url(#${wood})`} stroke="#7a4d25" strokeOpacity="0.55" strokeWidth="0.8" />
          <path d="M14 52.6 Q52 36.6 100 31.4 Q148 36.6 186 52.6" fill="none" stroke="#fff" strokeOpacity="0.42" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M30 50 Q62 39.5 92 35.8 M108 35.8 Q138 39.5 170 50" fill="none" stroke="#6b421f" strokeOpacity="0.16" strokeWidth="0.7" />
        </g>
      ) : (
        <g>
          <rect x="12" y="30" width="176" height="11.5" rx="5.75" fill={`url(#${wood})`} stroke="#7a4d25" strokeOpacity="0.55" strokeWidth="0.8" />
          <path d="M18 32.6 H182" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round" />
          {[44, 156].map((x) => (
            <g key={x}>
              <rect x={x - 6.5} y="38" width="13" height="19" rx="2.2" fill={`url(#${metal})`} stroke="#6e6972" strokeWidth="0.7" />
              <path d={`M${x - 4} 44 H${x + 4}`} stroke="#6e6972" strokeWidth="0.8" strokeLinecap="round" />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

function Garment({ item, eager = false, sizes }: { item: RailItem; eager?: boolean; sizes: string }) {
  const img = item.front
  return (
    <img
      className={`rail__img is-${item.hanger}`}
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

/** الشماعة المناسبة لنوع صورة القطعة */
function HangerFor({ item, big }: { item: RailItem; big?: boolean }) {
  if (item.hanger === 'photo') return null
  return <Hanger kind={item.hanger === 'cutout' ? 'shoulder' : 'clip'} big={big} />
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
                    <HangerFor item={it} />
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
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const n = items.length
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex])

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
          <div className="rail-focus__face">
            <HangerFor item={it} big />
            <Garment item={it} eager sizes="(min-width: 900px) 380px, 70vw" />
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
