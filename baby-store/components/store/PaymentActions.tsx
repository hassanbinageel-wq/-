'use client'

import { useState } from 'react'
import { Copy, Check, Landmark, Wallet, ArrowLeftRight, CreditCard, RefreshCw, Info } from 'lucide-react'
import { WhatsAppIcon } from './Deco'
import { useStore } from './StoreProvider'

export type MethodView = {
  id: number
  name: string
  type: string
  typeLabel: string
  beneficiary: string
  accountNumber: string
  extraInfo: string | null
  currency: string | null
  instructions: string | null
  qr: string | null
}

const ICONS: Record<string, typeof Landmark> = { bank: Landmark, wallet: Wallet, exchange: ArrowLeftRight, other: CreditCard }

export function CopyButton({ value, label = 'نسخ', small }: { value: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false)
  const { toast } = useStore()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setDone(true)
    toast('تم النسخ')
    setTimeout(() => setDone(false), 1800)
  }
  return (
    <button type="button" className={`btn btn--soft ${small ? 'btn--sm' : ''}`} onClick={copy} aria-label={`${label}: ${value}`}>
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? 'تم النسخ' : label}
    </button>
  )
}

export function PaymentActions({
  token,
  totalText,
  totalRaw,
  methods,
  selectedId,
  initialMessage,
  initialUrl,
  canSelect,
  storeNumber,
}: {
  token: string
  totalText: string
  totalRaw: string
  methods: MethodView[]
  selectedId: number | null
  initialMessage: string
  initialUrl: string
  canSelect: boolean
  storeNumber: string
}) {
  const [selected, setSelected] = useState<number | null>(selectedId ?? (methods.length === 1 ? methods[0].id : null))
  const [message, setMessage] = useState(initialMessage)
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState(false)
  const { toast } = useStore()

  const choose = async (id: number) => {
    setSelected(id)
    if (!canSelect) return
    setBusy(true)
    try {
      const r = await fetch(`/api/orders/${token}/method`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ methodId: id }) })
      if (r.ok) {
        const m = await fetch(`/api/orders/${token}/message`).then((x) => x.json())
        if (m.text) {
          setMessage(m.text)
          setUrl(m.url)
        }
      }
    } catch {
      toast('تعذر حفظ اختيارك، حاول مرة أخرى', { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      toast('تم نسخ رسالة الطلب')
    } catch {
      toast('تعذر النسخ', { type: 'error' })
    }
  }

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <div className="amount-box">
        <span>
          <span className="small muted" style={{ display: 'block' }}>
            المبلغ المطلوب تحويله
          </span>
          <strong className="num">{totalText}</strong>
        </span>
        <CopyButton value={totalRaw} label="نسخ المبلغ" />
      </div>

      <section className="card">
        <h2 style={{ fontSize: '1.15rem' }}>1. اختر وسيلة التحويل وحوّل المبلغ</h2>
        {!methods.length ? (
          <div className="notice notice--warn">
            <Info size={18} />
            <span>
              لم تُضف بيانات التحويل في المتجر بعد. يرجى التواصل مع المتجر عبر واتساب للحصول على بيانات التحويل الصحيحة قبل تحويل أي مبلغ.
              <br />
              <a className="link" href={`https://wa.me/${storeNumber}?text=${encodeURIComponent('مرحباً، أحتاج بيانات التحويل لطلبي.')}`} target="_blank" rel="noopener noreferrer">
                طلب بيانات التحويل عبر واتساب
              </a>
            </span>
          </div>
        ) : (
          <div className="stack">
            {methods.map((m) => {
              const Icon = ICONS[m.type] || CreditCard
              const on = selected === m.id
              return (
                <div key={m.id} className={`method ${on ? 'is-selected' : ''}`}>
                  <button type="button" className="method__head" onClick={() => choose(m.id)} aria-expanded={on}>
                    <input type="radio" readOnly checked={on} tabIndex={-1} style={{ accentColor: 'var(--c-primary)', width: 20, height: 20 }} aria-hidden="true" />
                    <span className="feature__icon" style={{ width: 40, height: 40 }}>
                      <Icon size={20} />
                    </span>
                    <span className="grow">
                      <b>{m.name}</b>
                      <span className="small muted" style={{ display: 'block' }}>
                        {m.typeLabel}
                        {m.currency ? ` — ${m.currency}` : ''}
                      </span>
                    </span>
                    {busy && on && <span className="spinner" style={{ width: 16, height: 16 }} />}
                  </button>
                  {on && (
                    <div className="method__body">
                      <div className="copy-row">
                        <span>
                          <span>اسم المستفيد</span>
                          <b>{m.beneficiary}</b>
                        </span>
                        <CopyButton value={m.beneficiary} small />
                      </div>
                      <div className="copy-row">
                        <span>
                          <span>رقم الحساب / المحفظة</span>
                          <b className="num">
                            <bdi>{m.accountNumber}</bdi>
                          </b>
                        </span>
                        <CopyButton value={m.accountNumber} label="نسخ الرقم" small />
                      </div>
                      {m.extraInfo && <p className="small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.extraInfo}</p>}
                      {m.currency && <p className="small" style={{ margin: 0 }}>العملة المقبولة: {m.currency}</p>}
                      {m.instructions && (
                        <div className="notice small" style={{ whiteSpace: 'pre-line' }}>
                          <Info size={16} /> <span>{m.instructions}</span>
                        </div>
                      )}
                      {m.qr && (
                        <div>
                          <span className="small muted">رمز QR للتحويل</span>
                          <img className="qr" src={m.qr} alt={`رمز QR لـ ${m.name}`} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="wa-panel stack">
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>2. أرسل الطلب وصورة السند عبر واتساب</h2>
        <a
          className="btn btn--wa btn--lg"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
        >
          <WhatsAppIcon size={22} /> إرسال الطلب والسند عبر واتساب
        </a>
        <p style={{ margin: 0, fontWeight: 700 }}>بعد التحويل افتح واتساب وأرسل تفاصيل الطلب ثم أرفق صورة سند التحويل مع رقم الطلب.</p>
        <ul className="small muted" style={{ margin: 0, paddingInlineStart: '1.1rem' }}>
          <li>الزر يفتح محادثة المتجر برسالة جاهزة فقط؛ يجب أن تضغط «إرسال» بنفسك داخل واتساب.</li>
          <li>صورة السند لا تُرفق تلقائياً — أرفقها يدوياً في نفس المحادثة.</li>
          <li>يتم تأكيد الدفع بعد مراجعة فريق المتجر للتحويل، وستظهر الحالة في صفحة متابعة الطلب.</li>
        </ul>
        {opened && (
          <div className="notice notice--ok small" role="status">
            إذا لم تُفتح المحادثة، استخدم زر «فتح واتساب مرة أخرى» أو انسخ الرسالة وأرسلها إلى الرقم <bdi className="num">+{storeNumber}</bdi>.
          </div>
        )}
        <div className="row">
          <button type="button" className="btn btn--white btn--sm grow" onClick={copyMessage}>
            <Copy size={16} /> نسخ رسالة الطلب
          </button>
          <a className="btn btn--white btn--sm grow" href={url} target="_blank" rel="noopener noreferrer">
            <RefreshCw size={16} /> فتح واتساب مرة أخرى
          </a>
        </div>
        <details>
          <summary className="small" style={{ cursor: 'pointer' }}>
            عرض نص الرسالة
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.85rem', background: '#fff', padding: '0.8rem', borderRadius: 12, marginTop: 8, maxHeight: 360, overflow: 'auto' }}>{message}</pre>
        </details>
      </section>
    </div>
  )
}
