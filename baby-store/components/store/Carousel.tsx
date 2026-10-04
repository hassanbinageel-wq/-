'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** شريط أفقي بالتمرير والسحب مع أسهم للكمبيوتر (متوافق مع RTL) */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    // في RTL تكون قيمة scrollLeft صفراً أو سالبة
    const max = el.scrollWidth - el.clientWidth
    const pos = Math.abs(el.scrollLeft)
    setCanPrev(pos > 4)
    setCanNext(pos < max - 4)
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  const go = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    // dir=1 للأمام (نحو اليسار في RTL)
    el.scrollBy({ left: -dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="carousel" role="region" aria-label={label}>
      <div className="carousel__nav carousel__nav--prev">
        <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={!canPrev} aria-label="السابق">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="carousel__track" ref={ref}>
        {children}
      </div>
      <div className="carousel__nav carousel__nav--next">
        <button type="button" className="icon-btn" onClick={() => go(1)} disabled={!canNext} aria-label="التالي">
          <ChevronLeft size={22} />
        </button>
      </div>
    </div>
  )
}
