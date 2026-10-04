// استيراد ملف خط (مثل DIN Next LT Arabic) إلى مجلد البيانات وتعيينه خطاً للمتجر
// الاستخدام: npm run font:import -- ./DINNextLTArabic-Regular.ttf "DIN Next LT Arabic"
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../lib/server/db'
import { saveFont } from '../lib/server/media'
import { ensureAppearance, getPublishedAppearance } from '../lib/server/appearance'

const [file, name] = process.argv.slice(2)
if (!file || !fs.existsSync(file)) {
  console.error('حدد مسار ملف الخط: npm run font:import -- ./font.ttf "اسم الخط"')
  process.exit(1)
}
ensureAppearance()
const id = saveFont(fs.readFileSync(file), path.basename(file))
const a = getPublishedAppearance()
a.theme.customFontId = id
a.theme.customFontName = name || a.theme.customFontName
a.theme.fontBody = 'custom'
a.theme.fontHeading = 'custom'
db().prepare("UPDATE appearance_versions SET data=? WHERE status='published'").run(JSON.stringify(a))
db().prepare("DELETE FROM appearance_versions WHERE status='draft'").run()
console.log(`✓ تم استيراد الخط (${a.theme.customFontName}) وتعيينه للمتجر`)
