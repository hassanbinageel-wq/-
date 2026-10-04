import { requirePage } from '@/lib/server/auth'
import { PageHead } from '@/components/admin/ui'
import { CsvImport } from '@/components/admin/CsvImport'
import { PRODUCT_COLUMNS, COLUMN_HELP } from '@/lib/server/csv'

export const metadata = { title: 'استيراد وتصدير' }

export default async function ImportPage() {
  await requirePage('products')
  return (
    <>
      <PageHead title="استيراد وتصدير المنتجات (CSV)" subtitle="عدّل المنتجات بالجملة في Excel أو Google Sheets ثم استوردها بعد معاينة الأخطاء">
        <a className="a-btn a-btn--ghost" href="/api/admin/products/template">
          تحميل نموذج فارغ
        </a>
        <a className="a-btn a-btn--ghost" href="/api/admin/products/export">
          تصدير كل المنتجات
        </a>
      </PageHead>
      <div className="a-grid a-grid--side">
        <CsvImport />
        <div className="a-card">
          <h2>الأعمدة</h2>
          <ul className="small" style={{ margin: 0, paddingInlineStart: '1rem' }}>
            {PRODUCT_COLUMNS.map((c) => (
              <li key={c}>
                <bdi>{c}</bdi>
                {COLUMN_HELP[c] && <span className="muted"> — {COLUMN_HELP[c]}</span>}
              </li>
            ))}
          </ul>
          <p className="small muted">
            الأسطر من نوع variant تتبع منتجاً من نوع variable عبر parent_sku. المنتج الموجود (نفس الرقم) يُحدَّث، والجديد يُنشأ كما في الملف. الصور والباقات تُدار من صفحة المنتج. احفظ الملف بترميز UTF-8.
          </p>
        </div>
      </div>
    </>
  )
}
