import { Suspense } from 'react'
import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { getSetting } from '@/lib/server/settings'
import { formatDateTime } from '@/lib/shared/dates'
import { PageHead } from '@/components/admin/ui'
import { SearchInput, PagerLinks, Toolbar } from '@/components/admin/UrlFilters'

export const metadata = { title: 'سجل الإجراءات' }

const ACTIONS: Record<string, string> = {
  login: 'تسجيل دخول', login_failed: 'محاولة دخول فاشلة', logout: 'تسجيل خروج', order_status: 'تغيير حالة طلب', payment_status: 'تغيير حالة دفع', payment_record: 'تسجيل تحويل',
  payment_delete: 'حذف تحويل', receipt_upload: 'إرفاق سند', receipt_view: 'عرض سند', refund: 'استرداد', return: 'مرتجع', shipping: 'بيانات شحن', product_create: 'إنشاء منتج',
  product_update: 'تعديل منتج', product_delete: 'حذف منتج', product_duplicate: 'نسخ منتج', products_bulk: 'تعديل جماعي', stock_adjust: 'تعديل مخزون', products_import: 'استيراد CSV',
  products_export: 'تصدير منتجات', orders_export: 'تصدير طلبات', settings_update: 'تعديل إعدادات', appearance_publish: 'نشر المظهر', appearance_discard: 'تجاهل مسودة المظهر',
  appearance_restore: 'استعادة نسخة مظهر', user_create: 'إنشاء مستخدم', user_update: 'تعديل مستخدم', user_password_reset: 'إعادة تعيين كلمة مرور', password_change: 'تغيير كلمة المرور',
  backup_create: 'نسخة احتياطية', backup_restore: 'استعادة نسخة احتياطية', backup_download: 'تنزيل نسخة احتياطية', demo_delete: 'حذف البيانات التجريبية',
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage('owner')
  const sp = await searchParams
  const page = Number(sp.page) || 1
  const q = sp.q ? `%${sp.q}%` : null
  const where = q ? 'WHERE user_name ILIKE ? OR action ILIKE ? OR entity_id ILIKE ? OR details ILIKE ?' : ''
  const args = q ? [q, q, q, q] : []
  const total = (await db().prepare(`SELECT COUNT(*) n FROM audit_log ${where}`).get(...args) as { n: number }).n
  const rows = await db().prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT 50 OFFSET ?`).all(...args, (page - 1) * 50) as {
    id: number; user_name: string | null; action: string; entity: string | null; entity_id: string | null; details: string | null; ip: string | null; created_at: string
  }[]
  const tz = (await getSetting('store')).timezone
  return (
    <>
      <PageHead title="سجل الإجراءات المهمة" subtitle="من فعل ماذا ومتى (للمالك فقط)" />
      <Suspense>
        <Toolbar>
          <SearchInput placeholder="ابحث باسم المستخدم أو الإجراء أو الرقم" />
        </Toolbar>
      </Suspense>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>المستخدم</th>
              <th>الإجراء</th>
              <th>العنصر</th>
              <th>تفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small">{formatDateTime(r.created_at, tz)}</td>
                <td>{r.user_name || '—'}</td>
                <td>{ACTIONS[r.action] || r.action}</td>
                <td className="small">
                  {r.entity} {r.entity_id && <bdi>#{r.entity_id}</bdi>}
                </td>
                <td className="small muted" style={{ maxWidth: 360, wordBreak: 'break-word' }} dir="ltr">
                  {r.details?.slice(0, 200)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Suspense>
        <PagerLinks page={page} pages={Math.max(1, Math.ceil(total / 50))} />
      </Suspense>
    </>
  )
}
