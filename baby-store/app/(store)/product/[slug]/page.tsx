import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown, Clock, Gift, Layers, PenLine, Package } from 'lucide-react'
import { getProductDetailBySlug, relatedCards } from '@/lib/server/catalog'
import { getStoreContext } from '@/lib/server/storefront'
import { getSetting } from '@/lib/server/settings'
import { Markdown, plainText } from '@/lib/shared/markdown'
import { formatMoney } from '@/lib/shared/money'
import { ProductMain } from '@/components/store/ProductMain'
import { ProductSection } from '@/components/store/Sections'
import { RecentlyViewed } from '@/components/store/RecentlyViewed'

type Props = { params: Promise<{ slug: string }> }

async function load(slug: string) {
  const ctx = await getStoreContext()
  const p = await getProductDetailBySlug(decodeURIComponent(slug), { includeUnpublished: ctx.isAdmin })
  return { p, ctx }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { p } = await load((await params).slug)
  if (!p) return { title: 'المنتج غير موجود' }
  const desc = p.seoDescription || p.shortDescription || plainText(p.description)
  return {
    title: p.seoTitle || p.name,
    description: desc,
    alternates: { canonical: `/product/${encodeURIComponent(p.slug)}` },
    openGraph: { title: p.name, description: desc, images: p.images.slice(0, 3).map((i) => ({ url: i.url, width: i.w || undefined, height: i.h || undefined })), type: 'website' },
    robots: p.isDemo ? { index: false } : undefined,
  }
}

function days(min: number | null, max: number | null) {
  if (min == null && max == null) return null
  if (min != null && max != null && max > min) return `${min} - ${max} أيام عمل`
  return `${max ?? min} أيام عمل`
}

