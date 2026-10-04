import { requirePage } from '@/lib/server/auth'
import { db, parseJson } from '@/lib/server/db'
import { Coupons } from '@/components/admin/Coupons'

export const metadata = { title: 'كوبونات الخصم' }

export default async function CouponsPage() {
  await requirePage('owner')
  const rows = await db()
      .prepare("SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.coupon_id=c.id AND o.status<>'cancelled') AS used FROM coupons c ORDER BY c.id DESC")
      .all() as Record<string, unknown>[]
  const cats = await db().prepare('SELECT id, name FROM categories ORDER BY sort').all() as { id: number; name: string }[]
  return (
    <Coupons
      categories={cats}
      initial={rows.map((r) => ({
        id: r.id as number, code: r.code as string, description: (r.description as string) || '', type: r.type as 'percent' | 'fixed', value: r.value as number,
        minOrder: r.min_order as number | null, maxDiscount: r.max_discount as number | null, startsAt: r.starts_at as string | null, endsAt: r.ends_at as string | null,
        usageLimit: r.usage_limit as number | null, perCustomerLimit: r.per_customer_limit as number | null, categoryIds: parseJson<number[]>(r.category_ids as string, []),
        productIds: parseJson<number[]>(r.product_ids as string, []), combineWithSale: !!r.combine_with_sale, active: !!r.active, isDemo: !!r.is_demo, used: r.used as number,
      }))}
    />
  )
}
