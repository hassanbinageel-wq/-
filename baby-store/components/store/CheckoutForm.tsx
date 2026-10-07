'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronRight, Gift, Lock, MapPin, Store, Truck, Pencil } from 'lucide-react'
import { useStore } from './StoreProvider'
import { useQuote } from './useQuote'
import { CouponBox } from './CartView'
import { FreeShippingBar } from './CartDrawer'
import { validatePhone } from '@/lib/shared/phone'
import type { Quote } from '@/lib/shared/types'

export type CheckoutProps = {
  shipping: { country: string; cities: string[]; allowOther: boolean }[]
  deliveryEnabled: boolean
  pickupEnabled: boolean
  pickupAddress: string
  pickupNotes: string
  notesMax: number
  reservationMinutes: number
  gifts: { giftOrderEnabled: boolean; giftWrapEnabled: boolean; giftMessageEnabled: boolean; giftMessageMax: number; recipientEnabled: boolean; hidePricesEnabled: boolean }
  wraps: { id: number; name: string; description: string | null; price: number; image: string | null }[]
  defaultCountry: string
  defaultPhoneCode: string
  /** بيانات الحساب المسجل لتعبئة النموذج تلقائياً */
  account: { name: string; phone: string; country: string | null; city: string | null; area: string | null; address: string | null; landmark: string | null; mapUrl: string | null } | null
}

/** يفصل الرقم الدولي المحفوظ إلى مفتاح دولة ورقم محلي */
export function splitIntl(intl: string): { code: string; local: string } {
  const codes = PHONE_CODES.map(([c]) => c).sort((a, b) => b.length - a.length)
  const code = codes.find((c) => intl.startsWith(c)) || ''
  return { code, local: code ? intl.slice(code.length) : intl }
}

const PHONE_CODES: [string, string][] = [
  ['967', 'اليمن'], ['966', 'السعودية'], ['971', 'الإمارات'], ['968', 'عُمان'], ['974', 'قطر'], ['965', 'الكويت'], ['973', 'البحرين'],
  ['20', 'مصر'], ['962', 'الأردن'], ['964', 'العراق'], ['249', 'السودان'], ['90', 'تركيا'], ['60', 'ماليزيا'], ['44', 'بريطانيا'], ['1', 'أمريكا/كندا'],
]

type Form = {
  name: string; phoneCode: string; phone: string; fulfillment: 'delivery' | 'pickup'
  country: string; city: string; cityOther: string; area: string; address: string; landmark: string; mapUrl: string; notes: string
  isGift: boolean; wrapId: number | null; giftMessage: string; hidePrices: boolean; toRecipient: boolean
  rName: string; rPhoneCode: string; rPhone: string; rCountry: string; rCity: string; rCityOther: string; rArea: string; rAddress: string
  remember: boolean
}

const K_FORM = 'gh_checkout_v1'
const K_KEY = 'gh_checkout_key'
const K_ORDERS = 'gh_my_orders_v1'
const OTHER = '__other__'

