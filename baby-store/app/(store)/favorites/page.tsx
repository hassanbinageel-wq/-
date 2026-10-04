import type { Metadata } from 'next'
import { FavoritesView } from '@/components/store/FavoritesView'
import { SectionTitle } from '@/components/store/Sections'
import { RecentlyViewed } from '@/components/store/RecentlyViewed'

export const metadata: Metadata = { title: 'المفضلة', robots: { index: false } }

export default function FavoritesPage() {
  return (
    <>
      <div className="container" style={{ paddingTop: '1.4rem', paddingBottom: '2rem' }}>
        <SectionTitle title="المفضلة" subtitle="منتجات حفظتها على هذا الجهاز" as="h1" />
        <FavoritesView />
      </div>
      <RecentlyViewed title="شاهدت مؤخراً" />
    </>
  )
}
