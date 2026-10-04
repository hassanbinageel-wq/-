import Link from 'next/link'
import { Gift, Truck, Wallet, Sparkles, Heart, Baby } from 'lucide-react'
import { getStoreContext, visibleCategories } from '@/lib/server/storefront'
import { listProducts, cardsByIds, railItems } from '@/lib/server/catalog'
import { getMediaMap, imageRef, imageRefById } from '@/lib/server/media'
import { db } from '@/lib/server/db'
import { isScheduledActive } from '@/lib/shared/theme'
import { Markdown } from '@/lib/shared/markdown'
import { Hero, type HeroSlide } from '@/components/store/Hero'
import { Rail } from '@/components/store/Rail'
import { ProductSection, SectionTitle } from '@/components/store/Sections'
import { RecentlyViewed } from '@/components/store/RecentlyViewed'
import { Star, Moon, Cloud, Bear, WhatsAppIcon } from '@/components/store/Deco'
import type { HomeSection } from '@/lib/shared/types'

const PILL_BG = ['var(--c-pink)', 'var(--c-blue)', 'var(--c-green)', 'var(--c-yellow)']
const PILL_ICONS = [Star, Moon, Cloud, Bear]
const FEATURE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  gift: Gift,
  truck: Truck,
  transfer: Wallet,
  whatsapp: WhatsAppIcon,
  sparkles: Sparkles,
  heart: Heart,
  baby: Baby,
}

