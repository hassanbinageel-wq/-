'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, TicketPercent, X } from 'lucide-react'
import { api, useAction, useAdmin, PageHead, Modal, Field, Switch, MoneyInput, NumInput, DateTimeInput, ProductPicker, confirmAction } from './ui'
import { formatDateTime } from '@/lib/shared/dates'

type C = {
  id: number; code: string; description: string; type: 'percent' | 'fixed'; value: number; minOrder: number | null; maxDiscount: number | null; startsAt: string | null; endsAt: string | null
  usageLimit: number | null; perCustomerLimit: number | null; categoryIds: number[]; productIds: number[]; combineWithSale: boolean; active: boolean; isDemo: boolean; used: number
}

export function Coupons({ initial, categories }: { initial: C[]; categories: { id: number; name: string }[] }) {
  const { money } = useAdmin()
  const { run } = useAction()
  const [edit, setEdit] = useState<C | null>(null)
  const [picker, setPicker] = useState(false)
  const [names, setNames] = useState<Record<number, string>>({})
  const blank: C = { id: 0, code: '', description: '', type: 'percent', value: 1000, minOrder: null, maxDiscount: null, startsAt: null, endsAt: null, usageLimit: null, perCustomerLimit: 1, categoryIds: [], productIds: [], combineWithSale: false, active: true, isDemo: false, used: 0 }
  const valueText = (c: C) => (c.type === 'percent' ? `${c.value / 100}%` : money(c.value))
  return (
    <>
      <PageHead title="كوبونات الخصم" subtitle="تُتحقق الشروط في الخادم عند كل طلب. الطلبات الملغاة لا تُحتسب من حد الاستخدام.">
        <button type="button" className="a-btn" onClick={() => setEdit(blank)}>
          <Plus size={16} /> كوبون جديد
        </button>
      </PageHead>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>الرمز</th>
              <th>الخصم</th>
              <th>الشروط</th>
              <th>الاستخدام</th>
              <th>الصلاحية</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((c) => (
              <tr key={c.id}>
                <td>
                  <TicketPercent size={14} style={{ display: 'inline' }} /> <bdi><b>{c.code}</b></bdi> {!c.active && <span className="a-badge a-badge--danger">معطل</span>} {c.isDemo && <span className="a-badge">تجريبي</span>}
                  <div className="small muted">{c.description}</div>
                </td>
                <td>{valueText(c)}</td>
                <td className="small">
                  {c.minOrder ? <div>حد أدنى {money(c.minOrder)}</div> : null}
                  {c.maxDiscount ? <div>أقصى خصم {money(c.maxDiscount)}</div> : null}
                  {!c.combineWithSale && <div>لا يجمع مع العروض</div>}
                  {(c.categoryIds.length > 0 || c.productIds.length > 0) && <div>أقسام/منتجات محددة</div>}
                </td>
                <td className="num">
                  {c.used}
                  {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                </td>
                <td className="small">
                  {c.startsAt ? `من ${formatDateTime(c.startsAt)}` : ''}
                  {c.endsAt ? <div>حتى {formatDateTime(c.endsAt)}</div> : !c.startsAt ? 'مفتوح' : ''}
                </td>
                <td>
                  <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(c)}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف ${c.code}؟`) && run(() => api('DELETE', `coupons/${c.id}`), 'تم الحذف')}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!initial.length && <p className="a-empty">لا توجد كوبونات</p>}
      </div>
      {edit && (
        <Modal title={edit.id ? `تعديل ${edit.code}` : 'كوبون جديد'} onClose={() => setEdit(null)} large>
          <div className="a-form a-form--2">
            <Field label="الرمز" hint="حروف إنجليزية وأرقام">
              <input className="a-input" dir="ltr" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} />
            </Field>
            <Field label="وصف يظهر للعميل عند التطبيق">
              <input className="a-input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <Field label="نوع الخصم">
              <select className="a-select" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as C['type'], value: e.target.value === 'percent' ? 1000 : 100000 })}>
                <option value="percent">نسبة مئوية</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </Field>
            <Field label={edit.type === 'percent' ? 'النسبة %' : 'المبلغ'}>
              {edit.type === 'percent' ? (
                <NumInput value={edit.value / 100} min={1} max={100} onChange={(v) => setEdit({ ...edit, value: (v || 1) * 100 })} />
              ) : (
                <MoneyInput value={edit.value} onChange={(v) => setEdit({ ...edit, value: v || 0 })} />
              )}
            </Field>
            <Field label="الحد الأدنى للطلب (اختياري)">
              <MoneyInput value={edit.minOrder} allowEmpty onChange={(v) => setEdit({ ...edit, minOrder: v })} />
            </Field>
            <Field label="الحد الأقصى للخصم (اختياري)">
              <MoneyInput value={edit.maxDiscount} allowEmpty onChange={(v) => setEdit({ ...edit, maxDiscount: v })} />
            </Field>
            <Field label="يبدأ في (اختياري)">
              <DateTimeInput value={edit.startsAt} onChange={(v) => setEdit({ ...edit, startsAt: v })} />
            </Field>
            <Field label="ينتهي في (اختياري)">
              <DateTimeInput value={edit.endsAt} onChange={(v) => setEdit({ ...edit, endsAt: v })} />
            </Field>
            <Field label="حد الاستخدام الكلي (اختياري)">
              <NumInput value={edit.usageLimit} allowEmpty min={1} onChange={(v) => setEdit({ ...edit, usageLimit: v })} />
            </Field>
            <Field label="حد الاستخدام لكل عميل (حسب رقم الهاتف)">
              <NumInput value={edit.perCustomerLimit} allowEmpty min={1} onChange={(v) => setEdit({ ...edit, perCustomerLimit: v })} />
            </Field>
            <Field label="الأقسام المشمولة (فارغ = الكل)" className="a-span-2">
              <div className="a-row">
                {categories.map((c) => (
                  <label key={c.id} className="a-check">
                    <input type="checkbox" checked={edit.categoryIds.includes(c.id)} onChange={(e) => setEdit({ ...edit, categoryIds: e.target.checked ? [...edit.categoryIds, c.id] : edit.categoryIds.filter((x) => x !== c.id) })} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="منتجات محددة (اختياري)" className="a-span-2">
              <div className="a-row">
                {edit.productIds.map((id) => (
                  <span key={id} className="a-badge">
                    {names[id] || `#${id}`}
                    <button type="button" aria-label="إزالة" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setEdit({ ...edit, productIds: edit.productIds.filter((x) => x !== id) })}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPicker(true)}>
                  + منتج
                </button>
              </div>
            </Field>
            <Switch checked={edit.combineWithSale} onChange={(v) => setEdit({ ...edit, combineWithSale: v })} label="يجمع مع العروض (يطبق على المنتجات المخفضة والباقات)" />
            <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="مفعل" />
          </div>
          <button
            type="button"
            className="a-btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              run(async () => {
                const { id, used, isDemo, ...body } = edit
                void used
                void isDemo
                if (id) await api('PUT', `coupons/${id}`, body)
                else await api('POST', 'coupons', body)
                setEdit(null)
              }, 'تم الحفظ')
            }
          >
            حفظ
          </button>
        </Modal>
      )}
      {picker && edit && (
        <ProductPicker
          onClose={() => setPicker(false)}
          onPick={(p) => {
            setNames({ ...names, [p.id]: p.name })
            if (!edit.productIds.includes(p.id)) setEdit({ ...edit, productIds: [...edit.productIds, p.id] })
            setPicker(false)
          }}
        />
      )}
    </>
  )
}
