'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { api, useAction, PageHead, Modal, Field, Switch, SortableList, Tabs, confirmAction } from './ui'
import { Markdown } from '@/lib/shared/markdown'

type P = { id: number; slug: string; title: string; content: string; status: 'draft' | 'published'; showInFooter: boolean; system: boolean; seoTitle: string; seoDescription: string }
type F = { id: number; question: string; answer: string; category: string; published: boolean }

export function PagesManager({ pages, faqs }: { pages: P[]; faqs: F[] }) {
  const [tab, setTab] = useState('pages')
  const [edit, setEdit] = useState<P | null>(null)
  const [fq, setFq] = useState<F | null>(null)
  const [order, setOrder] = useState(faqs)
  const [preview, setPreview] = useState(false)
  const { run, busy } = useAction()
  const href = (p: P) => (p.slug === 'contact' ? '/contact' : `/pages/${encodeURIComponent(p.slug)}`)
  return (
    <>
      <PageHead title="الصفحات والأسئلة الشائعة" subtitle="من نحن، التواصل، السياسات وطريقة الطلب — حررها دون تعديل الكود">
        {tab === 'pages' ? (
          <button type="button" className="a-btn" onClick={() => setEdit({ id: 0, slug: '', title: '', content: '', status: 'draft', showInFooter: true, system: false, seoTitle: '', seoDescription: '' })}>
            <Plus size={16} /> صفحة جديدة
          </button>
        ) : (
          <button type="button" className="a-btn" onClick={() => setFq({ id: 0, question: '', answer: '', category: '', published: true })}>
            <Plus size={16} /> سؤال جديد
          </button>
        )}
      </PageHead>
      <Tabs tabs={[{ key: 'pages', label: 'الصفحات' }, { key: 'faq', label: 'الأسئلة الشائعة' }]} active={tab} onChange={setTab} />
      {tab === 'pages' ? (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>الصفحة</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.title}</b> {p.system && <span className="a-badge">أساسية</span>}
                    <div className="small muted" dir="ltr" style={{ textAlign: 'right' }}>{href(p)}</div>
                  </td>
                  <td>{p.status === 'published' ? <span className="a-badge a-badge--ok">منشورة</span> : <span className="a-badge">مسودة</span>}</td>
                  <td>
                    <div className="a-row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                      <a className="a-icon-btn" href={href(p)} target="_blank" rel="noopener noreferrer" aria-label="عرض">
                        <ExternalLink size={16} />
                      </a>
                      <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(p)}>
                        <Pencil size={16} />
                      </button>
                      {!p.system && (
                        <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction(`حذف «${p.title}»؟`) && run(() => api('DELETE', `pages/${p.id}`), 'تم الحذف')}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="a-card">
          <SortableList
            items={order}
            getId={(f) => f.id}
            onReorder={(next) => {
              setOrder(next)
              run(() => api('POST', 'faqs/reorder', { ids: next.map((f) => f.id) }), 'تم حفظ الترتيب', { refresh: false })
            }}
            render={(f, handle) => (
              <div className="a-sortable-item">
                {handle}
                <span className="a-grow">
                  <b>{f.question}</b> {!f.published && <span className="a-badge">مخفي</span>}
                  <div className="small muted">{f.category || 'عام'}</div>
                </span>
                <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setFq(f)}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction('حذف السؤال؟') && run(() => api('DELETE', `faqs/${f.id}`).then(() => setOrder((x) => x.filter((y) => y.id !== f.id))), 'تم الحذف')}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? `تعديل ${edit.title}` : 'صفحة جديدة'} onClose={() => setEdit(null)} large>
          <div className="a-form a-form--2">
            <Field label="العنوان">
              <input className="a-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="الرابط المختصر" hint={edit.system ? 'رابط الصفحات الأساسية ثابت' : 'فارغ = من العنوان'}>
              <input className="a-input" value={edit.slug} disabled={edit.system} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
            </Field>
            <div className="a-span-2">
              <div className="a-row a-row--between" style={{ marginBottom: 4 }}>
                <span className="a-label">المحتوى</span>
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setPreview(!preview)}>
                  {preview ? 'تحرير' : 'معاينة'}
                </button>
              </div>
              {preview ? (
                <div className="a-card" style={{ maxHeight: 420, overflow: 'auto' }}>
                  <Markdown text={edit.content} />
                </div>
              ) : (
                <textarea className="a-textarea" rows={14} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
              )}
              <p className="small muted">التنسيق: ## عنوان، ### عنوان فرعي، - عنصر قائمة، 1. قائمة مرقمة، **نص عريض**، [نص الرابط](https://...)، &gt; ملاحظة</p>
            </div>
            <Field label="عنوان محركات البحث">
              <input className="a-input" value={edit.seoTitle} onChange={(e) => setEdit({ ...edit, seoTitle: e.target.value })} />
            </Field>
            <Field label="وصف محركات البحث">
              <input className="a-input" value={edit.seoDescription} onChange={(e) => setEdit({ ...edit, seoDescription: e.target.value })} />
            </Field>
            <Switch checked={edit.status === 'published'} onChange={(v) => setEdit({ ...edit, status: v ? 'published' : 'draft' })} label="منشورة" />
          </div>
          <button
            type="button"
            className="a-btn"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={() => {
              const body = { slug: edit.slug, title: edit.title, content: edit.content, status: edit.status, showInFooter: edit.showInFooter, seoTitle: edit.seoTitle, seoDescription: edit.seoDescription }
              run(() => (edit.id ? api('PUT', `pages/${edit.id}`, body) : api('POST', 'pages', body)).then(() => setEdit(null)), 'تم الحفظ')
            }}
          >
            حفظ
          </button>
          <p className="small muted">روابط التذييل تُدار من «مظهر المتجر ← التذييل».</p>
        </Modal>
      )}
      {fq && (
        <Modal title={fq.id ? 'تعديل السؤال' : 'سؤال جديد'} onClose={() => setFq(null)}>
          <div className="a-form">
            <Field label="السؤال">
              <input className="a-input" value={fq.question} onChange={(e) => setFq({ ...fq, question: e.target.value })} />
            </Field>
            <Field label="الإجابة">
              <textarea className="a-textarea" rows={5} value={fq.answer} onChange={(e) => setFq({ ...fq, answer: e.target.value })} />
            </Field>
            <Field label="التصنيف">
              <input className="a-input" value={fq.category} onChange={(e) => setFq({ ...fq, category: e.target.value })} placeholder="مثل: الطلب والدفع" />
            </Field>
            <Switch checked={fq.published} onChange={(v) => setFq({ ...fq, published: v })} label="منشور" />
            <button
              type="button"
              className="a-btn"
              disabled={busy}
              onClick={() => {
                const body = { question: fq.question, answer: fq.answer, category: fq.category, published: fq.published }
                run(() => (fq.id ? api('PUT', `faqs/${fq.id}`, body) : api('POST', 'faqs', body)).then(() => window.location.reload()), 'تم الحفظ', { refresh: false })
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
