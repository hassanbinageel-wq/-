'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Heart, Menu, Search, ShoppingBag, X, ChevronLeft, PackageSearch } from 'lucide-react'
import { useStore } from './StoreProvider'
import { SearchBox } from './SearchBox'
import { LogoMark, WhatsAppIcon, Star } from './Deco'
import type { LinkItem } from '@/lib/shared/types'

type Props = {
  name: string
  logoUrl: string | null
  menu: LinkItem[]
  categories: { name: string; slug: string }[]
  announcement: { items: LinkItem[]; bg: string; fg: string } | null
  whatsappUrl: string
}

export function Announcement({ items, bg, fg }: { items: LinkItem[]; bg: string; fg: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 5000)
    return () => clearInterval(t)
  }, [items.length])
  const it = items[i]
  if (!it) return null
  return (
    <div className="announce" style={{ ['--ann-bg' as string]: bg, ['--ann-fg' as string]: fg }}>
      <div className="announce__inner">
        <span key={i} className="announce__item">
          {it.href ? <Link href={it.href}>{it.label}</Link> : it.label}
        </span>
      </div>
    </div>
  )
}

export function Header({ name, logoUrl, menu, categories, announcement, whatsappUrl }: Props) {
  const { cartCount, favorites, setCartOpen, hydrated } = useStore()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen, searchOpen])

  const logo = (
    <Link href="/" className="logo" aria-label={`${name} — الصفحة الرئيسية`}>
      {logoUrl ? <img src={logoUrl} alt={name} /> : <><LogoMark /> <span>{name}</span></>}
    </Link>
  )

  return (
    <>
      {announcement && <Announcement {...announcement} />}
      <header className={`header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container header__bar">
          <div className="header__start">
            <button type="button" className="icon-btn mobile-only" aria-label="القائمة" onClick={() => setMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <span className="desktop-only">{logo}</span>
          </div>
          <span className="mobile-only" style={{ flex: '0 0 auto' }}>
            {logo}
          </span>
          <nav className="nav" aria-label="القائمة الرئيسية">
            {menu.map((m) => (
              <Link key={m.href + m.label} href={m.href} aria-current={pathname === m.href ? 'page' : undefined}>
                {m.label}
              </Link>
            ))}
          </nav>
          <div className="header__end">
            <span className="desktop-only" style={{ width: 260 }}>
              <SearchBox />
            </span>
            <button type="button" className="icon-btn mobile-only" aria-label="بحث" onClick={() => setSearchOpen(true)}>
              <Search size={22} />
            </button>
            <Link href="/favorites" className="icon-btn" aria-label="المفضلة">
              <Heart size={22} />
              {hydrated && favorites.length > 0 && <span className="count">{favorites.length}</span>}
            </Link>
            <button type="button" className="icon-btn" aria-label={`السلة (${cartCount})`} onClick={() => setCartOpen(true)}>
              <ShoppingBag size={22} />
              {hydrated && cartCount > 0 && (
                <span className="count" key={cartCount}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="البحث">
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            <div className="grow">
              <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
            </div>
            <button type="button" className="icon-btn" aria-label="إغلاق البحث" onClick={() => setSearchOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <p className="muted small">ابحث باسم المنتج أو رقمه (مثل GH-1001) أو اسم القسم.</p>
          <div className="suggest__chips" style={{ padding: 0 }}>
            {categories.map((c) => (
              <Link key={c.slug} className="chip" href={`/category/${encodeURIComponent(c.slug)}`}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {menuOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <aside className="drawer drawer--start" role="dialog" aria-modal="true" aria-label="القائمة">
            <div className="drawer__head">
              {logo}
              <button type="button" className="icon-btn" aria-label="إغلاق" onClick={() => setMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="drawer__body">
              <ul className="menu-list">
                {menu.map((m) => (
                  <li key={m.href + m.label}>
                    <Link href={m.href}>
                      {m.label} <ChevronLeft size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
              <h3 style={{ marginTop: '1.4rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Star size={16} style={{ color: 'var(--c-accent)' }} /> الأقسام
              </h3>
              <ul className="menu-list">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/category/${encodeURIComponent(c.slug)}`}>
                      {c.name} <ChevronLeft size={18} />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/favorites">
                    المفضلة <Heart size={18} />
                  </Link>
                </li>
                <li>
                  <Link href="/track">
                    تتبع طلبك <PackageSearch size={18} />
                  </Link>
                </li>
              </ul>
            </div>
            <div className="drawer__foot">
              <a className="btn btn--wa btn--block" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> تواصل معنا عبر واتساب
              </a>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
