'use client'

import { useState } from 'react'
import { api, useAction, Field } from './ui'

export function AccountForm() {
  const [f, setF] = useState({ current: '', next: '', again: '' })
  const { run, busy } = useAction()
  return (
    <div className="a-card a-form">
      <h2 style={{ margin: 0 }}>تغيير كلمة المرور</h2>
      <Field label="كلمة المرور الحالية">
        <input className="a-input" dir="ltr" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      </Field>
      <Field label="الجديدة" hint="10 أحرف على الأقل، حروف وأرقام">
        <input className="a-input" dir="ltr" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      </Field>
      <Field label="تأكيد الجديدة" error={f.again && f.again !== f.next ? 'غير متطابقة' : undefined}>
        <input className="a-input" dir="ltr" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
      </Field>
      <button type="button" className="a-btn" disabled={busy || !f.current || !f.next || f.next !== f.again} onClick={() => run(() => api('POST', 'account/password', { current: f.current, next: f.next }).then(() => setF({ current: '', next: '', again: '' })), 'تم تغيير كلمة المرور وتسجيل خروج الأجهزة الأخرى')}>
        حفظ
      </button>
    </div>
  )
}
