'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import type { ImageRef } from '@/lib/shared/types'

export function Gallery({ images, name, focusValue, compact }: { images: ImageRef[]; name: string; focusValue?: string | null; compact?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const scrollTo = useCallback((i: number, smooth = true) => {
    const el = track.current
    if (!el) return
    // كل شريحة بعرض الشريط كاملاً؛ في RTL تكون قيمة scrollLeft سالبة
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollTo({ left: (rtl ? -1 : 1) * i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    const on = () => {
      const w = el.clientWidth || 1
      setIndex(Math.min(images.length - 1, Math.round(Math.abs(el.scrollLeft) / w)))
    }
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [images.length])

  // عند اختيار لون له صورة: انتقل إليها
  useEffect(() => {
    if (!focusValue) return
    const i = images.findIndex((im) => im.optionValue === focusValue)
    if (i >= 0) scrollTo(i)
  }, [focusValue, images, scrollTo])

  if (!images.length) {
    return (
      <div className="gallery__main" style={{ aspectRatio: 'var(--card-aspect)', display: 'grid', placeItems: 'center' }}>
        <span className="muted">لا توجد صور لهذا المنتج</span>
      </div>
    )
  }

  return (
    <div className="gallery">
      <div className="gallery__main">
        <div className="gallery__track" ref={track} aria-roledescription="معرض صور" aria-label={`صور ${name}`}>
          {images.map((im, i) => (
            <button type="button" key={im.id + '-' + i} className="gallery__slide" onClick={() => setLightbox(i)} aria-label={`تكبير الصورة ${i + 1}`}>
              <img
                src={im.url}
                srcSet={im.srcset}
                sizes={compact ? '(min-width:768px) 480px, 100vw' : '(min-width:960px) 600px, 100vw'}
                alt={im.alt || name}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 && !compact ? 'high' : undefined}
                decoding="async"
                width={im.w || undefined}
                height={im.h || undefined}
                draggable={false}
              />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <span className="gallery__count num" aria-live="polite">
              {index + 1} / {images.length}
            </span>
            <div className="gallery__arrows desktop-only">
              <button type="button" className="icon-btn" aria-label="الصورة السابقة" onClick={() => scrollTo(Math.max(0, index - 1))} disabled={index === 0}>
                <ChevronRight size={22} />
              </button>
              <button type="button" className="icon-btn" aria-label="الصورة التالية" onClick={() => scrollTo(Math.min(images.length - 1, index + 1))} disabled={index === images.length - 1}>
                <ChevronLeft size={22} />
              </button>
            </div>
          </>
        )}
        <span className="gallery__count" style={{ insetInlineStart: 'auto', insetInlineEnd: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
          <ZoomIn size={14} /> اضغط للتكبير
        </span>
      </div>
      {images.length > 1 && !compact && (
        <div className="gallery__thumbs" role="tablist" aria-label="الصور المصغرة">
          {images.map((im, i) => (
            <button type="button" key={im.id + 't' + i} role="tab" aria-current={i === index} aria-label={`الصورة ${i + 1}`} onClick={() => scrollTo(i)}>
              <img src={im.url} srcSet={im.srcset} sizes="72px" alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {lightbox !== null && <Lightbox images={images} start={lightbox} name={name} onClose={() => setLightbox(null)} />}
    </div>
  )
}

function Lightbox({ images, start, name, onClose }: { images: ImageRef[]; start: number; name: string; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const swipe = useRef<number | null>(null)
  const im = images[i]

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  const go = useCallback(
    (d: number) => {
      setI((x) => (x + d + images.length) % images.length)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    },
    [images.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(1)
      if (e.key === 'ArrowRight') go(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [go, onClose])

  const onClickImg = (e: React.MouseEvent<HTMLImageElement>) => {
    if (drag.current && (Math.abs(drag.current.x - e.clientX) > 5 || Math.abs(drag.current.y - e.clientY) > 5)) return
    if (zoom > 1) return reset()
    const r = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - (r.left + r.width / 2)
    const cy = e.clientY - (r.top + r.height / 2)
    setZoom(2.4)
    setPan({ x: -cx * 1.4, y: -cy * 1.4 })
  }

  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`صور ${name}`}>
      <div className="lightbox__top">
        <span className="num">
          {i + 1} / {images.length}
        </span>
        <span className="small" style={{ opacity: 0.8 }}>
          {zoom > 1 ? 'اسحب للتحريك، واضغط للتصغير' : 'اضغط على الصورة للتكبير'}
        </span>
        <button type="button" className="icon-btn" aria-label="إغلاق" onClick={onClose} autoFocus>
          <X size={26} />
        </button>
      </div>
      <div
        className={`lightbox__stage ${zoom > 1 ? 'is-zoomed' : ''}`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
          if (zoom === 1) swipe.current = e.clientX
        }}
        onPointerMove={(e) => {
          if (!drag.current || zoom === 1 || pinch.current) return
          setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) })
        }}
        onPointerUp={(e) => {
          if (zoom === 1 && swipe.current !== null) {
            const dx = e.clientX - swipe.current
            if (Math.abs(dx) > 60) go(dx > 0 ? 1 : -1)
          }
          swipe.current = null
          setTimeout(() => (drag.current = null), 0)
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoom }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) {
            const z = Math.max(1, Math.min(4, (pinch.current.z * dist(e.touches)) / pinch.current.d))
            setZoom(z)
            if (z === 1) setPan({ x: 0, y: 0 })
          }
        }}
        onTouchEnd={() => {
          pinch.current = null
        }}
      >
        <img
          src={im.url}
          srcSet={im.srcset}
          sizes="100vw"
          alt={im.alt || name}
          onClick={onClickImg}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          draggable={false}
        />
        {images.length > 1 && (
          <>
            <button type="button" className="icon-btn lightbox__nav" style={{ insetInlineStart: 8, background: 'rgb(255 255 255 / 15%)' }} aria-label="السابقة" onClick={() => go(-1)}>
              <ChevronRight size={26} />
            </button>
            <button type="button" className="icon-btn lightbox__nav" style={{ insetInlineEnd: 8, background: 'rgb(255 255 255 / 15%)' }} aria-label="التالية" onClick={() => go(1)}>
              <ChevronLeft size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
