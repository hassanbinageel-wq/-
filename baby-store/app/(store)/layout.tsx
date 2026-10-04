import Link from 'next/link'
import { getStoreContext, visibleCategories, announcementFor, logoUrl, sweep } from '@/lib/server/storefront'
import { getSetting, storeWhatsapp } from '@/lib/server/settings'
import { themeCss } from '@/lib/server/theme-css'
import { StoreProvider } from '@/components/store/StoreProvider'
import { Header } from '@/components/store/Header'
import { Footer } from '@/components/store/Footer'
import { CartDrawer } from '@/components/store/CartDrawer'
import { QuickView } from '@/components/store/ProductMain'
import { SkyDecor, WhatsAppIcon, LogoMark } from '@/components/store/Deco'
import { waLink } from '@/lib/shared/phone'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await sweep()
  const ctx = await getStoreContext()
  const { a } = ctx
  const maintenance = await getSetting('maintenance')
  const css = await themeCss(a)
  const wa = await storeWhatsapp()

  if (maintenance.enabled && !ctx.isAdmin) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <main className="maintenance">
          <SkyDecor enabled />
          <div className="card stack">
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <LogoMark size={64} />
            </div>
            <h1 style={{ fontSize: '1.6rem' }}>{maintenance.title}</h1>
            <p className="muted">{maintenance.message}</p>
            <a className="btn btn--wa" href={waLink(wa)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> تواصل معنا عبر واتساب
            </a>
          </div>
        </main>
      </>
    )
  }

  const cats = (await visibleCategories()).map((c) => ({ name: c.name, slug: c.slug }))
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <StoreProvider config={ctx.config}>
        <a href="#main" className="sr-only">
          تخطي إلى المحتوى
        </a>
        <Header
          name={a.brand.name}
          logoUrl={await logoUrl(a)}
          menu={a.header.menu}
          categories={cats}
          announcement={announcementFor(a)}
          whatsappUrl={waLink(wa, `مرحباً ${a.brand.name}،`)}
        />
        <main id="main">{children}</main>
        <Footer a={a} store={await getSetting('store')} whatsapp={wa} />
        <CartDrawer />
        <QuickView />
        {ctx.preview && (
          <div className="preview-bar no-print">
            <span>معاينة المسودة — لم تُنشر بعد</span>
            <Link className="btn btn--white btn--sm" href="/api/admin/preview?exit=1" prefetch={false}>
              إنهاء المعاينة
            </Link>
          </div>
        )}
        {!ctx.preview && maintenance.enabled && ctx.isAdmin && (
          <div className="preview-bar no-print">
            <span>وضع الصيانة مفعل: الزوار يرون رسالة الصيانة</span>
            <Link className="btn btn--white btn--sm" href="/admin/settings?tab=maintenance">
              الإعدادات
            </Link>
          </div>
        )}
      </StoreProvider>
    </>
  )
}
