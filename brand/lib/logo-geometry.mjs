// الهندسة النهائية للشعار: مسارات موحدة مُطبَّعة (وحدة = 1/1000 من ارتفاع الحروف التقريبي)
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { wordmark, symbolGlyph } from './logo.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))

let cache
export function logoGeometry() {
  if (cache) return cache
  const w = wordmark(), s = symbolGlyph()
  const input = { wLetters: w.letters, wCloud: w.cloud, sLetters: s.letters, sCloud: s.cloud }
  const out = JSON.parse(execFileSync('python3', [path.join(here, '../scripts/union.py')], { input: JSON.stringify(input) }).toString())
  const box = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
  cache = {
    word: { letters: out.wLetters.d, cloud: out.wCloud.d, bounds: box(out.wLetters.bounds, out.wCloud.bounds) },
    symbol: { letters: out.sLetters.d, cloud: out.sCloud.d, bounds: box(out.sLetters.bounds, out.sCloud.bounds) },
  }
  return cache
}
