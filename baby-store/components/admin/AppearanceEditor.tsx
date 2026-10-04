'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Upload, RotateCcw, History, Plus, Trash2, Monitor, Smartphone, ChevronDown, ChevronUp, X } from 'lucide-react'
import { api, useAction, useAdmin, Field, Switch, NumInput, DateTimeInput, ImageUpload, SortableList, Modal, Tabs, ProductPicker, confirmAction } from './ui'
import { THEME_PRESETS, COLOR_LABELS, FONTS, LABEL_NAMES, DEFAULT_LABELS, contrastRatio, newSection } from '@/lib/shared/theme'
import { HOME_SECTION_TYPES, type HomeSectionType } from '@/lib/shared/constants'
import { formatDateTime } from '@/lib/shared/dates'
import type { Appearance, Banner, HomeSection, LinkItem, ThemeColors } from '@/lib/shared/types'

type Props = {
  initial: Appearance
  hasDraft: boolean
  updatedAt: string | null
  versions: { id: number; status: string; note: string | null; created_by_name: string | null; created_at: string; published_at: string | null }[]
  urls: Record<number, string>
  products: Record<number, string>
  tagGroups: { id: number; name: string }[]
  fontFile: string | null
}

const uid = () => Math.random().toString(36).slice(2, 10)

function LinksEditor({ items, onChange, max = 12 }: { items: LinkItem[]; onChange: (v: LinkItem[]) => void; max?: number }) {
  return (
    <div className="a-form" style={{ gap: 6 }}>
      <SortableList
        items={items.map((x, i) => ({ ...x, _k: `${i}-${x.href}` }))}
        getId={(x) => x._k}
        onReorder={(next) => onChange(next.map(({ _k, ...rest }) => { void _k; return rest }))}
        render={(it, handle, i) => (
          <div className="a-sortable-item" style={{ marginTop: 4 }}>
            {handle}
            <input className="a-input" value={it.label} placeholder="النص" onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
            <input className="a-input" dir="ltr" value={it.href} placeholder="/products" onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, href: e.target.value } : x)))} />
            <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => onChange(items.filter((_, k) => k !== i))}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      />
      {items.length < max && (
        <button type="button" className="a-btn a-btn--ghost a-btn--sm" style={{ justifySelf: 'start' }} onClick={() => onChange([...items, { label: '', href: '/' }])}>
          <Plus size={14} /> رابط
        </button>
      )}
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="a-color">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label} />
        <input className="a-input" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 110 }} />
      </div>
    </Field>
  )
}

