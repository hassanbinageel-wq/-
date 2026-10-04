'use client'

import { useState } from 'react'
import { api, useAction, Modal, Field } from './ui'

export function StockAdjust({ productId, variantId, label, current }: { productId: number; variantId: number | null; label: string; current: number }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'add' | 'set'>('add')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const { run, busy } = useAction()
  const n = Number(value)
  const after = mode === 'set' ? n : current + n
  return (
    <>
      <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setOpen(true)}>
        تعديل
      </button>
      {open && (
        <Modal title={`تعديل مخزون: ${label}`} onClose={() => setOpen(false)}>
          <div className="a-form">
            <p className="small" style={{ margin: 0 }}>
              الرصيد الحالي: <b className="num">{current}</b>
            </p>
            <Field label="نوع التعديل">
              <select className="a-select" value={mode} onChange={(e) => setMode(e.target.value as 'add' | 'set')}>
                <option value="add">إضافة / خصم كمية (مثل 10 أو -2)</option>
                <option value="set">تحديد الرصيد بعد الجرد</option>
              </select>
            </Field>
            <Field label="الكمية">
              <input className="a-input" dir="ltr" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ''))} autoFocus />
            </Field>
            <Field label="السبب (يظهر في السجل)">
              <input className="a-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="استلام بضاعة، جرد، تالف…" />
            </Field>
            {value !== '' && !Number.isNaN(n) && <p className="small">الرصيد بعد التعديل: <b className="num">{after}</b></p>}
            <button
              type="button"
              className="a-btn"
              disabled={busy || value === '' || Number.isNaN(n) || after < 0}
              onClick={() => run(() => api('POST', 'stock/adjust', { productId, variantId, mode, value: n, note }).then(() => setOpen(false)), 'تم تعديل المخزون')}
            >
              حفظ
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
