import type { Appearance } from '../shared/types'
import { FONTS } from '../shared/theme'
import { getMedia } from './media'

const ARABIC_RANGE =
  'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC'
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

const BUNDLED: Record<string, { family: string; file: string }> = {
  tajawal: { family: 'Tajawal', file: 'tajawal' },
  almarai: { family: 'Almarai', file: 'almarai' },
  'ibm-plex': { family: 'IBM Plex Sans Arabic', file: 'ibm-plex-sans-arabic' },
  cairo: { family: 'Cairo', file: 'cairo' },
}

function bundledFace(key: string): string {
  const f = BUNDLED[key]
  if (!f) return ''
  return [400, 700]
    .flatMap((w) => [
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:swap;src:url(/fonts/${f.file}-arabic-${w}-normal.woff2) format('woff2');unicode-range:${ARABIC_RANGE}}`,
      `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:swap;src:url(/fonts/${f.file}-latin-${w}-normal.woff2) format('woff2');unicode-range:${LATIN_RANGE}}`,
    ])
    .join('\n')
}

const safeName = (s: string) => (s || '').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60)
const HEX = /^#[0-9a-fA-F]{3,8}$/

function familyOf(key: string, a: Appearance): string {
  if (key === 'custom') return `'StoreCustomFont', '${safeName(a.theme.customFontName)}', 'Tajawal'`
  if (key === 'system') return 'system-ui'
  return `'${FONTS.find((f) => f.key === key)?.family || 'Tajawal'}'`
}

/** CSS للهوية: الخطوط والألوان (تُضمن داخل <style> في رأس الصفحة) */
export async function themeCss(a: Appearance): Promise<string> {
  const parts: string[] = []
  const used = new Set([a.theme.fontBody, a.theme.fontHeading, 'tajawal'])
  for (const k of used) if (BUNDLED[k]) parts.push(bundledFace(k))
  if (used.has('custom')) {
    const m = await getMedia(a.theme.customFontId)
    const name = safeName(a.theme.customFontName)
    const fmt = m ? ({ woff2: 'woff2', woff: 'woff', otf: 'opentype', ttf: 'truetype' } as Record<string, string>)[m.ext] : null
    const src = [`local('${name}')`, m && m.kind === 'public' ? `url(/media/${m.path}.${m.ext}) format('${fmt}')` : null].filter(Boolean).join(', ')
    parts.push(`@font-face{font-family:'StoreCustomFont';font-style:normal;font-weight:100 900;font-display:swap;src:${src}}`)
  }
  const raw = a.theme.colors
  const c = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, HEX.test(v) ? v : '#888888'])) as typeof raw
  const headingCustom = a.theme.fontHeading === 'custom'
  parts.push(`:root{
  --c-bg:${c.bg};--c-surface:${c.surface};--c-soft:${c.soft};--c-text:${c.text};--c-muted:${c.muted};
  --c-primary:${c.primary};--c-on-primary:${c.onPrimary};--c-accent:${c.accent};
  --c-pink:${c.pink};--c-blue:${c.blue};--c-green:${c.green};--c-yellow:${c.yellow};--c-border:${c.border};--c-sale:${c.sale};
  --radius:${Math.max(0, Math.min(32, a.theme.radius))}px;
  --font-body:${familyOf(a.theme.fontBody, a)}, system-ui, sans-serif;
  --font-heading:${familyOf(a.theme.fontHeading, a)}, system-ui, sans-serif;
  --heading-weight:${headingCustom ? 500 : 700};
  --base-size:${Math.max(14, Math.min(19, a.theme.baseSize))}px;
  --card-aspect:${a.productCard.aspect};--card-fit:${a.productCard.fit};
  --cols-m:${a.productCard.columnsMobile};--cols-d:${a.productCard.columnsDesktop};
}`)
  return parts.join('\n')
}

/** خطوط لوحة التحكم (ثابتة) */
export function adminFontCss(): string {
  return bundledFace('tajawal')
}
