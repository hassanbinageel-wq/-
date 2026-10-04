'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { api, useAction, PageHead, Modal, Field, ImageUpload, confirmAction } from './ui'

type Guide = { id: number; name: string; intro: string; columns: string[]; rows: string[][]; notes: string; imageId: number | null; imageUrl: string | null; isDemo: boolean; count: number }

export function SizeGuides({ initial }: { initial: Guide[] }) {
  const { run } = useAction()
  const [edit, setEdit] = useState<Guide | null>(null)
  const blank: Guide = { id: 0, name: '', intro: '', columns: ['المقاس', 'العمر', 'الطول (سم)', 'الوزن (كجم)'], rows: [['', '', '', '']], notes: '', imageId: null, imageUrl: null, isDemo: false, count: 0 }
  const setCell = (r: number, c: number, v: string) => setEdit((e) => e && { ...e, rows: e.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  return (
    <>
      <PageHead title="أدلة المقاسات" subtitle="جداول تربطها بالمنتجات وتظهر في نافذة «دليل المقاسات»">
        <button type="button" className="a-btn" onClick={() => setEdit(blank)}>
          <Plus size={16} /> دليل جديد
        </button>
      </PageHead>
      <div className="a-grid a-grid--2">
        {initial.map((g) => (
          <div key={g.id} className="a-card">
            <div className="a-row a-row--between">
              <h2 style={{ margin: 0 }}>
                {g.name} {g.isDemo && <span className="a-badge">نموذج</span>}
              </h2>
              <div className="a-row" style={{ gap: 2 }}>
                <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(g)}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction('حذف الدليل؟') && run(() => api('DELETE', `size-guides/${g.id}`), 'تم الحذف')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="small muted">مستخدم في {g.count} منتج · {g.rows.length} صفوف</p>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? 'تعديل الدليل' : 'دليل جديد'} onClose={() => setEdit(null)} large>
          <div className="a-form">
            <Field label="الاسم">
              <input className="a-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="مقدمة">
              <input className="a-input" value={edit.intro} onChange={(e) => setEdit({ ...edit, intro: e.target.value })} />
            </Field>
            <div className="a-table-wrap">
              <table className="a-table">
                <thead>
                  <tr>
                    {edit.columns.map((c, j) => (
                      <th key={j}>
                        <div className="a-row" style={{ flexWrap: 'nowrap', gap: 2 }}>
                          <input className="a-input" value={c} onChange={(e) => setEdit({ ...edit, columns: edit.columns.map((x, k) => (k === j ? e.target.value : x)) })} />
                          <button type="button" className="a-icon-btn" aria-label="حذف العمود" onClick={() => setEdit({ ...edit, columns: edit.columns.filter((_, k) => k !== j), rows: edit.rows.map((r) => r.filter((_, k) => k !== j)) })}>
                            <X size={14} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {edit.rows.map((r, i) => (
                    <tr key={i}>
                      {edit.columns.map((_, j) => (
                        <td key={j}>
                          <input className="a-input" value={r[j] || ''} onChange={(e) => setCell(i, j, e.target.value)} />
                        </td>
                      ))}
                      <td>
                        <button type="button" className="a-icon-btn" aria-label="حذف الصف" onClick={() => setEdit({ ...edit, rows: edit.rows.filter((_, k) => k !== i) })}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="a-row">
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setEdit({ ...edit, rows: [...edit.rows, edit.columns.map(() => '')] })}>
                + صف
              </button>
              <button type="button" className="a-btn a-btn--ghost a-btn--sm" disabled={edit.columns.length >= 10} onClick={() => setEdit({ ...edit, columns: [...edit.columns, 'عمود'], rows: edit.rows.map((r) => [...r, '']) })}>
                + عمود
              </button>
            </div>
            <Field label="ملاحظات">
              <textarea className="a-textarea" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <Field label="صورة توضيحية (اختياري)">
              <ImageUpload value={edit.imageId} url={edit.imageUrl} purpose="size-guide" onChange={(id, url) => setEdit({ ...edit, imageId: id, imageUrl: url })} />
            </Field>
            <button
              type="button"
              className="a-btn"
              onClick={() => {
                const body = { name: edit.name, intro: edit.intro, columns: edit.columns, rows: edit.rows, notes: edit.notes, imageId: edit.imageId }
                run(() => (edit.id ? api('PUT', `size-guides/${edit.id}`, body) : api('POST', 'size-guides', body)).then(() => setEdit(null)), 'تم الحفظ')
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
