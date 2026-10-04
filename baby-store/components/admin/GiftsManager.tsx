'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api, useAction, useAdmin, PageHead, SortableList, Modal, Field, Switch, MoneyInput, NumInput, ImageUpload, confirmAction } from './ui'
import type { GiftSettings, PersonalizationSettings } from '@/lib/shared/types'

type W = { id: number; name: string; description: string; price: number; imageId: number | null; imageUrl: string | null; active: boolean }

export function GiftsManager({ gifts, personalization, wraps }: { gifts: GiftSettings; personalization: PersonalizationSettings; wraps: W[] }) {
  const { money } = useAdmin()
  const { run, busy } = useAction()
  const [g, setG] = useState(gifts)
  const [p, setP] = useState(personalization)
  const [items, setItems] = useState(wraps)
  const [edit, setEdit] = useState<W | null>(null)
  return (
    <>
      <PageHead title="الهدايا والتخصيص" subtitle="تحكم في خيارات الهدية في صفحة الطلب وخيارات التغليف" />
      <div className="a-grid a-grid--2">
        <div className="a-card a-form">
          <h2 style={{ margin: 0 }}>خيارات الهدية</h2>
          <Switch checked={g.giftOrderEnabled} onChange={(v) => setG({ ...g, giftOrderEnabled: v })} label="إظهار خيار «هذا الطلب هدية»" />
          <Switch checked={g.giftWrapEnabled} disabled={!g.giftOrderEnabled} onChange={(v) => setG({ ...g, giftWrapEnabled: v })} label="تغليف الهدايا برسوم" />
          <Switch checked={g.giftMessageEnabled} disabled={!g.giftOrderEnabled} onChange={(v) => setG({ ...g, giftMessageEnabled: v })} label="رسالة إهداء" />
          {g.giftMessageEnabled && (
            <Field label="أقصى عدد أحرف لرسالة الإهداء">
              <NumInput value={g.giftMessageMax} min={20} max={1000} onChange={(v) => setG({ ...g, giftMessageMax: v || 250 })} />
            </Field>
          )}
          <Switch checked={g.recipientEnabled} disabled={!g.giftOrderEnabled} onChange={(v) => setG({ ...g, recipientEnabled: v })} label="بيانات مستلم مختلف (الاسم والرقم والعنوان)" />
          <Switch checked={g.hidePricesEnabled} disabled={!g.giftOrderEnabled} onChange={(v) => setG({ ...g, hidePricesEnabled: v })} label="خيار إخفاء الأسعار من ورقة الهدية" />
          <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('PUT', 'settings/gifts', g), 'تم الحفظ')}>
            حفظ
          </button>
        </div>
        <div className="a-card a-form">
          <h2 style={{ margin: 0 }}>التخصيص (مثل اسم المولود)</h2>
          <Switch checked={p.enabled} onChange={(v) => setP({ ...p, enabled: v })} label="تفعيل التخصيص في المتجر" />
          <p className="small muted" style={{ margin: 0 }}>رسوم التخصيص وحد الأحرف والمدة الإضافية تُحدد لكل منتج من صفحة المنتج ← «التغليف والتخصيص».</p>
          <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('PUT', 'settings/personalization', p), 'تم الحفظ')}>
            حفظ
          </button>
        </div>
      </div>
      <div className="a-card" style={{ marginTop: '1rem' }}>
        <div className="a-row a-row--between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>أنواع التغليف</h2>
          <button type="button" className="a-btn a-btn--sm" onClick={() => setEdit({ id: 0, name: '', description: '', price: 0, imageId: null, imageUrl: null, active: true })}>
            <Plus size={15} /> تغليف جديد
          </button>
        </div>
        <SortableList
          items={items}
          getId={(w) => w.id}
          onReorder={(next) => {
            setItems(next)
            run(() => api('POST', 'gift-wraps/reorder', { ids: next.map((w) => w.id) }), 'تم حفظ الترتيب', { refresh: false })
          }}
          render={(w, handle) => (
            <div className="a-sortable-item">
              {handle}
              {w.imageUrl ? <img src={w.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ width: 44 }} />}
              <span className="a-grow">
                <b>{w.name}</b> <span className="num small">{money(w.price)}</span> {!w.active && <span className="a-badge a-badge--danger">معطل</span>}
                <div className="small muted">{w.description}</div>
              </span>
              <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(w)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف ${w.name}؟`) && run(() => api('DELETE', `gift-wraps/${w.id}`).then(() => setItems((x) => x.filter((y) => y.id !== w.id))), 'تم الحذف')}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
      </div>
      {edit && (
        <Modal title={edit.id ? 'تعديل التغليف' : 'تغليف جديد'} onClose={() => setEdit(null)}>
          <div className="a-form">
            <Field label="الاسم">
              <input className="a-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="الوصف">
              <input className="a-input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <Field label="الرسوم">
              <MoneyInput value={edit.price} onChange={(v) => setEdit({ ...edit, price: v || 0 })} />
            </Field>
            <Field label="صورة توضيحية">
              <ImageUpload value={edit.imageId} url={edit.imageUrl} purpose="wrap" onChange={(id, url) => setEdit({ ...edit, imageId: id, imageUrl: url })} />
            </Field>
            <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="مفعل" />
            <button
              type="button"
              className="a-btn"
              onClick={() =>
                run(async () => {
                  const body = { name: edit.name, description: edit.description, price: edit.price, imageId: edit.imageId, active: edit.active }
                  if (edit.id) await api('PUT', `gift-wraps/${edit.id}`, body)
                  else await api('POST', 'gift-wraps', body)
                  window.location.reload()
                }, 'تم الحفظ', { refresh: false })
              }
            >
              حفظ
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
