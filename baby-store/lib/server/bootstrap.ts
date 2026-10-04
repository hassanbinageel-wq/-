import { db } from './db'
import { DEFAULT_CATEGORIES, DEFAULT_FAQS, DEFAULT_PAGES, DEFAULT_TAG_GROUPS } from './default-content'

/**
 * هيكل المتجر الأساسي (الصفحات، الأسئلة الشائعة، الأقسام، تصنيفات العمر والمناسبة)
 * يُضاف مرة واحدة فقط لقاعدة البيانات الجديدة، فلا يعود ما يحذفه المالك لاحقاً.
 * لا يضيف منتجات أو بيانات تجريبية (تلك عبر npm run db:seed).
 * يُستدعى داخل معاملة الترحيل.
 */
export async function bootstrapContent() {
  const d = db()
  if (await d.prepare("SELECT 1 FROM meta WHERE key='bootstrapped'").get()) return
  const empty = async (table: string) => !(await d.prepare(`SELECT COUNT(*) n FROM ${table}`).get<{ n: number }>())!.n
  if (await empty('pages')) {
    const ins = d.prepare('INSERT INTO pages(slug,title,content,status,show_in_footer,system,sort) VALUES(?,?,?,?,?,1,?)')
    for (const p of DEFAULT_PAGES) await ins.run(p.slug, p.title, p.content, 'published', p.slug === 'contact' ? 0 : 1, p.sort)
  }
  if (await empty('faqs')) {
    const ins = d.prepare('INSERT INTO faqs(question,answer,category,sort) VALUES(?,?,?,?)')
    for (const [i, f] of DEFAULT_FAQS.entries()) await ins.run(f.question, f.answer, f.category, i)
  }
  if (await empty('categories')) {
    const ins = d.prepare('INSERT INTO categories(name,slug,description,sort) VALUES(?,?,?,?)')
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) await ins.run(c.name, c.slug, c.description, i)
  }
  if (await empty('tag_groups')) {
    for (const [gi, g] of DEFAULT_TAG_GROUPS.entries()) {
      const gid = (await d.prepare('INSERT INTO tag_groups(name,slug,kind,sort) VALUES(?,?,?,?)').run(g.name, g.slug, g.kind, gi)).lastInsertRowid
      for (const [ti, [name, slug]] of g.tags.entries()) await d.prepare('INSERT INTO tags(group_id,name,slug,sort) VALUES(?,?,?,?)').run(gid, name, slug, ti)
    }
  }
  await d.prepare("INSERT INTO meta(key,value) VALUES('bootstrapped',datetime('now'))").run()
}
