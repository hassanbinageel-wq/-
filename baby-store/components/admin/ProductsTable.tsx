'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { api, useAction, useAdmin, Modal, Field, confirmAction } from './ui'

type Row = {
  id: number; type: string; sku: string; name: string; slug: string; status: string; price: number; sale_price: number | null
  track_stock: number; is_demo: number; category_name: string | null; stock_total: number; variants_count: number; thumb: string | null
}

const STATUS: Record<string, [string, string]> = { published: ['منشور', 'a-badge--ok'], draft: ['مسودة', ''], archived: ['مؤرشف', 'a-badge--danger'] }
const TYPE: Record<string, string> = { simple: 'بسيط', variable: 'بخيارات', bundle: 'باقة' }

export function ProductsTable({ rows, categories }: { rows: Row[]; categories: { id: number; name: string }[] }) {
  const { money } = useAdmin()
  const { run, busy } = useAction()
  const [sel, setSel] = useState<number[]>([])
  const [bulk, setBulk] = useState<null | 'price' | 'category' | 'sale'>(null)
  const all = rows.length > 0 && sel.length === rows.length
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const doBulk = (body: Record<string, unknown>, msg: string) => run(() => api('POST', 'products/bulk', { ids: sel, ...body }).then(() => { setSel([]); setBulk(null) }), msg)

  return (
    <>
      {sel.length > 0 && (
        <div className="a-card a-row" style={{ marginBottom: 10, position: 'sticky', top: 64, zIndex: 10 }}>
          <b className="num">{sel.length} محدد</b>
          <button type="button" className="a-btn a-btn--sm" disabled={busy} onClick={() => doBulk({ status: 'published' }, 'تم النشر')}>نشر</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={busy} onClick={() => doBulk({ status: 'draft' }, 'تم التحويل لمسودة')}>مسودة</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={busy} onClick={() => confirmAction('أرشفة المنتجات المحددة؟ لن تظهر في المتجر.') && doBulk({ status: 'archived' }, 'تمت الأرشفة')}>أرشفة</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setBulk('price')}>تعديل الأسعار</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setBulk('sale')}>التخفيض</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setBulk('category')}>نقل لقسم</button>
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setSel([])}>إلغاء التحديد</button>
        </div>
      )}
      {rows.length ? (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="تحديد الكل" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} /></th>
                <th></th>
                <th>المنتج</th>
                <th>القسم</th>
                <th>السعر</th>
                <th>المخزون</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label={`تحديد ${r.name}`} checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td>{r.thumb ? <img className="thumb" src={`/media/${r.thumb}`} alt="" /> : <span className="thumb" style={{ display: 'block' }} />}</td>
                  <td>
                    <Link className="rowlink" href={`/admin/products/${r.id}`}>{r.name}</Link>
                    <div className="small muted">
                      <bdi>{r.sku}</bdi> · {TYPE[r.type]}{r.type === 'variable' ? ` (${r.variants_count})` : ''} {r.is_demo ? <span className="a-badge">تجريبي</span> : null}
                    </div>
                  </td>
                  <td className="small">{r.category_name || '—'}</td>
                  <td className="num">
                    {r.sale_price != null ? <><b style={{ color: 'var(--a-danger)' }}>{money(r.sale_price)}</b> <s className="small muted">{money(r.price)}</s></> : money(r.price)}
                  </td>
                  <td className="num">
                    {r.type === 'bundle' ? <span className="small muted">من المكونات</span> : !r.track_stock ? <span className="small muted">بدون تتبع</span> : (
                      <span className={`a-badge ${r.stock_total <= 0 ? 'a-badge--danger' : r.stock_total <= 3 ? 'a-badge--warn' : 'a-badge--ok'}`}>{r.stock_total}</span>
                    )}
                  </td>
                  <td><span className={`a-badge ${STATUS[r.status]?.[1] || ''}`}>{STATUS[r.status]?.[0]}</span></td>
                  <td>
                    <div className="a-row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                      <button type="button" className="a-icon-btn" title="نسخ المنتج برقم جديد" aria-label="نسخ" disabled={busy} onClick={() => run(async () => {
                        const res = await api<{ id: number }>('POST', `products/${r.id}/duplicate`)
                        window.location.href = `/admin/products/${res.id}`
                      }, 'تم إنشاء نسخة (مسودة)', { refresh: false })}>
                        <Copy size={16} />
                      </button>
                      <a className="a-icon-btn" href={`/product/${encodeURIComponent(r.slug)}`} target="_blank" rel="noopener noreferrer" aria-label="عرض في المتجر"><ExternalLink size={16} /></a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="a-card a-empty">
          لا توجد منتجات. <Link href="/admin/products/new" style={{ textDecoration: 'underline' }}>أضف أول منتج</Link>
        </div>
      )}
      {bulk === 'price' && <BulkPrice onClose={() => setBulk(null)} onApply={(b) => doBulk(b, 'تم تعديل الأسعار')} />}
      {bulk === 'sale' && <BulkSale onClose={() => setBulk(null)} onApply={(b) => doBulk(b, 'تم تحديث التخفيض')} />}
      {bulk === 'category' && (
        <Modal title="نقل المنتجات المحددة لقسم" onClose={() => setBulk(null)}>
          <div className="a-form">
            {categories.map((c) => (
              <button key={c.id} type="button" className="a-btn a-btn--ghost" onClick={() => doBulk({ categoryId: c.id }, `تم النقل إلى ${c.name}`)}>{c.name}</button>
            ))}
            <button type="button" className="a-btn a-btn--ghost" onClick={() => doBulk({ categoryId: null }, 'تمت إزالة القسم')}>بدون قسم</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function BulkPrice({ onClose, onApply }: { onClose: () => void; onApply: (b: Record<string, unknown>) => void }) {
  const [mode, setMode] = useState<'percent' | 'add' | 'set'>('percent')
  const [value, setValue] = useState('')
  return (
    <Modal title="تعديل جماعي للأسعار" onClose={onClose}>
      <div className="a-form">
        <Field label="طريقة التعديل">
          <select className="a-select" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="percent">نسبة مئوية (+ زيادة / - تخفيض)</option>
            <option value="add">إضافة أو طرح مبلغ ثابت</option>
            <option value="set">تحديد سعر موحد</option>
          </select>
        </Field>
        <Field label={mode === 'percent' ? 'النسبة % (مثال: 10 أو -5)' : 'المبلغ'}>
          <input className="a-input" dir="ltr" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.-]/g, ''))} />
        </Field>
        <p className="small muted" style={{ margin: 0 }}>يشمل أسعار الخيارات المستقلة. يُلغى التخفيض تلقائياً إذا أصبح أكبر من السعر الجديد.</p>
        <button type="button" className="a-btn" disabled={value === '' || Number.isNaN(Number(value))} onClick={() => onApply({ priceMode: mode, priceValue: Number(value) })}>تطبيق</button>
      </div>
    </Modal>
  )
}

function BulkSale({ onClose, onApply }: { onClose: () => void; onApply: (b: Record<string, unknown>) => void }) {
  const [pct, setPct] = useState('')
  return (
    <Modal title="التخفيض الجماعي" onClose={onClose}>
      <div className="a-form">
        <Field label="نسبة التخفيض من السعر الأساسي %">
          <input className="a-input" dir="ltr" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <div className="a-row">
          <button type="button" className="a-btn" disabled={!pct || Number(pct) < 1 || Number(pct) > 95} onClick={() => onApply({ salePercent: Number(pct) })}>تطبيق التخفيض</button>
          <button type="button" className="a-btn a-btn--ghost" onClick={() => onApply({ clearSale: true })}>إزالة كل التخفيضات</button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>لجدولة العرض بتاريخ بداية ونهاية افتح المنتج وحدد فترة التخفيض.</p>
      </div>
    </Modal>
  )
}
