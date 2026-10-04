'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LogIn, Lock } from 'lucide-react'

async function post(path: string, body: unknown) {
  const r = await fetch(`/api/admin/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'تعذر تسجيل الدخول')
  return d
}

export function LoginForm({ noUsers }: { noUsers: boolean }) {
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="a-login">
      <form
        className="a-card a-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            await post('auth/login', { username, password })
            window.location.href = '/admin'
          } catch (x) {
            setErr((x as Error).message)
            setBusy(false)
          }
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.4rem' }}>☁️</div>
          <h1 style={{ fontSize: '1.3rem' }}>لوحة تحكم المتجر</h1>
          <p className="muted small">سجّل الدخول بحساب الموظف</p>
        </div>
        {noUsers && (
          <div className="a-notice a-notice--warn">
            لا يوجد حساب بعد. أنشئ حساب المالك بالأمر <code dir="ltr">npm run owner:create</code> أو من صفحة <Link href="/admin/setup">الإعداد الأول</Link>.
          </div>
        )}
        <div className="a-field">
          <label htmlFor="u">اسم المستخدم</label>
          <input id="u" className="a-input" dir="ltr" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} required />
        </div>
        <div className="a-field">
          <label htmlFor="p">كلمة المرور</label>
          <input id="p" className="a-input" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} required />
        </div>
        {err && <div className="a-notice a-notice--danger" role="alert">{err}</div>}
        <button className="a-btn" disabled={busy}>
          <LogIn size={18} /> {busy ? 'جارٍ الدخول…' : 'دخول'}
        </button>
        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
          <Lock size={12} style={{ display: 'inline' }} /> يتم إيقاف الدخول مؤقتاً بعد 5 محاولات خاطئة
        </p>
      </form>
    </div>
  )
}

export function SetupForm({ enabled }: { enabled: boolean }) {
  const [f, setF] = useState({ token: '', username: '', name: '', password: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!enabled) {
    return (
      <div className="a-login">
        <div className="a-card a-form">
          <h1 style={{ fontSize: '1.2rem' }}>إنشاء حساب المالك</h1>
          <p>أنشئ حساب المالك من الخادم بالأمر:</p>
          <pre dir="ltr" style={{ background: '#f6f4f8', padding: 10, borderRadius: 8 }}>npm run owner:create</pre>
          <p className="small muted">أو اضبط متغير البيئة SETUP_TOKEN (12 حرفاً على الأقل) ثم أعد تشغيل التطبيق لتفعيل الإعداد من المتصفح.</p>
        </div>
      </div>
    )
  }
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  return (
    <div className="a-login">
      <form
        className="a-card a-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            await post('auth/setup', f)
            window.location.href = '/admin'
          } catch (x) {
            setErr((x as Error).message)
            setBusy(false)
          }
        }}
      >
        <h1 style={{ fontSize: '1.2rem' }}>إنشاء حساب المالك</h1>
        <div className="a-field">
          <label htmlFor="t">رمز الإعداد (SETUP_TOKEN)</label>
          <input id="t" className="a-input" dir="ltr" value={f.token} onChange={(e) => set('token', e.target.value)} required />
        </div>
        <div className="a-field">
          <label htmlFor="n">الاسم</label>
          <input id="n" className="a-input" value={f.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="a-field">
          <label htmlFor="u">اسم المستخدم (إنجليزي)</label>
          <input id="u" className="a-input" dir="ltr" value={f.username} onChange={(e) => set('username', e.target.value)} required />
        </div>
        <div className="a-field">
          <label htmlFor="p">كلمة المرور (10 أحرف على الأقل، حروف وأرقام)</label>
          <input id="p" className="a-input" dir="ltr" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} required />
        </div>
        {err && <div className="a-notice a-notice--danger">{err}</div>}
        <button className="a-btn" disabled={busy}>
          إنشاء الحساب والدخول
        </button>
      </form>
    </div>
  )
}
