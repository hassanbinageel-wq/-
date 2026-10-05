// تصغير الصور قبل تضمينها في الدليل (للحفاظ على حجم PDF معقول)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ROOT } from './browser.mjs'
const CACHE = path.join(ROOT, 'lab', 'thumbs'); fs.mkdirSync(CACHE, { recursive: true })
export function thumb(p, maxW = 900, fmt = 'jpg') {
  const key = crypto.createHash('md5').update(p + maxW + fmt + fs.statSync(p).mtimeMs).digest('hex').slice(0, 12)
  const out = path.join(CACHE, key + '.' + fmt)
  if (!fs.existsSync(out)) execFileSync('python3', ['-c', `
from PIL import Image
i=Image.open(r'''${p}''')
if '${fmt}'=='jpg': i=i.convert('RGB')
i.thumbnail((${maxW},${maxW}*4))
i.save(r'''${out}''', quality=86) if '${fmt}'=='jpg' else i.save(r'''${out}''')`])
  return `data:image/${fmt === 'jpg' ? 'jpeg' : 'png'};base64,` + fs.readFileSync(out).toString('base64')
}
