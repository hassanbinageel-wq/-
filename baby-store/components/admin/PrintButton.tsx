'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button type="button" className="a-btn" onClick={() => window.print()}>
      <Printer size={16} /> طباعة / حفظ PDF
    </button>
  )
}
