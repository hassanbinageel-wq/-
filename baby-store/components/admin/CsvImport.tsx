'use client'

import { useState } from 'react'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { api, useAction } from './ui'

type Preview = {
  rows: { line: number; type: string; sku: string; name: string; action: 'create' | 'update' | 'error'; errors: string[]; warnings: string[] }[]
  summary: { total: number; create: number; update: number; errors: number }
}

export function CsvImport() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null)
  const { run, busy } = useAction()
  const fd = () => {
    const f = new FormData()
    f.append('file', file!)
    return f
  }
  return (
    <div className="a-card a-form">
      <h2 style={{ margin: 0 }}>1. اختر الملف ثم عاين النتائج</h2>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          setFile(e.target.files?.[0] || null)
          setPreview(null)
          setDone(null)
        }}
      />
      <button type="button" className="a-btn a-btn--ghost" disabled={!file || busy} onClick={() => run(async () => setPreview(await api<Preview>('POST', 'products/import/preview', fd())), undefined, { refresh: false })}>
        <Upload size={16} /> معاينة قبل الاستيراد
      </button>
      {preview && (
        <>
          <div className="a-row">
            <span className="a-badge a-badge--ok">إنشاء: {preview.summary.create}</span>
            <span className="a-badge a-badge--info">تحديث: {preview.summary.update}</span>
            <span className={`a-badge ${preview.summary.errors ? 'a-badge--danger' : ''}`}>أخطاء: {preview.summary.errors}</span>
          </div>
          <div className="a-table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="a-table">
              <thead>
                <tr>
                  <th>السطر</th>
                  <th>النوع</th>
                  <th>الرقم / الاسم</th>
                  <th>النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} style={r.action === 'error' ? { background: '#fff5f6' } : undefined}>
                    <td className="num">{r.line}</td>
                    <td>{r.type}</td>
                    <td>
                      <bdi>{r.sku}</bdi> {r.name}
                    </td>
                    <td className="small">
                      {r.action === 'error' ? (
                        <span style={{ color: 'var(--a-danger)' }}>
                          <AlertCircle size={13} style={{ display: 'inline' }} /> {r.errors.join('، ')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--a-ok)' }}>
                          <CheckCircle2 size={13} style={{ display: 'inline' }} /> {r.action === 'create' ? 'سيُنشأ' : 'سيُحدّث'}
                        </span>
                      )}
                      {r.warnings.length > 0 && <div style={{ color: 'var(--a-warn)' }}>{r.warnings.join('، ')}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 style={{ margin: 0 }}>2. تنفيذ الاستيراد</h2>
          {preview.summary.errors > 0 ? (
            <div className="a-notice a-notice--danger">صحح الأخطاء في الملف ثم أعد المعاينة. لن يُستورد أي سطر ما دامت هناك أخطاء.</div>
          ) : (
            <button type="button" className="a-btn" disabled={busy} onClick={() => run(async () => setDone(await api<{ created: number; updated: number }>('POST', 'products/import/commit', fd())), 'تم الاستيراد')}>
              استيراد {preview.summary.create + preview.summary.update} سطر
            </button>
          )}
        </>
      )}
      {done && <div className="a-notice a-notice--ok">تم إنشاء {done.created} وتحديث {done.updated} منتج. تُسجل تغييرات المخزون في سجل الحركة بسبب «استيراد CSV».</div>}
    </div>
  )
}
