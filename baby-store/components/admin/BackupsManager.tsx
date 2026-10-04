'use client'

import { useState } from 'react'
import { DatabaseBackup, Download, Trash2, RotateCcw } from 'lucide-react'
import { api, useAction, PageHead, Field, Switch, NumInput, Modal, confirmAction } from './ui'
import { formatDateTime } from '@/lib/shared/dates'
import type { BackupSettings } from '@/lib/shared/types'

export function BackupsManager({
  list,
  settings,
  usage,
}: {
  list: { name: string; size: number; createdAt: string }[]
  settings: BackupSettings
  usage: { total: number; images: number; backups: number }
}) {
  const { run, busy } = useAction()
  const [s, setS] = useState(settings)
  const [restore, setRestore] = useState<{ name?: string } | null>(null)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`
  return (
    <>
      <PageHead title="النسخ الاحتياطي والاستعادة" subtitle="النسخة تشمل كل بيانات المتجر: المنتجات والطلبات والعملاء والإعدادات">
        <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('POST', 'backups'), 'تم إنشاء نسخة احتياطية')}>
          <DatabaseBackup size={16} /> إنشاء نسخة الآن
        </button>
      </PageHead>
      <div className="a-notice a-notice--warn" style={{ marginBottom: 12 }}>
        النسخ محفوظة داخل قاعدة بيانات المتجر نفسها، وتحمي من الحذف أو التعديل بالخطأ. نزّل نسخة دورياً (أسبوعياً مثلاً) واحفظها على حاسوبك أو هاتفك للحماية من فقدان الحساب. الصور محفوظة في قاعدة البيانات ولا تُضمَّن في الملف. ملفات النسخ تحتوي بيانات العملاء — احفظها بأمان.
      </div>
      <div className="a-card" style={{ marginBottom: 12 }}>
        <div className="a-row" style={{ justifyContent: 'space-between' }}>
          <strong>مساحة قاعدة البيانات</strong>
          <span className="num small">{mb(usage.total)} / 500 MB</span>
        </div>
        <div className="usage-bar" role="img" aria-label={`المستخدم ${Math.round((usage.total / (500 * 1024 * 1024)) * 100)}٪`}>
          <span style={{ width: `${Math.min(100, (usage.total / (500 * 1024 * 1024)) * 100)}%` }} data-warn={usage.total > 400 * 1024 * 1024 ? '1' : undefined} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          منها الصور <span className="num">{mb(usage.images)}</span> والنسخ الاحتياطية <span className="num">{mb(usage.backups)}</span>. حد الخطة المجانية 500 ميجابايت؛ عند الاقتراب منه احذف النسخ القديمة أو الصور غير المستخدمة.
        </p>
      </div>
      <div className="a-grid a-grid--side">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>النسخة</th>
                <th>الحجم</th>
                <th>التاريخ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.name}>
                  <td dir="ltr" className="small" style={{ textAlign: 'right' }}>{b.name}</td>
                  <td className="num small">{mb(b.size)}</td>
                  <td className="small">{formatDateTime(b.createdAt)}</td>
                  <td>
                    <div className="a-row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                      <a className="a-icon-btn" href={`/api/admin/backups/${encodeURIComponent(b.name)}`} aria-label="تنزيل">
                        <Download size={16} />
                      </a>
                      <button type="button" className="a-icon-btn" aria-label="استعادة" onClick={() => setRestore({ name: b.name })}>
                        <RotateCcw size={16} />
                      </button>
                      <button type="button" className="a-icon-btn" aria-label="حذف" onClick={() => confirmAction('حذف هذه النسخة؟') && run(() => api('DELETE', `backups/${encodeURIComponent(b.name)}`), 'تم الحذف')}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="a-empty">لا توجد نسخ بعد</p>}
        </div>
        <div className="a-grid">
          <div className="a-card a-form">
            <h2 style={{ margin: 0 }}>النسخ التلقائي</h2>
            <Switch checked={s.autoEnabled} onChange={(v) => setS({ ...s, autoEnabled: v })} label="نسخة تلقائية يومية" />
            <Field label="عدد النسخ التلقائية المحتفظ بها">
              <NumInput value={s.keep} min={1} max={60} onChange={(v) => setS({ ...s, keep: v || 7 })} />
            </Field>
            {s.lastAutoAt && <p className="small muted" style={{ margin: 0 }}>آخر نسخة تلقائية: {formatDateTime(s.lastAutoAt)}</p>}
            <button type="button" className="a-btn a-btn--ghost" disabled={busy} onClick={() => run(() => api('PUT', 'settings/backup', s), 'تم الحفظ')}>
              حفظ
            </button>
          </div>
          <div className="a-card a-form">
            <h2 style={{ margin: 0 }}>استعادة من ملف</h2>
            <input type="file" accept=".gz,application/gzip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button type="button" className="a-btn a-btn--ghost" disabled={!file} onClick={() => setRestore({})}>
              <RotateCcw size={16} /> استعادة الملف
            </button>
          </div>
        </div>
      </div>
      {restore && (
        <Modal title="تأكيد الاستعادة" onClose={() => setRestore(null)}>
          <div className="a-form">
            <div className="a-notice a-notice--danger">ستُستبدل كل بيانات المتجر الحالية (المنتجات والطلبات والعملاء والإعدادات) بمحتوى النسخة، وتبقى الصور المحفوظة كما هي. تُنشأ نسخة أمان تلقائية من البيانات الحالية قبل الاستعادة، وستحتاج لتسجيل الدخول مجدداً بعدها.</div>
            <Field label="كلمة مرورك">
              <input className="a-input" dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <Field label="اكتب «استعادة» للتأكيد">
              <input className="a-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <button
              type="button"
              className="a-btn a-btn--danger"
              disabled={busy || confirm !== 'استعادة' || !pw}
              onClick={() =>
                run(async () => {
                  const fd = new FormData()
                  fd.append('password', pw)
                  fd.append('confirm', confirm)
                  if (restore.name) fd.append('name', restore.name)
                  else if (file) fd.append('file', file)
                  await api('POST', 'backups/restore', fd)
                  window.location.href = '/admin/login'
                  setRestore(null)
                  setPw('')
                  setConfirm('')
                }, 'تمت الاستعادة بنجاح')
              }
            >
              استعادة الآن
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
