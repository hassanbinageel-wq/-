import type { Metadata } from 'next'
import { Mail, MapPin, Phone, Clock } from 'lucide-react'
import { getPage } from '@/lib/server/pages'
import { getSetting, storeWhatsapp } from '@/lib/server/settings'
import { Markdown } from '@/lib/shared/markdown'
import { SectionTitle } from '@/components/store/Sections'
import { WhatsAppIcon } from '@/components/store/Deco'
import { formatIntl, waLink } from '@/lib/shared/phone'
import { ContactWhatsapp } from '@/components/store/ContactWhatsapp'

export const metadata: Metadata = { title: 'تواصل معنا' }

export default async function ContactPage() {
  const page = await getPage('contact')
  const store = await getSetting('store')
  const wa = await storeWhatsapp()
  return (
    <div className="container" style={{ paddingTop: '1.6rem', paddingBottom: '3rem' }}>
      <SectionTitle title={page?.title || 'تواصل معنا'} as="h1" />
      <div className="cart-layout">
        <div className="card">
          {page && <Markdown text={page.content} />}
          <ContactWhatsapp number={wa} />
        </div>
        <aside className="card stack">
          <a className="btn btn--wa btn--block" href={waLink(wa)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon /> واتساب <bdi className="num">{formatIntl(wa)}</bdi>
          </a>
          {store.phone && (
            <a className="row" href={`tel:${store.phone.replace(/[^\d+]/g, '')}`}>
              <Phone size={18} /> <bdi className="num">{store.phone}</bdi>
            </a>
          )}
          {store.email && (
            <a className="row" href={`mailto:${store.email}`}>
              <Mail size={18} /> {store.email}
            </a>
          )}
          {store.address && (
            <span className="row">
              <MapPin size={18} /> {store.address}
            </span>
          )}
          {store.mapUrl && /^https?:\/\//.test(store.mapUrl) && (
            <a className="link" href={store.mapUrl} target="_blank" rel="noopener noreferrer">
              الموقع على الخريطة
            </a>
          )}
          {store.workingHours && (
            <span className="row">
              <Clock size={18} /> {store.workingHours}
            </span>
          )}
        </aside>
      </div>
    </div>
  )
}
