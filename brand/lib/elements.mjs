// العناصر المساندة: النمط، الإطارات، الفواصل، الملصقات، الأزرار وبطاقات الأسعار (SVG)
import { cloudPath } from './cloud.mjs'
import { C } from './palette.mjs'
import { textPathCentered, textPath } from './textpath.mjs'
import { iconSVG } from './icons.mjs'

const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${body}</svg>`
export const cloud = (cx, base, s, fill, op = 1) => `<path d="${cloudPath(cx, base, s)}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`

// ——— النمط المتكرر: غيوم صغيرة ونقاط ناعمة على شبكة متداخلة (بلاطة 360) ———
export const PATTERNS = {
  cotton: { bg: C.cotton, cloud: C.sand, dot: C.apricot, dotOp: 0.55, label: 'على القطن' },
  sage: { bg: C.sage, cloud: '#BFD0BA', dot: C.cotton, dotOp: 0.7, label: 'على المريمية' },
  ink: { bg: C.ink, cloud: '#4A3F55', dot: C.apricot, dotOp: 0.8, label: 'على الحبر' },
  apricot: { bg: '#F6C9AA', cloud: '#F9D9C2', dot: C.cotton, dotOp: 0.9, label: 'على المشمش' },
}
export function patternTile(v, { size = 360, bg = true } = {}) {
  const p = PATTERNS[v], s = size / 360
  const items = [
    cloud(90 * s, 92 * s, 34 * s, p.cloud), cloud(270 * s, 272 * s, 34 * s, p.cloud),
    `<circle cx="${270 * s}" cy="${80 * s}" r="${6 * s}" fill="${p.dot}" opacity="${p.dotOp}"/>`,
    `<circle cx="${90 * s}" cy="${262 * s}" r="${6 * s}" fill="${p.dot}" opacity="${p.dotOp}"/>`,
    `<circle cx="${180 * s}" cy="${178 * s}" r="${3.5 * s}" fill="${p.dot}" opacity="${p.dotOp * 0.8}"/>`,
    `<circle cx="${0}" cy="${178 * s}" r="${3.5 * s}" fill="${p.dot}" opacity="${p.dotOp * 0.8}"/>`, `<circle cx="${360 * s}" cy="${178 * s}" r="${3.5 * s}" fill="${p.dot}" opacity="${p.dotOp * 0.8}"/>`,
  ].join('')
  return svg(size, size, (bg ? `<rect width="${size}" height="${size}" fill="${p.bg}"/>` : '') + items)
}
export function patternSheet(v, w, h, { size = 360, bg = true } = {}) {
  const tile = patternTile(v, { size, bg: false }).replace(/^<svg[^>]*>|<\/svg>$/g, '')
  return svg(w, h, `<defs><pattern id="pt" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${tile}</pattern></defs>` + (bg ? `<rect width="${w}" height="${h}" fill="${PATTERNS[v].bg}"/>` : '') + `<rect width="${w}" height="${h}" fill="url(#pt)"/>`)
}