export default async function ProductPage({ params }: Props) {
  const { p, ctx } = await load((await params).slug)
  if (!p) notFound()
  const store = await getSetting('store')
  const url = `${ctx.origin}/product/${encodeURIComponent(p.slug)}`
  const complementary = await relatedCards(p.id, 'complementary', 8)
  const related = (await relatedCards(p.id, 'related', 8)).filter((c) => !complementary.some((x) => x.id === c.id))
  const prep = days(p.prepDaysMin, p.prepDaysMax)
  const gifts = await getSetting('gifts')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    image: p.images.map((i) => `${ctx.origin}${i.url}`),
    description: p.shortDescription || plainText(p.description, 300),
    category: p.category?.name,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: store.currency.code,
      price: (p.price / 100).toFixed(Math.min(2, store.currency.decimals)),
      availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }

  const header = (
    <>
      <nav className="crumbs" aria-label="مسار التنقل">
        <Link href="/">الرئيسية</Link>
        <span aria-hidden="true">‹</span>
        {p.category ? <Link href={`/category/${encodeURIComponent(p.category.slug)}`}>{p.category.name}</Link> : <Link href="/products">المنتجات</Link>}
      </nav>
      {ctx.isAdmin && p && (
        <div className="notice notice--info small" style={{ marginBottom: 8 }}>
          أنت مسجل كموظف.{' '}
          <Link className="link" href={`/admin/products/${p.id}`}>
            تعديل المنتج
          </Link>
        </div>
      )}
      <h1 className="pdp__title">{p.name}</h1>
      <div className="pdp__meta">
        <span>
          رقم المنتج: <bdi className="num">{p.sku}</bdi>
        </span>
        {p.type === 'bundle' && <span className="badge badge--bundle">باقة</span>}
        {p.isDemo && <span className="badge badge--demo">منتج تجريبي</span>}
        {p.tags.slice(0, 3).map((t) => (
          <Link key={t.id} className="badge" href={`/collection/${encodeURIComponent(t.slug)}`} style={{ background: 'var(--c-soft)' }}>
            {t.name}
          </Link>
        ))}
      </div>
      {p.shortDescription && <p className="pdp__short" style={{ marginTop: '0.6rem' }}>{p.shortDescription}</p>}
    </>
  )

  const facts = [
    p.piecesCount ? { icon: Layers, text: `${p.piecesCount} قطع` } : null,
    prep ? { icon: Clock, text: `التجهيز: ${prep}` } : null,
    p.personalization ? { icon: PenLine, text: `يدعم كتابة ${p.personalization.label}` } : null,
    p.giftWrapEligible && gifts.giftOrderEnabled && gifts.giftWrapEnabled ? { icon: Gift, text: 'متاح تغليف الهدايا' } : null,
  ].filter(Boolean) as { icon: typeof Clock; text: string }[]

  const details = (
    <>
      {facts.length > 0 && (
        <div className="facts">
          {facts.map((f) => (
            <span className="fact" key={f.text}>
              <f.icon size={18} /> {f.text}
            </span>
          ))}
        </div>
      )}
      <div className="accordion">
        {p.description && (
          <details open>
            <summary>
              الوصف <ChevronDown size={18} />
            </summary>
            <div className="acc-body">
              <Markdown text={p.description} />
            </div>
          </details>
        )}
        {p.setContents.length > 0 && (
          <details open={!p.description}>
            <summary>
              محتويات الطقم{p.piecesCount ? ` (${p.piecesCount} قطع)` : ''} <ChevronDown size={18} />
            </summary>
            <div className="acc-body">
              <ul className="prose" style={{ margin: 0 }}>
                {p.setContents.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </details>
        )}
        {p.type === 'bundle' && p.components.length > 0 && (
          <details>
            <summary>
              مكونات الباقة <ChevronDown size={18} />
            </summary>
            <div className="acc-body">
              <ul className="prose" style={{ margin: 0 }}>
                {p.components.map((c) => (
                  <li key={c.id}>
                    <Link className="link" href={`/product/${encodeURIComponent(c.slug)}`}>
                      {c.name}
                    </Link>{' '}
                    × {c.qty}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
        {(p.material || p.careInstructions) && (
          <details>
            <summary>
              الخامة والعناية <ChevronDown size={18} />
            </summary>
            <div className="acc-body">
              {p.material && (
                <p>
                  <b>الخامة: </b>
                  {p.material}
                </p>
              )}
              {p.careInstructions && (
                <p style={{ whiteSpace: 'pre-line' }}>
                  <b>العناية والغسيل: </b>
                  {p.careInstructions}
                </p>
              )}
            </div>
          </details>
        )}
        {(prep || p.personalization) && (
          <details>
            <summary>
              التجهيز والتخصيص <ChevronDown size={18} />
            </summary>
            <div className="acc-body">
              {prep && <p>مدة التجهيز المتوقعة: {prep}.</p>}
              {p.personalization && (
                <p>
                  يمكن كتابة {p.personalization.label} (حتى {p.personalization.maxLength} حرفاً)
                  {p.personalization.fee > 0 && <> برسوم {formatMoney(p.personalization.fee, store.currency)} للقطعة</>}
                  {p.personalization.extraDays > 0 && <>، ويضيف {p.personalization.extraDays} يوم عمل لمدة التجهيز</>}.
                </p>
              )}
            </div>
          </details>
        )}
        <details>
          <summary>
            الطلب والدفع <ChevronDown size={18} />
          </summary>
          <div className="acc-body">
            <p>
              <Package size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> بعد تأكيد الطلب تظهر لك وسائل التحويل والمبلغ المطلوب، ثم ترسل تفاصيل الطلب وصورة سند التحويل عبر واتساب. يراجع فريق المتجر الدفع يدوياً.{' '}
              <Link className="link" href="/pages/how-to-order">
                التفاصيل
              </Link>
            </p>
          </div>
        </details>
      </div>
    </>
  )

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="container">
        {p.status !== 'published' && <div className="notice notice--warn" style={{ marginTop: 12 }}>هذا المنتج غير منشور ({p.status === 'draft' ? 'مسودة' : 'مؤرشف'}) — تراه لأنك مسجل في لوحة التحكم.</div>}
        <ProductMain p={p} productUrl={url} header={header} details={details} />
      </div>
      <ProductSection title="منتجات مكملة" subtitle="تكمل الإطلالة أو الهدية — اختر ما يناسبك" items={complementary} soft />
      <ProductSection title="قد يعجبك أيضاً" items={related} />
      <RecentlyViewed title="شاهدت مؤخراً" excludeId={p.id} />
    </>
  )
}
