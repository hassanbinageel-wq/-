'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ImageRef } from '@/lib/shared/types'
import { SkyDecor, Bear } from './Deco'

export type HeroSlide = {
  id: string
  title: string
  text: string
  buttonText: string
  link: string
  align: 'start' | 'center' | 'end'
  tone: 'light' | 'dark'
  desktop: ImageRef | null
  mobile: ImageRef | null
}

export function Hero({ slides, decorations }: { slides: HeroSlide[]; decorations: boolean }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (slides.length < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6500)
    return () => clearInterval(t)
  }, [slides.length, paused])
  if (!slides.length) return null
  return (
    <section className="hero container" aria-roledescription="عرض شرائح" aria-label="العروض الرئيسية">
      <div className="hero__frame" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <div className="hero__track">
          {slides.map((s, k) => (
            <div key={s.id} className={`hero__slide ${k === i ? 'is-active' : ''} ${s.tone === 'light' ? 'hero--light' : ''}`} aria-hidden={k !== i} role="group" aria-label={`${k + 1} من ${slides.length}`}>
              {s.desktop || s.mobile ? (
                <picture>
                  {s.mobile && <source media="(max-width: 767px)" srcSet={s.mobile.srcset} sizes="100vw" />}
                  {s.desktop && <source media="(min-width: 768px)" srcSet={s.desktop.srcset} sizes="(min-width:1240px) 1240px, 100vw" />}
                  <img src={(s.desktop || s.mobile)!.url} alt="" loading={k === 0 ? 'eager' : 'lazy'} fetchPriority={k === 0 ? 'high' : undefined} />
                </picture>
              ) : (
                <div className="hero__art" aria-hidden="true">
                  <SkyDecor enabled={decorations} />
                  <Bear size={150} style={{ position: 'absolute', bottom: -10, insetInlineEnd: '8%', color: '#e8cba8' }} />
                </div>
              )}
              <div className={`hero__content hero__content--${s.align}`}>
                {s.title && (k === 0 ? <h1 style={{ fontSize: 'clamp(1.5rem, 1.1rem + 2vw, 2.6rem)', marginBottom: '0.3rem' }}>{s.title}</h1> : <h2>{s.title}</h2>)}
                {s.text && <p>{s.text}</p>}
                {s.buttonText && s.link && (
                  <Link className="btn" href={s.link} tabIndex={k === i ? 0 : -1}>
                    {s.buttonText}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        {slides.length > 1 && (
          <div className="hero__dots">
            {slides.map((s, k) => (
              <button key={s.id} type="button" aria-label={`الشريحة ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
