'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Plus, Trash2, Wand2, ExternalLink, Copy, Archive, X } from 'lucide-react'
import { api, useAdmin, useAction, Field, Switch, MoneyInput, NumInput, DateTimeInput, ImagesManager, ProductPicker, confirmAction, type PickedProduct } from './ui'
import type { ProductInput } from '@/lib/server/products'
import type { ProductOption } from '@/lib/shared/types'
import { formatDateTime } from '@/lib/shared/dates'

export type EditorRefs = {
  categories: { id: number; name: string }[]
  tagGroups: { id: number; name: string; tags: { id: number; name: string }[] }[]
  sizeGuides: { id: number; name: string }[]
  imageUrls: Record<number, string>
  products: Record<number, { name: string; sku: string; image: string | null; type: string; variants: { id: number; label: string; sku: string }[] }>
  movements: { id: number; sku: string; change: number; stock_after: number; reason: string; user_name: string | null; note: string | null; created_at: string; order_id: number | null }[]
  reasonLabels: Record<string, string>
}

type Variant = NonNullable<ProductInput['variants']>[number]
type Img = { mediaId: number; url: string; alt?: string | null; optionValue?: string | null; role?: 'rail' | 'back' | null }

const blank = (type: ProductInput['type']): ProductInput => ({
  type,
  name: '',
  sku: '',
  slug: '',
  shortDescription: '',
  description: '',
  categoryId: null,
  tagIds: [],
  status: 'draft',
  price: 0,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  trackStock: type !== 'bundle',
  stock: 0,
  manualAvailability: 'in_stock',
  lowStockThreshold: null,
  maxPerOrder: null,
  options: type === 'variable' ? [{ name: 'المقاس', kind: 'size', values: [] }] : [],
  variants: [],
  images: [],
  material: '',
  careInstructions: '',
  sizeGuideId: null,
  setContents: [],
  piecesCount: null,
  prepDaysMin: null,
  prepDaysMax: null,
  giftWrapEligible: true,
  personalization: null,
  relatedIds: [],
  complementaryIds: [],
  bundleItems: [],
  seoTitle: '',
  seoDescription: '',
})

function combos(options: ProductOption[]): (string | null)[][] {
  const lists = options.map((o) => o.values.map((v) => v.value))
  if (!lists.length || lists.some((l) => !l.length)) return []
  let out: (string | null)[][] = [[]]
  for (const l of lists) out = out.flatMap((c) => l.map((v) => [...c, v]))
  return out.map((c) => [c[0] ?? null, c[1] ?? null, c[2] ?? null])
}

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="a-card">
      <h2>{title}</h2>
      {hint && <p className="small muted" style={{ marginTop: -6 }}>{hint}</p>}
      {children}
    </section>
  )
}

