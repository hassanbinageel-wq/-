// يُشغَّل قبل البناء على Netlify فقط: يحذف نسخ sharp غير المستخدمة على خوادم Linux x64 (glibc)
// حتى لا تُضمَّن في حزمة دالة الخادم (تقليل حجمها). لا يعمل خارج Netlify.
import fs from 'node:fs'
import path from 'node:path'

if (!process.env.NETLIFY) process.exit(0)
const dir = path.join(process.cwd(), 'node_modules', '@img')
if (!fs.existsSync(dir)) process.exit(0)
for (const name of fs.readdirSync(dir)) {
  if (name === 'sharp-wasm32' || name.includes('linuxmusl')) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    console.log('[netlify-prune] removed @img/' + name)
  }
}
