'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, EyeOff } from 'lucide-react'
import { api, useAction, PageHead, SortableList, Modal, Field, Switch, ImageUpload, confirmAction } from './ui'

type Cat = { id: number; name: string; slug: string; description: string; imageId: number | null; imageUrl: string | null; visible: boolean; hiddenFilters: string[]; seoTitle: string; seoDescription: string; count: number }

export function CategoriesManager({ initial, groups }: { initial: Cat[]; groups: { slug: string; name: string }[] }) {
  const [items, setItems] = useState(initial)
  const [edit, setEdit] = useState<Cat | null>(null)
  const { run } = useAction()
  const filters = [
    { key: 'size', label: 'المقاس' },
    { key: 'color', label: 'اللون' },
    { key: 'price', label: 'السعر' },
    { key: 'stock', label: 'التوفر والعروض' },
    ...groups.map((g) => ({ key: `tag:${g.slug}`, label: g.name })),
  ]
  return (
    <>
      <PageHead title="الأقسام" subtitle="اسحب لإعادة الترتيب. الترتيب يظهر في القائمة والرئيسية.">
        <button type="button" className="a-btn" onClick={() => setEdit({ id: 0, name: '', slug: '', description: '', imageId: null, imageUrl: null, visible: true, hiddenFilters: [], seoTitle: '', seoDescription: '', count: 0 })}>
          <Plus size={16} /> قسم جديد
        </button>
      </PageHead>
      <div className="a-card">
        <SortableList
          items={items}
          getId={(c) => c.id}
          onReorder={(next) => {
            setItems(next)
            run(() => api('POST', 'categories/reorder', { ids: next.map((c) => c.id) }), 'تم حفظ الترتيب', { refresh: false })
          }}
          render={(c, handle) => (
            <div className="a-sortable-item">
              {handle}
              {c.imageUrl ? <img src={c.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ width: 44 }} />}
              <span className="a-grow">
                <b>{c.name}</b> {!c.visible && <span className="a-badge"><EyeOff size={12} /> مخفي</span>}
                <div className="small muted">
                  {c.count} منتج · /category/{c.slug}
                </div>
              </span>
              <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(c)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف القسم «${c.name}»؟`) && run(() => api('DELETE', `categories/${c.id}`).then(() => setItems((x) => x.filter((y) => y.id !== c.id))), 'تم الحذف')}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
        {!items.length && <p className="a-empty">لا توجد أقسام</p>}
      </div>
      {edit && (
        <Modal title={edit.id ? `تعديل ${edit.name}` : 'قسم جديد'} onClose={() => setEdit(null)}>
          <div className="a-form">
            <Field label="الاسم">
              <input className="a-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="الرابط المختصر" hint="فارغ = من الاسم">
              <input className="a-input" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
            </Field>
            <Field label="الوصف">
              <textarea className="a-textarea" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <Field label="الصورة">
              <ImageUpload value={edit.imageId} url={edit.imageUrl} purpose="category" onChange={(id, url) => setEdit({ ...edit, imageId: id, imageUrl: url })} />
            </Field>
            <Switch checked={edit.visible} onChange={(v) => setEdit({ ...edit, visible: v })} label="ظاهر في المتجر" />
            <Field label="الفلاتر المخفية في صفحة هذا القسم" hint="تظهر الفلاتر تلقائياً فقط إذا كانت لمنتجات القسم قيم لها؛ ويمكنك إخفاء ما لا يناسب القسم">
              <div className="a-row">
                {filters.map((f) => (
                  <label key={f.key} className="a-check">
                    <input type="checkbox" checked={edit.hiddenFilters.includes(f.key)} onChange={(e) => setEdit({ ...edit, hiddenFilters: e.target.checked ? [...edit.hiddenFilters, f.key] : edit.hiddenFilters.filter((x) => x !== f.key) })} />
                    <span>إخفاء {f.label}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="عنوان محركات البحث">
              <input className="a-input" value={edit.seoTitle} onChange={(e) => setEdit({ ...edit, seoTitle: e.target.value })} />
            </Field>
            <Field label="وصف محركات البحث">
              <textarea className="a-textarea" rows={2} value={edit.seoDescription} onChange={(e) => setEdit({ ...edit, seoDescription: e.target.value })} />
            </Field>
            <button
              type="button"
              className="a-btn"
              onClick={() =>
                run(async () => {
                  const body = { name: edit.name, slug: edit.slug, description: edit.description, imageId: edit.imageId, visible: edit.visible, hiddenFilters: edit.hiddenFilters, seoTitle: edit.seoTitle, seoDescription: edit.seoDescription }
                  if (edit.id) await api('PUT', `categories/${edit.id}`, body)
                  else await api('POST', 'categories', body)
                  setEdit(null)
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
