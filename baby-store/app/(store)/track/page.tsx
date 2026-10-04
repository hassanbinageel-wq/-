import type { Metadata } from 'next'
import { TrackForm } from '@/components/store/TrackForm'
import { SectionTitle } from '@/components/store/Sections'

export const metadata: Metadata = { title: 'تتبع طلبك' }

export default function TrackPage() {
  return (
    <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '3rem', maxWidth: 560 }}>
      <SectionTitle title="تتبع طلبك" subtitle="أدخل رقم الطلب ورقم واتساب الذي استخدمته عند الطلب" as="h1" />
      <TrackForm />
    </div>
  )
}
