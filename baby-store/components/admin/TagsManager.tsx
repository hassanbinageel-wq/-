'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { api, useAction, PageHead, SortableList, Modal, Field, Switch, confirmAction } from './ui'

type Tag = { id: number; name: string; slug: string; description: string; visible: boolean; count: number }
type Group = { id: number; name: string; slug: string; kind: 'age' | 'occasion' | 'custom'; showInFilters: boolean; tags: Tag[] }

export function TagsManager({ groups }: { groups: Group[] }) {
  const { run } = useAction()
  const [g, setG] = useState<Partial<Group> | null>(null)
  const [t, setT] = useState<(Partial<Tag> & { groupId: number }) | null>(null)
  const [order, setOrder] = useState<Record<number, Tag[]>>(() => Object.fromEntries(groups.map((x) => [x.id, x.tags])))
  return (
    <>
      <PageHead title="التسوق حسب العمر والمناسبة" subtitle="مجموعات تصنيف تظهر كفلاتر وكأقسام «تسوق حسب» في الرئيسية. أضف أي تصنيف تحتاجه.">
        <button type="button" className="a-btn" onClick={() => setG({ name: '', kind: 'custom', showInFilters: true })}>
          <Plus size={16} /> مجموعة جديدة
        </button>
      </PageHead>
      <div className="a-grid a-grid--2">
        {groups.map((gr) => (
          <section key={gr.id} className="a-card">
            <div className="a-row a-row--between" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>
                {gr.name} <span className="a-badge">{gr.kind === 'age' ? 'العمر' : gr.kind === 'occasion' ? 'مناسبة' : 'مخصص'}</span>
                {!gr.showInFilters && <span className="a-badge">لا يظهر في الفلاتر</span>}
              </h2>
              <div className="a-row" style={{ gap: 2 }}>
                <button type="button" className="a-icon-btn" aria-label="تعديل المجموعة" onClick={() => setG(gr)}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="a-icon-btn" aria-label="حذف المجموعة" onClick={() => confirmAction(`حذف مجموعة «${gr.name}» وكل تصنيفاتها؟`) && run(() => api('DELETE', `tag-groups/${gr.id}`), 'تم الحذف')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <SortableList
              items={order[gr.id] || []}
              getId={(x) => x.id}
              onReorder={(next) => {
                setOrder({ ...order, [gr.id]: next })
                run(() => api('POST', 'tags/reorder', { ids: next.map((x) => x.id) }), 'تم حفظ الترتيب', { refresh: false })
              }}
              render={(tag, handle) => (
                <div className="a-sortable-item">
                  {handle}
                  <span className="a-grow">
                    <b>{tag.name}</b> {!tag.visible && <span className="a-badge">مخفي</span>}
                    <div className="small muted">{tag.count} منتج</div>
                  </span>
                  <a className="a-icon-btn" href={`/collection/${encodeURIComponent(tag.slug)}`} target="_blank" rel="noopener noreferrer" aria-label="عرض">
                    <ExternalLink size={15} />
                  </a>
                  <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setT({ ...tag, groupId: gr.id })}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف «${tag.name}»؟`) && run(() => api('DELETE', `tags/${tag.id}`), 'تم الحذف')}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            />
            <button type="button" className="a-btn a-btn--ghost a-btn--sm" style={{ marginTop: 10 }} onClick={() => setT({ groupId: gr.id, name: '', description: '', visible: true })}>
              <Plus size={14} /> تصنيف في {gr.name}
            </button>
          </section>
        ))}
      </div>
      {g && (
        <Modal title={g.id ? 'تعديل المجموعة' : 'مجموعة جديدة'} onClose={() => setG(null)}>
          <div className="a-form">
            <Field label="الاسم">
              <input className="a-input" value={g.name || ''} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="مثل: المناسبة، الموسم، مناسب لـ" />
            </Field>
            <Field label="النوع">
              <select className="a-select" value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value as Group['kind'] })}>
                <option value="age">العمر</option>
                <option value="occasion">المناسبة</option>
                <option value="custom">مخصص</option>
              </select>
            </Field>
            <Switch checked={!!g.showInFilters} onChange={(v) => setG({ ...g, showInFilters: v })} label="إظهاره كفلتر في صفحات المنتجات" />
            <button type="button" className="a-btn" onClick={() => run(() => (g.id ? api('PUT', `tag-groups/${g.id}`, g) : api('POST', 'tag-groups', g)).then(() => setG(null)), 'تم الحفظ')}>
              حفظ
            </button>
          </div>
        </Modal>
      )}
      {t && (
        <Modal title={t.id ? 'تعديل التصنيف' : 'تصنيف جديد'} onClose={() => setT(null)}>
          <div className="a-form">
            <Field label="الاسم">
              <input className="a-input" value={t.name || ''} onChange={(e) => setT({ ...t, name: e.target.value })} />
            </Field>
            <Field label="المجموعة">
              <select className="a-select" value={t.groupId} onChange={(e) => setT({ ...t, groupId: Number(e.target.value) })}>
                {groups.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="وصف يظهر في صفحة التصنيف">
              <textarea className="a-textarea" rows={2} value={t.description || ''} onChange={(e) => setT({ ...t, description: e.target.value })} />
            </Field>
            <Switch checked={!!t.visible} onChange={(v) => setT({ ...t, visible: v })} label="ظاهر" />
            <button
              type="button"
              className="a-btn"
              onClick={() => {
                const body = { groupId: t.groupId, name: t.name || '', description: t.description || '', visible: !!t.visible, imageId: null }
                run(() => (t.id ? api('PUT', `tags/${t.id}`, body) : api('POST', 'tags', body)).then(() => setT(null)), 'تم الحفظ')
              }}
            >
              حفظ
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
