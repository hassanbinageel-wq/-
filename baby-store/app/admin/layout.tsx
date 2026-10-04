import type { Metadata } from 'next'
import './admin.css'
import { adminFontCss } from '@/lib/server/theme-css'

export const metadata: Metadata = { title: { default: 'لوحة التحكم', template: '%s | لوحة التحكم' }, robots: { index: false, follow: false } }

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <style dangerouslySetInnerHTML={{ __html: adminFontCss() }} />
      {children}
    </div>
  )
}
