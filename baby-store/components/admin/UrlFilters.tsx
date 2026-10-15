'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'

/** شريط فلاتر يعتمد على معاملات الرابط */
export function useUrlParams() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const set = (patch: Record<string, string | null>, keepPage = false) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k))
    if (!keepPage) p.delete('page')
    router.push(`${pathname}${p.toString() ? `?${p}` : ''}`)
  }
  return { sp, set }
}

export function SearchInput({ placeholder, param = 'q' }: { placeholder: string; param?: string }) {
  const { sp, set } = useUrlParams()
  const [v, setV] = useState(sp.get(param) || '')
  useEffect(() => setV(sp.get(param) || ''), [sp, param])
  return (
    <form
      className="a-row a-grow"
      style={{ minWidth: 220, flexWrap: 'nowrap' }}
      onSubmit={(e) => {
        e.preventDefault()
        set({ [param]: v.trim() || null })
      }}
    >
      <input className="a-input" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <button className="a-btn a-btn--ghost a-btn--icon" aria-label="بحث">
        <Search size={17} />
      </button>
    </form>
  )
}

export function SelectFilter({ param, options, label }: { param: string; options: { value: string; label: string }[]; label: string }) {
  const { sp, set } = useUrlParams()
  return (
    <select className="a-select" style={{ width: 'auto' }} aria-label={label} value={sp.get(param) || ''} onChange={(e) => set({ [param]: e.target.value || null })}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function DateFilter({ param, label }: { param: string; label: string }) {
  const { sp, set } = useUrlParams()
  return (
    <label className="a-row small" style={{ gap: 4, flexWrap: 'nowrap' }}>
      <span className="muted">{label}</span>
      <input type="date" className="a-input" style={{ width: 'auto' }} value={sp.get(param) || ''} onChange={(e) => set({ [param]: e.target.value || null })} />
    </label>
  )
}

/** فترات جاهزة بضغطة واحدة بدل كتابة التاريخ */
export function DatePresets() {
  const { sp, set } = useUrlParams()
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const opts: [string, string | null][] = [['اليوم', day(0)], ['آخر 7 أيام', day(6)], ['آخر 30 يوماً', day(29)], ['كل الفترات', null]]
  const cur = sp.get('from')
  return (
    <div className="a-row" role="group" aria-label="فترة الطلبات" style={{ gap: 4 }}>
      {opts.map(([label, from]) => {
        const on = from ? cur === from && !sp.get('to') : !cur && !sp.get('to')
        return (
          <button key={label} type="button" className={`a-btn a-btn--sm ${on ? '' : 'a-btn--ghost'}`} aria-pressed={on} onClick={() => set({ from, to: null })}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function RangePicker() {
  const { sp, set } = useUrlParams()
  const r = sp.get('range') || '30d'
  const opts: [string, string][] = [['today', 'اليوم'], ['7d', '7 أيام'], ['30d', '30 يوماً'], ['90d', '90 يوماً'], ['year', 'هذه السنة'], ['custom', 'مخصص']]
  return (
    <div className="a-row">
      <select className="a-select" style={{ width: 'auto' }} value={r} onChange={(e) => set({ range: e.target.value })} aria-label="الفترة">
        {opts.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      {r === 'custom' && (
        <>
          <DateFilter param="from" label="من" />
          <DateFilter param="to" label="إلى" />
        </>
      )}
    </div>
  )
}

export function PagerLinks({ page, pages }: { page: number; pages: number }) {
  const { set } = useUrlParams()
  if (pages <= 1) return null
  return (
    <div className="a-pager">
      <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, true)}>
        السابق
      </button>
      <span className="small muted num">
        {page} / {pages}
      </span>
      <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, true)}>
        التالي
      </button>
    </div>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="a-card" style={{ marginBottom: '1rem', padding: '0.7rem' }}>
      <div className="a-row">{children}</div>
    </div>
  )
}