function BannerEditor({ b, onChange, urls, setUrl, onRemove }: { b: Banner; onChange: (b: Banner) => void; urls: Record<number, string>; setUrl: (id: number, url: string) => void; onRemove?: () => void }) {
  return (
    <div className="a-card" style={{ background: '#fcfbfd' }}>
      <div className="a-row a-row--between">
        <Switch checked={b.enabled} onChange={(v) => onChange({ ...b, enabled: v })} label="ظاهر" />
        {onRemove && (
          <button type="button" className="a-icon-btn" aria-label="حذف البانر" onClick={onRemove}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="a-form a-form--2" style={{ marginTop: 8 }}>
        <Field label="العنوان">
          <input className="a-input" value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} />
        </Field>
        <Field label="النص">
          <input className="a-input" value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />
        </Field>
        <Field label="نص الزر">
          <input className="a-input" value={b.buttonText} onChange={(e) => onChange({ ...b, buttonText: e.target.value })} />
        </Field>
        <Field label="رابط الزر">
          <input className="a-input" dir="ltr" value={b.link} onChange={(e) => onChange({ ...b, link: e.target.value })} placeholder="/products" />
        </Field>
        <Field label="صورة الكمبيوتر" hint="عرضية، يفضل 2000×800">
          <ImageUpload value={b.imageDesktopId} url={b.imageDesktopId ? urls[b.imageDesktopId] : null} purpose="banner" onChange={(id, url) => { if (id && url) setUrl(id, url); onChange({ ...b, imageDesktopId: id }) }} />
        </Field>
        <Field label="صورة الجوال" hint="طولية، يفضل 900×1100">
          <ImageUpload value={b.imageMobileId} url={b.imageMobileId ? urls[b.imageMobileId] : null} purpose="banner" onChange={(id, url) => { if (id && url) setUrl(id, url); onChange({ ...b, imageMobileId: id }) }} />
        </Field>
        <Field label="موضع النص">
          <select className="a-select" value={b.align} onChange={(e) => onChange({ ...b, align: e.target.value as Banner['align'] })}>
            <option value="start">يمين</option>
            <option value="center">وسط</option>
            <option value="end">يسار</option>
          </select>
        </Field>
        <Field label="خلفية النص">
          <select className="a-select" value={b.tone} onChange={(e) => onChange({ ...b, tone: e.target.value as Banner['tone'] })}>
            <option value="dark">فاتحة (نص داكن)</option>
            <option value="light">داكنة (نص أبيض)</option>
          </select>
        </Field>
        <Field label="يظهر من (جدولة)">
          <DateTimeInput value={b.startsAt} onChange={(v) => onChange({ ...b, startsAt: v })} />
        </Field>
        <Field label="حتى">
          <DateTimeInput value={b.endsAt} onChange={(v) => onChange({ ...b, endsAt: v })} />
        </Field>
      </div>
    </div>
  )
}

const blankBanner = (): Banner => ({ id: uid(), enabled: true, title: '', text: '', buttonText: '', link: '/products', imageDesktopId: null, imageMobileId: null, align: 'start', tone: 'dark', startsAt: null, endsAt: null })

export function AppearanceEditor(p: Props) {
  const router = useRouter()
  const { toast } = useAdmin()
  const { run, busy } = useAction()
  const [a, setA] = useState<Appearance>(p.initial)
  const [tab, setTab] = useState('brand')
  const [dirty, setDirty] = useState(false)
  const [urls, setUrls] = useState(p.urls)
  const [products, setProducts] = useState(p.products)
  const [preview, setPreview] = useState<null | 'mobile' | 'desktop'>(null)
  const [frameKey, setFrameKey] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [versions, setVersions] = useState(false)
  const [picker, setPicker] = useState<string | null>(null)
  const [addType, setAddType] = useState<HomeSectionType>('new')

  const up = (fn: (x: Appearance) => Appearance) => {
    setA((x) => fn(structuredClone(x)))
    setDirty(true)
  }
  const setUrl = (id: number, url: string) => setUrls((u) => ({ ...u, [id]: url }))
  const c = a.theme.colors
  const setColor = (k: keyof ThemeColors, v: string) => up((x) => ({ ...x, theme: { ...x.theme, preset: 'custom', colors: { ...x.theme.colors, [k]: v } } }))
  const setSection = (id: string, patch: Partial<HomeSection>) => up((x) => ({ ...x, home: { sections: x.home.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) } }))

  const saveDraft = async () => {
    await api('PUT', 'appearance', a)
    setDirty(false)
    setFrameKey((k) => k + 1)
  }

  const contrasts: [string, string, string][] = [
    ['النص على الخلفية', c.text, c.bg],
    ['النص الثانوي على الخلفية', c.muted, c.bg],
    ['نص الأزرار على لونها', c.onPrimary, c.primary],
    ['سعر التخفيض على البطاقة', c.sale, c.surface],
  ]
  const weak = contrasts.filter(([, f, b]) => contrastRatio(f, b) < 4.5)

  return (
    <>
      <div className="a-page-head">
        <div>
          <h1>مظهر المتجر</h1>
          <p>
            {dirty ? (
              <span className="a-badge a-badge--warn">تعديلات غير محفوظة</span>
            ) : p.hasDraft ? (
              <span className="a-badge a-badge--info">مسودة محفوظة غير منشورة {p.updatedAt && `— ${formatDateTime(p.updatedAt)}`}</span>
            ) : (
              <span className="a-badge a-badge--ok">مطابق للنسخة المنشورة</span>
            )}
          </p>
        </div>
        <div className="a-row">
          <button type="button" className="a-btn a-btn--ghost" onClick={() => setVersions(true)}>
            <History size={16} /> النسخ السابقة
          </button>
          {(p.hasDraft || dirty) && (
            <button
              type="button"
              className="a-btn a-btn--ghost"
              disabled={busy}
              onClick={() => confirmAction('تجاهل المسودة والعودة لآخر نسخة منشورة؟') && run(async () => { await api('POST', 'appearance/discard'); window.location.reload() }, 'تمت العودة للنسخة المنشورة', { refresh: false })}
            >
              <RotateCcw size={16} /> العودة للنسخة المنشورة
            </button>
          )}
          <button type="button" className="a-btn a-btn--ghost" disabled={busy} onClick={() => run(saveDraft, 'تم حفظ المسودة')}>
            حفظ كمسودة
          </button>
          <button type="button" className="a-btn a-btn--soft" disabled={busy} onClick={() => run(async () => { await saveDraft(); setPreview(preview || 'mobile') }, undefined, { refresh: false })}>
            <Eye size={16} /> معاينة
          </button>
          <button
            type="button"
            className="a-btn"
            disabled={busy}
            onClick={() => run(async () => { await api('PUT', 'appearance', a); await api('POST', 'appearance/publish', {}); setDirty(false); router.refresh() }, 'تم نشر المظهر للزوار')}
          >
            <Upload size={16} /> نشر
          </button>
        </div>
      </div>

      {preview && (
        <div className="a-card" style={{ marginBottom: '1rem' }}>
          <div className="a-row a-row--between" style={{ marginBottom: 8 }}>
            <div className="a-row">
              <button type="button" className={`a-btn a-btn--sm ${preview === 'mobile' ? '' : 'a-btn--ghost'}`} onClick={() => setPreview('mobile')}>
                <Smartphone size={15} /> جوال
              </button>
              <button type="button" className={`a-btn a-btn--sm ${preview === 'desktop' ? '' : 'a-btn--ghost'}`} onClick={() => setPreview('desktop')}>
                <Monitor size={15} /> كمبيوتر
              </button>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => run(saveDraft, 'تم تحديث المعاينة', { refresh: false })}>
                تحديث المعاينة
              </button>
            </div>
            <button type="button" className="a-icon-btn" aria-label="إغلاق المعاينة" onClick={() => setPreview(null)}>
              <X size={18} />
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>المعاينة تعرض المسودة المحفوظة لك فقط؛ الزوار يرون النسخة المنشورة حتى تضغط «نشر».</p>
          <div style={{ overflow: 'hidden', height: preview === 'mobile' ? 760 : 640 }}>
            {preview === 'mobile' ? (
              <iframe key={frameKey} title="معاينة الجوال" src="/api/admin/preview?to=/" className="a-preview-frame" style={{ width: 390, height: 740, display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: 640, position: 'relative' }}>
                <iframe
                  key={frameKey}
                  title="معاينة الكمبيوتر"
                  src="/api/admin/preview?to=/"
                  className="a-preview-frame"
                  style={{ width: 1280, height: 1000, transform: 'scale(0.62)', transformOrigin: 'top right', position: 'absolute', top: 0, insetInlineStart: 0 }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'brand', label: 'الهوية' },
          { key: 'theme', label: 'الألوان والخطوط' },
          { key: 'home', label: 'الرئيسية والبنرات' },
          { key: 'announce', label: 'شريط الإعلانات' },
          { key: 'cards', label: 'عرض المنتجات' },
          { key: 'labels', label: 'النصوص والأزرار' },
          { key: 'nav', label: 'القائمة والتذييل' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'brand' && (
        <div className="a-card a-form a-form--2">
          <Field label="اسم المتجر">
            <input className="a-input" value={a.brand.name} onChange={(e) => up((x) => ({ ...x, brand: { ...x.brand, name: e.target.value } }))} />
          </Field>
          <Field label="الشعار النصي (يظهر تحت الاسم وفي العنوان)">
            <input className="a-input" value={a.brand.tagline} onChange={(e) => up((x) => ({ ...x, brand: { ...x.brand, tagline: e.target.value } }))} />
          </Field>
          <Field label="الشعار (صورة)" hint="PNG بخلفية شفافة. بدونه يظهر شعار الغيمة مع الاسم">
            <ImageUpload value={a.brand.logoId} url={a.brand.logoId ? urls[a.brand.logoId] : null} purpose="logo" onChange={(id, url) => { if (id && url) setUrl(id, url); up((x) => ({ ...x, brand: { ...x.brand, logoId: id } })) }} />
          </Field>
          <Field label="أيقونة المتصفح" hint="صورة مربعة (512×512)">
            <ImageUpload kind="favicon" value={a.brand.faviconId} url={a.brand.faviconId ? urls[a.brand.faviconId] : null} purpose="favicon" onChange={(id, url) => { if (id && url) setUrl(id, url); up((x) => ({ ...x, brand: { ...x.brand, faviconId: id } })) }} />
          </Field>
        </div>
      )}

      {tab === 'theme' && (
        <div className="a-grid">
          <div className="a-card">
            <h2>قوالب ألوان للمواليد</h2>
            <div className="a-row">
              {THEME_PRESETS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="a-btn a-btn--ghost"
                  aria-pressed={a.theme.preset === t.key}
                  style={a.theme.preset === t.key ? { borderColor: 'var(--a-primary)', boxShadow: '0 0 0 2px var(--a-primary-soft)' } : undefined}
                  onClick={() => up((x) => ({ ...x, theme: { ...x.theme, preset: t.key, colors: { ...t.colors } } }))}
                >
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {[t.colors.bg, t.colors.soft, t.colors.primary, t.colors.accent].map((col) => (
                      <i key={col} style={{ width: 14, height: 14, borderRadius: 99, background: col, border: '1px solid #ddd', display: 'inline-block' }} />
                    ))}
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="a-card">
            <h2>تخصيص الألوان</h2>
            {weak.length > 0 && (
              <div className="a-notice a-notice--warn" style={{ marginBottom: 10 }}>
                تباين ضعيف قد يصعّب القراءة: {weak.map(([n, f, b]) => `${n} (${contrastRatio(f, b)}:1)`).join('، ')} — يُنصح بـ 4.5:1 على الأقل.
              </div>
            )}
            <div className="a-form a-form--3">
              {(Object.keys(COLOR_LABELS) as (keyof ThemeColors)[]).map((k) => (
                <ColorInput key={k} label={COLOR_LABELS[k]} value={c[k]} onChange={(v) => setColor(k, v)} />
              ))}
            </div>
          </div>
          <div className="a-card a-form a-form--2">
            <Field label="خط النصوص">
              <select className="a-select" value={a.theme.fontBody} onChange={(e) => up((x) => ({ ...x, theme: { ...x.theme, fontBody: e.target.value } }))}>
                {FONTS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="خط العناوين">
              <select className="a-select" value={a.theme.fontHeading} onChange={(e) => up((x) => ({ ...x, theme: { ...x.theme, fontHeading: e.target.value } }))}>
                {FONTS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ملف الخط المرفوع" hint={p.fontFile ? `الحالي: ${p.fontFile}` : 'لم يُرفع خط بعد — يُستخدم «تجوال» بديلاً. TTF / OTF / WOFF / WOFF2'}>
              <ImageUpload kind="font" accept=".ttf,.otf,.woff,.woff2" label="رفع ملف خط" value={a.theme.customFontId} url={null} onChange={(id) => up((x) => ({ ...x, theme: { ...x.theme, customFontId: id } }))} />
            </Field>
            <Field label="اسم الخط المرفوع">
              <input className="a-input" dir="ltr" value={a.theme.customFontName} onChange={(e) => up((x) => ({ ...x, theme: { ...x.theme, customFontName: e.target.value } }))} />
            </Field>
            <Field label="حجم الخط الأساسي (px)">
              <NumInput value={a.theme.baseSize} min={14} max={19} onChange={(v) => up((x) => ({ ...x, theme: { ...x.theme, baseSize: v || 16 } }))} />
            </Field>
            <Field label="استدارة الحواف (px)">
              <NumInput value={a.theme.radius} min={0} max={32} onChange={(v) => up((x) => ({ ...x, theme: { ...x.theme, radius: v ?? 18 } }))} />
            </Field>
            <Switch checked={a.theme.decorations} onChange={(v) => up((x) => ({ ...x, theme: { ...x.theme, decorations: v } }))} label="زخارف النجوم والغيوم والقمر" />
            <p className="small muted a-span-2" style={{ margin: 0 }}>تأكد أن لديك ترخيص استخدام الخط على الويب قبل رفعه (مثل DIN Next LT Arabic).</p>
          </div>
        </div>
      )}

      {tab === 'home' && (
        <div className="a-card">
          <p className="small muted" style={{ marginTop: 0 }}>اسحب الأقسام لترتيبها، وأخفِ ما لا تحتاجه، وحدد فترة ظهور للعروض الموسمية.</p>
          <SortableList
            items={a.home.sections}
            getId={(s) => s.id}
            onReorder={(next) => up((x) => ({ ...x, home: { sections: next } }))}
            render={(s, handle) => (
              <div className="a-sortable-item" style={{ display: 'block', marginTop: 6 }}>
                <div className="a-section-row">
                  {handle}
                  <span className="a-grow">
                    <b>{s.title || HOME_SECTION_TYPES[s.type]}</b>
                    <span className="small muted">{HOME_SECTION_TYPES[s.type]}{(s.startsAt || s.endsAt) && ' · مجدول'}</span>
                  </span>
                  <Switch checked={s.enabled} onChange={(v) => setSection(s.id, { enabled: v })} label={<span className="sr-only">إظهار القسم</span>} />
                  <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {open === s.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <button type="button" className="a-icon-btn" aria-label="حذف القسم" onClick={() => confirmAction('حذف هذا القسم من الرئيسية؟') && up((x) => ({ ...x, home: { sections: x.home.sections.filter((y) => y.id !== s.id) } }))}>
                    <Trash2 size={16} />
                  </button>
                </div>
                {open === s.id && (
                  <div className="a-form" style={{ marginTop: 10 }}>
                    {s.type !== 'hero' && s.type !== 'promo' && (
                      <div className="a-form a-form--2">
                        <Field label="العنوان">
                          <input className="a-input" value={s.title} onChange={(e) => setSection(s.id, { title: e.target.value })} />
                        </Field>
                        <Field label="العنوان الفرعي">
                          <input className="a-input" value={s.subtitle} onChange={(e) => setSection(s.id, { subtitle: e.target.value })} />
                        </Field>
                      </div>
                    )}
                    {['new', 'offers', 'bundles', 'featured', 'categories'].includes(s.type) && (
                      <div className="a-form a-form--3">
                        <Field label="عدد العناصر">
                          <NumInput value={s.limit} min={1} max={48} onChange={(v) => setSection(s.id, { limit: v || 8 })} />
                        </Field>
                        {s.type !== 'categories' && (
                          <Field label="طريقة العرض">
                            <select className="a-select" value={s.layout} onChange={(e) => setSection(s.id, { layout: e.target.value as 'carousel' | 'grid' })}>
                              <option value="carousel">شريط أفقي بالسحب</option>
                              <option value="grid">شبكة</option>
                            </select>
                          </Field>
                        )}
                        <Field label="نص زر «عرض الكل»">
                          <input className="a-input" value={s.buttonText} onChange={(e) => setSection(s.id, { buttonText: e.target.value })} />
                        </Field>
                        <Field label="رابطه">
                          <input className="a-input" dir="ltr" value={s.buttonLink} onChange={(e) => setSection(s.id, { buttonLink: e.target.value })} />
                        </Field>
                      </div>
                    )}
                    {s.type === 'tag_group' && (
                      <Field label="مجموعة التصنيف">
                        <select className="a-select" value={s.tagGroupId ?? ''} onChange={(e) => setSection(s.id, { tagGroupId: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">اختر</option>
                          {p.tagGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    {s.type === 'featured' && (
                      <Field label="المنتجات المميزة (بالترتيب)">
                        <div className="a-row">
                          {s.productIds.map((id) => (
                            <span key={id} className="a-badge" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>
                              {products[id] || `#${id}`}
                              <button type="button" aria-label="إزالة" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setSection(s.id, { productIds: s.productIds.filter((x) => x !== id) })}>
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPicker(s.id)}>
                            <Plus size={14} /> منتج
                          </button>
                        </div>
                      </Field>
                    )}
                    {s.type === 'hero' && (
                      <>
                        {s.banners.map((b, i) => (
                          <BannerEditor
                            key={b.id}
                            b={b}
                            urls={urls}
                            setUrl={setUrl}
                            onChange={(nb) => setSection(s.id, { banners: s.banners.map((x, k) => (k === i ? nb : x)) })}
                            onRemove={() => setSection(s.id, { banners: s.banners.filter((_, k) => k !== i) })}
                          />
                        ))}
                        <button type="button" className="a-btn a-btn--ghost a-btn--sm" style={{ justifySelf: 'start' }} onClick={() => setSection(s.id, { banners: [...s.banners, blankBanner()] })}>
                          <Plus size={14} /> بانر
                        </button>
                      </>
                    )}
                    {s.type === 'promo' && (
                      <BannerEditor b={s.banners[0] || blankBanner()} urls={urls} setUrl={setUrl} onChange={(nb) => setSection(s.id, { banners: [nb] })} />
                    )}
                    {s.type === 'features' && (
                      <div className="a-form">
                        {s.items.map((it, i) => (
                          <div key={i} className="a-row" style={{ flexWrap: 'nowrap' }}>
                            <select className="a-select" style={{ width: 120 }} value={it.icon} onChange={(e) => setSection(s.id, { items: s.items.map((x, k) => (k === i ? { ...x, icon: e.target.value } : x)) })} aria-label="الأيقونة">
                              {[['gift', 'هدية'], ['truck', 'توصيل'], ['transfer', 'تحويل'], ['whatsapp', 'واتساب'], ['sparkles', 'تميز'], ['heart', 'قلب'], ['baby', 'طفل']].map(([k, l]) => (
                                <option key={k} value={k}>
                                  {l}
                                </option>
                              ))}
                            </select>
                            <input className="a-input" value={it.title} placeholder="العنوان" onChange={(e) => setSection(s.id, { items: s.items.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
                            <input className="a-input" value={it.text} placeholder="الوصف" onChange={(e) => setSection(s.id, { items: s.items.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                            <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => setSection(s.id, { items: s.items.filter((_, k) => k !== i) })}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                        {s.items.length < 8 && (
                          <button type="button" className="a-btn a-btn--ghost a-btn--sm" style={{ justifySelf: 'start' }} onClick={() => setSection(s.id, { items: [...s.items, { icon: 'sparkles', title: '', text: '' }] })}>
                            <Plus size={14} /> ميزة
                          </button>
                        )}
                        <p className="small muted" style={{ margin: 0 }}>اكتب مزايا حقيقية يقدمها متجرك فقط.</p>
                      </div>
                    )}
                    {s.type === 'text' && (
                      <Field label="النص (يدعم ## عنوان و- قائمة و**عريض**)">
                        <textarea className="a-textarea" rows={6} value={s.body} onChange={(e) => setSection(s.id, { body: e.target.value })} />
                      </Field>
                    )}
                    <div className="a-form a-form--2">
                      <Field label="يظهر القسم من (اختياري)">
                        <DateTimeInput value={s.startsAt} onChange={(v) => setSection(s.id, { startsAt: v })} />
                      </Field>
                      <Field label="حتى (اختياري)">
                        <DateTimeInput value={s.endsAt} onChange={(v) => setSection(s.id, { endsAt: v })} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            )}
          />
          <div className="a-row" style={{ marginTop: 12 }}>
            <select className="a-select" style={{ width: 'auto' }} value={addType} onChange={(e) => setAddType(e.target.value as HomeSectionType)} aria-label="نوع القسم">
              {(Object.keys(HOME_SECTION_TYPES) as HomeSectionType[]).map((t) => (
                <option key={t} value={t}>
                  {HOME_SECTION_TYPES[t]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="a-btn a-btn--ghost"
              onClick={() => {
                const s = newSection(addType, { title: addType === 'hero' || addType === 'promo' ? '' : HOME_SECTION_TYPES[addType], banners: addType === 'hero' || addType === 'promo' ? [blankBanner()] : [] })
                up((x) => ({ ...x, home: { sections: [...x.home.sections, s] } }))
                setOpen(s.id)
              }}
            >
              <Plus size={16} /> إضافة قسم
            </button>
          </div>
        </div>
      )}

      {tab === 'announce' && (
        <div className="a-card a-form">
          <Switch checked={a.announcement.enabled} onChange={(v) => up((x) => ({ ...x, announcement: { ...x.announcement, enabled: v } }))} label="إظهار شريط الإعلانات أعلى الصفحات" />
          <Field label="الرسائل (تتبدل كل 5 ثوانٍ)">
            <LinksEditor items={a.announcement.items} max={8} onChange={(v) => up((x) => ({ ...x, announcement: { ...x.announcement, items: v } }))} />
          </Field>
          <div className="a-form a-form--2">
            <ColorInput label="لون الخلفية" value={a.announcement.bg} onChange={(v) => up((x) => ({ ...x, announcement: { ...x.announcement, bg: v } }))} />
            <ColorInput label="لون النص" value={a.announcement.fg} onChange={(v) => up((x) => ({ ...x, announcement: { ...x.announcement, fg: v } }))} />
            <Field label="يظهر من">
              <DateTimeInput value={a.announcement.startsAt} onChange={(v) => up((x) => ({ ...x, announcement: { ...x.announcement, startsAt: v } }))} />
            </Field>
            <Field label="حتى">
              <DateTimeInput value={a.announcement.endsAt} onChange={(v) => up((x) => ({ ...x, announcement: { ...x.announcement, endsAt: v } }))} />
            </Field>
          </div>
          {contrastRatio(a.announcement.fg, a.announcement.bg) < 4.5 && <div className="a-notice a-notice--warn small">تباين ضعيف بين لون النص والخلفية.</div>}
        </div>
      )}

      {tab === 'cards' && (
        <div className="a-card a-form a-form--2">
          <Field label="نسبة صورة المنتج">
            <select className="a-select" value={a.productCard.aspect} onChange={(e) => up((x) => ({ ...x, productCard: { ...x.productCard, aspect: e.target.value as Appearance['productCard']['aspect'] } }))}>
              <option value="4/5">4:5 (طولية)</option>
              <option value="1/1">1:1 (مربعة)</option>
              <option value="3/4">3:4</option>
            </select>
          </Field>
          <Field label="ملاءمة الصورة" hint="«احتواء» يعرض الصورة كاملة دون قص">
            <select className="a-select" value={a.productCard.fit} onChange={(e) => up((x) => ({ ...x, productCard: { ...x.productCard, fit: e.target.value as 'cover' | 'contain' } }))}>
              <option value="cover">ملء الإطار</option>
              <option value="contain">احتواء كامل الصورة</option>
            </select>
          </Field>
          <Field label="أعمدة الجوال">
            <select className="a-select" value={a.productCard.columnsMobile} onChange={(e) => up((x) => ({ ...x, productCard: { ...x.productCard, columnsMobile: Number(e.target.value) as 1 | 2 } }))}>
              <option value={2}>2</option>
              <option value={1}>1</option>
            </select>
          </Field>
          <Field label="أعمدة الكمبيوتر">
            <select className="a-select" value={a.productCard.columnsDesktop} onChange={(e) => up((x) => ({ ...x, productCard: { ...x.productCard, columnsDesktop: Number(e.target.value) as 3 | 4 | 5 } }))}>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </Field>
          <Switch checked={a.productCard.hoverSecondImage} onChange={(v) => up((x) => ({ ...x, productCard: { ...x.productCard, hoverSecondImage: v } }))} label="إظهار الصورة الثانية عند المرور (كمبيوتر)" />
          <Switch checked={a.productCard.quickView} onChange={(v) => up((x) => ({ ...x, productCard: { ...x.productCard, quickView: v } }))} label="زر النظرة السريعة" />
        </div>
      )}

      {tab === 'labels' && (
        <div className="a-card a-form a-form--2">
          {Object.keys(DEFAULT_LABELS).map((k) => (
            <Field key={k} label={LABEL_NAMES[k] || k}>
              <input className="a-input" value={a.labels[k] ?? ''} placeholder={DEFAULT_LABELS[k]} onChange={(e) => up((x) => ({ ...x, labels: { ...x.labels, [k]: e.target.value } }))} />
            </Field>
          ))}
        </div>
      )}

      {tab === 'nav' && (
        <div className="a-grid">
          <div className="a-card">
            <h2>القائمة الرئيسية</h2>
            <LinksEditor items={a.header.menu} onChange={(v) => up((x) => ({ ...x, header: { menu: v } }))} />
          </div>
          <div className="a-card a-form">
            <h2 style={{ margin: 0 }}>التذييل</h2>
            <Field label="نبذة عن المتجر">
              <textarea className="a-textarea" rows={2} value={a.footer.about} onChange={(e) => up((x) => ({ ...x, footer: { ...x.footer, about: e.target.value } }))} />
            </Field>
            {a.footer.columns.map((col, i) => (
              <div key={i} className="a-card" style={{ background: '#fcfbfd' }}>
                <div className="a-row" style={{ marginBottom: 8 }}>
                  <input className="a-input a-grow" value={col.title} onChange={(e) => up((x) => ({ ...x, footer: { ...x.footer, columns: x.footer.columns.map((cc, k) => (k === i ? { ...cc, title: e.target.value } : cc)) } }))} aria-label="عنوان العمود" />
                  <button type="button" className="a-icon-btn" aria-label="حذف العمود" onClick={() => up((x) => ({ ...x, footer: { ...x.footer, columns: x.footer.columns.filter((_, k) => k !== i) } }))}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <LinksEditor items={col.links} onChange={(v) => up((x) => ({ ...x, footer: { ...x.footer, columns: x.footer.columns.map((cc, k) => (k === i ? { ...cc, links: v } : cc)) } }))} />
              </div>
            ))}
            {a.footer.columns.length < 5 && (
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" style={{ justifySelf: 'start' }} onClick={() => up((x) => ({ ...x, footer: { ...x.footer, columns: [...x.footer.columns, { title: 'روابط', links: [] }] } }))}>
                <Plus size={14} /> عمود
              </button>
            )}
            <div className="a-form a-form--2">
              {(['instagram', 'tiktok', 'snapchat', 'facebook', 'x'] as const).map((k) => (
                <Field key={k} label={k}>
                  <input className="a-input" dir="ltr" value={a.footer.social[k]} placeholder="https://" onChange={(e) => up((x) => ({ ...x, footer: { ...x.footer, social: { ...x.footer.social, [k]: e.target.value } } }))} />
                </Field>
              ))}
              <Field label="نص الحقوق">
                <input className="a-input" value={a.footer.copyright} onChange={(e) => up((x) => ({ ...x, footer: { ...x.footer, copyright: e.target.value } }))} />
              </Field>
            </div>
            <p className="small muted" style={{ margin: 0 }}>رقم واتساب والبريد والعنوان تُعدل من الإعدادات.</p>
          </div>
        </div>
      )}

      {versions && (
        <Modal title="النسخ المنشورة السابقة" onClose={() => setVersions(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>استعادة نسخة تنسخها إلى المسودة لتراجعها ثم تنشرها.</p>
          <ul className="a-timeline">
            {p.versions.map((v) => (
              <li key={v.id} className="a-row a-row--between">
                <span>
                  {v.status === 'published' ? <span className="a-badge a-badge--ok">المنشورة حالياً</span> : <span className="a-badge">سابقة</span>} {v.note || ''}
                  <time>
                    {v.created_by_name || 'النظام'} — {formatDateTime(v.published_at || v.created_at)}
                  </time>
                </span>
                <button
                  type="button"
                  className="a-btn a-btn--ghost a-btn--sm"
                  onClick={() => run(async () => { await api('POST', `appearance/restore/${v.id}`); window.location.reload() }, 'تم نسخها إلى المسودة', { refresh: false })}
                >
                  استعادة للمسودة
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {picker && (
        <ProductPicker
          onClose={() => setPicker(null)}
          onPick={(pp) => {
            setProducts((x) => ({ ...x, [pp.id]: pp.name }))
            const s = a.home.sections.find((y) => y.id === picker)
            if (s && !s.productIds.includes(pp.id)) setSection(picker, { productIds: [...s.productIds, pp.id] })
            else toast('المنتج مضاف مسبقاً')
            setPicker(null)
          }}
        />
      )}
    </>
  )
}