// ——— إطارات الصور (أشكال تُستخدم كقناع) ———
export function framePath(kind, w, h) {
  const r = Math.min(w, h)
  if (kind === 'arch') return `M0 ${h}V${w / 2}A${w / 2} ${w / 2} 0 0 1 ${w} ${w / 2}V${h}Z`
  if (kind === 'rounded') { const k = r * 0.08; return `M${k} 0H${w - k}A${k} ${k} 0 0 1 ${w} ${k}V${h - k}A${k} ${k} 0 0 1 ${w - k} ${h}H${k}A${k} ${k} 0 0 1 0 ${h - k}V${k}A${k} ${k} 0 0 1 ${k} 0Z` }
  if (kind === 'circle') return `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 1 0 ${h / 2}Z`
  if (kind === 'cloud') {
    // حافة علوية متموجة كغيمة: أقواس متتالية
    const n = 5, bw = w / n, rr = bw / 2, top = rr * 0.9, k = r * 0.06
    let d = `M0 ${h - k}V${top + rr * 0.2}`
    for (let i = 0; i < n; i++) d += `A${rr} ${rr} 0 0 1 ${(i + 1) * bw} ${top + rr * 0.2}`
    return d + `V${h - k}A${k} ${k} 0 0 1 ${w - k} ${h}H${k}A${k} ${k} 0 0 1 0 ${h - k}Z`
  }
  if (kind === 'ticket') { const k = r * 0.08, n = r * 0.06; return `M${k} 0H${w - k}A${k} ${k} 0 0 1 ${w} ${k}V${h / 2 - n}A${n} ${n} 0 0 0 ${w} ${h / 2 + n}V${h - k}A${k} ${k} 0 0 1 ${w - k} ${h}H${k}A${k} ${k} 0 0 1 0 ${h - k}V${h / 2 + n}A${n} ${n} 0 0 0 0 ${h / 2 - n}V${k}A${k} ${k} 0 0 1 ${k} 0Z` }
}
export const FRAMES = { arch: 'قوس', cloud: 'حافة غيمة', rounded: 'مستطيل ناعم', circle: 'دائرة', ticket: 'بطاقة' }
export const frameSVG = (kind, w, h, fill = C.sand, stroke) => svg(w, h, `<path d="${framePath(kind, w, h)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="4"` : ''}/>`)

// ——— فواصل ———
export const DIVIDERS = {
  cloudLine: (w = 600, c = C.ink) => svg(w, 60, `<path d="M0 34H${w / 2 - 50}M${w / 2 + 50} 34H${w}" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".35"/>${cloud(w / 2, 44, 18, C.apricot)}`),
  dots: (w = 600, c = C.ink) => svg(w, 30, [-28, 0, 28].map((dx, i) => `<circle cx="${w / 2 + dx}" cy="15" r="${i === 1 ? 6 : 4.5}" fill="${i === 1 ? C.apricot : c}" opacity="${i === 1 ? 1 : 0.35}"/>`).join('')),
  dotted: (w = 600, c = C.ink) => svg(w, 20, `<path d="M6 10H${w - 6}" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 14" opacity=".4"/>`),
  wave: (w = 600, c = C.sage) => { let d = 'M0 18'; for (let x = 0; x < w; x += 40) d += ` q10 -12 20 0 t20 0`; return svg(w, 36, `<path d="${d}" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`) },
}

// ——— الملصقات ———
function pill(label, bg, fg, { h = 76, padX = 34, iconCloud = false, font = 500 } = {}) {
  const t = textPath(label, { size: h * 0.42, wght: font })
  const extra = iconCloud ? h * 0.62 : 0
  const w = Math.round(t.width + padX * 2 + extra)
  let body = `<rect width="${w}" height="${h}" rx="${h / 2}" fill="${bg}"/>`
  if (iconCloud) body += cloud(w - padX - h * 0.2, h * 0.62, h * 0.17, C.apricot)
  body += textPathCentered(label, (w - extra) / 2, h / 2, fg, { size: h * 0.42, wght: font })
  return svg(w, h, body)
}
function cloudBadge(label, bg, fg, S = 220) {
  const t = textPath(label, { size: S * 0.15, wght: 600 })
  const lines = label.split(' ')
  let body = `<path d="${cloudPath(S / 2, S * 0.78, S * 0.31)}" fill="${bg}" transform="translate(0 0)"/>`
  if (lines.length > 1 && t.width > S * 0.62) {
    body += textPathCentered(lines[0], S / 2, S * 0.47, fg, { size: S * 0.15, wght: 600 }) + textPathCentered(lines.slice(1).join(' '), S / 2, S * 0.645, fg, { size: S * 0.15, wght: 600 })
  } else body += textPathCentered(label, S / 2, S * 0.58, fg, { size: S * 0.13, wght: 600 })
  return svg(S, S * 0.86, body)
}
function scallop(label, bg, fg, S = 220) {
  const n = 14, R = S / 2 - 4, r = R * 0.12
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = S / 2 + (R - r) * Math.cos(a), y = S / 2 + (R - r) * Math.sin(a)
    d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
  }
  const words = label.split(' ')
  let body = `<path d="${d}" fill="${bg}"/><circle cx="${S / 2}" cy="${S / 2}" r="${R - r}" fill="${bg}"/><circle cx="${S / 2}" cy="${S / 2}" r="${R - r * 2.6}" fill="none" stroke="${fg}" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" opacity=".7"/>`
  if (words.length === 2) body += textPathCentered(words[0], S / 2, S * 0.41, fg, { size: S * 0.17, wght: 600 }) + textPathCentered(words[1], S / 2, S * 0.6, fg, { size: S * 0.17, wght: 600 })
  else body += textPathCentered(label, S / 2, S / 2, fg, { size: S * 0.15, wght: 600 })
  return svg(S, S, body)
}
export const STICKERS = {
  new: { ar: 'جديد', svg: () => pill('جديد', C.apricot, C.ink) },
  bestseller: { ar: 'الأكثر طلباً', svg: () => pill('الأكثر طلباً', C.ink, C.cotton, { iconCloud: true }) },
  newbornGift: { ar: 'هدية مولود', svg: () => cloudBadge('هدية مولود', C.sage, C.ink) },
  special: { ar: 'عرض خاص', svg: () => scallop('عرض خاص', C.clay, C.milk) },
  newOutline: { ar: 'جديد (محدد)', svg: () => { const s = pill('جديد', C.milk, C.ink); return s.replace('fill="#FFFDF9"/>', `fill="${C.milk}" stroke="${C.ink}" stroke-width="3"/>`) } },
  backInStock: { ar: 'متوفر مجدداً', svg: () => pill('متوفر مجدداً', C.sageDeep, C.milk) },
}

