'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertCircle, LogOut } from 'lucide-react'
import { useStore } from './StoreProvider'
import { formatIntl } from '@/lib/shared/phone'

const CODES: [string, string][] = [
  ['967', 'اليمن'], ['966', 'السعودية'], ['971', 'الإمارات'], ['968', 'عُمان'], ['974', 'قطر'], ['965', 'الكويت'], ['973', 'البحرين'],
  ['20', 'مصر'], ['962', 'الأردن'], ['964', 'العراق'], ['249', 'السودان'], ['90', 'تركيا'], ['60', 'ماليزيا'], ['44', 'بريطانيا'], ['1', 'أمريكا/كندا'],
]

async function post(path: string, body: unknown) {
  const r = await fetch(`/api/account/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(d.error || 'تعذر إتمام العملية'), { fieldErrors: (d.fieldErrors || {}) as Record<string, string> })
  return d
}

function Err({ text }: { text?: string }) {
  return text ? (
    <span className="err" role="alert">
      {text}
    </span>
  ) : null
}

export function AccountAuth({ next, defaultPhoneCode }: { next: string | null; defaultPhoneCode: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [phoneCode, setPhoneCode] = useState(defaultPhoneCode)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      if (mode === 'login') await post('login', { phoneCode, phone, password })
      else await post('register', { phoneCode, phone, password, name })
      router.replace(next || '/account')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setFieldErrors((err as { fieldErrors?: Record<string, string> }).fieldErrors || {})
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-on' : ''} onClick={() => setMode('login')}>
          تسجيل الدخول
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-on' : ''} onClick={() => setMode('register')}>
          حساب جديد
        </button>
      </div>
      {error && (
        <div className="notice notice--danger" role="alert">
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}
      <form className="stack" onSubmit={submit} noValidate>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="acc-name">الاسم الكامل</label>
            <input id="acc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <Err text={fieldErrors.name} />
          </div>
        )}
        <div className="field">
          <label htmlFor="acc-phone">رقم واتساب</label>
          <div className="phone-input">
            <select className="select" aria-label="مفتاح الدولة" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)}>
              {CODES.map(([c, n]) => (
                <option key={c} value={c}>
                  +{c} {n}
                </option>
              ))}
            </select>
            <input id="acc-phone" className="input" dir="ltr" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XXXXXXXX" />
          </div>
          <Err text={fieldErrors.phone} />
        </div>
        <div className="field">
          <label htmlFor="acc-pass">كلمة المرور</label>
          <input
            id="acc-pass"
            className="input"
            type="password"
            dir="ltr"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' && !fieldErrors.password && <span className="hint">6 أحرف أو أرقام على الأقل</span>}
          <Err text={fieldErrors.password} />
        </div>
        <button type="submit" className="btn btn--lg btn--block" disabled={busy}>
          {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
        </button>
        {mode === 'login' ? (
          <p className="small muted" style={{ margin: 0 }}>
            نسيت كلمة المرور؟ تواصل معنا عبر واتساب من نفس الرقم وسنساعدك في تعيين كلمة جديدة.
          </p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            سنحفظ اسمك وعنوانك بعد أول طلب، وتظهر طلباتك في حسابك. يمكنك أيضاً الطلب كزائر بدون حساب.
          </p>
        )}
      </form>
    </div>
  )
}

type Profile = { name: string; phone: string; country: string; city: string; area: string; address: string; landmark: string; mapUrl: string }

export function AccountProfile({ account, countries }: { account: Profile; countries: string[] }) {
  const router = useRouter()
  const { toast } = useStore()
  const [p, setP] = useState(account)
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const set = (k: keyof Profile, v: string) => setP((x) => ({ ...x, [k]: v }))

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      toast(ok)
      router.refresh()
    } catch (e) {
      toast((e as Error).message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const input = (k: keyof Profile, label: string, opts: { ltr?: boolean; area?: boolean } = {}) => (
    <div className="field">
      <label htmlFor={`p-${k}`}>{label}</label>
      {opts.area ? (
        <textarea id={`p-${k}`} className="textarea" rows={2} value={p[k]} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input id={`p-${k}`} className="input" dir={opts.ltr ? 'ltr' : undefined} value={p[k]} onChange={(e) => set(k, e.target.value)} />
      )}
    </div>
  )

  return (
    <div className="stack">
      <section className="card stack">
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>بياناتي</h2>
        <p className="small muted" style={{ margin: 0 }}>
          رقم واتساب: <b dir="ltr">{formatIntl(p.phone)}</b>
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => post('profile', { ...p }), 'تم حفظ بياناتك')
          }}
        >
          {input('name', 'الاسم الكامل')}
          <div className="field">
            <label htmlFor="p-country">الدولة</label>
            {countries.length ? (
              <select id="p-country" className="select" value={p.country} onChange={(e) => set('country', e.target.value)}>
                <option value="">—</option>
                {Array.from(new Set([...countries, ...(p.country ? [p.country] : [])])).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input id="p-country" className="input" value={p.country} onChange={(e) => set('country', e.target.value)} />
            )}
          </div>
          {input('city', 'المدينة')}
          {input('area', 'المنطقة أو الحي')}
          {input('address', 'العنوان بالتفصيل', { area: true })}
          {input('landmark', 'أقرب معلم (اختياري)')}
          {input('mapUrl', 'رابط الموقع على الخريطة (اختياري)', { ltr: true })}
          <button type="submit" className="btn" disabled={busy}>
            حفظ البيانات
          </button>
        </form>
      </section>
      <section className="card stack">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>تغيير كلمة المرور</h2>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            run(async () => {
              await post('password', pw)
              setPw({ current: '', next: '' })
            }, 'تم تغيير كلمة المرور')
          }}
        >
          <input className="input" type="password" dir="ltr" placeholder="كلمة المرور الحالية" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <input className="input" type="password" dir="ltr" placeholder="كلمة المرور الجديدة" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          <button type="submit" className="btn btn--ghost" disabled={busy || !pw.current || !pw.next}>
            تغيير
          </button>
        </form>
      </section>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() =>
          run(async () => {
            await post('logout', {})
            router.replace('/')
          }, 'تم تسجيل الخروج')
        }
      >
        <LogOut size={18} /> تسجيل الخروج
      </button>
    </div>
  )
}
