import type { DB } from './db'
import { DEFAULT_CATEGORIES, DEFAULT_FAQS, DEFAULT_PAGES, DEFAULT_TAG_GROUPS } from './default-content'

/**
 * هيكل المتجر الأساسي (الصفحات، الأسئلة الشائعة، الأقسام، تصنيفات العمر والمناسبة)
 * يُضاف مرة واحدة فقط لقاعدة البيانات الجديدة، فلا يعود ما يحذفه المالك لاحقاً.
 * لا يضيف منتجات أو بيانات تجريبية (تلك عبر npm run db:seed).
 */
export function bootstrapContent(db: DB) {
  if (db.prepare("SELECT 1 FROM meta WHERE key='bootstrapped'").get()) return
  const empty = (table: string) => !(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as { n: number }).n
  db.transaction(() => {
    if (empty('pages')) {
      const ins = db.prepare('INSERT INTO pages(slug,title,content,status,show_in_footer,system,sort) VALUES(?,?,?,?,?,1,?)')
      for (const p of DEFAULT_PAGES) ins.run(p.slug, p.title, p.content, 'published', p.slug === 'contact' ? 0 : 1, p.sort)
    }
    if (empty('faqs')) {
      const ins = db.prepare('INSERT INTO faqs(question,answer,category,sort) VALUES(?,?,?,?)')
      DEFAULT_FAQS.forEach((f, i) => ins.run(f.question, f.answer, f.category, i))
    }
    if (empty('categories')) {
      const ins = db.prepare('INSERT INTO categories(name,slug,description,sort) VALUES(?,?,?,?)')
      DEFAULT_CATEGORIES.forEach((c, i) => ins.run(c.name, c.slug, c.description, i))
    }
    if (empty('tag_groups')) {
      DEFAULT_TAG_GROUPS.forEach((g, gi) => {
        const gid = Number(db.prepare('INSERT INTO tag_groups(name,slug,kind,sort) VALUES(?,?,?,?)').run(g.name, g.slug, g.kind, gi).lastInsertRowid)
        g.tags.forEach(([name, slug], ti) => db.prepare('INSERT INTO tags(group_id,name,slug,sort) VALUES(?,?,?,?)').run(gid, name, slug, ti))
      })
    }
    db.prepare("INSERT INTO meta(key,value) VALUES('bootstrapped',datetime('now'))").run()
  })()
}
