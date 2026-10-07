'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, GripVertical, Search, Trash2, ImagePlus } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatMoney, type CurrencyConfig } from '@/lib/shared/money'
import { toLocalInput, fromLocalInput } from '@/lib/shared/dates'
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/shared/constants'
import type { Permission } from '@/lib/shared/constants'

// ===== سياق اللوحة =====
type AdminCtx = {
  user: { id: number; name: string; permissions: Permission[] }
  currency: CurrencyConfig
  toast: (text: string, type?: 'ok' | 'error') => void
  can: (p: Permission | Permission[]) => boolean
  money: (c: number) => string
}
const Ctx = createContext<AdminCtx | null>(null)

export function AdminProvider({ user, currency, children }: { user: AdminCtx['user']; currency: CurrencyConfig; children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string; type?: 'ok' | 'error' }[]>([])
  const n = useRef(0)
  const toast = useCallback((text: string, type?: 'ok' | 'error') => {
    const id = ++n.current
    setToasts((t) => [...t.slice(-3), { id, text, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500)
  }, [])
  const can = useCallback(
    (p: Permission | Permission[]) => user.permissions.includes('owner') || (Array.isArray(p) ? p : [p]).some((x) => user.permissions.includes(x)),
    [user.permissions],
  )
  const money = useCallback((c: number) => formatMoney(c, currency), [currency])
  return (
    <Ctx.Provider value={{ user, currency, toast, can, money }}>
      {children}
      <div className="a-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`a-toast ${t.type === 'error' ? 'a-toast--error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useAdmin() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAdmin outside provider')
  return c
}

// ===== الاتصال بالخادم =====
export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  const r = await fetch(`/api/admin/${path}`, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  })
  let data: Record<string, unknown> = {}
  try {
    data = await r.json()
  } catch {}
  if (r.status === 401) {
    window.location.href = '/admin/login'
    throw new Error('انتهت الجلسة')
  }
  if (!r.ok) {
    const e = new Error((data.error as string) || 'حدث خطأ') as Error & { data?: Record<string, unknown> }
    e.data = data
    throw e
  }
  return data as T
}

/** تنفيذ إجراء مع تنبيه نجاح/خطأ وتحديث الصفحة */
export function useAction() {
  const { toast } = useAdmin()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string, opts: { refresh?: boolean } = {}): Promise<T | undefined> => {
      setBusy(true)
      try {
        const r = await fn()
        if (ok) toast(ok)
        if (opts.refresh !== false) router.refresh()
        return r
      } catch (e) {
        toast((e as Error).message, 'error')
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [toast, router],
  )
  return { run, busy }
}

// ===== عناصر الواجهة =====
export function PageHead({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="a-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="a-row">{children}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children, className = '', htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={`a-field ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className="a-switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Modal({ title, onClose, children, large }: { title: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="a-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`a-modal ${large ? 'a-modal--lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="a-modal__head">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="a-icon-btn" aria-label="إغلاق" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function confirmAction(msg: string) {
  return window.confirm(msg)
}

/** إدخال مبلغ بالعملة (يعرض بالوحدة ويحفظ بالسنت) */
export function MoneyInput({ value, onChange, id, placeholder, allowEmpty }: { value: number | null | undefined; onChange: (c: number | null) => void; id?: string; placeholder?: string; allowEmpty?: boolean }) {
  const { currency } = useAdmin()
  const [text, setText] = useState(value == null ? '' : String(value / 100))
  useEffect(() => {
    const cur = text === '' ? null : Math.round(Number(text) * 100)
    if (cur !== (value ?? null)) setText(value == null ? '' : String(value / 100))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="a-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
      <input
        id={id}
        className="a-input"
        inputMode="decimal"
        dir="ltr"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, '')
          setText(t)
          if (t === '') onChange(allowEmpty ? null : 0)
          else if (!Number.isNaN(Number(t))) onChange(Math.round(Number(t) * 100))
        }}
      />
      <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
        {currency.symbol}
      </span>
    </div>
  )
}

export function NumInput({ value, onChange, min = 0, max, id, allowEmpty, placeholder }: { value: number | null | undefined; onChange: (n: number | null) => void; min?: number; max?: number; id?: string; allowEmpty?: boolean; placeholder?: string }) {
  return (
    <input
      id={id}
      className="a-input"
      type="number"
      inputMode="numeric"
      dir="ltr"
      min={min}
      max={max}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === '') return onChange(allowEmpty ? null : min)
        const n = Math.floor(Number(e.target.value))
        if (!Number.isNaN(n)) onChange(max != null ? Math.min(max, Math.max(min, n)) : Math.max(min, n))
      }}
    />
  )
}

