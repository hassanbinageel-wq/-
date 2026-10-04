import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getPublishedAppearance } from '@/lib/server/appearance'
import { getMedia } from '@/lib/server/media'
import { siteUrl } from '@/lib/server/settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const a = getPublishedAppearance()
  const fav = getMedia(a.brand.faviconId)
  const base = siteUrl()
  return {
    metadataBase: new URL(base),
    title: { default: `${a.brand.name} — ${a.brand.tagline}`, template: `%s | ${a.brand.name}` },
    description: a.brand.tagline,
    applicationName: a.brand.name,
    icons: fav
      ? {
          icon: [{ url: `/media/${fav.path}-32.png`, sizes: '32x32', type: 'image/png' }, { url: `/media/${fav.path}-512.png`, sizes: '512x512', type: 'image/png' }],
          apple: `/media/${fav.path}-180.png`,
        }
      : { icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }] },
    openGraph: { siteName: a.brand.name, locale: 'ar_YE', type: 'website' },
    formatDetection: { telephone: false },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const a = getPublishedAppearance()
  return { width: 'device-width', initialScale: 1, themeColor: /^#[0-9a-f]{3,8}$/i.test(a.theme.colors.bg) ? a.theme.colors.bg : '#ffffff' }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
