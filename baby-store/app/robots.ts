import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/server/settings'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/order/', '/cart', '/checkout', '/favorites'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
