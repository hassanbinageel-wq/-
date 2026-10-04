import { requirePage } from '@/lib/server/auth'
import { db } from '@/lib/server/db'
import { PagesManager } from '@/components/admin/PagesManager'

export const metadata = { title: 'الصفحات والأسئلة' }

export default async function PagesAdmin() {
  await requirePage('owner')
  const pages = db().prepare('SELECT * FROM pages ORDER BY sort, id').all() as {
    id: number; slug: string; title: string; content: string; status: 'draft' | 'published'; show_in_footer: number; system: number; seo_title: string | null; seo_description: string | null
  }[]
  const faqs = db().prepare('SELECT * FROM faqs ORDER BY sort, id').all() as { id: number; question: string; answer: string; category: string | null; published: number }[]
  return (
    <PagesManager
      pages={pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, content: p.content, status: p.status, showInFooter: !!p.show_in_footer, system: !!p.system, seoTitle: p.seo_title || '', seoDescription: p.seo_description || '' }))}
      faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, category: f.category || '', published: !!f.published }))}
    />
  )
}
