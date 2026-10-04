import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { publishedFaqs } from '@/lib/server/pages'
import { SectionTitle } from '@/components/store/Sections'
import { Markdown } from '@/lib/shared/markdown'

export const metadata: Metadata = { title: 'الأسئلة الشائعة' }

export default function FaqPage() {
  const faqs = publishedFaqs()
  const groups = new Map<string, typeof faqs>()
  for (const f of faqs) {
    const k = f.category || 'عام'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(f)
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  }
  return (
    <div className="container faq" style={{ paddingTop: '1.6rem', paddingBottom: '3rem', maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <SectionTitle title="الأسئلة الشائعة" subtitle="إجابات سريعة عن الطلب والدفع والهدايا" as="h1" />
      {!faqs.length && <p className="muted">لا توجد أسئلة منشورة بعد.</p>}
      {Array.from(groups.entries()).map(([cat, list]) => (
        <section key={cat} style={{ marginBottom: '1.4rem' }}>
          <h2 style={{ fontSize: '1.15rem' }}>{cat}</h2>
          {list.map((f) => (
            <details key={f.id}>
              <summary>
                {f.question} <Plus size={20} />
              </summary>
              <div className="faq__a">
                <Markdown text={f.answer} className="" />
              </div>
            </details>
          ))}
        </section>
      ))}
      <p className="muted">
        لم تجد إجابتك؟{' '}
        <Link className="link" href="/contact">
          تواصل معنا
        </Link>
      </p>
    </div>
  )
}
