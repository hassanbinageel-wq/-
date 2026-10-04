import Link from 'next/link'
import { Suspense } from 'react'
import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { getSetting } from '@/lib/server/settings'
import { normalizeArabic } from '@/lib/shared/arabic'
import { formatDateTime } from '@/lib/shared/dates'
import { MOVEMENT_REASON_LABELS } from '@/lib/shared/constants'
import { PageHead } from '@/components/admin/ui'
import { SearchInput, SelectFilter, PagerLinks, Toolbar } from '@/components/admin/UrlFilters'
import { StockAdjust } from '@/components/admin/StockAdjust'

export const metadata = { title: 'المخزون' }

type StockRow = { product_id: number; variant_id: number | null; name: string; sku: string; label: string | null; stock: number; threshold: number; status: string }

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage('products')
  const sp = await searchParams
  const tab = sp.tab === 'log' ? 'log' : 'stock'
  const store = await getSetting('store')
  const low = (await getSetting('inventory')).lowStockThreshold
  const d = db()
  let content: React.ReactNode
  if (tab === 'stock') {
    const q = normalizeArabic(sp.q || '')
    const rows = (await d
      .prepare(
        `SELECT * FROM (
      SELECT p.id AS product_id, NULL AS variant_id, p.name, p.sku, NULL AS label, p.stock, COALESCE(p.low_stock_threshold, ?) AS threshold, p.status, p.search_text
      FROM products p WHERE p.type='simple' AND p.track_stock=1 AND p.status<>'archived'
      UNION ALL
      SELECT p.id, v.id, p.name, v.sku, TRIM(COALESCE(v.option1,'') || ' ' || COALESCE(v.option2,'') || ' ' || COALESCE(v.option3,'')), v.stock, COALESCE(p.low_stock_threshold, ?), p.status, p.search_text || ' ' || lower(v.sku)
      FROM variants v JOIN products p ON p.id=v.product_id WHERE p.type='variable' AND p.track_stock=1 AND p.status<>'archived' AND v.active=1
    ) WHERE (? = '' OR search_text ILIKE ? OR sku ILIKE ?) ${sp.filter === 'low' ? 'AND stock <= threshold' : sp.filter === 'out' ? 'AND stock <= 0' : ''}
    ORDER BY stock ASC, name LIMIT 300`,
      )
      .all(low, low, q, `%${q}%`, `%${(sp.q || '').toUpperCase()}%`)) as StockRow[]
    content = (
      <>
        <Suspense>
          <Toolbar>
            <SearchInput placeholder="ابحث باسم المنتج أو رقمه" />
            <SelectFilter param="filter" label="كل الأرصدة" options={[{ value: 'low', label: 'منخفض' }, { value: 'out', label: 'نفد' }]} />
          </Toolbar>
        </Suspense>
        <div className="a-notice small" style={{ marginBottom: 10 }}>
          الرصيد المعروض هو الكمية المتاحة للبيع؛ الكميات المحجوزة لطلبات بانتظار التحويل مخصومة منه مسبقاً، وتعود تلقائياً عند انتهاء المهلة أو الإلغاء.
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الرقم</th>
                <th>الرصيد</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.product_id}-${r.variant_id}`}>
                  <td>
                    <Link className="rowlink" href={`/admin/products/${r.product_id}`}>
                      {r.name}
                    </Link>
                    {r.label && <div className="small muted">{r.label}</div>}
                  </td>
                  <td><bdi className="small">{r.sku}</bdi></td>
                  <td>
                    <span className={`a-badge ${r.stock <= 0 ? 'a-badge--danger' : r.stock <= r.threshold ? 'a-badge--warn' : 'a-badge--ok'}`}>
                      <span className="num">{r.stock}</span>
                    </span>
                  </td>
                  <td>
                    <StockAdjust productId={r.product_id} variantId={r.variant_id} label={`${r.name}${r.label ? ` (${r.label})` : ''}`} current={r.stock} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="a-empty">لا توجد نتائج</p>}
        </div>
      </>
    )
  } else {
    const page = Number(sp.page) || 1
    const where: string[] = []
    const args: unknown[] = []
    if (sp.reason) {
      where.push('reason=?')
      args.push(sp.reason)
    }
    if (sp.product) {
      where.push('product_id=?')
      args.push(Number(sp.product))
    }
    if (sp.q) {
      where.push('(product_name ILIKE ? OR sku ILIKE ?)')
      args.push(`%${sp.q}%`, `%${sp.q.toUpperCase()}%`)
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (await d.prepare(`SELECT COUNT(*) n FROM stock_movements ${w}`).get(...args) as { n: number }).n
    const rows = await d.prepare(`SELECT * FROM stock_movements ${w} ORDER BY id DESC LIMIT 50 OFFSET ?`).all(...args, (page - 1) * 50) as {
      id: number; product_id: number; product_name: string; sku: string; change: number; stock_after: number; reason: string; order_id: number | null; user_name: string | null; note: string | null; created_at: string
    }[]
    content = (
      <>
        <Suspense>
          <Toolbar>
            <SearchInput placeholder="اسم المنتج أو الرقم" />
            <SelectFilter param="reason" label="كل الأسباب" options={Object.entries(MOVEMENT_REASON_LABELS).map(([value, label]) => ({ value, label }))} />
          </Toolbar>
        </Suspense>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المنتج</th>
                <th>التغيير</th>
                <th>الرصيد بعدها</th>
                <th>السبب</th>
                <th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="small">{formatDateTime(m.created_at, store.timezone)}</td>
                  <td>
                    {m.product_name} <bdi className="small muted">{m.sku}</bdi>
                  </td>
                  <td className="num" style={{ color: m.change > 0 ? 'var(--a-ok)' : 'var(--a-danger)', fontWeight: 700 }}>
                    {m.change > 0 ? '+' : ''}
                    {m.change}
                  </td>
                  <td className="num">{m.stock_after}</td>
                  <td className="small">
                    {MOVEMENT_REASON_LABELS[m.reason] || m.reason}
                    {m.order_id && (
                      <>
                        {' '}
                        — <Link href={`/admin/orders/${m.order_id}`}>الطلب</Link>
                      </>
                    )}
                    {m.note && <div className="muted">{m.note}</div>}
                  </td>
                  <td className="small">{m.user_name || 'النظام'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="a-empty">لا توجد حركات</p>}
        </div>
        <Suspense>
          <PagerLinks page={page} pages={Math.max(1, Math.ceil(total / 50))} />
        </Suspense>
      </>
    )
  }
  return (
    <>
      <PageHead title="المخزون" subtitle="أرصدة المنتجات والخيارات وسجل كل حركة مع السبب والتاريخ" />
      <div className="a-tabs">
        <Link href="/admin/inventory" aria-current={tab === 'stock' ? 'page' : undefined}>
          الأرصدة
        </Link>
        <Link href="/admin/inventory?tab=log" aria-current={tab === 'log' ? 'page' : undefined}>
          سجل الحركة
        </Link>
      </div>
      {content}
    </>
  )
}
