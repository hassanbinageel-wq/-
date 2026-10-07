'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'
import { api, useAction, PageHead, SortableList, Modal, Field, Switch, ImageUpload, confirmAction } from './ui'
import { TRANSFER_TYPE_LABELS } from '@/lib/shared/constants'

type M = { id: number; name: string; type: 'bank' | 'wallet' | 'exchange' | 'other'; beneficiary: string; accountNumber: string; extraInfo: string; currency: string; instructions: string; qrMediaId: number | null; qrUrl: string | null; logoMediaId: number | null; logoUrl: string | null; active: boolean }

export function TransferMethods({ initial }: { initial: M[] }) {
  const [items, setItems] = useState(initial)
  const [edit, setEdit] = useState<M | null>(null)
  const { run } = useAction()
  const blank: M = { id: 0, name: '', type: 'bank', beneficiary: '', accountNumber: '', extraInfo: '', currency: '', instructions: '', qrMediaId: null, qrUrl: null, logoMediaId: null, logoUrl: null, active: true }
  return (
    <>
      <PageHead title="وسائل التحويل" subtitle="البنوك والمحافظ وجهات التحويل التي تظهر للعميل بعد إنشاء الطلب">
        <button type="button" className="a-btn" onClick={() => setEdit(blank)}>
          <Plus size={16} /> وسيلة جديدة
        </button>
      </PageHead>
      <div className="a-notice a-notice--warn" style={{ marginBottom: 12 }}>
        أدخل بيانات حساباتك الحقيقية بدقة. رقم واتساب الطلبات ليس رقم محفظة؛ إن لم تضف أي وسيلة سيُطلب من العميل التواصل معك للحصول على بيانات التحويل.
      </div>
      <div className="a-card">
        <SortableList
          items={items}
          getId={(m) => m.id}
          onReorder={(next) => {
            setItems(next)
            run(() => api('POST', 'transfer-methods/reorder', { ids: next.map((x) => x.id) }), 'تم حفظ الترتيب', { refresh: false })
          }}
          render={(m, handle) => (
            <div className="a-sortable-item">
              {handle}
              {m.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.logoUrl} alt="" width={36} height={36} style={{ objectFit: 'contain', borderRadius: 8, background: '#fff', border: '1px solid var(--a-border, #e5e5e5)' }} />
              ) : (
                <Landmark size={20} />
              )}
              <span className="a-grow">
                <b>{m.name}</b> <span className="a-badge">{TRANSFER_TYPE_LABELS[m.type]}</span> {!m.active && <span className="a-badge a-badge--danger">معطلة</span>}
                <div className="small muted">
                  {m.beneficiary} — <bdi>{m.accountNumber}</bdi> {m.currency && `— ${m.currency}`}
                </div>
              </span>
              <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(m)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف «${m.name}»؟`) && run(() => api('DELETE', `transfer-methods/${m.id}`).then(() => setItems((x) => x.filter((y) => y.id !== m.id))), 'تم الحذف')}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
        {!items.length && <p className="a-empty">لم تُضف وسائل تحويل بعد</p>}
      </div>
      {edit && (
        <Modal title={edit.id ? `تعديل ${edit.name}` : 'وسيلة تحويل جديدة'} onClose={() => setEdit(null)}>
          <div className="a-form a-form--2">
            <Field label="اسم البنك أو المحفظة أو جهة التحويل">
              <input className="a-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="النوع">
              <select className="a-select" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as M['type'] })}>
                {Object.entries(TRANSFER_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="اسم المستفيد">
              <input className="a-input" value={edit.beneficiary} onChange={(e) => setEdit({ ...edit, beneficiary: e.target.value })} />
            </Field>
            <Field label="رقم الحساب أو المحفظة">
              <input className="a-input" dir="ltr" value={edit.accountNumber} onChange={(e) => setEdit({ ...edit, accountNumber: e.target.value })} />
            </Field>
            <Field label="العملة المقبولة">
              <input className="a-input" value={edit.currency} onChange={(e) => setEdit({ ...edit, currency: e.target.value })} placeholder="مثل: ريال يمني" />
            </Field>
            <Field label="معلومات إضافية (اختياري)" hint="مثل رقم الآيبان أو الفرع">
              <input className="a-input" value={edit.extraInfo} onChange={(e) => setEdit({ ...edit, extraInfo: e.target.value })} />
            </Field>
            <Field label="تعليمات التحويل" className="a-span-2">
              <textarea className="a-textarea" rows={3} value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })} placeholder="مثل: اكتب رقم الطلب في خانة الملاحظات" />
            </Field>
            <Field label="شعار البنك أو المحفظة (اختياري)" hint="يفضل صورة مربعة بخلفية شفافة أو بيضاء (PNG)">
              <ImageUpload value={edit.logoMediaId} url={edit.logoUrl} purpose="transfer-logo" label="رفع الشعار" onChange={(id, url) => setEdit({ ...edit, logoMediaId: id, logoUrl: url })} />
            </Field>
            <Field label="رمز QR (اختياري)">
              <ImageUpload value={edit.qrMediaId} url={edit.qrUrl} purpose="qr" label="رفع رمز QR" onChange={(id, url) => setEdit({ ...edit, qrMediaId: id, qrUrl: url })} />
            </Field>
            <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="مفعلة وتظهر للعملاء" />
          </div>
          <button
            type="button"
            className="a-btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              run(async () => {
                const body = { name: edit.name, type: edit.type, beneficiary: edit.beneficiary, accountNumber: edit.accountNumber, extraInfo: edit.extraInfo, currency: edit.currency, instructions: edit.instructions, qrMediaId: edit.qrMediaId, logoMediaId: edit.logoMediaId, active: edit.active }
                if (edit.id) await api('PUT', `transfer-methods/${edit.id}`, body)
                else await api('POST', 'transfer-methods', body)
                window.location.reload()
              }, 'تم الحفظ', { refresh: false })
            }
          >
            حفظ
          </button>
        </Modal>
      )}
    </>
  )
}