export function ProductEditor({ initial, refs, isNew }: { initial: ProductInput | null; refs: EditorRefs; isNew: boolean; defaultType?: ProductInput['type'] }) {
  const router = useRouter()
  const { money, toast } = useAdmin()
  const { run, busy } = useAction()
  const [p, setP] = useState<ProductInput>(() => initial || blank('simple'))
  const [images, setImages] = useState<Img[]>(() => (initial?.images || []).map((i) => ({ ...i, url: refs.imageUrls[i.mediaId] || '' })))
  const [prodInfo, setProdInfo] = useState(refs.products)
  const [picker, setPicker] = useState<null | 'related' | 'complementary' | 'bundle'>(null)
  const [newValue, setNewValue] = useState<Record<number, string>>({})
  const [newColor, setNewColor] = useState<Record<number, string>>({})
  const [contentLine, setContentLine] = useState('')
  const [dirty, setDirty] = useState(false)

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => {
    setP((x) => ({ ...x, [k]: v }))
    setDirty(true)
  }
  const options = p.options || []
  const variants = p.variants || []
  const colorIdx = options.findIndex((o) => o.kind === 'color')
  const imgOptionValues = (colorIdx >= 0 ? options[colorIdx] : options[0])?.values.map((v) => v.value) || []

  const setOption = (i: number, patch: Partial<ProductOption>) => set('options', options.map((o, k) => (k === i ? { ...o, ...patch } : o)))
  const addValue = (i: number) => {
    const v = (newValue[i] || '').trim()
    if (!v) return
    if (options[i].values.some((x) => x.value === v)) return toast('القيمة موجودة', 'error')
    setOption(i, { values: [...options[i].values, { value: v, ...(options[i].kind === 'color' ? { color: newColor[i] || '#f4c6d0' } : {}) }] })
    setNewValue({ ...newValue, [i]: '' })
  }
  const generate = () => {
    const all = combos(options)
    if (!all.length) return toast('أضف قيماً لكل خيار أولاً', 'error')
    const key = (o: (string | null)[]) => o.slice(0, options.length).join('|')
    const existing = new Map(variants.map((v) => [key(v.options), v]))
    const next: Variant[] = all.map((c) => existing.get(key(c)) || { id: null, sku: '', options: c, price: null, salePrice: null, stock: 0, active: true })
    set('variants', next)
    toast(`تم إنشاء ${next.length} تركيبة. حدد المخزون لكل منها`)
  }
  const setVariant = (i: number, patch: Partial<Variant>) => set('variants', variants.map((v, k) => (k === i ? { ...v, ...patch } : v)))

  const totalStock = useMemo(() => variants.filter((v) => v.active).reduce((s, v) => s + (v.stock || 0), 0), [variants])

  const onPick = (pp: PickedProduct) => {
    setProdInfo((x) => ({ ...x, [pp.id]: { name: pp.name, sku: pp.sku, image: pp.image, type: pp.type, variants: pp.variants.map((v) => ({ id: v.id, label: v.label, sku: v.sku })) } }))
    if (picker === 'bundle') {
      if (pp.type === 'bundle') return toast('لا يمكن إضافة باقة داخل باقة', 'error')
      set('bundleItems', [...(p.bundleItems || []), { productId: pp.id, variantId: null, qty: 1 }])
    } else if (picker === 'related' && !(p.relatedIds || []).includes(pp.id)) set('relatedIds', [...(p.relatedIds || []), pp.id])
    else if (picker === 'complementary' && !(p.complementaryIds || []).includes(pp.id)) set('complementaryIds', [...(p.complementaryIds || []), pp.id])
    setPicker(null)
  }

  const save = (status?: ProductInput['status']) =>
    run(
      async () => {
        const body: ProductInput = {
          ...p,
          status: status || p.status,
          images: images.map((i) => ({ mediaId: i.mediaId, alt: i.alt || p.name, optionValue: i.optionValue || null, role: i.role || null })),
          setContents: (p.setContents || []).filter(Boolean),
          personalization: p.personalization?.enabled ? p.personalization : null,
        }
        if (!body.name.trim()) throw new Error('اكتب اسم المنتج')
        if (body.type === 'variable' && !variants.length) throw new Error('أضف الخيارات ثم اضغط «إنشاء التركيبات»')
        if (body.type === 'bundle' && !(body.bundleItems || []).length) throw new Error('أضف منتجات الباقة')
        const r = isNew ? await api<{ id: number }>('POST', 'products', body) : await api<{ id: number }>('PUT', `products/${p.id}`, body)
        setDirty(false)
        if (isNew) router.replace(`/admin/products/${r.id}`)
        else if (status) set('status', status)
      },
      'تم حفظ المنتج',
    )

  const pers = p.personalization || { enabled: false, label: 'اسم المولود', placeholder: '', maxLength: 15, fee: 0, extraDays: 0, required: false, help: '' }

  return (
    <>
      <div className="a-page-head">
        <div>
          <h1>{isNew ? (p.type === 'bundle' ? 'باقة جديدة' : 'منتج جديد') : p.name || 'تعديل المنتج'}</h1>
          <p>
            {!isNew && (
              <>
                رقم المنتج: <bdi>{p.sku}</bdi> ·{' '}
              </>
            )}
            {p.isDemo && <span className="a-badge">منتج تجريبي</span>}
          </p>
        </div>
        <div className="a-row">
          {!isNew && (
            <>
              <a className="a-btn a-btn--ghost" href={`/product/${encodeURIComponent(p.slug || '')}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} /> عرض
              </a>
              <button type="button" className="a-btn a-btn--ghost" disabled={busy} onClick={() => run(async () => {
                const r = await api<{ id: number }>('POST', `products/${p.id}/duplicate`)
                router.push(`/admin/products/${r.id}`)
              }, 'تم إنشاء نسخة برقم جديد (مسودة)', { refresh: false })}>
                <Copy size={16} /> نسخ
              </button>
            </>
          )}
          <Link className="a-btn a-btn--ghost" href="/admin/products">
            رجوع
          </Link>
        </div>
      </div>

      <div className="a-grid a-grid--side">
        <div className="a-grid">
          <Card title="المعلومات الأساسية">
            <div className="a-form">
              {isNew && (
                <div className="a-row" role="radiogroup" aria-label="نوع المنتج">
                  {(
                    [
                      ['simple', 'منتج بسيط'],
                      ['variable', 'منتج بخيارات (مقاسات/ألوان/أعمار)'],
                      ['bundle', 'باقة من عدة منتجات'],
                    ] as const
                  ).map(([t, l]) => (
                    <label key={t} className="a-check" style={{ border: '1px solid var(--a-border)', borderRadius: 10, padding: '0.5rem 0.7rem' }}>
                      <input type="radio" checked={p.type === t} onChange={() => setP({ ...blank(t), name: p.name, description: p.description, shortDescription: p.shortDescription, categoryId: p.categoryId })} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
              )}
              <Field label="اسم المنتج">
                <input className="a-input" value={p.name} onChange={(e) => set('name', e.target.value)} maxLength={150} />
              </Field>
              <div className="a-form a-form--2">
                <Field label="رقم المنتج (SKU)" hint={isNew ? 'اتركه فارغاً لإنشاء رقم فريد تلقائياً' : 'رقم ثابت يظهر في الطلبات'}>
                  <input className="a-input" dir="ltr" value={p.sku || ''} onChange={(e) => set('sku', e.target.value.toUpperCase())} placeholder="تلقائي" />
                </Field>
                <Field label="الرابط المختصر" hint="يُنشأ من الاسم تلقائياً">
                  <input className="a-input" value={p.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="تلقائي" />
                </Field>
                <Field label="القسم">
                  <select className="a-select" value={p.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">بدون قسم</option>
                    {refs.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="الحالة">
                  <select className="a-select" value={p.status} onChange={(e) => set('status', e.target.value as ProductInput['status'])}>
                    <option value="draft">مسودة (لا يظهر)</option>
                    <option value="published">منشور</option>
                    <option value="archived">مؤرشف</option>
                  </select>
                </Field>
              </div>
              <Field label="الوصف المختصر" hint="يظهر تحت اسم المنتج">
                <textarea className="a-textarea" rows={2} maxLength={500} value={p.shortDescription || ''} onChange={(e) => set('shortDescription', e.target.value)} />
              </Field>
              <Field label="الوصف التفصيلي" hint="يدعم: ## عنوان، - قائمة، **عريض**. لا تذكر خامات أو شهادات غير موثقة.">
                <textarea className="a-textarea" rows={6} value={p.description || ''} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="الصور" hint={imgOptionValues.length ? 'يمكن ربط كل صورة بلون ليظهرها المعرض عند اختياره' : undefined}>
            <ImagesManager images={images} onChange={(v) => { setImages(v); setDirty(true) }} optionValues={imgOptionValues} />
          </Card>

          <Card title="السعر والعروض">
            <div className="a-form a-form--2">
              <Field label={p.type === 'variable' ? 'السعر الأساسي (للخيارات بدون سعر خاص)' : 'السعر'}>
                <MoneyInput value={p.price} onChange={(v) => set('price', v || 0)} />
              </Field>
              <Field label="سعر التخفيض (اختياري)">
                <MoneyInput value={p.salePrice ?? null} allowEmpty onChange={(v) => set('salePrice', v)} placeholder="بدون تخفيض" />
              </Field>
              {p.salePrice != null && (
                <>
                  <Field label="بداية العرض (اختياري)">
                    <DateTimeInput value={p.saleStartsAt} onChange={(v) => set('saleStartsAt', v)} />
                  </Field>
                  <Field label="نهاية العرض (اختياري)">
                    <DateTimeInput value={p.saleEndsAt} onChange={(v) => set('saleEndsAt', v)} />
                  </Field>
                </>
              )}
            </div>
            {p.salePrice != null && p.salePrice >= p.price && <div className="a-notice a-notice--danger small" style={{ marginTop: 8 }}>سعر التخفيض يجب أن يكون أقل من السعر.</div>}
          </Card>

          {p.type === 'variable' && (
            <Card title="الخيارات (المقاسات، الألوان، الأعمار)" hint="حتى 3 خيارات. لكل تركيبة رقم ومخزون وسعر مستقل عند الحاجة.">
              <div className="a-form">
                {options.map((o, i) => (
                  <div key={i} className="a-card" style={{ background: '#fcfbfd' }}>
                    <div className="a-row">
                      <input className="a-input" style={{ maxWidth: 180 }} value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} placeholder="اسم الخيار" aria-label="اسم الخيار" />
                      <select className="a-select" style={{ width: 'auto' }} value={o.kind} onChange={(e) => setOption(i, { kind: e.target.value as ProductOption['kind'] })} aria-label="نوع الخيار">
                        <option value="size">مقاس / عمر (يظهر في فلتر المقاس)</option>
                        <option value="color">لون (يظهر في فلتر اللون)</option>
                        <option value="other">آخر</option>
                      </select>
                      <button type="button" className="a-icon-btn" aria-label="حذف الخيار" onClick={() => set('options', options.filter((_, k) => k !== i))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="a-row" style={{ marginTop: 8 }}>
                      {o.values.map((v) => (
                        <span key={v.value} className="a-badge" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>
                          {o.kind === 'color' && <i style={{ width: 14, height: 14, borderRadius: 99, background: v.color || '#ddd', display: 'inline-block', border: '1px solid #ccc' }} />}
                          {v.value}
                          <button type="button" aria-label={`حذف ${v.value}`} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setOption(i, { values: o.values.filter((x) => x.value !== v.value) })}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="a-row" style={{ marginTop: 8 }}>
                      <input
                        className="a-input"
                        style={{ maxWidth: 200 }}
                        value={newValue[i] || ''}
                        onChange={(e) => setNewValue({ ...newValue, [i]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addValue(i)
                          }
                        }}
                        placeholder={o.kind === 'color' ? 'مثل: وردي' : o.kind === 'size' ? 'مثل: 0-3 أشهر' : 'قيمة'}
                      />
                      {o.kind === 'color' && <input type="color" value={newColor[i] || '#f4c6d0'} onChange={(e) => setNewColor({ ...newColor, [i]: e.target.value })} aria-label="لون العينة" />}
                      <button type="button" className="a-btn a-btn--soft a-btn--sm" onClick={() => addValue(i)}>
                        إضافة
                      </button>
                    </div>
                  </div>
                ))}
                <div className="a-row">
                  {options.length < 3 && (
                    <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => set('options', [...options, { name: options.some((o) => o.kind === 'color') ? 'خيار' : 'اللون', kind: options.some((o) => o.kind === 'color') ? 'other' : 'color', values: [] }])}>
                      <Plus size={15} /> خيار آخر
                    </button>
                  )}
                  <button type="button" className="a-btn a-btn--sm" onClick={generate}>
                    <Wand2 size={15} /> إنشاء / تحديث التركيبات
                  </button>
                </div>
                {variants.length > 0 && (
                  <div className="a-table-wrap">
                    <table className="a-table">
                      <thead>
                        <tr>
                          <th>التركيبة</th>
                          <th>رقم الخيار</th>
                          <th>سعر خاص</th>
                          <th>سعر تخفيض</th>
                          {p.trackStock && <th>المخزون</th>}
                          <th>مفعل</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v, i) => (
                          <tr key={(v.id || 'n') + v.options.join('|')}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <b>{v.options.filter(Boolean).join(' / ')}</b>
                            </td>
                            <td style={{ minWidth: 120 }}>
                              <input className="a-input" dir="ltr" value={v.sku || ''} placeholder="تلقائي" onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} />
                            </td>
                            <td style={{ minWidth: 120 }}>
                              <MoneyInput value={v.price ?? null} allowEmpty placeholder={String(p.price / 100)} onChange={(x) => setVariant(i, { price: x })} />
                            </td>
                            <td style={{ minWidth: 120 }}>
                              <MoneyInput value={v.salePrice ?? null} allowEmpty onChange={(x) => setVariant(i, { salePrice: x })} />
                            </td>
                            {p.trackStock && (
                              <td style={{ minWidth: 90 }}>
                                <NumInput value={v.stock} onChange={(x) => setVariant(i, { stock: x || 0 })} />
                              </td>
                            )}
                            <td>
                              <input type="checkbox" checked={v.active} onChange={(e) => setVariant(i, { active: e.target.checked })} aria-label="مفعل" />
                            </td>
                            <td>
                              <button type="button" className="a-icon-btn" aria-label="حذف التركيبة" onClick={() => set('variants', variants.filter((_, k) => k !== i))}>
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {variants.length > 0 && p.trackStock && <p className="small muted" style={{ margin: 0 }}>إجمالي المخزون المتاح: <b className="num">{totalStock}</b>. السعر الخاص الفارغ = السعر الأساسي. سعر التخفيض للخيار يتبع فترة العرض المحددة أعلاه.</p>}
              </div>
            </Card>
          )}

          {p.type === 'bundle' && (
            <Card title="مكونات الباقة" hint="يرتبط توفر الباقة بمخزون مكوناتها، وتُخصم الكميات من المكونات فقط عند الطلب (لا يوجد مخزون مستقل للباقة).">
              <div className="a-form">
                {(p.bundleItems || []).map((b, i) => {
                  const info = prodInfo[b.productId]
                  return (
                    <div key={i} className="a-sortable-item" style={{ flexWrap: 'wrap' }}>
                      {info?.image && <img src={info.image} alt="" style={{ width: 38, height: 46, objectFit: 'cover', borderRadius: 6 }} />}
                      <span className="a-grow">
                        <b>{info?.name || `منتج #${b.productId}`}</b>
                        <div className="small muted">
                          <bdi>{info?.sku}</bdi>
                        </div>
                      </span>
                      {info?.type === 'variable' && (
                        <select
                          className="a-select"
                          style={{ width: 'auto' }}
                          value={b.variantId ?? ''}
                          onChange={(e) => set('bundleItems', (p.bundleItems || []).map((x, k) => (k === i ? { ...x, variantId: e.target.value ? Number(e.target.value) : null } : x)))}
                          aria-label="الخيار"
                        >
                          <option value="">يختار العميل المقاس/اللون</option>
                          {info.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              ثابت: {v.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="a-row small" style={{ gap: 4 }}>
                        الكمية
                        <input
                          className="a-input"
                          type="number"
                          min={1}
                          max={50}
                          style={{ width: 70 }}
                          value={b.qty}
                          onChange={(e) => set('bundleItems', (p.bundleItems || []).map((x, k) => (k === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))}
                        />
                      </label>
                      <button type="button" className="a-icon-btn" aria-label="إزالة" onClick={() => set('bundleItems', (p.bundleItems || []).filter((_, k) => k !== i))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" style={{ justifySelf: 'start' }} onClick={() => setPicker('bundle')}>
                  <Plus size={15} /> إضافة منتج للباقة
                </button>
              </div>
            </Card>
          )}

          <Card title="تفاصيل المنتج" hint="اترك أي حقل فارغاً إذا لم ينطبق — لن يظهر للعميل.">
            <div className="a-form a-form--2">
              <Field label="الخامة">
                <input className="a-input" value={p.material || ''} onChange={(e) => set('material', e.target.value)} />
              </Field>
              <Field label="دليل المقاسات">
                <select className="a-select" value={p.sizeGuideId ?? ''} onChange={(e) => set('sizeGuideId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">بدون</option>
                  {refs.sizeGuides.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="تعليمات العناية والغسيل" className="a-span-2">
                <textarea className="a-textarea" rows={2} value={p.careInstructions || ''} onChange={(e) => set('careInstructions', e.target.value)} />
              </Field>
              <Field label="عدد القطع">
                <NumInput value={p.piecesCount} allowEmpty min={1} onChange={(v) => set('piecesCount', v)} />
              </Field>
              <div className="a-form a-form--2" style={{ gap: 8 }}>
                <Field label="مدة التجهيز من (أيام)">
                  <NumInput value={p.prepDaysMin} allowEmpty onChange={(v) => set('prepDaysMin', v)} />
                </Field>
                <Field label="إلى (أيام)">
                  <NumInput value={p.prepDaysMax} allowEmpty onChange={(v) => set('prepDaysMax', v)} />
                </Field>
              </div>
              <Field label="محتويات الطقم" className="a-span-2" hint="أضف كل قطعة في سطر">
                <div className="a-form" style={{ gap: 6 }}>
                  {(p.setContents || []).map((c, i) => (
                    <div key={i} className="a-row" style={{ flexWrap: 'nowrap' }}>
                      <input className="a-input" value={c} onChange={(e) => set('setContents', (p.setContents || []).map((x, k) => (k === i ? e.target.value : x)))} />
                      <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => set('setContents', (p.setContents || []).filter((_, k) => k !== i))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <div className="a-row" style={{ flexWrap: 'nowrap' }}>
                    <input
                      className="a-input"
                      value={contentLine}
                      placeholder="مثل: قبعة"
                      onChange={(e) => setContentLine(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && contentLine.trim()) {
                          e.preventDefault()
                          set('setContents', [...(p.setContents || []), contentLine.trim()])
                          setContentLine('')
                        }
                      }}
                    />
                    <button type="button" className="a-btn a-btn--soft a-btn--sm" onClick={() => { if (contentLine.trim()) { set('setContents', [...(p.setContents || []), contentLine.trim()]); setContentLine('') } }}>
                      إضافة
                    </button>
                  </div>
                </div>
              </Field>
            </div>
          </Card>

          <Card title="التغليف والتخصيص">
            <div className="a-form">
              <Switch checked={p.giftWrapEligible !== false} onChange={(v) => set('giftWrapEligible', v)} label="يمكن تغليف هذا المنتج كهدية" />
              <Switch checked={pers.enabled} onChange={(v) => set('personalization', { ...pers, enabled: v })} label="يدعم التخصيص (مثل كتابة اسم المولود)" />
              {pers.enabled && (
                <div className="a-form a-form--3">
                  <Field label="عنوان الحقل">
                    <input className="a-input" value={pers.label} onChange={(e) => set('personalization', { ...pers, label: e.target.value })} />
                  </Field>
                  <Field label="أقصى عدد أحرف">
                    <NumInput value={pers.maxLength} min={1} max={60} onChange={(v) => set('personalization', { ...pers, maxLength: v || 15 })} />
                  </Field>
                  <Field label="رسوم التخصيص للقطعة">
                    <MoneyInput value={pers.fee} onChange={(v) => set('personalization', { ...pers, fee: v || 0 })} />
                  </Field>
                  <Field label="أيام تجهيز إضافية">
                    <NumInput value={pers.extraDays} max={60} onChange={(v) => set('personalization', { ...pers, extraDays: v || 0 })} />
                  </Field>
                  <Field label="نص توضيحي داخل الحقل">
                    <input className="a-input" value={pers.placeholder} onChange={(e) => set('personalization', { ...pers, placeholder: e.target.value })} />
                  </Field>
                  <Field label="ملاحظة للعميل">
                    <input className="a-input" value={pers.help} onChange={(e) => set('personalization', { ...pers, help: e.target.value })} />
                  </Field>
                  <Switch checked={pers.required} onChange={(v) => set('personalization', { ...pers, required: v })} label="إلزامي" />
                </div>
              )}
            </div>
          </Card>

          <Card title="منتجات مرتبطة ومكملة" hint="المكملة تُقترح في صفحة المنتج والسلة دون إضافتها تلقائياً.">
            {(['complementary', 'related'] as const).map((kind) => {
              const ids = (kind === 'related' ? p.relatedIds : p.complementaryIds) || []
              return (
                <div key={kind} style={{ marginBottom: 12 }}>
                  <b className="small">{kind === 'related' ? 'قد يعجبك أيضاً (مرتبطة)' : 'منتجات مكملة'}</b>
                  <div className="a-row" style={{ marginTop: 6 }}>
                    {ids.map((id) => (
                      <span key={id} className="a-badge" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>
                        {prodInfo[id]?.name || `#${id}`}
                        <button type="button" aria-label="إزالة" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => set(kind === 'related' ? 'relatedIds' : 'complementaryIds', ids.filter((x) => x !== id))}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPicker(kind)}>
                      <Plus size={14} /> إضافة
                    </button>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

        <div className="a-grid">
          <Card title="المخزون والتوفر">
            <div className="a-form">
              {p.type === 'bundle' ? (
                <Switch checked={p.manualAvailability !== 'out_of_stock'} onChange={(v) => set('manualAvailability', v ? 'in_stock' : 'out_of_stock')} label="الباقة متاحة للبيع (حسب مخزون المكونات)" />
              ) : (
                <>
                  <Switch checked={p.trackStock} onChange={(v) => set('trackStock', v)} label="تتبع المخزون" />
                  {!p.trackStock && (
                    <Field label="حالة التوفر" hint="بدون تتبع: يُباع دون خصم من المخزون">
                      <select className="a-select" value={p.manualAvailability} onChange={(e) => set('manualAvailability', e.target.value as 'in_stock' | 'out_of_stock')}>
                        <option value="in_stock">متوفر</option>
                        <option value="out_of_stock">غير متوفر</option>
                      </select>
                    </Field>
                  )}
                  {p.trackStock && p.type === 'simple' && (
                    <Field label="الكمية المتاحة" hint="الكميات المحجوزة لطلبات معلقة مخصومة مسبقاً من هذا الرقم">
                      <NumInput value={p.stock ?? 0} onChange={(v) => set('stock', v || 0)} />
                    </Field>
                  )}
                  {p.trackStock && (
                    <Field label="سبب تعديل المخزون (يظهر في السجل)">
                      <input className="a-input" value={p.stockNote || ''} onChange={(e) => set('stockNote', e.target.value)} placeholder="مثل: استلام شحنة جديدة" />
                    </Field>
                  )}
                  <Field label="حد التنبيه للمخزون المنخفض" hint="فارغ = الإعداد العام">
                    <NumInput value={p.lowStockThreshold} allowEmpty onChange={(v) => set('lowStockThreshold', v)} />
                  </Field>
                </>
              )}
              <Field label="أقصى كمية في الطلب الواحد" hint="فارغ = الإعداد العام">
                <NumInput value={p.maxPerOrder} allowEmpty min={1} onChange={(v) => set('maxPerOrder', v)} />
              </Field>
            </div>
          </Card>

          <Card title="التصنيفات (العمر والمناسبة)">
            {refs.tagGroups.map((g) => (
              <div key={g.id} style={{ marginBottom: 10 }}>
                <b className="small">{g.name}</b>
                <div className="a-form" style={{ gap: 4, marginTop: 4 }}>
                  {g.tags.map((t) => (
                    <label key={t.id} className="a-check">
                      <input
                        type="checkbox"
                        checked={(p.tagIds || []).includes(t.id)}
                        onChange={(e) => set('tagIds', e.target.checked ? [...(p.tagIds || []), t.id] : (p.tagIds || []).filter((x) => x !== t.id))}
                      />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Link className="small" href="/admin/tags" style={{ textDecoration: 'underline' }}>
              إدارة التصنيفات
            </Link>
          </Card>

          <Card title="محركات البحث (اختياري)">
            <div className="a-form">
              <Field label="عنوان الصفحة">
                <input className="a-input" value={p.seoTitle || ''} maxLength={120} onChange={(e) => set('seoTitle', e.target.value)} placeholder={p.name} />
              </Field>
              <Field label="الوصف">
                <textarea className="a-textarea" rows={3} maxLength={300} value={p.seoDescription || ''} onChange={(e) => set('seoDescription', e.target.value)} placeholder={p.shortDescription || ''} />
              </Field>
            </div>
          </Card>

          {!isNew && refs.movements.length > 0 && (
            <Card title="آخر حركات المخزون">
              <ul className="a-timeline">
                {refs.movements.map((m) => (
                  <li key={m.id}>
                    <b className="num" style={{ color: m.change > 0 ? 'var(--a-ok)' : 'var(--a-danger)' }}>
                      {m.change > 0 ? '+' : ''}
                      {m.change}
                    </b>{' '}
                    <bdi className="small">{m.sku}</bdi> — {refs.reasonLabels[m.reason] || m.reason}
                    {m.order_id && (
                      <Link className="small" href={`/admin/orders/${m.order_id}`}>
                        {' '}
                        (طلب)
                      </Link>
                    )}
                    <time>
                      الرصيد بعدها {m.stock_after} — {m.user_name || 'النظام'} — {formatDateTime(m.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
              <Link className="small" href={`/admin/inventory?product=${p.id}`} style={{ textDecoration: 'underline' }}>
                السجل الكامل
              </Link>
            </Card>
          )}
        </div>
      </div>

      <div className="a-sticky-save">
        {dirty && <span className="small muted">تغييرات غير محفوظة</span>}
        {!isNew && p.status !== 'archived' && (
          <button type="button" className="a-btn a-btn--ghost" disabled={busy} onClick={() => confirmAction('أرشفة المنتج؟ سيختفي من المتجر ويبقى في الطلبات السابقة.') && save('archived')}>
            <Archive size={16} /> أرشفة
          </button>
        )}
        {!isNew && (
          <button
            type="button"
            className="a-btn a-btn--ghost"
            disabled={busy}
            onClick={() =>
              confirmAction('حذف المنتج نهائياً؟ (يُمنع إذا كان له طلبات سابقة)') &&
              run(async () => {
                await api('DELETE', `products/${p.id}`)
                router.replace('/admin/products')
              }, 'تم حذف المنتج', { refresh: false })
            }
          >
            <Trash2 size={16} /> حذف
          </button>
        )}
        {p.status !== 'published' && (
          <button type="button" className="a-btn a-btn--ghost" disabled={busy} onClick={() => save()}>
            حفظ كمسودة
          </button>
        )}
        <button type="button" className="a-btn" disabled={busy} onClick={() => save(p.status === 'published' ? undefined : 'published')}>
          {p.status === 'published' ? 'حفظ التغييرات' : 'حفظ ونشر'}
        </button>
        {p.price > 0 && <span className="small muted num">{money(p.salePrice ?? p.price)}</span>}
      </div>

      {picker && <ProductPicker componentsOnly={picker === 'bundle'} title={picker === 'bundle' ? 'اختر منتجاً للباقة' : 'اختر منتجاً'} onClose={() => setPicker(null)} onPick={onPick} />}
    </>
  )
}
