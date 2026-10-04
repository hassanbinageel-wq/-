'use client'

import Link from 'next/link'
import { Minus, Plus, Trash2, AlertCircle } from 'lucide-react'
import type { CartLineSnapshot, QuoteLine } from '@/lib/shared/types'
import { useStore } from './StoreProvider'

export function QtyStepper({ value, max, onChange, small, label }: { value: number; max: number; onChange: (n: number) => void; small?: boolean; label?: string }) {
  return (
    <div className={`qty ${small ? 'qty--sm' : ''}`} role="group" aria-label={label || 'الكمية'}>
      <button type="button" aria-label="زيادة الكمية" onClick={() => onChange(value + 1)} disabled={value >= max}>
        <Plus size={small ? 15 : 18} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        aria-label="الكمية"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(Math.max(1, Math.min(max, n)))
        }}
      />
      <button type="button" aria-label="إنقاص الكمية" onClick={() => onChange(value - 1)} disabled={value <= 1}>
        <Minus size={small ? 15 : 18} />
      </button>
    </div>
  )
}

export function CartLineView({ line, q, compact }: { line: CartLineSnapshot; q?: QuoteLine; compact?: boolean }) {
  const { setQty, removeLine, money } = useStore()
  const unit = q?.unitPrice ?? line.unitPrice
  const priceChanged = q && q.ok && q.unitPrice !== line.unitPrice
  const max = q ? Math.max(1, Math.min(q.maxQty || 1, 99)) : 20
  const options = q?.options?.length ? q.options.map((o) => `${o.name}: ${o.value}`).join(' — ') : q?.components?.length ? '' : line.optionsText
  return (
    <div className="cart-line">
      <Link href={`/product/${encodeURIComponent(q?.slug || line.slug)}`} className="cart-line__img">
        {(line.image || q?.image) && <img src={(line.image || q?.image)!} alt="" loading="lazy" />}
      </Link>
      <div style={{ minWidth: 0 }}>
        <Link href={`/product/${encodeURIComponent(q?.slug || line.slug)}`} className="cart-line__name">
          {q?.name || line.name}
        </Link>
        <div className="cart-line__meta">
          <div>
            رقم المنتج: <bdi className="num">{q?.sku || line.sku}</bdi>
          </div>
          {options && <div>{options}</div>}
          {!!q?.components?.length && (
            <div>
              المكونات:{' '}
              {q.components.map((c) => `${c.name}${c.qty > 1 ? ` ×${c.qty}` : ''}${c.options.length ? ` (${c.options.map((o) => o.value).join('، ')})` : ''}`).join('، ')}
            </div>
          )}
          {line.personalization && (
            <div>
              {q?.personalization?.label || 'التخصيص'}: «{line.personalization}»
              {q?.personalization?.feeUnit ? ` (+${money(q.personalization.feeUnit)} للقطعة)` : ''}
            </div>
          )}
          {!compact && <div>سعر الوحدة: <span className="num">{money(unit)}</span></div>}
        </div>
        {priceChanged && (
          <div className="notice notice--warn small" style={{ marginTop: 6, padding: '0.4rem 0.6rem' }}>
            <AlertCircle size={16} /> تغير السعر من <span className="num">{money(line.unitPrice)}</span> إلى <span className="num">{money(q!.unitPrice)}</span>
          </div>
        )}
        {q && !q.ok &&
          q.errors.map((e) => (
            <div key={e} className="notice notice--danger small" style={{ marginTop: 6, padding: '0.4rem 0.6rem' }}>
              <AlertCircle size={16} /> <span>{e}</span>
              {q.maxQty > 0 && line.qty > q.maxQty && (
                <button type="button" className="link" style={{ marginInlineStart: 'auto' }} onClick={() => setQty(line.key, q.maxQty)}>
                  اجعلها {q.maxQty}
                </button>
              )}
            </div>
          ))}
        {q?.warnings.map((w) => (
          <div key={w} className="notice notice--warn small" style={{ marginTop: 6, padding: '0.4rem 0.6rem' }}>
            {w}
          </div>
        ))}
        <div className="cart-line__row">
          <QtyStepper small value={line.qty} max={max} onChange={(n) => setQty(line.key, n)} />
          <b className="num">{money((q?.ok ? q.lineTotal + q.personalizationTotal : unit * line.qty))}</b>
          <button type="button" className="icon-btn" aria-label={`حذف ${line.name} من السلة`} onClick={() => removeLine(line.key)}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
