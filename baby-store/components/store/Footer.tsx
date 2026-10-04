import Link from 'next/link'
import { Mail, MapPin, Phone, Clock } from 'lucide-react'
import type { Appearance } from '@/lib/shared/types'
import type { StoreSettings } from '@/lib/shared/types'
import { Wave, WhatsAppIcon, LogoMark, SocialIcon, Star } from './Deco'
import { formatIntl } from '@/lib/shared/phone'

export function Footer({ a, store, whatsapp }: { a: Appearance; store: StoreSettings; whatsapp: string }) {
  const social = (Object.entries(a.footer.social) as [keyof Appearance['footer']['social'], string][]).filter(([, v]) => v && /^https?:\/\//.test(v))
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <Wave className="footer__wave" />
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link href="/" className="logo" style={{ marginBottom: '0.6rem' }}>
              <LogoMark /> <span>{a.brand.name}</span>
            </Link>
            <p className="muted small" style={{ maxWidth: 360 }}>
              {a.footer.about}
            </p>
            <div className="stack small" style={{ marginTop: '0.8rem' }}>
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 8 }}>
                <WhatsAppIcon size={18} /> <bdi className="num">{formatIntl(whatsapp)}</bdi>
              </a>
              {store.phone && (
                <a href={`tel:${store.phone.replace(/[^\d+]/g, '')}`} className="row" style={{ gap: 8 }}>
                  <Phone size={17} /> <bdi className="num">{store.phone}</bdi>
                </a>
              )}
              {store.email && (
                <a href={`mailto:${store.email}`} className="row" style={{ gap: 8 }}>
                  <Mail size={17} /> {store.email}
                </a>
              )}
              {store.address && (
                <span className="row" style={{ gap: 8 }}>
                  <MapPin size={17} /> {store.address}
                </span>
              )}
              {store.workingHours && (
                <span className="row" style={{ gap: 8 }}>
                  <Clock size={17} /> {store.workingHours}
                </span>
              )}
            </div>
            {social.length > 0 && (
              <div className="social">
                {social.map(([k, v]) => (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer" aria-label={k}>
                    <SocialIcon name={k} />
                  </a>
                ))}
              </div>
            )}
          </div>
          {a.footer.columns.map((c) => (
            <div key={c.title}>
              <h3 className="row" style={{ gap: 6 }}>
                <Star size={13} style={{ color: 'var(--c-accent)' }} /> {c.title}
              </h3>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer__bottom">
          <span>
            © <span className="num">{year}</span> {a.brand.name} — {a.footer.copyright}
          </span>
          <span>الدفع بالتحويل البنكي/المحافظ وإرسال السند عبر واتساب</span>
        </div>
      </div>
    </footer>
  )
}
