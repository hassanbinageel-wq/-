'use client'

import { useState } from 'react'
import { Plus, Pencil, KeyRound, LogOut } from 'lucide-react'
import { api, useAction, PageHead, Modal, Field, Switch } from './ui'
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from '@/lib/shared/constants'
import { formatDateTime } from '@/lib/shared/dates'

type U = { id: number; username: string; name: string; permissions: Permission[]; active: boolean; lastLogin: string | null; locked: boolean; sessions: number }

export function UsersManager({ initial, meId }: { initial: U[]; meId: number }) {
  const { run, busy } = useAction()
  const [edit, setEdit] = useState<(U & { password?: string }) | null>(null)
  const [pw, setPw] = useState<{ id: number; name: string; password: string } | null>(null)
  return (
    <>
      <PageHead title="المستخدمون والصلاحيات" subtitle="يمكن جمع أكثر من صلاحية لنفس الحساب. الصلاحيات تُطبق في الخادم على كل إجراء.">
        <button type="button" className="a-btn" onClick={() => setEdit({ id: 0, username: '', name: '', permissions: ['orders'], active: true, lastLogin: null, locked: false, sessions: 0, password: '' })}>
          <Plus size={16} /> مستخدم جديد
        </button>
      </PageHead>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الصلاحيات</th>
              <th>الحالة</th>
              <th>آخر دخول</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.name}</b> {u.id === meId && <span className="a-badge a-badge--info">أنت</span>}
                  <div className="small muted" dir="ltr" style={{ textAlign: 'right' }}>{u.username}</div>
                </td>
                <td className="small">{u.permissions.map((p) => PERMISSION_LABELS[p].split(' (')[0]).join('، ')}</td>
                <td>
                  {u.active ? <span className="a-badge a-badge--ok">مفعل</span> : <span className="a-badge a-badge--danger">معطل</span>}
                  {u.locked && <span className="a-badge a-badge--warn">مقفل مؤقتاً</span>}
                </td>
                <td className="small muted">{u.lastLogin ? formatDateTime(u.lastLogin) : '—'}</td>
                <td>
                  <div className="a-row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                    <button type="button" className="a-icon-btn" aria-label="تعديل" onClick={() => setEdit(u)}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="a-icon-btn" aria-label="تعيين كلمة مرور" onClick={() => setPw({ id: u.id, name: u.name, password: '' })}>
                      <KeyRound size={16} />
                    </button>
                    {u.sessions > 0 && u.id !== meId && (
                      <button type="button" className="a-icon-btn" aria-label="تسجيل خروج من كل الأجهزة" title="تسجيل خروج من كل الأجهزة" onClick={() => run(() => api('DELETE', `users/${u.id}/sessions`), 'تم إنهاء الجلسات')}>
                        <LogOut size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? `تعديل ${edit.name}` : 'مستخدم جديد'} onClose={() => setEdit(null)}>
          <div className="a-form">
            {!edit.id && (
              <Field label="اسم المستخدم (للدخول)" hint="حروف إنجليزية وأرقام">
                <input className="a-input" dir="ltr" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} />
              </Field>
            )}
            <Field label="الاسم الظاهر">
              <input className="a-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            {!edit.id && (
              <Field label="كلمة المرور" hint="10 أحرف على الأقل، حروف وأرقام">
                <input className="a-input" dir="ltr" type="password" autoComplete="new-password" value={edit.password || ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
              </Field>
            )}
            <Field label="الصلاحيات">
              <div className="a-form" style={{ gap: 6 }}>
                {PERMISSIONS.map((p) => (
                  <label key={p} className="a-check">
                    <input type="checkbox" checked={edit.permissions.includes(p)} onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, p] : edit.permissions.filter((x) => x !== p) })} />
                    <span>{PERMISSION_LABELS[p]}</span>
                  </label>
                ))}
              </div>
            </Field>
            {!!edit.id && <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="الحساب مفعل" />}
            <button
              type="button"
              className="a-btn"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    (edit.id
                      ? api('PUT', `users/${edit.id}`, { name: edit.name, permissions: edit.permissions, active: edit.active })
                      : api('POST', 'users', { username: edit.username, name: edit.name, password: edit.password, permissions: edit.permissions })
                    ).then(() => setEdit(null)),
                  'تم الحفظ',
                )
              }
            >
              حفظ
            </button>
          </div>
        </Modal>
      )}
      {pw && (
        <Modal title={`كلمة مرور جديدة لـ ${pw.name}`} onClose={() => setPw(null)}>
          <div className="a-form">
            <input className="a-input" dir="ltr" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            <p className="small muted" style={{ margin: 0 }}>سيتم تسجيل خروج المستخدم من كل الأجهزة.</p>
            <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('POST', `users/${pw.id}/password`, { password: pw.password }).then(() => setPw(null)), 'تم تعيين كلمة المرور')}>
              حفظ
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
