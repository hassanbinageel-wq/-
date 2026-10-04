import type { Metadata } from 'next'
import { CartView } from '@/components/store/CartView'
import { SectionTitle } from '@/components/store/Sections'

export const metadata: Metadata = { title: 'السلة', robots: { index: false } }

export default function CartPage() {
  return (
    <div className="container" style={{ paddingTop: '1.4rem' }}>
      <ol className="steps" aria-label="خطوات الطلب">
        <li className="is-current">السلة</li>
        <li>البيانات</li>
        <li>المراجعة</li>
        <li>التحويل</li>
      </ol>
      <SectionTitle title="سلة التسوق" as="h1" />
      <CartView />
    </div>
  )
}
