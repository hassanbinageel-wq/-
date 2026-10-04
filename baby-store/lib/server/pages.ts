import { db } from './db'

export type PageRow = {
  id: number
  slug: string
  title: string
  content: string
  status: 'draft' | 'published'
  show_in_footer: number
  system: number
  sort: number
  seo_title: string | null
  seo_description: string | null
  updated_at: string
}

export async function getPage(slug: string, includeDraft = false): Promise<PageRow | undefined> {
  const p = await db().prepare('SELECT * FROM pages WHERE slug=?').get(slug) as PageRow | undefined
  if (!p || (p.status !== 'published' && !includeDraft)) return undefined
  return p
}

export async function publishedFaqs() {
  return await db().prepare('SELECT id, question, answer, category FROM faqs WHERE published=1 ORDER BY sort, id').all() as {
    id: number; question: string; answer: string; category: string | null
  }[]
}
