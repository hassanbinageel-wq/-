'use client'

import { useState } from 'react'
import { api, useAction, PageHead, Field, Switch, NumInput, Tabs } from './ui'
import { formatMoney, convertMoney } from '@/lib/shared/money'
import type { AllSettings } from '@/lib/shared/types'

export function SettingsForm({ initial, tab: tab0, demo }: { initial: AllSettings; tab: string; demo: { products: number; zones: number; coupons: number; wraps: number } }) {
  const [tab, setTab] = useState(tab0)
  const [s, setS] = useState(initial)
  const { run, busy } = useAction()
  const store = s.store
  const setStore = (patch: Partial<AllSettings['store']>) => setS({ ...s, store: { ...store, ...patch } })
  const ch = s.checkout
  const setCh = (patch: Partial<AllSettings['checkout']>) => setS({ ...s, checkout: { ...ch, ...patch } })
  const save = (key: keyof AllSettings) => run(() => api('PUT', `settings/${key}`, s[key]), 'تم حفظ الإعدادات')
  const [confirmDemo, setConfirmDemo] = useState('')

  return (
    <>
      <PageHead title="الإعدادات" />
      <Tabs
        tabs={[
          { key: 'store', label: 'المتجر وواتساب' },
          { key: 'currency', label: 'العملات وسعر الصرف' },
          { key: 'orders', label: 'الطلبات والحجز' },
          { key: 'inventory', label: 'المخزون' },
          { key: 'maintenance', label: 'وضع الصيانة' },
          { key: 'demo', label: 'البيانات التجريبية' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'store' && (
        <div className="a-card">
          <div className="a-form a-form--2">
            <Field label="مفتاح الدولة لواتساب الطلبات" hint="بدون + (اليمن: 967)">
              <input className="a-input" dir="ltr" value={store.whatsappCountryCode} onChange={(e) => setStore({ whatsappCountryCode: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="رقم واتساب الطلبات والسندات" hint="بدون مفتاح الدولة وبدون صفر في البداية">
              <input className="a-input" dir="ltr" value={store.whatsappNumber} onChange={(e) => setStore({ whatsappNumber: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <p className="a-span-2 small" style={{ margin: 0 }}>
              الرقم الدولي: <b dir="ltr">+{store.whatsappCountryCode}{store.whatsappNumber.replace(/^0+/, '')}</b> — رابط المحادثة: <span dir="ltr">wa.me/{store.whatsappCountryCode}{store.whatsappNumber.replace(/^0+/, '')}</span>
            </p>
            <Field label="المنطقة الزمنية">
              <input className="a-input" dir="ltr" value={store.timezone} onChange={(e) => setStore({ timezone: e.target.value })} />
            </Field>
            <Field label="الدولة الافتراضية في نموذج الطلب">
              <input className="a-input" value={store.defaultCountry} onChange={(e) => setStore({ defaultCountry: e.target.value })} />
            </Field>
            <Field label="مفتاح هاتف العميل الافتراضي">
              <input className="a-input" dir="ltr" value={store.defaultPhoneCode} onChange={(e) => setStore({ defaultPhoneCode: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="بادئة رقم الطلب" hint="مثل GH ← GH-1001">
              <input className="a-input" dir="ltr" value={store.orderPrefix} onChange={(e) => setStore({ orderPrefix: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="بادئة رقم المنتج (SKU)">
              <input className="a-input" dir="ltr" value={store.skuPrefix} onChange={(e) => setStore({ skuPrefix: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="هاتف للتواصل (اختياري)">
              <input className="a-input" dir="ltr" value={store.phone} onChange={(e) => setStore({ phone: e.target.value })} />
            </Field>
            <Field label="البريد (اختياري)">
              <input className="a-input" dir="ltr" value={store.email} onChange={(e) => setStore({ email: e.target.value })} />
            </Field>
            <Field label="العنوان (اختياري)">
              <input className="a-input" value={store.address} onChange={(e) => setStore({ address: e.target.value })} />
            </Field>
            <Field label="أوقات العمل (اختياري)">
              <input className="a-input" value={store.workingHours} onChange={(e) => setStore({ workingHours: e.target.value })} />
            </Field>
            <Field label="رابط الموقع على الخريطة (اختياري)" className="a-span-2">
              <input className="a-input" dir="ltr" value={store.mapUrl} onChange={(e) => setStore({ mapUrl: e.target.value })} />
            </Field>
          </div>
          <button type="button" className="a-btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => save('store')}>
            حفظ
          </button>
          <p className="small muted">اسم المتجر وشعاره من صفحة «مظهر المتجر».</p>
        </div>
      )}
      {tab === 'currency' && (
        <div className="a-card stack">
          <div className="a-notice" style={{ marginBottom: 4 }}>
            تُدخل أسعار المنتجات والشحن والكوبونات بالعملة الأساسية. يستطيع العميل اختيار عرض الأسعار بعملة أخرى، وتُحوّل حسب سعر الصرف الذي تكتبه هنا.
            لا تظهر أي عملة للعميل قبل أن تكتب سعر صرفها وتفعّلها. عند تغيير سعر الصرف لا تتغير مبالغ الطلبات السابقة.
          </div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>العملة الأساسية</h3>
          <div className="a-form a-form--2">
            <Field label="اسم العملة للعميل" hint="مثل: ريال سعودي">
              <input className="a-input" value={store.currencyLabel} onChange={(e) => setStore({ currencyLabel: e.target.value })} />
            </Field>
            <Field label="رمز العملة (ISO)" hint="مثل SAR">
              <input className="a-input" dir="ltr" value={store.currency.code} onChange={(e) => setStore({ currency: { ...store.currency, code: e.target.value.toUpperCase() } })} />
            </Field>
            <Field label="رمز العملة المعروض" hint="مثل: ر.س">
              <input className="a-input" value={store.currency.symbol} onChange={(e) => setStore({ currency: { ...store.currency, symbol: e.target.value } })} />
            </Field>
            <Field label="الخانات العشرية">
              <select className="a-select" value={store.currency.decimals} onChange={(e) => setStore({ currency: { ...store.currency, decimals: Number(e.target.value) } })}>
                <option value={0}>بدون كسور (125)</option>
                <option value={2}>تسمح بالهللات (125.50)</option>
              </select>
            </Field>
            <Field label="شكل الأرقام">
              <select className="a-select" value={store.currency.numerals} onChange={(e) => setStore({ currency: { ...store.currency, numerals: e.target.value as 'latn' | 'arab' } })}>
                <option value="latn">1234567890</option>
                <option value="arab">١٢٣٤٥٦٧٨٩٠</option>
              </select>
            </Field>
          </div>
          <h3 style={{ margin: '8px 0 0', fontSize: '1rem' }}>عملات العرض للعميل</h3>
          {store.displayCurrencies.map((c, i) => {
            const setC = (patch: Partial<typeof c>) => setStore({ displayCurrencies: store.displayCurrencies.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
            const cfg = { ...c, numerals: store.currency.numerals }
            return (
              <div key={c.id} className="a-card" style={{ background: 'var(--a-soft, #fafafa)' }}>
                <div className="a-form a-form--2">
                  <Field label="اسم العملة كما يراه العميل">
                    <input className="a-input" value={c.label} onChange={(e) => setC({ label: e.target.value })} />
                  </Field>
                  <Field label={`سعر الصرف: كم ${c.label || 'وحدة'} مقابل 1 ${store.currencyLabel || store.currency.code}`} hint="اكتب السعر الذي تعتمده أنت، ويمكن أن يكون بكسور">
                    <input
                      className="a-input"
                      dir="ltr"
                      inputMode="decimal"
                      defaultValue={c.rate || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[,\s]/g, ''))
                        setC({ rate: Number.isFinite(n) && n > 0 ? n : 0 })
                      }}
                    />
                  </Field>
                  <Field label="رمز العملة المعروض">
                    <input className="a-input" value={c.symbol} onChange={(e) => setC({ symbol: e.target.value })} />
                  </Field>
                  <Field label="تقريب المبلغ المحول لأقرب" hint="1 = بدون تقريب، أو 10، 50، 100">
                    <NumInput value={c.roundTo} min={1} max={100000} onChange={(n) => setC({ roundTo: n || 1 })} />
                  </Field>
                  <Field label="الخانات العشرية">
                    <select className="a-select" value={c.decimals} onChange={(e) => setC({ decimals: Number(e.target.value) })}>
                      <option value={0}>بدون كسور</option>
                      <option value={2}>خانتان</option>
                    </select>
                  </Field>
                  <div>
                    <Switch checked={c.enabled} onChange={(v) => setC({ enabled: v })} label="متاحة للعميل" />
                    {c.enabled && !(c.rate > 0) && <p className="small" style={{ color: '#b42318', margin: '4px 0 0' }}>اكتب سعر الصرف أولاً</p>}
                  </div>
                  {c.rate > 0 && (
                    <p className="a-span-2 small muted" style={{ margin: 0 }}>
                      مثال: منتج بسعر {formatMoney(10000, store.currency)} يظهر للعميل {formatMoney(10000, cfg)}
                      {convertMoney(10000, cfg) <= 0 ? ' — تحقق من سعر الصرف' : ''}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <button type="button" className="a-btn" disabled={busy} onClick={() => save('store')}>
            حفظ العملات
          </button>
        </div>
      )}
      {tab === 'orders' && (
        <div className="a-card">
          <div className="a-form a-form--2">
            <Field label="مدة حجز المخزون بانتظار التحويل (بالساعات)" hint="تظهر للعميل كمهلة للتحويل. بعدها تتحرر الكميات تلقائياً">
              <NumInput value={Math.round(ch.reservationMinutes / 60)} min={1} max={336} onChange={(v) => setCh({ reservationMinutes: (v || 24) * 60 })} />
            </Field>
            <Field label="إلغاء تلقائي بعد انتهاء الحجز (بالساعات)" hint="0 = بدون إلغاء تلقائي (يقرر الموظف)">
              <NumInput value={ch.autoCancelAfterExpiryHours} max={720} onChange={(v) => setCh({ autoCancelAfterExpiryHours: v || 0 })} />
            </Field>
            <Field label="أقصى عدد طلبات معلقة لنفس الرقم" hint="للحد من الطلبات الوهمية (0 = بدون حد)">
              <NumInput value={ch.maxPendingPerPhone} max={50} onChange={(v) => setCh({ maxPendingPerPhone: v || 0 })} />
            </Field>
            <Field label="أقصى طلبات من نفس الجهاز خلال 10 دقائق" hint="0 = بدون حد">
              <NumInput value={ch.ordersPerIpPer10Min} max={100} onChange={(v) => setCh({ ordersPerIpPer10Min: v || 0 })} />
            </Field>
            <Field label="أقصى كمية للمنتج في الطلب">
              <NumInput value={ch.maxQtyPerLine} min={1} max={999} onChange={(v) => setCh({ maxQtyPerLine: v || 20 })} />
            </Field>
            <Field label="أقصى طول لملاحظات الطلب">
              <NumInput value={ch.notesMax} min={50} max={2000} onChange={(v) => setCh({ notesMax: v || 500 })} />
            </Field>
          </div>
          <button type="button" className="a-btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => save('checkout')}>
            حفظ
          </button>
          <p className="small muted">طرق الاستلام والتوصيل من صفحة «التوصيل والاستلام».</p>
        </div>
      )}
      {tab === 'inventory' && (
        <div className="a-card a-form">
          <Field label="حد التنبيه للمخزون المنخفض (افتراضي)">
            <NumInput value={s.inventory.lowStockThreshold} max={1000} onChange={(v) => setS({ ...s, inventory: { ...s.inventory, lowStockThreshold: v || 0 } })} />
          </Field>
          <Switch checked={s.inventory.showLowStockToCustomers} onChange={(v) => setS({ ...s, inventory: { ...s.inventory, showLowStockToCustomers: v } })} label="إظهار «متبقٍ X فقط» للعملاء عند انخفاض الكمية الفعلية" />
          <button type="button" className="a-btn" disabled={busy} onClick={() => save('inventory')}>
            حفظ
          </button>
        </div>
      )}
      {tab === 'maintenance' && (
        <div className="a-card a-form">
          <Switch checked={s.maintenance.enabled} onChange={(v) => setS({ ...s, maintenance: { ...s.maintenance, enabled: v } })} label="تفعيل وضع الصيانة (يرى الزوار رسالة الصيانة، وتبقى لوحة التحكم متاحة)" />
          <Field label="العنوان">
            <input className="a-input" value={s.maintenance.title} onChange={(e) => setS({ ...s, maintenance: { ...s.maintenance, title: e.target.value } })} />
          </Field>
          <Field label="الرسالة">
            <textarea className="a-textarea" value={s.maintenance.message} onChange={(e) => setS({ ...s, maintenance: { ...s.maintenance, message: e.target.value } })} />
          </Field>
          <button type="button" className="a-btn" disabled={busy} onClick={() => save('maintenance')}>
            حفظ
          </button>
        </div>
      )}
      {tab === 'demo' && (
        <div className="a-card a-form">
          <h2 style={{ margin: 0 }}>حذف البيانات التجريبية</h2>
          <p style={{ margin: 0 }}>
            المتبقي: <b>{demo.products}</b> منتج تجريبي، <b>{demo.zones}</b> منطقة توصيل تجريبية، <b>{demo.coupons}</b> كوبون تجريبي، <b>{demo.wraps}</b> خيار تغليف تجريبي.
          </p>
          <div className="a-notice a-notice--warn">لن تُحذف الطلبات (تبقى أسماء المنتجات محفوظة فيها). أضف مناطق توصيلك الحقيقية قبل الحذف حتى لا يتوقف التوصيل.</div>
          <Field label="اكتب «حذف» للتأكيد">
            <input className="a-input" value={confirmDemo} onChange={(e) => setConfirmDemo(e.target.value)} />
          </Field>
          <button type="button" className="a-btn a-btn--danger" disabled={busy || confirmDemo !== 'حذف'} onClick={() => run(() => api('POST', 'demo/delete', { confirm: 'حذف' }).then(() => setConfirmDemo('')), 'تم حذف البيانات التجريبية')}>
            حذف كل البيانات التجريبية
          </button>
        </div>
      )}
    </>
  )
}
