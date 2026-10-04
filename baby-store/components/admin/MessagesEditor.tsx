'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api, useAction, PageHead, Field } from './ui'
import type { MessageTemplate } from '@/lib/shared/types'

export function MessagesEditor({ initial, variables }: { initial: MessageTemplate[]; variables: Record<string, string> }) {
  const [list, setList] = useState(initial)
  const { run, busy } = useAction()
  return (
    <>
      <PageHead title="رسائل واتساب الجاهزة" subtitle="قوالب يستخدمها الموظفون من صفحة الطلب. تُفتح للمراجعة والإرسال اليدوي ولا تُرسل تلقائياً.">
        <button type="button" className="a-btn" disabled={busy} onClick={() => run(() => api('PUT', 'settings/messages', list), 'تم حفظ القوالب')}>
          حفظ القوالب
        </button>
      </PageHead>
      <div className="a-grid a-grid--side">
        <div className="a-grid">
          {list.map((m, i) => (
            <div key={m.key} className="a-card a-form">
              <div className="a-row">
                <input className="a-input a-grow" value={m.title} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} aria-label="عنوان القالب" />
                <button type="button" className="a-icon-btn" aria-label="حذف القالب" onClick={() => setList(list.filter((_, k) => k !== i))}>
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea className="a-textarea" rows={7} value={m.body} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)))} aria-label="نص القالب" />
            </div>
          ))}
          <button type="button" className="a-btn a-btn--ghost" onClick={() => setList([...list, { key: `custom_${Date.now()}`, title: 'قالب جديد', body: 'مرحباً {customer_name}،\n' }])}>
            <Plus size={16} /> قالب جديد
          </button>
        </div>
        <div className="a-card">
          <h2>المتغيرات المتاحة</h2>
          <Field label="انسخ المتغير كما هو داخل النص">
            <ul className="small" style={{ margin: 0, paddingInlineStart: '1rem' }}>
              {Object.entries(variables).map(([k, v]) => (
                <li key={k}>
                  <code dir="ltr">{`{${k}}`}</code> — {v}
                </li>
              ))}
            </ul>
          </Field>
          <p className="small muted">ملاحظة: إذا حذفت قالباً أساسياً سيعود تلقائياً بنصه الافتراضي.</p>
        </div>
      </div>
    </>
  )
}
