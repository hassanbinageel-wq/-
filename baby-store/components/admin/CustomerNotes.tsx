'use client'

import { useState } from 'react'
import { api, useAction } from './ui'

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
