'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  LayoutDashboard, ShoppingBag, Users, Package, FolderTree, Tags, Ruler, Boxes, FileSpreadsheet, BarChart3, TicketPercent, Landmark,
  Truck, Gift, Palette, FileText, MessageCircle, Settings, ShieldCheck, History, DatabaseBackup, UserCog, Menu, Bell, BellRing, Volume2, VolumeX, LogOut, ExternalLink,
} from 'lucide-react'
import { api, useAdmin } from './ui'
import type { Permission } from '@/lib/shared/constants'

type Item = { href: string; label: string; icon: typeof LayoutDashboard; perm?: Permission | Permission[]; count?: number }

export function AdminShell({ children, storeName, counts }: { children: ReactNode; storeName: string; counts: { pending: number; review: number } }) {
  const { user, can } = useAdmin()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'الإدارة اليومية',
      items: [
        { href: '/admin', label: 'الرئيسية', icon: LayoutDashboard },
        { href: '/admin/orders', label: 'الطلبات', icon: ShoppingBag, perm: ['orders', 'payments'], count: counts.pending + counts.review },
        { href: '/admin/customers', label: 'العملاء', icon: Users, perm: 'orders' },
        { href: '/admin/reports', label: 'التقارير', icon: BarChart3, perm: 'owner' },
      ],
    },
    {
      title: 'الكتالوج',
      items: [
        { href: '/admin/products', label: 'المنتجات والباقات', icon: Package, perm: 'products' },
        { href: '/admin/categories', label: 'الأقسام', icon: FolderTree, perm: 'products' },
        { href: '/admin/tags', label: 'العمر والمناسبات', icon: Tags, perm: 'products' },
        { href: '/admin/size-guides', label: 'أدلة المقاسات', icon: Ruler, perm: 'products' },
        { href: '/admin/inventory', label: 'المخزون وسجل الحركة', icon: Boxes, perm: 'products' },
        { href: '/admin/import', label: 'استيراد وتصدير CSV', icon: FileSpreadsheet, perm: 'products' },
      ],
    },
    {
      title: 'البيع والدفع',
      items: [
        { href: '/admin/transfer-methods', label: 'وسائل التحويل', icon: Landmark, perm: 'owner' },
        { href: '/admin/coupons', label: 'كوبونات الخصم', icon: TicketPercent, perm: 'owner' },
        { href: '/admin/shipping', label: 'التوصيل والاستلام', icon: Truck, perm: 'owner' },
        { href: '/admin/gifts', label: 'الهدايا والتخصيص', icon: Gift, perm: 'owner' },
        { href: '/admin/messages', label: 'رسائل واتساب', icon: MessageCircle, perm: 'owner' },
      ],
    },
    {
      title: 'المتجر',
      items: [
        { href: '/admin/appearance', label: 'مظهر المتجر', icon: Palette, perm: 'owner' },
        { href: '/admin/pages', label: 'الصفحات والأسئلة', icon: FileText, perm: 'owner' },
        { href: '/admin/settings', label: 'الإعدادات', icon: Settings, perm: 'owner' },
        { href: '/admin/users', label: 'المستخدمون والصلاحيات', icon: ShieldCheck, perm: 'owner' },
        { href: '/admin/audit', label: 'سجل الإجراءات', icon: History, perm: 'owner' },
        { href: '/admin/backups', label: 'النسخ الاحتياطي', icon: DatabaseBackup, perm: 'owner' },
        { href: '/admin/account', label: 'حسابي', icon: UserCog },
      ],
    },
  ]

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href))
  const current = groups.flatMap((g) => g.items).find((i) => isActive(i.href))

  const logout = async () => {
    await api('POST', 'auth/logout').catch(() => {})
    router.replace('/admin/login')
  }

  return (
    <div className="a-layout">
      {open && <div className="a-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`a-side ${open ? 'is-open' : ''}`} aria-label="قائمة لوحة التحكم">
        <div className="a-side__brand">
          <span style={{ fontSize: '1.3rem' }}>☁️</span> {storeName}
        </div>
        <nav className="a-nav">
          {groups.map((g) => {
            const items = g.items.filter((i) => !i.perm || can(i.perm))
            if (!items.length) return null
            return (
              <div key={g.title} style={{ display: 'contents' }}>
                <div className="a-nav__group">{g.title}</div>
                {items.map((i) => (
                  <Link key={i.href} href={i.href} aria-current={isActive(i.href) ? 'page' : undefined}>
                    <i.icon size={18} /> {i.label}
                    {!!i.count && <span className="count num">{i.count}</span>}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
        <div style={{ borderTop: '1px solid rgb(255 255 255 / 10%)', marginTop: '1rem', paddingTop: '0.8rem' }} className="a-nav">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} /> عرض المتجر
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              logout()
            }}
          >
            <LogOut size={18} /> تسجيل الخروج
          </a>
        </div>
      </aside>
      <div className="a-main">
        <header className="a-top no-print">
          <button type="button" className="a-icon-btn a-hide-d" aria-label="القائمة" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="a-top__title">{current?.label || 'لوحة التحكم'}</span>
          <Notifications />
          <span className="small muted a-hide-m">{user.name}</span>
        </header>
        <main className="a-content">{children}</main>
      </div>
    </div>
  )
}

type Note = { id: number; title: string; body: string; link: string; created_at: string }

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = [880, 1174.7]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.18)
      o.stop(ctx.currentTime + i * 0.18 + 0.55)
    })
  } catch {}
}

