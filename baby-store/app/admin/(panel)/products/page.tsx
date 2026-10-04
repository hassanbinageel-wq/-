import Link from 'next/link'
import { Suspense } from 'react'
import { Plus, Gift } from 'lucide-react'
import { requirePage } from '@/lib/server/auth'
import { listAdminProducts } from '@/lib/server/admin/queries'
import { db } from '@/lib/server/db'
import { PageHead } from '@/components/admin/ui'
import { SearchInput, SelectFilter, PagerLinks, Toolbar } from '@/components/admin/UrlFilters'
import { ProductsTable } from '@/components/admin/ProductsTable'

export const metadata = { title: 'المنتجات' }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage('products')
  const sp = await searchParams
  const r = listAdminProducts({ q: sp.q, status: sp.status, category: Number(sp.category) || undefined, type: sp.type, stock: sp.stock, page: Number(sp.page) || 1 })
  const cats = db().prepare('SELECT id, name FROM categories ORDER BY sort').all() as { id: number; name: string }[]
  return (
    <>
      <PageHead title="المنتجات والباقات" subtitle={<span className="num">{r.total} منتج</span>}>
        <Link className="a-btn a-btn--ghost" href="/admin/products/new?type=bundle">
          <Gift size={16} /> باقة جديدة
        </Link>
        <Link className="a-btn" href="/admin/products/new">
          <Plus size={16} /> منتج جديد
        </Link>
      </PageHead>
      <Suspense>
        <Toolbar>
          <SearchInput placeholder="ابحث بالاسم أو رقم المنتج" />
          <SelectFilter param="status" label="المنشور والمسودات" options={[{ value: 'published', label: 'منشور' }, { value: 'draft', label: 'مسودة' }, { value: 'archived', label: 'مؤرشف' }]} />
          <SelectFilter param="category" label="كل الأقسام" options={cats.map((c) => ({ value: String(c.id), label: c.name }))} />
          <SelectFilter param="type" label="كل الأنواع" options={[{ value: 'simple', label: 'بسيط' }, { value: 'variable', label: 'بخيارات' }, { value: 'bundle', label: 'باقة' }]} />
          <SelectFilter param="stock" label="كل المخزون" options={[{ value: 'low', label: 'منخفض' }, { value: 'out', label: 'نفد' }]} />
        </Toolbar>
      </Suspense>
      <ProductsTable rows={r.rows} categories={cats} />
      <Suspense>
        <PagerLinks page={r.page} pages={r.pages} />
      </Suspense>
    </>
  )
}