export function DateTimeInput({ value, onChange, id }: { value: string | null | undefined; onChange: (iso: string | null) => void; id?: string }) {
  return (
    <div className="a-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
      <input id={id} className="a-input" type="datetime-local" value={toLocalInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />
      {value && (
        <button type="button" className="a-icon-btn" aria-label="مسح التاريخ" onClick={() => onChange(null)}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function OrderStatusBadge({ status }: { status: string }) {
  const cls = status === 'cancelled' ? 'a-badge--danger' : status === 'completed' ? 'a-badge--ok' : status === 'pending' ? 'a-badge--warn' : 'a-badge--info'
  return <span className={`a-badge ${cls}`}>{ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status}</span>
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'paid' ? 'a-badge--ok' : ['needs_review'].includes(status) ? 'a-badge--danger' : status === 'under_review' ? 'a-badge--info' : status.includes('refund') ? 'a-badge--primary' : 'a-badge--warn'
  return <span className={`a-badge ${cls}`}>{PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] || status}</span>
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="a-pager">
      <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </button>
      <span className="small muted num">
        {page} / {pages}
      </span>
      <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </button>
    </div>
  )
}

// ===== رفع الصور =====
const MAX_UPLOAD = 5 * 1024 * 1024
const MAX_SIDE = 2400

/** تصغير الصور الكبيرة في المتصفح قبل الرفع (حد الاستضافة ~6 ميجابايت للطلب) مع الحفاظ على الشفافية */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size <= MAX_UPLOAD) {
    bmp.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const toBlob = (type: string, q?: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
  let blob = await toBlob('image/webp', 0.9)
  // بعض المتصفحات لا تدعم WEBP: PNG للصور الشفافة وJPEG لغيرها
  if (!blob || blob.type !== 'image/webp') blob = file.type === 'image/png' ? await toBlob('image/png') : await toBlob('image/jpeg', 0.9)
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + (blob.type === 'image/png' ? '.png' : blob.type === 'image/jpeg' ? '.jpg' : '.webp'), { type: blob.type })
}

/** يجهّز الملف للرفع: يصغّر الصور الكبيرة ويرفض ما يتجاوز الحد */
export async function prepareUpload(file: File): Promise<File> {
  const f = await shrinkImage(file)
  if (f.size > MAX_UPLOAD + 512 * 1024) throw new Error('حجم الملف أكبر من 5 ميجابايت')
  return f
}

export async function uploadFile(file: File, kind: 'image' | 'favicon' | 'font' = 'image', purpose = 'product') {
  if (kind !== 'font') file = await prepareUpload(file)
  else if (file.size > MAX_UPLOAD + 512 * 1024) throw new Error('حجم الملف أكبر من 5 ميجابايت')
  const fd = new FormData()
  fd.append('file', file)
  fd.append('kind', kind)
  fd.append('purpose', purpose)
  return api<{ id: number; url: string }>('POST', 'media', fd)
}

export function ImageUpload({ value, url, onChange, purpose = 'general', label = 'اختر صورة', kind = 'image', accept = 'image/*' }: {
  value: number | null
  url: string | null
  onChange: (id: number | null, url: string | null) => void
  purpose?: string
  label?: string
  kind?: 'image' | 'favicon' | 'font'
  accept?: string
}) {
  const { toast } = useAdmin()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const r = await uploadFile(f, kind, purpose)
      onChange(r.id, r.url)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="a-row" style={{ alignItems: 'flex-start' }}>
      {value && url && kind !== 'font' ? (
        <img src={url} alt="" style={{ width: 96, height: 96, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--a-border)', background: '#faf8fb' }} />
      ) : value && kind === 'font' ? (
        <span className="a-badge a-badge--ok">ملف خط مرفوع</span>
      ) : null}
      <div className="a-row">
        <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => input.current?.click()} disabled={busy}>
          <Upload size={15} /> {busy ? 'جارٍ الرفع…' : value ? 'تغيير' : label}
        </button>
        {value && (
          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => onChange(null, null)}>
            إزالة
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

// ===== الترتيب بالسحب =====
function SortableRow({ id, children }: { id: string | number; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <span className="a-drag" {...attributes} {...listeners} aria-label="اسحب لإعادة الترتيب">
      <GripVertical size={18} />
    </span>
  )
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined, position: 'relative' }} className={isDragging ? 'is-dragging' : ''}>
      {children(handle)}
    </div>
  )
}

export function SortableList<T>({ items, getId, onReorder, render, grid }: { items: T[]; getId: (t: T) => string | number; onReorder: (items: T[]) => void; render: (item: T, handle: ReactNode, index: number) => ReactNode; grid?: boolean }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((x) => getId(x) === e.active.id)
    const to = items.findIndex((x) => getId(x) === e.over!.id)
    if (from < 0 || to < 0) return
    onReorder(arrayMove(items, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={items.map(getId)} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={grid ? 'a-images' : ''}>
          {items.map((it, i) => (
            <SortableRow key={getId(it)} id={getId(it)}>
              {(h) => render(it, h, i)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/** مدير صور متعددة مع الرفع والسحب للترتيب */
type ManagedImage = { mediaId: number; url: string; alt?: string | null; optionValue?: string | null; role?: 'rail' | 'rail_photo' | 'back' | null }

export function ImagesManager({ images, onChange, optionValues }: {
  images: ManagedImage[]
  onChange: (imgs: ManagedImage[]) => void
  optionValues: string[]
}) {
  // صورة واحدة فقط لكل دور (الشماعة بنوعيها / الخلف)
  const group = (r: ManagedImage['role']) => (r === 'rail_photo' ? 'rail' : r)
  const setRole = (id: number, role: ManagedImage['role']) =>
    onChange(images.map((x) => (x.mediaId === id ? { ...x, role } : role && group(x.role) === group(role) ? { ...x, role: null } : x)))
  const { toast } = useAdmin()
  const [busy, setBusy] = useState(0)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(images)
  latest.current = images
  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setBusy(list.length)
    for (const f of list) {
      try {
        const r = await uploadFile(f, 'image', 'product')
        latest.current = [...latest.current, { mediaId: r.id, url: r.url, alt: '', optionValue: null }]
        onChange(latest.current)
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, 'error')
      } finally {
        setBusy((b) => b - 1)
      }
    }
    if (input.current) input.current.value = ''
  }
  return (
    <div className="a-form">
      {images.length > 0 && (
        <SortableList
          grid
          items={images}
          getId={(i) => i.mediaId}
          onReorder={onChange}
          render={(im, handle, i) => (
            <div className={`a-image ${im.role === 'rail' ? 'a-image--rail' : ''}`}>
              {i === 0 && im.role !== 'rail' && <span className="main-tag">الرئيسية</span>}
              {im.role && <span className="main-tag main-tag--role">{im.role === 'rail' ? 'الشماعة (مفرغة)' : im.role === 'rail_photo' ? 'الشماعة (صورة حقيقية)' : 'الخلف'}</span>}
              <img src={im.url} alt="" />
              <select className="a-image__role" aria-label="استخدام الصورة" value={im.role || ''} onChange={(e) => setRole(im.mediaId, (e.target.value || null) as ManagedImage['role'])}>
                <option value="">صورة عادية</option>
                <option value="rail_photo">صورة الشماعة: القطعة معلقة على شماعتها (صورة حقيقية)</option>
                <option value="rail">صورة الشماعة: القطعة مفرغة بدون شماعة (نرسم لها شماعة خشبية)</option>
                <option value="back">صورة الخلف (في صفحة المنتج فقط)</option>
              </select>
              <div className="a-image__bar">
                {handle}
                {optionValues.length > 0 && (
                  <select aria-label="ربط بخيار" value={im.optionValue || ''} onChange={(e) => onChange(images.map((x) => (x.mediaId === im.mediaId ? { ...x, optionValue: e.target.value || null } : x)))}>
                    <option value="">كل الخيارات</option>
                    {optionValues.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className="a-icon-btn" style={{ width: 28, height: 28 }} aria-label="حذف الصورة" onClick={() => onChange(images.filter((x) => x.mediaId !== im.mediaId))}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )}
        />
      )}
      <div
        className={`a-dropzone ${over ? 'is-over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          upload(e.dataTransfer.files)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
      >
        <ImagePlus size={26} style={{ margin: '0 auto 4px' }} />
        {busy > 0 ? `جارٍ رفع ${busy} صورة…` : 'اسحب الصور هنا أو اضغط لاختيار عدة صور (JPG / PNG / WEBP حتى 12MB)'}
        <div className="small">تُضغط الصور تلقائياً بعدة مقاسات لسرعة التحميل. اسحب الصور لترتيبها؛ الأولى هي الرئيسية.</div>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
    </div>
  )
}

// ===== منتقي المنتجات =====
export type PickedProduct = { id: number; name: string; sku: string; type: string; image: string | null; variants: { id: number; sku: string; label: string; active: boolean }[] }

export function ProductPicker({ onPick, onClose, componentsOnly, title = 'اختر منتجاً' }: { onPick: (p: PickedProduct) => void; onClose: () => void; componentsOnly?: boolean; title?: string }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<PickedProduct[]>([])
  useEffect(() => {
    const t = setTimeout(() => {
      api<{ items: PickedProduct[] }>('GET', `products-search?q=${encodeURIComponent(q)}${componentsOnly ? '&type=component' : ''}`)
        .then((r) => setItems(r.items))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [q, componentsOnly])
  return (
    <Modal title={title} onClose={onClose}>
      <div className="a-row" style={{ marginBottom: 10 }}>
        <Search size={18} />
        <input className="a-input a-grow" autoFocus placeholder="ابحث بالاسم أو رقم المنتج" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gap: 6, maxHeight: '60vh', overflow: 'auto' }}>
        {items.map((p) => (
          <button key={p.id} type="button" className="a-sortable-item" style={{ cursor: 'pointer', textAlign: 'start', font: 'inherit' }} onClick={() => onPick(p)}>
            {p.image ? <img src={p.image} alt="" style={{ width: 38, height: 46, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ width: 38 }} />}
            <span className="a-grow">
              <b style={{ display: 'block' }}>{p.name}</b>
              <span className="small muted">
                <bdi>{p.sku}</bdi> · {p.type === 'variable' ? `${p.variants.length} خيارات` : p.type === 'bundle' ? 'باقة' : 'بسيط'}
              </span>
            </span>
          </button>
        ))}
        {!items.length && <p className="muted small">لا نتائج</p>}
      </div>
    </Modal>
  )
}

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: ReactNode }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="a-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
