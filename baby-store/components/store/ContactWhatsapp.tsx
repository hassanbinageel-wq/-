'use client'

import { useState } from 'react'
import { WhatsAppIcon } from './Deco'
import { waLink } from '@/lib/shared/phone'

/** نموذج يجهز رسالة واتساب (لا يرسل شيئاً من الموقع؛ تُفتح المحادثة للإرسال اليدوي) */
export function ContactWhatsapp({ number }: { number: string }) {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const text = `مرحباً، معك ${name || '...'}\n${msg}`
  return (
    <form
      className="form-grid"
      style={{ marginTop: '1rem' }}
      onSubmit={(e) => {
        e.preventDefault()
        window.open(waLink(number, text), '_blank', 'noopener,noreferrer')
      }}
    >
      <div className="field">
        <label htmlFor="cn">الاسم</label>
        <input id="cn" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="cm">رسالتك</label>
        <textarea id="cm" className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} required maxLength={1000} />
      </div>
      <button className="btn btn--wa">
        <WhatsAppIcon /> متابعة عبر واتساب
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        سيفتح واتساب برسالتك جاهزة، واضغط «إرسال» داخل التطبيق لإرسالها.
      </p>
    </form>
  )
}