function Notifications() {
  const [data, setData] = useState<{ items: Note[]; unread: number; latestId: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [sound, setSound] = useState(false)
  const lastId = useRef<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      setSound(localStorage.getItem('gh_admin_sound') === '1')
    } catch {}
  }, [])

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const d = await api<{ items: Note[]; unread: number; latestId: number }>('GET', 'notifications')
        if (stop) return
        if (lastId.current !== null && d.latestId > lastId.current) {
          if (localStorage.getItem('gh_admin_sound') === '1') chime()
          router.refresh()
        }
        lastId.current = d.latestId
        setData(d)
        document.title = d.unread ? `(${d.unread}) لوحة التحكم` : 'لوحة التحكم'
      } catch {}
    }
    load()
    const t = setInterval(load, 25000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [router])

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && data?.latestId) {
      await api('POST', 'notifications/seen', { id: data.latestId }).catch(() => {})
      setData((d) => (d ? { ...d, unread: 0 } : d))
    }
  }

  const toggleSound = () => {
    const v = !sound
    setSound(v)
    try {
      localStorage.setItem('gh_admin_sound', v ? '1' : '0')
    } catch {}
    if (v) chime()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="a-icon-btn" aria-label={sound ? 'إيقاف صوت الإشعارات' : 'تشغيل صوت الإشعارات'} title={sound ? 'الصوت مفعل' : 'الصوت متوقف'} onClick={toggleSound}>
        {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
      </button>
      <button type="button" className="a-icon-btn" aria-label="الإشعارات" onClick={toggleOpen}>
        {data?.unread ? <BellRing size={20} /> : <Bell size={20} />}
        {!!data?.unread && <span className="dot num">{data.unread}</span>}
      </button>
      {open && (
        <div className="a-card" style={{ position: 'absolute', insetInlineEnd: 0, top: '110%', width: 330, maxHeight: 420, overflow: 'auto', zIndex: 60, boxShadow: '0 20px 50px rgb(0 0 0 / 15%)', padding: '0.6rem' }}>
          <b style={{ display: 'block', padding: '0.3rem 0.4rem' }}>الإشعارات</b>
          {!data?.items.length && <p className="muted small" style={{ padding: '0.4rem' }}>لا توجد إشعارات</p>}
          {data?.items.map((n) => (
            <Link key={n.id} href={n.link || '/admin'} onClick={() => setOpen(false)} style={{ display: 'block', padding: '0.5rem', borderRadius: 8, textDecoration: 'none' }} className="a-notif">
              <b style={{ fontSize: '0.88rem' }}>{n.title}</b>
              <div className="small muted">{n.body}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