async function renderSection(s: HomeSection, decorations: boolean) {
  switch (s.type) {
    case 'rail': {
      const items = await railItems(s.productIds, s.limit || 10)
      if (!items.length) return null
      return <Rail key={s.id} items={items} kicker={s.title} subtitle={s.subtitle} buttonText={s.buttonText} buttonLink={s.buttonLink} />
    }
    case 'hero': {
      const active = s.banners.filter((b) => b.enabled && isScheduledActive(b.startsAt, b.endsAt))
      const media = await getMediaMap(active.flatMap((b) => [b.imageDesktopId, b.imageMobileId]))
      const slides: HeroSlide[] = active.map((b) => ({
          id: b.id,
          title: b.title,
          text: b.text,
          buttonText: b.buttonText,
          link: b.link,
          align: b.align,
          tone: b.tone,
          desktop: imageRef(media.get(b.imageDesktopId!), b.title, null, 1600),
          mobile: imageRef(media.get(b.imageMobileId!), b.title, null, 640),
        }))
      return <Hero key={s.id} slides={slides} decorations={decorations} />
    }
    case 'categories': {
      const cats = (await visibleCategories()).slice(0, s.limit || 10)
      if (!cats.length) return null
      const media = await getMediaMap(cats.map((c) => c.image_id))
      return (
        <section key={s.id} className="section">
          <div className="container">
            <SectionTitle title={s.title || 'الأقسام'} subtitle={s.subtitle} more={s.buttonLink || undefined} moreLabel={s.buttonText || undefined} />
            <div className="cat-grid">
              {cats.map((c, i) => {
                const img = imageRef(media.get(c.image_id!), c.name, null, 640)
                return (
                  <Link key={c.id} href={`/category/${encodeURIComponent(c.slug)}`} className="cat-card reveal" style={{ ['--d' as string]: `${i * 60}ms` }}>
                    <div className="cat-card__img">{img && <img src={img.url} srcSet={img.srcset} sizes="(min-width:1024px) 20vw, 50vw" alt="" loading="lazy" />}</div>
                    <div className="cat-card__name">
                      {c.name} <small className="num">{c.count}</small>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )
    }
    case 'tag_group': {
      if (!s.tagGroupId) return null
      const tags = await db()
           .prepare(
             `SELECT t.id, t.name, t.slug, t.description, (SELECT COUNT(*) FROM product_tags pt JOIN products p ON p.id=pt.product_id WHERE pt.tag_id=t.id AND p.status='published') AS count
        FROM tags t WHERE t.group_id=? AND t.visible=1 ORDER BY t.sort, t.id`,
           )
           .all(s.tagGroupId) as { id: number; name: string; slug: string; description: string | null; count: number }[]
      const list = tags.filter((t) => t.count > 0)
      if (!list.length) return null
      return (
        <section key={s.id} className="section" style={{ paddingTop: '0.6rem' }}>
          <div className="container">
            <SectionTitle title={s.title || 'تسوق حسب'} subtitle={s.subtitle} />
            <div className="pill-row">
              {list.map((t, i) => {
                const Icon = PILL_ICONS[i % PILL_ICONS.length]
                return (
                  <Link key={t.id} href={`/collection/${encodeURIComponent(t.slug)}`} className="tag-pill reveal" style={{ ['--pill-bg' as string]: PILL_BG[i % PILL_BG.length], ['--d' as string]: `${i * 60}ms` }}>
                    <span className="tag-pill__icon">
                      <Icon size={22} />
                    </span>
                    <span>
                      <b>{t.name}</b>
                      <span className="num">{t.count} منتج</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )
    }
    case 'new': {
      const items = (await listProducts({ sort: 'newest', perPage: s.limit || 8 })).items
      return <ProductSection key={s.id} title={s.title || 'وصل حديثاً'} subtitle={s.subtitle} items={items} more={s.buttonLink || '/products?sort=newest'} moreLabel={s.buttonText || undefined} layout={s.layout} />
    }
    case 'featured': {
      const items = (await cardsByIds(s.productIds)).slice(0, s.limit || 12)
      return <ProductSection key={s.id} title={s.title || 'منتجات مميزة'} subtitle={s.subtitle} items={items} more={s.buttonLink || undefined} moreLabel={s.buttonText || undefined} layout={s.layout} soft />
    }
    case 'offers': {
      const items = (await listProducts({ sale: true, perPage: s.limit || 8 })).items
      return <ProductSection key={s.id} title={s.title || 'العروض'} subtitle={s.subtitle} items={items} more={s.buttonLink || '/products?sale=1'} moreLabel={s.buttonText || undefined} layout={s.layout} />
    }
    case 'bundles': {
      const items = (await listProducts({ type: 'bundle', perPage: s.limit || 8 })).items
      return <ProductSection key={s.id} title={s.title || 'باقات الهدايا'} subtitle={s.subtitle} items={items} more={s.buttonLink || '/products?type=bundle'} moreLabel={s.buttonText || undefined} layout={s.layout} soft />
    }
    case 'promo': {
      const b = s.banners.find((x) => x.enabled && isScheduledActive(x.startsAt, x.endsAt))
      if (!b) return null
      const img = await imageRefById(b.imageDesktopId, b.title, 1600)
      const mob = await imageRefById(b.imageMobileId, b.title, 640)
      return (
        <section key={s.id} className="section">
          <div className="container">
            <div className="promo reveal">
              {(img || mob) && (
                <picture>
                  {mob && <source media="(max-width: 767px)" srcSet={mob.srcset} />}
                  <img src={(img || mob)!.url} srcSet={(img || mob)!.srcset} sizes="100vw" alt="" loading="lazy" />
                </picture>
              )}
              <div className="promo__content" style={b.tone === 'light' ? { color: '#fff' } : undefined}>
                {b.title && <h2>{b.title}</h2>}
                {b.text && <p>{b.text}</p>}
                {b.buttonText && b.link && (
                  <Link className="btn" href={b.link}>
                    {b.buttonText}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )
    }
    case 'features': {
      if (!s.items.length) return null
      return (
        <section key={s.id} className="section" style={{ paddingBlock: '1.2rem' }}>
          <div className="container features">
            {s.items.map((f, i) => {
              const Icon = FEATURE_ICONS[f.icon] || Sparkles
              return (
                <div key={i} className="feature reveal" style={{ ['--d' as string]: `${i * 70}ms` }}>
                  <span className="feature__icon">
                    <Icon size={22} />
                  </span>
                  <span>
                    <b>{f.title}</b>
                    <span>{f.text}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )
    }
    case 'recently_viewed':
      return <RecentlyViewed key={s.id} title={s.title || 'شاهدت مؤخراً'} subtitle={s.subtitle} />
    case 'text':
      if (!s.body) return null
      return (
        <section key={s.id} className="section">
          <div className="container">
            {s.title && <SectionTitle title={s.title} subtitle={s.subtitle} />}
            <Markdown text={s.body} />
          </div>
        </section>
      )
    default:
      return null
  }
}

export default async function HomePage() {
  const { a } = await getStoreContext()
  const sections = a.home.sections.filter((s) => s.enabled && isScheduledActive(s.startsAt, s.endsAt))
  const hasHero = sections.some((s) => s.type === 'hero')
  return (
    <>
      {!hasHero && <h1 className="sr-only">{a.brand.name}</h1>}
      {sections.map((s) => renderSection(s, a.theme.decorations))}
    </>
  )
}