// ——— الأزرار وبطاقات الأسعار ———
export function buttonSVG(kind, label = 'اطلبوا الآن', h = 88) {
  const st = { primary: [C.ink, C.cotton, null], accent: [C.apricot, C.ink, null], secondary: ['none', C.ink, C.ink], light: [C.milk, C.ink, null] }[kind]
  const t = textPath(label, { size: h * 0.36, wght: 500 })
  const w = Math.round(t.width + h * 1.1)
  return svg(w, h, `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${(h - 3) / 2}" fill="${st[0]}"${st[2] ? ` stroke="${st[2]}" stroke-width="3"` : ''}/>` + textPathCentered(label, w / 2, h / 2, st[1], { size: h * 0.36, wght: 500 }))
}
export function priceCardSVG({ name = 'بدلة قطنية للمولود', price = '89', old = '', currency = 'ر.س', w = 520 } = {}) {
  const h = old ? 210 : 176
  let b = `<rect width="${w}" height="${h}" rx="28" fill="${C.milk}"/><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="27" fill="none" stroke="${C.line}" stroke-width="2"/>`
  const nm = textPath(name, { size: 30, wght: 500 })
  b += `<path transform="translate(${w - 36 - nm.width} 62) scale(${nm.scale})" d="${nm.d}" fill="${C.ink}"/>`
  const pr = textPath(`${price} ${currency}`, { size: 46, wght: 600 })
  b += `<path transform="translate(${w - 36 - pr.width} 132) scale(${pr.scale})" d="${pr.d}" fill="${old ? C.clay : C.ink}"/>`
  if (old) {
    const o = textPath(`${old} ${currency}`, { size: 28, wght: 400 })
    const ox = w - 36 - pr.width - 24 - o.width
    b += `<path transform="translate(${ox} 128) scale(${o.scale})" d="${o.d}" fill="${C.muted}"/><path d="M${ox - 2} 118H${ox + o.width + 2}" stroke="${C.muted}" stroke-width="2.5"/>`
    const pct = textPath('وفّري ' + Math.round((1 - price / old) * 100) + '٪', { size: 22, wght: 500 })
    b += `<rect x="${w - 36 - pct.width - 28}" y="${152}" width="${pct.width + 28}" height="40" rx="20" fill="${C.apricot}"/><path transform="translate(${w - 36 - pct.width - 14} ${180}) scale(${pct.scale})" d="${pct.d}" fill="${C.ink}"/>`
  }
  return svg(w, h, b)
}
export { iconSVG }
