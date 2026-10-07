'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatMoney, type CurrencyConfig } from '@/lib/shared/money'
import type { Appearance, CartLineSnapshot } from '@/lib/shared/types'

export type StoreConfig = {
  storeName: string
  /** عملة العرض التي اختارها الزائر (بسعر الصرف) */
  currency: CurrencyConfig
  currencies: { id: string; label: string; symbol: string }[]
  account: { name: string } | null
  labels: Record<string, string>
  whatsapp: string
  productCard: Appearance['productCard']
  decorations: boolean
  siteUrl: string
  freeShipping: { enabled: boolean; threshold: number }
}

type Toast = { id: number; text: string; type?: 'ok' | 'error'; action?: { label: string; href: string } }

type Ctx = {
  config: StoreConfig
  money: (cents: number) => string
  hydrated: boolean
  cart: CartLineSnapshot[]
  coupon: string | null
  addToCart: (line: Omit<CartLineSnapshot, 'key'>, opts?: { silent?: boolean }) => void
  setQty: (key: string, qty: number) => void
  removeLine: (key: string) => void
  updateSnapshots: (updates: Record<string, Partial<CartLineSnapshot>>) => void
  clearCart: () => void
  setCoupon: (c: string | null) => void
  cartCount: number
  favorites: number[]
  toggleFavorite: (id: number, name?: string) => void
  isFavorite: (id: number) => boolean
  recent: number[]
  pushRecent: (id: number) => void
  cartOpen: boolean
  setCartOpen: (v: boolean) => void
  quickViewId: number | null
  openQuickView: (id: number | null) => void
  toast: (text: string, opts?: Omit<Toast, 'id' | 'text'>) => void
}

const StoreCtx = createContext<Ctx | null>(null)

const K_CART = 'gh_cart_v1'
const K_FAV = 'gh_fav_v1'
const K_RECENT = 'gh_recent_v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function lineKey(l: Pick<CartLineSnapshot, 'productId' | 'variantId' | 'bundle' | 'personalization'>): string {
  const b = [...(l.bundle || [])].sort((x, y) => x.itemId - y.itemId).map((x) => `${x.itemId}-${x.variantId ?? 0}`).join('.')
  return `${l.productId}:${l.variantId ?? 0}:${b}:${(l.personalization || '').trim()}`
}

export function StoreProvider({ config, children }: { config: StoreConfig; children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [cart, setCart] = useState<CartLineSnapshot[]>([])
  const [coupon, setCouponState] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<number[]>([])
  const [recent, setRecent] = useState<number[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [quickViewId, setQuickViewId] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  useEffect(() => {
    const c = read<{ lines: CartLineSnapshot[]; coupon: string | null }>(K_CART, { lines: [], coupon: null })
    setCart(Array.isArray(c.lines) ? c.lines : [])
    setCouponState(c.coupon || null)
    setFavorites(read<number[]>(K_FAV, []))
    setRecent(read<number[]>(K_RECENT, []))
    setHydrated(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key === K_CART) {
        const v = read<{ lines: CartLineSnapshot[]; coupon: string | null }>(K_CART, { lines: [], coupon: null })
        setCart(v.lines || [])
        setCouponState(v.coupon || null)
      }
      if (e.key === K_FAV) setFavorites(read<number[]>(K_FAV, []))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const persistCart = useCallback((lines: CartLineSnapshot[], c: string | null) => write(K_CART, { lines, coupon: c, updatedAt: Date.now() }), [])

  const toast = useCallback((text: string, opts: Omit<Toast, 'id' | 'text'> = {}) => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const addToCart = useCallback(
    (line: Omit<CartLineSnapshot, 'key'>, opts: { silent?: boolean } = {}) => {
      const key = lineKey(line)
      setCart((prev) => {
        const existing = prev.find((l) => l.key === key)
        const next = existing ? prev.map((l) => (l.key === key ? { ...l, ...line, key, qty: l.qty + line.qty } : l)) : [...prev, { ...line, key }]
        persistCart(next, coupon)
        return next
      })
      if (!opts.silent) setCartOpen(true)
    },
    [coupon, persistCart],
  )

  const setQty = useCallback(
    (key: string, qty: number) => {
      setCart((prev) => {
        const next = prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.floor(qty)) } : l))
        persistCart(next, coupon)
        return next
      })
    },
    [coupon, persistCart],
  )

  const removeLine = useCallback(
    (key: string) => {
      setCart((prev) => {
        const next = prev.filter((l) => l.key !== key)
        persistCart(next, coupon)
        return next
      })
    },
    [coupon, persistCart],
  )

  const updateSnapshots = useCallback(
    (updates: Record<string, Partial<CartLineSnapshot>>) => {
      setCart((prev) => {
        let changed = false
        const next = prev.map((l) => {
          const u = updates[l.key]
          if (!u) return l
          const merged = { ...l, ...u }
          if (JSON.stringify(merged) !== JSON.stringify(l)) changed = true
          return merged
        })
        if (!changed) return prev
        persistCart(next, coupon)
        return next
      })
    },
    [coupon, persistCart],
  )

  const clearCart = useCallback(() => {
    setCart([])
    setCouponState(null)
    persistCart([], null)
  }, [persistCart])

  const setCoupon = useCallback(
    (c: string | null) => {
      setCouponState(c)
      setCart((prev) => {
        persistCart(prev, c)
        return prev
      })
    },
    [persistCart],
  )

  const toggleFavorite = useCallback(
    (id: number, name?: string) => {
      setFavorites((prev) => {
        const has = prev.includes(id)
        const next = has ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 200)
        write(K_FAV, next)
        toast(has ? 'أُزيل من المفضلة' : `أُضيف ${name ? `«${name}» ` : ''}إلى المفضلة`, has ? {} : { action: { label: 'عرض المفضلة', href: '/favorites' } })
        return next
      })
    },
    [toast],
  )

  const pushRecent = useCallback((id: number) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 16)
      write(K_RECENT, next)
      return next
    })
  }, [])

  const money = useCallback((c: number) => formatMoney(c, config.currency), [config.currency])

  const value = useMemo<Ctx>(
    () => ({
      config,
      money,
      hydrated,
      cart,
      coupon,
      addToCart,
      setQty,
      removeLine,
      updateSnapshots,
      clearCart,
      setCoupon,
      cartCount: cart.reduce((s, l) => s + l.qty, 0),
      favorites,
      toggleFavorite,
      isFavorite: (id: number) => favorites.includes(id),
      recent,
      pushRecent,
      cartOpen,
      setCartOpen,
      quickViewId,
      openQuickView: setQuickViewId,
      toast,
    }),
    [config, money, hydrated, cart, coupon, addToCart, setQty, removeLine, updateSnapshots, clearCart, setCoupon, favorites, toggleFavorite, recent, pushRecent, cartOpen, quickViewId, toast],
  )

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'toast--error' : ''}`}>
            <span>{t.text}</span>
            {t.action && <a href={t.action.href}>{t.action.label}</a>}
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  )
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore outside StoreProvider')
  return c
}

export function label(config: StoreConfig, key: string, fallback = ''): string {
  return config.labels[key] || fallback
}
