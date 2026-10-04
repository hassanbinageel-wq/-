'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { api, useAction, useAdmin, PageHead, SortableList, Modal, Field, Switch, MoneyInput, confirmAction } from './ui'
import type { CheckoutSettings, ShippingSettings } from '@/lib/shared/types'

type Z = { id: number; name: string; country: string; cities: string[]; fee: number; freeShippingEligible: boolean; etaText: string; active: boolean; isDemo: boolean }

export function ShippingManager({ checkout, shipping, zones }: { checkout: CheckoutSettings; shipping: ShippingSettings; zones: Z[] }) {
  const { money } = useAdmin()
  const { run, busy } = useAction()
  const [c, setC] = useState(checkout)
  const [s, setS] = useState(shipping)
  const [items, setItems] = useState(zones)
  const [edit, setEdit] = useState<(Z & { citiesText: string }) | null>(null)
  return (
    <>
      <PageHead title="التوصيل والاستلام" subtitle="مناطق التوصيل ورسومها، الشحن المجاني، والاستلام من المحل" />
      <div className="a-grid a-grid--side">
        <div className="a-card">
          <div className="a-row a-row--between" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>مناطق التوصيل</h2>
            <button type="button" className="a-btn a-btn--sm" onClick={() => setEdit({ id: 0, name: '', country: 'اليمن', cities: [], citiesText: '', fee: 0, freeShippingEligible: true, etaText: '', active: true, isDemo: false })}>
              <Plus size={15} /> منطقة
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>يختار العميل المدينة فتُحدد المنطقة ورسومها. المنطقة بدون مدن تشمل «باقي مدن الدولة».</p>
          <SortableList
            items={items}
            getId={(z) => z.id}
            onReorder={(next) => {
              setItems(next)
              run(() => api('POST', 'shipping-zones/reorder', { ids: next.map((z) => z.id) }), 'تم حفظ الترتيب', { refresh: false })
            }}
            render={(z, handle) => (
              <div className="a-sortable-item">
                {handle}
                <MapPin size={18} />
                <span className="a-grow">
                  <b>{z.name}</b> {!z.active && <span className="a-badge a-badge--danger">معطلة</span>} {z.isDemo && <span className="a-badge">تجريبية</span>}
                  <div className="small muted">
                    {z.country} — {z.cities.length ? z.cities.join('، ') : 'باقي المدن'} — {money(z.fee)} {z.etaText && `— ${z.etaText}`} {!z.freeShippingEligible && '— خارج الشحن المجاني'}
                  </div>
                </span>
                <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit({ ...z, citiesText: z.cities.join('\n') })}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف ${z.name}؟`) && run(() => api('DELETE', `shipping-zones/${z.id}`).then(() => setItems((x) => x.filter((y) => y.id !== z.id))), 'تم الحذف')}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
          {!items.length && <p className="a-empty">لا توجد مناطق — لن يتمكن العملاء من اختيار التوصيل</p>}
        </div>
        <div className="a-grid">
          <div className="a-card a-form">
            <h2 style={{ margin: 0 }}>طرق الاستلام</h2>
            <Switch checked={c.deliveryEnabled} onChange={(v) => setC({ ...c, deliveryEnabled: v })} label="التوصيل" />
            <Switch checked={c.pickupEnabled} onChange={(v) => setC({ ...c, pickupEnabled: v })} label="الاستلام من المحل" />
            {c.pickupEnabled && (
              <>
                <Field label="عنوان المحل للاستلام">
                  <input className="a-input" value={c.pickupAddress} onChange={(e) => setC({ ...c, pickupAddress: e.target.value })} />
                </Field>
                <Field label="ملاحظات الاستلام">
                  <textarea className="a-textarea" rows={2} value={c.pickupNotes} onChange={(e) => setC({ ...c, pickupNotes: e.target.value })} placeholder="مثل: أوقات الاستلام" />
                </Field>
              </>
            )}
            <button type="button" className="a-btn" disabled={busy || (!c.deliveryEnabled && !c.pickupEnabled)} onClick={() => run(() => api('PUT', 'settings/checkout', c), 'تم الحفظ')}>
              حفظ
            </button>
          </div>
          <div className="a-card a-form">
            <h2 style={{ margin: 0 }}>الشحن المجاني</h2>
            <Switch checked={s.freeShippingEnabled} onChange={(v) => setS({ ...s, freeShippingEnabled: v })} label="تفعيل الشحن المجاني" />
            {s.freeShippingEnabled && (
              <Field label="الحد الأدنى بعد الخصم" hint="يطبق فقط على المناطق المشمولة بالشحن المجاني">
                <MoneyInput value={s.freeShippingThreshold} onChange={(v) => setS({ ...s, freeShippingThreshold: v || 0 })} />
              </Field>
            )}
            <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('PUT', 'settings/shipping', s), 'تم الحفظ')}>
              حفظ
            </button>
          </div>
        </div>
      </div>
      {edit && (
        <Modal title={edit.id ? `تعديل ${edit.name}` : 'منطقة توصيل جديدة'} onClose={() => setEdit(null)}>
          <div className="a-form a-form--2">
            <Field label="اسم المنطقة">
              <input className="a-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="الدولة">
              <input className="a-input" value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} />
            </Field>
            <Field label="المدن (مدينة في كل سطر)" hint="اتركه فارغاً لتشمل المنطقة باقي مدن الدولة" className="a-span-2">
              <textarea className="a-textarea" rows={3} value={edit.citiesText} onChange={(e) => setEdit({ ...edit, citiesText: e.target.value })} />
            </Field>
            <Field label="رسوم التوصيل">
              <MoneyInput value={edit.fee} onChange={(v) => setEdit({ ...edit, fee: v || 0 })} />
            </Field>
            <Field label="مدة التوصيل التقريبية">
              <input className="a-input" value={edit.etaText} onChange={(e) => setEdit({ ...edit, etaText: e.target.value })} placeholder="مثل: 2 - 4 أيام عمل" />
            </Field>
            <Switch checked={edit.freeShippingEligible} onChange={(v) => setEdit({ ...edit, freeShippingEligible: v })} label="مشمولة بالشحن المجاني" />
            <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="مفعلة" />
          </div>
          <button
            type="button"
            className="a-btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              run(async () => {
                const body = { name: edit.name, country: edit.country, cities: edit.citiesText.split(/\n|،|,/).map((x) => x.trim()).filter(Boolean), fee: edit.fee, freeShippingEligible: edit.freeShippingEligible, etaText: edit.etaText, active: edit.active }
                if (edit.id) await api('PUT', `shipping-zones/${edit.id}`, body)
                else await api('POST', 'shipping-zones', body)
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