function newKey() {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return 'ck_' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

function Field({ id, label, error, hint, children, optional }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="field" data-field={id}>
      <label htmlFor={id}>
        {label} {optional && <span className="muted small" style={{ fontWeight: 400 }}>(اختياري)</span>}
      </label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="err" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function CheckoutForm(props: CheckoutProps) {
  const { cart, hydrated, money, coupon, clearCart, config, updateSnapshots, setCoupon } = useStore()
  const router = useRouter()
  const defaultFulfillment: 'delivery' | 'pickup' = props.deliveryEnabled ? 'delivery' : 'pickup'
  const initial: Form = {
    name: '', phoneCode: props.defaultPhoneCode, phone: '', fulfillment: defaultFulfillment,
    country: props.shipping.find((s) => s.country === props.defaultCountry)?.country || props.shipping[0]?.country || '', city: '', cityOther: '',
    area: '', address: '', landmark: '', mapUrl: '', notes: '',
    isGift: false, wrapId: null, giftMessage: '', hidePrices: false, toRecipient: false,
    rName: '', rPhoneCode: props.defaultPhoneCode, rPhone: '', rCountry: '', rCity: '', rCityOther: '', rArea: '', rAddress: '',
    remember: true,
  }
  const [f, setF] = useState<Form>(initial)
  const [step, setStep] = useState<'info' | 'review'>('info')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [serverQuote, setServerQuote] = useState<Quote | null>(null)
  const [loaded, setLoaded] = useState(false)
  // إنشاء حساب مع الطلب (لا تُحفظ كلمة المرور في المتصفح)
  const [makeAccount, setMakeAccount] = useState(false)
  const [accountPassword, setAccountPassword] = useState('')
  const honeypot = useRef<HTMLInputElement>(null)

  // استعادة البيانات أثناء التنقل (sessionStorage) أو من «تذكر بياناتي» (localStorage)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(K_FORM) || localStorage.getItem(K_FORM)
      if (raw) setF((x) => ({ ...x, ...JSON.parse(raw) }))
    } catch {}
    const a = props.account
    if (a) {
      // بيانات الحساب تملأ الحقول الفارغة فقط
      const ph = splitIntl(a.phone)
      setF((x) => {
        const sameCountry = !a.country || props.shipping.some((s) => s.country === a.country)
        const cities = props.shipping.find((s) => s.country === (a.country || x.country))?.cities || []
        const cityKnown = !a.city || !cities.length || cities.includes(a.city)
        return {
          ...x,
          name: x.name || a.name,
          phoneCode: x.phone ? x.phoneCode : ph.code || x.phoneCode,
          phone: x.phone || ph.local,
          country: x.address ? x.country : (sameCountry && a.country) || x.country,
          city: x.address ? x.city : a.city ? (cityKnown ? a.city : OTHER) : x.city,
          cityOther: x.address ? x.cityOther : a.city && !cityKnown ? a.city : x.cityOther,
          area: x.area || a.area || '',
          address: x.address || a.address || '',
          landmark: x.landmark || a.landmark || '',
          mapUrl: x.mapUrl || a.mapUrl || '',
        }
      })
    }
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try {
      sessionStorage.setItem(K_FORM, JSON.stringify(f))
      if (f.remember) {
        const { giftMessage, notes, ...keep } = f
        void giftMessage
        void notes
        localStorage.setItem(K_FORM, JSON.stringify({ ...keep, isGift: false, toRecipient: false }))
      } else localStorage.removeItem(K_FORM)
    } catch {}
  }, [f, loaded])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    setErrors((e) => {
      const n = { ...e }
      delete n[k as string]
      return n
    })
  }

  const giftOn = props.gifts.giftOrderEnabled && f.isGift
  const recipientOn = giftOn && props.gifts.recipientEnabled && f.toRecipient
  const locCountry = recipientOn ? f.rCountry || f.country : f.country
  const locCityRaw = recipientOn ? f.rCity : f.city
  const locCity = locCityRaw === OTHER ? (recipientOn ? f.rCityOther : f.cityOther) : locCityRaw

  const quoteOpts = useMemo(
    () => ({
      coupon,
      fulfillment: f.fulfillment,
      country: f.fulfillment === 'delivery' ? locCountry : null,
      city: f.fulfillment === 'delivery' ? locCity : null,
      isGift: giftOn,
      giftWrapId: giftOn && props.gifts.giftWrapEnabled ? f.wrapId : null,
    }),
    [coupon, f.fulfillment, locCountry, locCity, giftOn, f.wrapId, props.gifts.giftWrapEnabled],
  )
  const { quote: liveQuote, loading } = useQuote(cart, quoteOpts, hydrated)
  const quote = serverQuote || liveQuote
  useEffect(() => setServerQuote(null), [liveQuote])

  if (!hydrated || !loaded) return <div className="skeleton" style={{ height: 320 }} />
  if (!cart.length) {
    return (
      <div className="empty">
        <h2 style={{ fontSize: '1.2rem' }}>السلة فارغة</h2>
        <Link className="btn" href="/products">
          تصفح المنتجات
        </Link>
      </div>
    )
  }

  const countryCities = (c: string) => props.shipping.find((s) => s.country === c)
  const resolvedCity = (city: string, other: string) => (city === OTHER ? other.trim() : city)

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 3) e.name = 'يرجى كتابة الاسم الكامل'
    const ph = validatePhone(f.phoneCode, f.phone)
    if (!ph.ok) e.phone = ph.error
    if (f.fulfillment === 'delivery' && !recipientOn) {
      if (!f.country) e.country = 'يرجى اختيار الدولة'
      if (!resolvedCity(f.city, f.cityOther)) e.city = 'يرجى اختيار المدينة'
      if (!f.area.trim()) e.area = 'يرجى كتابة المنطقة أو الحي'
      if (f.address.trim().length < 6) e.address = 'يرجى كتابة العنوان بالتفصيل (الشارع، المبنى، الشقة)'
    }
    if (f.mapUrl.trim() && !/^https?:\/\/\S+$/.test(f.mapUrl.trim())) e.mapUrl = 'الصق رابط الموقع كاملاً يبدأ بـ https://'
    if (!props.account && makeAccount && accountPassword.length < 6) e.accountPassword = 'كلمة المرور 6 أحرف أو أرقام على الأقل'
    if (f.notes.length > props.notesMax) e.notes = `الحد الأقصى ${props.notesMax} حرفاً`
    if (giftOn) {
      if (props.gifts.giftMessageEnabled && f.giftMessage.length > props.gifts.giftMessageMax) e.giftMessage = `الحد الأقصى ${props.gifts.giftMessageMax} حرفاً`
      if (recipientOn) {
        if (f.rName.trim().length < 2) e.rName = 'يرجى كتابة اسم المستلم'
        const rp = validatePhone(f.rPhoneCode, f.rPhone)
        if (!rp.ok) e.rPhone = rp.error
        if (f.fulfillment === 'delivery') {
          if (!(f.rCountry || f.country)) e.rCountry = 'اختر الدولة'
          if (!resolvedCity(f.rCity, f.rCityOther)) e.rCity = 'اختر مدينة المستلم'
          if (!f.rArea.trim()) e.rArea = 'اكتب منطقة المستلم'
          if (f.rAddress.trim().length < 6) e.rAddress = 'اكتب عنوان المستلم بالتفصيل'
        }
      }
    }
    if (f.fulfillment === 'delivery' && quote && !quote.shipping.zone && locCountry && locCity) e.city = e.city || 'عذراً، التوصيل غير متاح لهذه المدينة حالياً'
    return e
  }

  const focusFirst = (e: Record<string, string>) => {
    const first = Object.keys(e)[0]
    if (!first) return
    const el = document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select, [data-field="${first}"] textarea`)
    el?.focus()
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const toReview = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return focusFirst(e)
    try {
      if (!sessionStorage.getItem(K_KEY)) sessionStorage.setItem(K_KEY, newKey())
    } catch {}
    setStep('review')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    if (submitting || !quote) return
    setSubmitting(true)
    setServerError(null)
    setErrorCode(null)
    let key = ''
    try {
      key = sessionStorage.getItem(K_KEY) || newKey()
      sessionStorage.setItem(K_KEY, key)
    } catch {
      key = newKey()
    }
    const body = {
      idempotencyKey: key,
      lines: cart.map(({ key: k, productId, variantId, qty, bundle, personalization }) => ({ key: k, productId, variantId, qty, bundle, personalization })),
      couponCode: coupon,
      expectedTotal: quote.total,
      fulfillment: f.fulfillment,
      customer: {
        name: f.name, phoneCode: f.phoneCode, phone: f.phone,
        country: f.fulfillment === 'delivery' ? f.country : null,
        city: f.fulfillment === 'delivery' ? resolvedCity(f.city, f.cityOther) || null : null,
        area: f.fulfillment === 'delivery' ? f.area : null,
        address: f.fulfillment === 'delivery' ? f.address : null,
        landmark: f.fulfillment === 'delivery' ? f.landmark : null,
        mapUrl: f.fulfillment === 'delivery' ? f.mapUrl : null,
        notes: f.notes,
      },
      gift: giftOn
        ? {
            isGift: true,
            wrapId: props.gifts.giftWrapEnabled ? f.wrapId : null,
            message: props.gifts.giftMessageEnabled ? f.giftMessage : null,
            hidePrices: props.gifts.hidePricesEnabled && f.hidePrices,
            toRecipient: recipientOn,
            recipient: recipientOn
              ? { name: f.rName, phoneCode: f.rPhoneCode, phone: f.rPhone, country: f.rCountry || f.country, city: resolvedCity(f.rCity, f.rCityOther), area: f.rArea, address: f.rAddress }
              : null,
          }
        : null,
      website: honeypot.current?.value || '',
      accountPassword: !props.account && makeAccount ? accountPassword : null,
    }
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) {
        if (d.quote) setServerQuote(d.quote)
        if (d.code === 'FIELDS' && d.fieldErrors) {
          const map: Record<string, string> = {}
          for (const [k, v] of Object.entries(d.fieldErrors as Record<string, string>)) {
            const short = k.replace('customer.', '').replace('gift.recipient.', 'r_').replace('gift.message', 'giftMessage')
            const fixed = short.startsWith('r_') ? 'r' + short.slice(2, 3).toUpperCase() + short.slice(3) : short
            map[fixed] = v
          }
          setErrors(map)
          setStep('info')
          setTimeout(() => focusFirst(map), 50)
        }
        if (d.code === 'PRICE_CHANGED' && d.quote) {
          // تحديث أسعار السلة المعروضة لتطابق الخادم
          const upd: Record<string, { unitPrice: number }> = {}
          for (const l of (d.quote as Quote).lines) if (l.ok) upd[l.key] = { unitPrice: l.unitPrice }
          updateSnapshots(upd)
        }
        setServerError(d.error || 'تعذر إنشاء الطلب')
        setErrorCode(d.code || null)
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      try {
        const list = JSON.parse(localStorage.getItem(K_ORDERS) || '[]')
        localStorage.setItem(K_ORDERS, JSON.stringify([{ number: d.number, token: d.token, at: Date.now() }, ...list.filter((x: { token: string }) => x.token !== d.token)].slice(0, 10)))
        sessionStorage.removeItem(K_KEY)
        const { giftMessage, notes, ...rest } = f
        void giftMessage
        void notes
        sessionStorage.setItem(K_FORM, JSON.stringify({ ...rest, isGift: false, toRecipient: false }))
      } catch {}
      clearCart()
      if (d.accountNote) sessionStorage.setItem('gh_account_note', d.accountNote)
      router.replace(`/order/${d.token}/payment`)
      if (d.accountCreated) router.refresh()
    } catch {
      setServerError('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة — لن يتكرر الطلب عند إعادة الضغط.')
      setSubmitting(false)
    }
  }

  const cityPicker = (prefix: '' | 'r') => {
    const country = prefix ? f.rCountry || f.country : f.country
    const info = countryCities(country)
    const cityKey = (prefix ? 'rCity' : 'city') as 'rCity' | 'city'
    const otherKey = (prefix ? 'rCityOther' : 'cityOther') as 'rCityOther' | 'cityOther'
    const val = f[cityKey]
    const errKey = prefix ? 'rCity' : 'city'
    if (info && info.cities.length) {
      return (
        <Field id={errKey} label="المدينة" error={errors[errKey]}>
          <select id={errKey} className="select" value={val} onChange={(e) => set(cityKey, e.target.value)} aria-invalid={!!errors[errKey]}>
            <option value="">اختر المدينة</option>
            {info.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {info.allowOther && <option value={OTHER}>مدينة أخرى</option>}
          </select>
          {val === OTHER && <input className="input" style={{ marginTop: 6 }} placeholder="اكتب اسم المدينة" value={f[otherKey]} onChange={(e) => set(otherKey, e.target.value)} />}
        </Field>
      )
    }
    return (
      <Field id={errKey} label="المدينة" error={errors[errKey]}>
        <input
          id={errKey}
          className="input"
          value={val === OTHER ? f[otherKey] : val}
          onChange={(e) => set(cityKey, e.target.value)}
          aria-invalid={!!errors[errKey]}
          autoComplete={prefix ? 'off' : 'address-level2'}
        />
      </Field>
    )
  }

  const hours = Math.round(props.reservationMinutes / 60)
  const zone = quote?.shipping.zone

  const summary = (
    <aside className="summary">
      <div className="card stack">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>ملخص الطلب</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {cart.map((l) => {
            const q = quote?.lines.find((x) => x.key === l.key)
            return (
              <li key={l.key} className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                {(q?.image || l.image) && <img src={(q?.image || l.image)!} alt="" style={{ width: 46, height: 56, objectFit: 'cover', borderRadius: 10 }} />}
                <span className="grow small" style={{ minWidth: 0 }}>
                  {q?.name || l.name} <span className="muted">× {l.qty}</span>
                  {l.optionsText && <span className="muted" style={{ display: 'block' }}>{l.optionsText}</span>}
                  {l.personalization && <span className="muted" style={{ display: 'block' }}>تخصيص: «{l.personalization}»</span>}
                  {q && !q.ok && <span style={{ color: 'var(--c-danger)', display: 'block' }}>{q.errors[0]}</span>}
                </span>
                <b className="small num">{q ? money(q.lineTotal + q.personalizationTotal) : ''}</b>
              </li>
            )
          })}
        </ul>
        {step === 'info' && <CouponBox />}
        {quote?.coupon && !quote.coupon.valid && <div className="notice notice--danger small">{quote.coupon.message}</div>}
        {config.freeShipping.enabled && f.fulfillment === 'delivery' && quote?.shipping.freeAppliesToZone !== false && (
          <FreeShippingBar remaining={quote?.shipping.freeRemaining ?? null} threshold={config.freeShipping.threshold} />
        )}
        <dl aria-busy={loading}>
          <dt>مجموع المنتجات</dt>
          <dd className="num">{quote ? money(quote.subtotal) : '…'}</dd>
          {!!quote?.discount && (
            <>
              <dt>الخصم {quote.coupon?.code && <bdi className="num">({quote.coupon.code})</bdi>}</dt>
              <dd className="num" style={{ color: 'var(--c-sale)' }}>-{money(quote.discount)}</dd>
            </>
          )}
          {!!quote?.personalizationTotal && (
            <>
              <dt>التخصيص</dt>
              <dd className="num">{money(quote.personalizationTotal)}</dd>
            </>
          )}
          {giftOn && quote?.wrap && (
            <>
              <dt>التغليف ({quote.wrap.name})</dt>
              <dd className="num">{money(quote.wrapFee)}</dd>
            </>
          )}
          <dt>{f.fulfillment === 'pickup' ? 'الاستلام من المحل' : `الشحن${zone ? ` (${zone.name})` : ''}`}</dt>
          <dd className="num">{f.fulfillment === 'pickup' ? 'مجاناً' : zone ? (quote!.shipping.free ? 'مجاني' : money(quote!.shippingFee)) : <span className="small muted" style={{ fontWeight: 400 }}>اختر المدينة</span>}</dd>
          <dt className="total">الإجمالي</dt>
          <dd className="total num">{quote ? money(quote.total) : '…'}</dd>
        </dl>
        {zone?.eta && f.fulfillment === 'delivery' && <p className="small muted" style={{ margin: 0 }}>مدة التوصيل التقريبية: {zone.eta}</p>}
        {quote?.prepDaysMax != null && quote.prepDaysMax > 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            مدة التجهيز المتوقعة: حتى <span className="num">{quote.prepDaysMax}</span> أيام عمل
          </p>
        )}
      </div>
    </aside>
  )

  return (
    <>
      <ol className="steps" aria-label="خطوات الطلب">
        <li className="is-done">السلة</li>
        <li className={step === 'info' ? 'is-current' : 'is-done'}>البيانات</li>
        <li className={step === 'review' ? 'is-current' : ''}>المراجعة</li>
        <li>التحويل</li>
      </ol>
      {serverError && (
        <div className="notice notice--danger" role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} /> <span>{serverError}</span>
          {errorCode === 'COUPON_INVALID' && coupon && (
            <button
              type="button"
              className="link"
              style={{ marginInlineStart: 'auto', whiteSpace: 'nowrap' }}
              onClick={() => {
                setCoupon(null)
                setServerError(null)
                setErrorCode(null)
              }}
            >
              إزالة الكوبون والمتابعة
            </button>
          )}
        </div>
      )}
      <div className="cart-layout">
        <div>
          <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none', clipPath: 'inset(50%)' }} />
          {step === 'info' ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                toReview()
              }}
            >
              {props.account ? (
                <div className="notice small" style={{ marginBottom: 12 }}>
                  <Lock size={16} />
                  <span>
                    مرحباً {props.account.name.split(' ')[0]}، عبّأنا بياناتك المحفوظة. سيُحفظ هذا الطلب في <Link className="link" href="/account">حسابك</Link>.
                  </span>
                </div>
              ) : (
                <div className="notice small" style={{ marginBottom: 12 }}>
                  <Lock size={16} />
                  <span>
                    لديك حساب؟ <Link className="link" href="/account?next=/checkout">سجّل الدخول</Link> لتعبئة بياناتك تلقائياً. أو أكمل الطلب كزائر.
                  </span>
                </div>
              )}
              <div className="card">
                <h2 style={{ fontSize: '1.15rem' }}>بيانات التواصل</h2>
                <div className="form-grid form-grid--2">
                  <Field id="name" label="الاسم الكامل" error={errors.name}>
                    <input id="name" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />
                  </Field>
                  <Field id="phone" label="رقم واتساب" error={errors.phone} hint="سنتواصل معك عبر هذا الرقم بخصوص الطلب">
                    <div className="phone-input">
                      <select className="select" aria-label="مفتاح الدولة" value={f.phoneCode} onChange={(e) => set('phoneCode', e.target.value)}>
                        {PHONE_CODES.map(([c, n]) => (
                          <option key={c} value={c}>
                            +{c} {n}
                          </option>
                        ))}
                      </select>
                      <input id="phone" className="input" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="7XXXXXXXX" autoComplete="tel-national" aria-invalid={!!errors.phone} />
                    </div>
                  </Field>
                </div>
              </div>

              {props.deliveryEnabled && props.pickupEnabled && (
                <div className="card">
                  <h2 style={{ fontSize: '1.15rem' }}>طريقة الاستلام</h2>
                  <div className="choice-cards choice-cards--2" role="radiogroup">
                    <label className="choice">
                      <input type="radio" name="fulfillment" checked={f.fulfillment === 'delivery'} onChange={() => set('fulfillment', 'delivery')} />
                      <span>
                        <b style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Truck size={18} /> توصيل
                        </b>
                        <span className="small muted">إلى العنوان الذي تحدده</span>
                      </span>
                    </label>
                    <label className="choice">
                      <input type="radio" name="fulfillment" checked={f.fulfillment === 'pickup'} onChange={() => set('fulfillment', 'pickup')} />
                      <span>
                        <b style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Store size={18} /> استلام من المحل
                        </b>
                        <span className="small muted">{props.pickupAddress || 'بدون رسوم توصيل'}</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {f.fulfillment === 'pickup' ? (
                <div className="card">
                  <h2 style={{ fontSize: '1.15rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Store size={20} /> الاستلام من المحل
                  </h2>
                  {props.pickupAddress && <p>{props.pickupAddress}</p>}
                  {props.pickupNotes && <p className="muted small">{props.pickupNotes}</p>}
                  <p className="small muted">سنتواصل معك عبر واتساب عند جاهزية الطلب للاستلام.</p>
                </div>
              ) : (
                !recipientOn && (
                  <div className="card">
                    <h2 style={{ fontSize: '1.15rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <MapPin size={20} /> عنوان التوصيل
                    </h2>
                    {!props.shipping.length && <div className="notice notice--warn small">لم تُضبط مناطق التوصيل بعد. تواصل مع المتجر عبر واتساب.</div>}
                    <div className="form-grid form-grid--2">
                      <Field id="country" label="الدولة" error={errors.country}>
                        <select id="country" className="select" value={f.country} onChange={(e) => { set('country', e.target.value); set('city', '') }} aria-invalid={!!errors.country}>
                          {props.shipping.map((s) => (
                            <option key={s.country} value={s.country}>
                              {s.country}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {cityPicker('')}
                      <Field id="area" label="المنطقة / الحي" error={errors.area}>
                        <input id="area" className="input" value={f.area} onChange={(e) => set('area', e.target.value)} aria-invalid={!!errors.area} />
                      </Field>
                      <Field id="landmark" label="أقرب معلم بارز" optional>
                        <input id="landmark" className="input" value={f.landmark} onChange={(e) => set('landmark', e.target.value)} />
                      </Field>
                      <div className="span-2">
                        <Field id="address" label="العنوان بالتفصيل" error={errors.address} hint="الشارع، اسم المبنى، رقم الشقة أو المنزل">
                          <textarea id="address" className="textarea" rows={2} value={f.address} onChange={(e) => set('address', e.target.value)} aria-invalid={!!errors.address} autoComplete="street-address" />
                        </Field>
                      </div>
                      <div className="span-2">
                        <Field id="mapUrl" label="رابط موقع التوصيل على الخريطة" optional error={errors.mapUrl} hint="من خرائط جوجل: اضغط مطولاً على الموقع ثم «مشاركة» وانسخ الرابط">
                          <input id="mapUrl" className="input" dir="ltr" value={f.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} placeholder="https://maps.app.goo.gl/..." aria-invalid={!!errors.mapUrl} />
                        </Field>
                      </div>
                    </div>
                  </div>
                )
              )}

              {props.gifts.giftOrderEnabled && (
                <div className="card">
                  <label className="check">
                    <input type="checkbox" checked={f.isGift} onChange={(e) => set('isGift', e.target.checked)} />
                    <span>
                      <b style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Gift size={18} /> هذا الطلب هدية
                      </b>
                      <span className="small muted">أضف تغليفاً ورسالة إهداء أو أرسله مباشرة لمستلم آخر</span>
                    </span>
                  </label>
                  {giftOn && (
                    <div className="stack" style={{ marginTop: '1rem' }}>
                      {props.gifts.giftWrapEnabled && props.wraps.length > 0 && (
                        <div>
                          <div className="label" style={{ marginBottom: 6 }}>تغليف الهدية</div>
                          <div className="choice-cards choice-cards--2">
                            <label className="choice">
                              <input type="radio" name="wrap" checked={!f.wrapId} onChange={() => set('wrapId', null)} />
                              <span>بدون تغليف</span>
                            </label>
                            {props.wraps.map((w) => (
                              <label className="choice" key={w.id}>
                                <input type="radio" name="wrap" checked={f.wrapId === w.id} onChange={() => set('wrapId', w.id)} />
                                {w.image && <img src={w.image} alt="" />}
                                <span>
                                  <b>{w.name}</b> <span className="num small">+{money(w.price)}</span>
                                  {w.description && <span className="small muted" style={{ display: 'block' }}>{w.description}</span>}
                                </span>
                              </label>
                            ))}
                          </div>
                          {quote && quote.lines.some((l) => !l.giftWrapEligible) && (
                            <p className="small muted" style={{ marginTop: 6 }}>بعض المنتجات في السلة غير قابلة للتغليف وستُرسل كما هي.</p>
                          )}
                        </div>
                      )}
                      {props.gifts.giftMessageEnabled && (
                        <Field id="giftMessage" label="رسالة الإهداء" optional error={errors.giftMessage} hint={`${f.giftMessage.length}/${props.gifts.giftMessageMax}`}>
                          <textarea id="giftMessage" className="textarea" rows={3} maxLength={props.gifts.giftMessageMax} value={f.giftMessage} onChange={(e) => set('giftMessage', e.target.value)} placeholder="مثال: ألف مبروك المولود، جعله الله من الصالحين" />
                        </Field>
                      )}
                      {props.gifts.hidePricesEnabled && (
                        <label className="check">
                          <input type="checkbox" checked={f.hidePrices} onChange={(e) => set('hidePrices', e.target.checked)} />
                          <span>إخفاء الأسعار من الورقة المرفقة بالهدية</span>
                        </label>
                      )}
                      {props.gifts.recipientEnabled && (
                        <label className="check">
                          <input type="checkbox" checked={f.toRecipient} onChange={(e) => set('toRecipient', e.target.checked)} />
                          <span>إرسال الهدية إلى مستلم آخر (اسم ورقم وعنوان مختلف)</span>
                        </label>
                      )}
                      {recipientOn && (
                        <div className="form-grid form-grid--2">
                          <Field id="rName" label="اسم المستلم" error={errors.rName}>
                            <input id="rName" className="input" value={f.rName} onChange={(e) => set('rName', e.target.value)} aria-invalid={!!errors.rName} />
                          </Field>
                          <Field id="rPhone" label="رقم المستلم" error={errors.rPhone}>
                            <div className="phone-input">
                              <select className="select" aria-label="مفتاح الدولة" value={f.rPhoneCode} onChange={(e) => set('rPhoneCode', e.target.value)}>
                                {PHONE_CODES.map(([c, n]) => (
                                  <option key={c} value={c}>
                                    +{c} {n}
                                  </option>
                                ))}
                              </select>
                              <input id="rPhone" className="input" type="tel" inputMode="tel" value={f.rPhone} onChange={(e) => set('rPhone', e.target.value)} aria-invalid={!!errors.rPhone} />
                            </div>
                          </Field>
                          {f.fulfillment === 'delivery' && (
                            <>
                              <Field id="rCountry" label="الدولة" error={errors.rCountry}>
                                <select id="rCountry" className="select" value={f.rCountry || f.country} onChange={(e) => { set('rCountry', e.target.value); set('rCity', '') }}>
                                  {props.shipping.map((s) => (
                                    <option key={s.country} value={s.country}>
                                      {s.country}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              {cityPicker('r')}
                              <Field id="rArea" label="المنطقة / الحي" error={errors.rArea}>
                                <input id="rArea" className="input" value={f.rArea} onChange={(e) => set('rArea', e.target.value)} aria-invalid={!!errors.rArea} />
                              </Field>
                              <div className="span-2">
                                <Field id="rAddress" label="عنوان المستلم بالتفصيل" error={errors.rAddress}>
                                  <textarea id="rAddress" className="textarea" rows={2} value={f.rAddress} onChange={(e) => set('rAddress', e.target.value)} aria-invalid={!!errors.rAddress} />
                                </Field>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="card">
                <Field id="notes" label="ملاحظات الطلب" optional error={errors.notes}>
                  <textarea id="notes" className="textarea" rows={2} maxLength={props.notesMax} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="مثل: الوقت المناسب للتوصيل" />
                </Field>
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" checked={f.remember} onChange={(e) => set('remember', e.target.checked)} />
                  <span className="small">تذكر بياناتي على هذا الجهاز للطلبات القادمة</span>
                </label>
                {!props.account && (
                  <>
                    <label className="check" style={{ marginTop: 8 }}>
                      <input type="checkbox" checked={makeAccount} onChange={(e) => setMakeAccount(e.target.checked)} />
                      <span className="small">أنشئ لي حساباً برقم واتساب لحفظ بياناتي ومتابعة طلباتي السابقة</span>
                    </label>
                    {makeAccount && (
                      <Field id="accountPassword" label="اختر كلمة مرور للحساب" error={errors.accountPassword} hint="6 أحرف أو أرقام على الأقل. ستدخل لاحقاً برقم واتساب وهذه الكلمة">
                        <input
                          id="accountPassword"
                          className="input"
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={accountPassword}
                          onChange={(e) => {
                            setAccountPassword(e.target.value)
                            setErrors((x) => {
                              const n = { ...x }
                              delete n.accountPassword
                              return n
                            })
                          }}
                        />
                      </Field>
                    )}
                  </>
                )}
              </div>
              <div className="row" style={{ marginTop: '1rem' }}>
                <Link href="/cart" className="btn btn--ghost">
                  <ChevronRight size={18} /> السلة
                </Link>
                <button type="submit" className="btn btn--lg grow">
                  متابعة لمراجعة الطلب
                </button>
              </div>
            </form>
          ) : (
            <div className="card">
              <h2 style={{ fontSize: '1.15rem' }}>راجع طلبك قبل التأكيد</h2>
              <div className="review-block">
                <h3>
                  بيانات العميل
                  <button type="button" className="link small" onClick={() => setStep('info')}>
                    <Pencil size={14} style={{ display: 'inline' }} /> تعديل
                  </button>
                </h3>
                <p style={{ margin: 0 }}>
                  {f.name} — <bdi className="num">+{f.phoneCode} {f.phone}</bdi>
                </p>
              </div>
              <div className="review-block">
                <h3>{f.fulfillment === 'pickup' ? 'الاستلام من المحل' : recipientOn ? 'التوصيل إلى مستلم الهدية' : 'عنوان التوصيل'}</h3>
                {f.fulfillment === 'pickup' ? (
                  <p style={{ margin: 0 }}>{props.pickupAddress || 'سنتواصل معك لتحديد موعد الاستلام'}</p>
                ) : recipientOn ? (
                  <p style={{ margin: 0 }}>
                    {f.rName} — <bdi className="num">+{f.rPhoneCode} {f.rPhone}</bdi>
                    <br />
                    {[f.rCountry || f.country, resolvedCity(f.rCity, f.rCityOther), f.rArea, f.rAddress].filter(Boolean).join('، ')}
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    {[f.country, resolvedCity(f.city, f.cityOther), f.area, f.address].filter(Boolean).join('، ')}
                    {f.landmark && <><br />أقرب معلم: {f.landmark}</>}
                    {f.mapUrl && <><br /><a className="link" href={f.mapUrl} target="_blank" rel="noopener noreferrer">رابط الموقع</a></>}
                  </p>
                )}
                {zone?.eta && f.fulfillment === 'delivery' && <p className="small muted" style={{ margin: 0 }}>مدة التوصيل التقريبية: {zone.eta}</p>}
              </div>
              {giftOn && (
                <div className="review-block">
                  <h3>تفاصيل الهدية</h3>
                  <p style={{ margin: 0 }}>
                    التغليف: {quote?.wrap ? `${quote.wrap.name} (${money(quote.wrapFee)})` : 'بدون تغليف'}
                    {f.giftMessage && <><br />رسالة الإهداء: «{f.giftMessage}»</>}
                    {f.hidePrices && <><br />سيتم إخفاء الأسعار من الورقة المرفقة</>}
                  </p>
                </div>
              )}
              {cart.some((l) => l.personalization) && (
                <div className="review-block">
                  <h3>التخصيص</h3>
                  <ul style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
                    {cart
                      .filter((l) => l.personalization)
                      .map((l) => {
                        const q = quote?.lines.find((x) => x.key === l.key)
                        return (
                          <li key={l.key}>
                            {l.name}: {q?.personalization?.label || 'نص'} «{l.personalization}» {q?.personalization?.feeUnit ? `(+${money(q.personalization.feeUnit * l.qty)})` : ''}
                          </li>
                        )
                      })}
                  </ul>
                </div>
              )}
              {f.notes && (
                <div className="review-block">
                  <h3>ملاحظات</h3>
                  <p style={{ margin: 0 }}>{f.notes}</p>
                </div>
              )}
              <div className="notice notice--info" style={{ marginTop: 12 }}>
                <AlertCircle size={18} />
                <span>
                  بعد التأكيد يُحفظ طلبك برقم خاص وتظهر لك وسائل التحويل. ستُحجز المنتجات لمدة <b className="num">{hours}</b> ساعة بانتظار التحويل وإرسال السند عبر واتساب.
                </span>
              </div>
              <div className="row" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn--ghost" onClick={() => setStep('info')} disabled={submitting}>
                  <ChevronRight size={18} /> تعديل البيانات
                </button>
                <button type="button" className="btn btn--lg grow" onClick={submit} disabled={submitting || !quote || quote.hasBlockingErrors}>
                  {submitting ? <span className="spinner" /> : <Lock size={18} />} {config.labels.placeOrder || 'تأكيد الطلب'}
                  {quote && <span className="num">— {money(quote.total)}</span>}
                </button>
              </div>
              {quote?.hasBlockingErrors && <p className="small" style={{ color: 'var(--c-danger)' }}>{quote.errors[0] || 'راجع السلة قبل التأكيد'}</p>}
            </div>
          )}
        </div>
        {summary}
      </div>
    </>
  )
}
