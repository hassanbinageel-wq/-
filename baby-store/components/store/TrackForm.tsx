'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AlertCircle, Search } from 'lucide-react'

export function TrackForm() {
  const router = useRouter()
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mine, setMine] = useState<{ number: string; token: string; at: number }[]>([])
  useEffect(() => {
    try {
      setMine(JSON.parse(localStorage.getItem('gh_my_orders_v1') || '[]'))
    } catch {}
  }, [])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number, phone }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      router.push(d.url)
    } catch (err) {
      setError((err as Error).message || 'تعذر البحث')
      setBusy(false)
    }
  }
  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <form className="card form-grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="tn">رقم الطلب</label>
          <input id="tn" className="input" dir="ltr" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="GH-1001" required />
        </div>
        <div className="field">
          <label htmlFor="tp">رقم واتساب المستخدم في الطلب</label>
          <input id="tp" className="input" dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XXXXXXXX" required />
        </div>
        {error && (
          <div className="notice notice--danger small" role="alert">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <button className="btn" disabled={busy}>
          {busy ? <span className="spinner" /> : <Search size={18} />} بحث عن الطلب
        </button>
      </form>
      {mine.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1.05rem' }}>طلبات من هذا الجهاز</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {mine.map((o) => (
              <li key={o.token}>
                <Link className="link" href={`/order/${o.token}`}>
                  الطلب <bdi className="num">{o.number}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
