'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Heart, Share2, Ruler, ShoppingBag, AlertCircle, Check } from 'lucide-react'
import type { BundleComponentPublic, ProductDetail, ProductOption, VariantPublic } from '@/lib/shared/types'
import { useStore } from './StoreProvider'
import { Price } from './ProductCard'
import { QtyStepper } from './CartLine'
import { WhatsAppIcon } from './Deco'
import { Modal } from './Modal'
import { waLink } from '@/lib/shared/phone'

const UNLIMITED = 9999

function findVariant(options: ProductOption[], variants: VariantPublic[], sel: (string | null)[]) {
  if (!options.length || sel.some((s, i) => i < options.length && !s)) return null
  return variants.find((v) => v.active && options.every((_, k) => v.options[k] === sel[k])) || null
}

function valueState(options: ProductOption[], variants: VariantPublic[], sel: (string | null)[], k: number, value: string): 'ok' | 'out' | 'none' {
  const cands = variants.filter((v) => v.active && v.options[k] === value && options.every((_, j) => j === k || !sel[j] || v.options[j] === sel[j]))
  if (!cands.length) return 'none'
  return cands.some((v) => v.available > 0) ? 'ok' : 'out'
}

function OptionPicker({
  options,
  variants,
  sel,
  onPick,
  idPrefix,
}: {
  options: ProductOption[]
  variants: VariantPublic[]
  sel: (string | null)[]
  onPick: (k: number, v: string) => void
  idPrefix: string
}) {
  return (
    <>
      {options.map((o, k) => (
        <div className="opt" key={o.name} role="radiogroup" aria-labelledby={`${idPrefix}-o${k}`}>
          <div className="opt__head">
            <b id={`${idPrefix}-o${k}`}>
              {o.name}: <span>{sel[k] || 'اختر'}</span>
            </b>
          </div>
          <div className="filter-opts" style={{ marginTop: 0 }}>
            {o.values.map((v) => {
              const st = valueState(options, variants, sel, k, v.value)
              const on = sel[k] === v.value
              return (
                <button
                  type="button"
                  key={v.value}
                  role="radio"
                  aria-checked={on}
                  className={`chip ${o.kind === 'color' ? 'chip--swatch' : ''} ${on ? 'is-on' : ''} ${st !== 'ok' ? 'is-disabled' : ''}`}
                  style={st !== 'ok' ? { cursor: 'pointer' } : undefined}
                  onClick={() => onPick(k, v.value)}
                  title={st === 'out' ? 'غير متوفر حالياً' : st === 'none' ? 'غير متاح مع اختيارك الحالي' : v.value}
                >
                  {o.kind === 'color' && <i style={{ background: v.color || 'var(--c-soft)' }} />}
                  {v.value}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

function componentAvail(c: BundleComponentPublic, sel: (string | null)[] | undefined): { variant: VariantPublic | null; avail: number | null } {
  if (c.type !== 'variable') return { variant: null, avail: Math.floor(c.simpleAvailable / c.qty) }
  if (c.fixedVariantId) {
    const v = c.variants.find((x) => x.id === c.fixedVariantId) || null
    return { variant: v, avail: v ? Math.floor(v.available / c.qty) : 0 }
  }
  const v = findVariant(c.options, c.variants, sel || [])
  return { variant: v, avail: v ? Math.floor(v.available / c.qty) : null }
}

export function Purchase({ p, compact, onFocusValue, productUrl }: { p: ProductDetail; compact?: boolean; onFocusValue?: (v: string | null) => void; productUrl: string }) {
  const { config, addToCart, isFavorite, toggleFavorite, hydrated, money, toast, pushRecent } = useStore()
  const L = config.labels
  const [sel, setSel] = useState<(string | null)[]>(() => p.options.map((o) => (o.values.length === 1 ? o.values[0].value : null)))
  const [compSel, setCompSel] = useState<Record<number, (string | null)[]>>(() =>
    Object.fromEntries(p.components.map((c) => [c.id, c.options.map((o) => (o.values.length === 1 ? o.values[0].value : null))])),
  )
  const [qty, setQty] = useState(1)
  const [persOn, setPersOn] = useState(!!p.personalization?.required)
  const [persText, setPersText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [guide, setGuide] = useState(false)
  const [added, setAdded] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    if (!compact) pushRecent(p.id)
  }, [p.id, compact, pushRecent])

  useEffect(() => {
    if (compact || !btnRef.current || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setStickyVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    io.observe(btnRef.current)
    return () => io.disconnect()
  }, [compact])

  const match = p.type === 'variable' ? findVariant(p.options, p.variants, sel) : null
  const comps = useMemo(() => p.components.map((c) => ({ c, ...componentAvail(c, compSel[c.id]) })), [p.components, compSel])

  let available: number | null
  if (p.type === 'variable') available = match ? match.available : null
  else if (p.type === 'bundle') available = !p.available ? 0 : comps.some((x) => x.avail === null) ? null : Math.min(UNLIMITED, ...comps.map((x) => x.avail as number))
  else available = p.simpleAvailable
  const maxQty = Math.max(1, Math.min(available ?? p.maxPerOrder, p.maxPerOrder))
  const outOfStock = available === 0 || (!p.available && p.type !== 'variable')
  const price = match ? match.price : p.price
  const compareAt = match ? match.compareAt : p.compareAt
  const pers = p.personalization
  const persFee = pers && persOn && persText.trim() ? pers.fee : 0
  const colorIdx = p.options.findIndex((o) => o.kind === 'color')
  const sku = match?.sku || p.sku
  const low = available != null && available > 0 && available < UNLIMITED && p.lowThreshold != null && available <= p.lowThreshold ? available : null

  useEffect(() => {
    if (qty > maxQty) setQty(maxQty)
  }, [maxQty, qty])

  const pick = (k: number, v: string) => {
    setSel((s) => s.map((x, i) => (i === k ? v : x)))
    setErrors([])
    if (k === colorIdx) onFocusValue?.(v)
  }

  const validate = (): string[] => {
    const e: string[] = []
    if (p.type === 'variable') {
      const missing = p.options.filter((_, k) => !sel[k]).map((o) => o.name)
      if (missing.length) e.push(`${L.selectOptions || 'اختر الخيارات'}: ${missing.join(' و')}`)
      else if (!match) e.push('هذه التركيبة غير متاحة، جرّب خياراً آخر')
    }
    for (const x of comps) {
      if (x.c.type === 'variable' && !x.c.fixedVariantId && !x.variant) e.push(`اختر خيارات «${x.c.name}» داخل الباقة`)
    }
    if (!e.length && available === 0) e.push('هذا الاختيار غير متوفر حالياً')
    if (!e.length && qty > maxQty) e.push(`الكمية المتاحة ${maxQty} فقط`)
    if (pers) {
      const t = persText.trim()
      if (pers.required && !t) e.push(`يرجى كتابة ${pers.label}`)
      if (persOn && t.length > pers.maxLength) e.push(`${pers.label} يجب ألا يتجاوز ${pers.maxLength} حرفاً`)
      if (persOn && t && !/^[\p{L}\p{M}\p{N} .'&-]+$/u.test(t)) e.push('استخدم حروفاً وأرقاماً فقط في نص التخصيص')
    }
    return e
  }

  const add = () => {
    const e = validate()
    setErrors(e)
    if (e.length) {
      btnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const colorVal = colorIdx >= 0 ? sel[colorIdx] : null
    const img = (colorVal && p.images.find((i) => i.optionValue === colorVal)) || p.images[0]
    const optionsText = [
      ...p.options.map((o, k) => (sel[k] ? `${o.name}: ${sel[k]}` : '')).filter(Boolean),
      ...comps.filter((x) => x.variant && x.c.type === 'variable').map((x) => `${x.c.name}: ${x.variant!.options.filter(Boolean).join(' / ')}`),
    ].join(' — ')
    addToCart({
      productId: p.id,
      variantId: match?.id ?? null,
      qty,
      bundle: comps.filter((x) => x.c.type === 'variable' && !x.c.fixedVariantId && x.variant).map((x) => ({ itemId: x.c.id, variantId: x.variant!.id })),
      personalization: pers && persOn && persText.trim() ? persText.trim() : null,
      name: p.name,
      image: img?.url || null,
      unitPrice: price,
      sku,
      optionsText,
      slug: p.slug,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const askText = [
    'مرحباً، أود الاستفسار عن المنتج:',
    p.name,
    `رقم المنتج: ${sku}`,
    ...p.options.map((o, k) => (sel[k] ? `${o.name}: ${sel[k]}` : '')).filter(Boolean),
    `الرابط: ${productUrl}`,
  ].join('\n')

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, text: p.shortDescription || p.name, url: productUrl })
        return
      }
    } catch {
      return
    }
    try {
      await navigator.clipboard.writeText(productUrl)
      toast('تم نسخ رابط المنتج')
    } catch {
      toast('تعذر النسخ، انسخ الرابط من شريط العنوان', { type: 'error' })
    }
  }

  const fav = hydrated && isFavorite(p.id)

  return (
    <div>
      <div className="pdp__price row">
        <Price price={price} compareAt={compareAt} from={p.type === 'variable' && !match && p.priceFrom} />
        {compareAt != null && compareAt > price && <span className="pdp__save">وفّر {money(compareAt - price)}</span>}
      </div>
      {p.type === 'bundle' && p.bundleValue && (
        <p className="small muted" style={{ marginTop: -6 }}>
          قيمة المكونات منفردة: <s className="num">{money(p.bundleValue)}</s>
        </p>
      )}
      <div className="row small" style={{ gap: 8 }}>
        {outOfStock ? (
          <span className="badge badge--out">{L.outOfStock || 'غير متوفر حالياً'}</span>
        ) : available == null ? (
          <span className="badge">{p.available ? 'اختر الخيارات لمعرفة التوفر' : L.outOfStock}</span>
        ) : (
          <span className="badge badge--ok">
            <Check size={14} /> متوفر
          </span>
        )}
        {low != null && <span className="low-stock">متبقٍ {low} فقط</span>}
      </div>

      {p.type === 'variable' && <OptionPicker options={p.options} variants={p.variants} sel={sel} onPick={pick} idPrefix={`p${p.id}`} />}
      {p.sizeGuide && (
        <button type="button" className="link small" style={{ marginTop: 8, display: 'inline-flex', gap: 4, alignItems: 'center' }} onClick={() => setGuide(true)}>
          <Ruler size={16} /> دليل المقاسات
        </button>
      )}

      {p.type === 'bundle' && (
        <div className="opt">
          <div className="opt__head">
            <b>محتويات الباقة</b>
          </div>
          <div className="stack">
            {comps.map(({ c, variant, avail }) => (
              <div className="bundle-comp" key={c.id}>
                {c.image ? <img src={c.image.url} alt="" loading="lazy" /> : <span className="skeleton" style={{ width: 64, height: 76 }} />}
                <div className="grow" style={{ minWidth: 0 }}>
                  <b style={{ fontWeight: 400 }}>
                    {c.name} {c.qty > 1 && <span className="muted">× {c.qty}</span>}
                  </b>
                  {c.type === 'variable' && c.fixedVariantId && variant && <div className="small muted">{variant.options.filter(Boolean).join(' / ')}</div>}
                  {c.type === 'variable' && !c.fixedVariantId && (
                    <OptionPicker
                      options={c.options}
                      variants={c.variants}
                      sel={compSel[c.id] || []}
                      idPrefix={`b${c.id}`}
                      onPick={(k, v) => {
                        setCompSel((s) => ({ ...s, [c.id]: (s[c.id] || []).map((x, i) => (i === k ? v : x)) }))
                        setErrors([])
                      }}
                    />
                  )}
                  {avail === 0 && <div className="small" style={{ color: 'var(--c-danger)' }}>غير متوفر بهذا الاختيار</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pers && (
        <div className="perso">
          {pers.required ? (
            <b>{pers.label}</b>
          ) : (
            <label className="check">
              <input type="checkbox" checked={persOn} onChange={(e) => setPersOn(e.target.checked)} />
              <span>
                <b>أضف {pers.label}</b>
                {pers.fee > 0 && <span className="muted small"> (+{money(pers.fee)} للقطعة)</span>}
              </span>
            </label>
          )}
          {(persOn || pers.required) && (
            <>
              <input
                className="input"
                value={persText}
                maxLength={pers.maxLength}
                placeholder={pers.placeholder || pers.label}
                onChange={(e) => setPersText(e.target.value)}
                aria-label={pers.label}
              />
              <div className="row small muted" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <span>{pers.help || (pers.extraDays ? `يضيف ${pers.extraDays} يوم عمل لمدة التجهيز` : '')}</span>
                <span className="num">
                  {persText.length}/{pers.maxLength}
                </span>
              </div>
              {pers.required && pers.fee > 0 && <div className="small muted">رسوم التخصيص: {money(pers.fee)} للقطعة</div>}
            </>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="notice notice--danger" role="alert" style={{ marginTop: 12 }}>
          <AlertCircle size={18} />
          <div>
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        </div>
      )}

      <div className="buy-row">
        <QtyStepper value={qty} max={maxQty} onChange={setQty} />
        <button ref={btnRef} type="button" className="btn btn--lg" onClick={add} disabled={outOfStock}>
          {added ? <Check size={20} /> : <ShoppingBag size={20} />}
          {outOfStock ? L.outOfStock || 'غير متوفر' : added ? 'أُضيف إلى السلة' : L.addToCart || 'أضف إلى السلة'}
        </button>
      </div>
      {persFee > 0 && <p className="small muted" style={{ marginTop: 6 }}>يشمل الإجمالي رسوم التخصيص: {money(persFee * qty)}</p>}

      <div className="row" style={{ marginTop: 10 }}>
        <a className="btn btn--ghost btn--sm grow" href={waLink(config.whatsapp, askText)} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon size={18} /> {L.askWhatsapp || 'اسأل عبر واتساب'}
        </a>
        <button type="button" className="icon-btn" style={{ border: '1.5px solid var(--c-border)' }} aria-pressed={fav} aria-label="المفضلة" onClick={() => toggleFavorite(p.id, p.name)}>
          <Heart size={20} fill={fav ? 'currentColor' : 'none'} color={fav ? 'var(--c-sale)' : 'currentColor'} />
        </button>
        <button type="button" className="icon-btn" style={{ border: '1.5px solid var(--c-border)' }} aria-label="مشاركة رابط المنتج" onClick={share}>
          <Share2 size={20} />
        </button>
      </div>

      {!compact && (
        <div className={`sticky-buy ${stickyVisible ? 'is-visible' : ''}`} aria-hidden={!stickyVisible}>
          <div style={{ minWidth: 0 }}>
            <div className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40vw' }}>
              {p.name}
            </div>
            <Price price={price} compareAt={compareAt} />
          </div>
          <button type="button" className="btn" onClick={add} disabled={outOfStock} tabIndex={stickyVisible ? 0 : -1}>
            <ShoppingBag size={18} /> {outOfStock ? L.outOfStock : L.addToCart}
          </button>
        </div>
      )}

      {guide && p.sizeGuide && (
        <Modal onClose={() => setGuide(false)} small label={p.sizeGuide.name}>
          <h2 style={{ fontSize: '1.2rem' }}>{p.sizeGuide.name}</h2>
          {p.sizeGuide.intro && <p className="muted">{p.sizeGuide.intro}</p>}
          {p.sizeGuide.columns.length > 0 && (
            <div className="table-wrap">
              <table className="size-table">
                <thead>
                  <tr>
                    {p.sizeGuide.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.sizeGuide.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {p.sizeGuide.image && <img src={p.sizeGuide.image.url} alt={p.sizeGuide.name} style={{ marginTop: 12, borderRadius: 12 }} />}
          {p.sizeGuide.notes && <p className="small muted" style={{ marginTop: 12 }}>{p.sizeGuide.notes}</p>}
        </Modal>
      )}
    </div>
  )
}
