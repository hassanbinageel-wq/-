'use client'

import { useState } from 'react'
import { api, useAction, confirmAction } from './ui'

export function CustomerNotes({ id, notes }: { id: number; notes: string }) {
  const [v, setV] = useState(notes)
  const { run, busy } = useAction()
  return (
    <div className="a-card a-form">
      <h2 style={{ margin: 0 }}>ملاحظات داخلية عن العميل</h2>
      <textarea className="a-textarea" value={v} onChange={(e) => setV(e.target.value)} />
      <button type="button" className="a-btn a-btn--soft" disabled={busy || v === notes} onClick={() => run(() => api('POST', `customers/${id}/notes`, { notes: v }), 'تم الحفظ')}>
        حفظ
      </button>
    </div>
  )
}

export function CustomerAccountBox({ account }: { account: { id: number; created: string; lastLogin: string | null } | null }) {
  const [pw, setPw] = useState('')
  const { run, busy } = useAction()
  if (!account) {
    return (
      <div className="a-card">
        <h2 style={{ margin: 0 }}>حساب العميل</h2>
        <p className="small muted" style={{ marginBottom: 0 }}>لم ينشئ العميل حساباً في المتجر بهذا الرقم.</p>
      </div>
    )
  }
  return (
    <div className="a-card a-form">
      <h2 style={{ margin: 0 }}>حساب العميل</h2>
      <p className="small" style={{ margin: 0 }}>
        أُنشئ في {account.created}
        {account.lastLogin ? ` — آخر دخول ${account.lastLogin}` : ''}
      </p>
      <p className="small muted" style={{ margin: 0 }}>
        إذا نسي العميل كلمة المرور: تأكد أنه يراسلك من نفس رقم الحساب عبر واتساب، ثم اكتب له كلمة مؤقتة وأرسلها له ليغيّرها من صفحة حسابه.
      </p>
      <input className="a-input" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة مرور جديدة (6 أحرف على الأقل)" autoComplete="off" />
      <button
        type="button"
        className="a-btn a-btn--soft"
        disabled={busy || pw.length < 6}
        onClick={() => confirmAction('تعيين كلمة مرور جديدة وإخراج العميل من أجهزته؟') && run(() => api('POST', `customer-accounts/${account.id}/password`, { password: pw }).then(() => setPw('')), 'تم تعيين كلمة المرور')}
      >
        تعيين كلمة مرور جديدة
      </button>
    </div>
  )
}
