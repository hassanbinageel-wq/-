// رسومات توضيحية بسيطة للمنتجات التجريبية (تُحول إلى صور WEBP عند التهيئة)
// ليست صوراً حقيقية لمنتجات — تُستبدل بصور المنتجات الفعلية من لوحة التحكم

type Art = 'onesie' | 'pajama' | 'hat' | 'socks' | 'bib' | 'blanket' | 'mittens' | 'gift' | 'bear' | 'bottle' | 'booties' | 'set' | 'jacket'

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  const r = c((n >> 16) & 255)
  const g = c((n >> 8) & 255)
  const b = c(n & 255)
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

const star = (x: number, y: number, r: number, fill: string, op = 1) => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" opacity="${op}" stroke-linejoin="round"/>`
}

const cloud = (x: number, y: number, s: number, fill: string, op = 0.9) =>
  `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}"><path d="M20 60 Q0 60 0 42 Q0 24 20 24 Q24 4 46 4 Q66 4 72 22 Q92 18 98 36 Q112 38 112 50 Q112 62 98 62 Z" fill="${fill}"/></g>`

function onesie(c: string, accent: string, longSleeves = false) {
  const dark = shade(c, -28)
  const sleeves = longSleeves
    ? `<path d="M120 120 L40 210 L40 330 Q40 348 58 348 L78 348 Q94 348 96 330 L104 230 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
       <path d="M280 120 L360 210 L360 330 Q360 348 342 348 L322 348 Q306 348 304 330 L296 230 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>`
    : `<path d="M120 120 L50 175 L78 222 L112 202 Z" fill="${c}" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
       <path d="M280 120 L350 175 L322 222 L288 202 Z" fill="${c}" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>`
  return `${sleeves}
  <path d="M120 112 Q160 150 200 150 Q240 150 280 112 L300 125 L300 380 Q300 410 270 425 L238 470 L162 470 L130 425 Q100 410 100 380 L100 125 Z"
    fill="${c}" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M138 118 Q170 150 200 150 Q230 150 262 118" fill="none" stroke="${dark}" stroke-width="5"/>
  <circle cx="180" cy="462" r="6" fill="${dark}"/><circle cx="200" cy="462" r="6" fill="${dark}"/><circle cx="220" cy="462" r="6" fill="${dark}"/>
  ${star(200, 280, 34, accent)}
  <circle cx="160" cy="215" r="6" fill="${accent}" opacity=".7"/><circle cx="246" cy="350" r="5" fill="${accent}" opacity=".7"/>`
}

function pajama(c: string, accent: string) {
  const dark = shade(c, -28)
  return `<path d="M120 100 L40 190 L40 300 Q40 316 56 316 L76 316 Q92 316 94 300 L104 210 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <path d="M280 100 L360 190 L360 300 Q360 316 344 316 L324 316 Q308 316 306 300 L296 210 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <path d="M120 92 Q160 128 200 128 Q240 128 280 92 L300 105 L300 470 Q300 488 282 488 L222 488 Q210 488 208 470 L200 380 L192 470 Q190 488 178 488 L118 488 Q100 488 100 470 L100 105 Z" fill="${c}" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
  <line x1="200" y1="130" x2="200" y2="370" stroke="${dark}" stroke-width="4" stroke-dasharray="2 26" stroke-linecap="round"/>
  <circle cx="200" cy="160" r="7" fill="#fff" stroke="${dark}" stroke-width="3"/><circle cx="200" cy="215" r="7" fill="#fff" stroke="${dark}" stroke-width="3"/>
  <circle cx="200" cy="270" r="7" fill="#fff" stroke="${dark}" stroke-width="3"/><circle cx="200" cy="325" r="7" fill="#fff" stroke="${dark}" stroke-width="3"/>
  ${star(150, 220, 16, accent)}${star(255, 300, 14, accent)}${star(140, 420, 12, accent)}${star(262, 430, 12, accent)}
  <path d="M250 175 a26 26 0 1 0 22 40 a20 20 0 1 1 -22 -40z" fill="${accent}"/>`
}

function hat(c: string, accent: string) {
  const dark = shade(c, -28)
  return `<circle cx="200" cy="110" r="34" fill="${accent}" stroke="${shade(accent, -30)}" stroke-width="5"/>
  <path d="M90 330 Q90 150 200 140 Q310 150 310 330 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <rect x="78" y="320" width="244" height="74" rx="30" fill="${shade(c, -10)}" stroke="${dark}" stroke-width="5"/>
  ${[110, 150, 190, 230, 270].map((x) => `<line x1="${x + 10}" y1="330" x2="${x + 10}" y2="384" stroke="${dark}" stroke-width="4" opacity=".5"/>`).join('')}
  ${star(200, 240, 26, accent)}`
}

function sock(x: number, c: string, accent: string, flip = false) {
  const dark = shade(c, -28)
  return `<g transform="translate(${x} 0) ${flip ? 'scale(-1 1) translate(-160 0)' : ''}">
    <path d="M40 120 L120 120 L120 300 Q120 320 140 330 L150 336 Q178 352 166 384 Q154 412 118 404 L52 388 Q30 382 30 356 L40 300 Z" fill="${c}" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="34" y="110" width="92" height="40" rx="12" fill="${shade(c, -12)}" stroke="${dark}" stroke-width="5"/>
    <path d="M118 404 Q150 410 166 384 Q154 370 136 372 Z" fill="${accent}"/>
    ${star(80, 220, 16, accent)}
  </g>`
}

function bib(c: string, accent: string) {
  const dark = shade(c, -28)
  return `<path d="M200 90 C120 90 70 150 70 250 C70 360 130 440 200 440 C270 440 330 360 330 250 C330 150 280 90 200 90 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <path d="M150 110 Q200 220 250 110" fill="#FFFDF8" stroke="${dark}" stroke-width="5"/>
  <path d="M90 230 Q200 250 310 230" fill="none" stroke="${accent}" stroke-width="6" stroke-dasharray="1 16" stroke-linecap="round"/>
  ${cloud(140, 280, 1.1, '#FFFFFF', 1)}${star(268, 330, 18, accent)}`
}

function blanket(c: string, accent: string) {
  const dark = shade(c, -25)
  let dots = ''
  for (let y = 150; y < 420; y += 45) for (let x = 110; x < 320; x += 45) dots += star(x + ((y / 45) % 2) * 20, y, 9, accent, 0.8)
  return `<rect x="70" y="110" width="270" height="330" rx="34" fill="${shade(c, -18)}"/>
  <rect x="60" y="100" width="270" height="330" rx="34" fill="${c}" stroke="${dark}" stroke-width="5"/>
  ${dots}
  <path d="M60 330 L330 330 L330 396 Q330 430 296 430 L94 430 Q60 430 60 396 Z" fill="${shade(c, -10)}" stroke="${dark}" stroke-width="5"/>`
}

function mitten(x: number, c: string, accent: string) {
  const dark = shade(c, -28)
  return `<g transform="translate(${x} 0)">
    <path d="M40 170 Q40 100 100 100 Q160 100 160 170 L160 330 L40 330 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
    <rect x="34" y="320" width="132" height="54" rx="16" fill="${shade(c, -12)}" stroke="${dark}" stroke-width="5"/>
    ${star(100, 215, 18, accent)}
  </g>`
}

function gift(c: string, accent: string) {
  const dark = shade(c, -25)
  return `<rect x="80" y="210" width="240" height="230" rx="18" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <rect x="64" y="168" width="272" height="64" rx="14" fill="${shade(c, -10)}" stroke="${dark}" stroke-width="5"/>
  <rect x="182" y="168" width="36" height="272" fill="${accent}"/>
  <path d="M200 168 C150 90 90 120 128 160 C140 172 170 172 200 168 Z" fill="${accent}" stroke="${shade(accent, -30)}" stroke-width="5"/>
  <path d="M200 168 C250 90 310 120 272 160 C260 172 230 172 200 168 Z" fill="${accent}" stroke="${shade(accent, -30)}" stroke-width="5"/>
  ${star(130, 320, 16, '#FFFFFF')}${star(270, 380, 14, '#FFFFFF')}`
}

function bear(c: string, accent: string) {
  const dark = shade(c, -35)
  return `<circle cx="130" cy="120" r="40" fill="${c}" stroke="${dark}" stroke-width="5"/><circle cx="270" cy="120" r="40" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <circle cx="130" cy="120" r="20" fill="${accent}"/><circle cx="270" cy="120" r="20" fill="${accent}"/>
  <ellipse cx="200" cy="370" rx="110" ry="100" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <ellipse cx="200" cy="380" rx="62" ry="58" fill="${shade(c, 25)}"/>
  <circle cx="200" cy="190" r="96" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <ellipse cx="200" cy="220" rx="40" ry="30" fill="${shade(c, 25)}"/>
  <circle cx="165" cy="175" r="9" fill="#3A2E3F"/><circle cx="235" cy="175" r="9" fill="#3A2E3F"/>
  <ellipse cx="200" cy="208" rx="12" ry="9" fill="#3A2E3F"/>
  <path d="M188 228 Q200 240 212 228" fill="none" stroke="#3A2E3F" stroke-width="4" stroke-linecap="round"/>
  <path d="M150 300 L200 285 L250 300 L235 320 L200 308 L165 320 Z" fill="${accent}"/>`
}

function bottle(c: string, accent: string) {
  const dark = shade(c, -30)
  return `<path d="M175 70 Q200 40 225 70 L235 120 L165 120 Z" fill="#F6E7D7" stroke="#C9A98A" stroke-width="5"/>
  <rect x="145" y="118" width="110" height="40" rx="10" fill="${accent}" stroke="${shade(accent, -30)}" stroke-width="5"/>
  <rect x="135" y="156" width="130" height="290" rx="40" fill="#FFFFFF" stroke="${dark}" stroke-width="5" opacity=".95"/>
  <rect x="145" y="290" width="110" height="146" rx="30" fill="${c}" opacity=".6"/>
  ${[200, 240, 280, 320, 360].map((y) => `<line x1="140" y1="${y}" x2="165" y2="${y}" stroke="${dark}" stroke-width="4"/>`).join('')}
  ${star(205, 230, 18, accent)}`
}

function bootie(x: number, c: string, accent: string) {
  const dark = shade(c, -28)
  return `<g transform="translate(${x} 0)">
    <path d="M50 160 L130 160 L130 300 Q190 300 200 350 Q205 390 160 392 L50 392 Q30 392 30 370 L30 300 Q30 250 50 230 Z" fill="${c}" stroke="${dark}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="42" y="150" width="96" height="36" rx="12" fill="${shade(c, -12)}" stroke="${dark}" stroke-width="5"/>
    <path d="M30 370 L200 370 Q200 392 160 392 L50 392 Q30 392 30 370 Z" fill="${shade(c, -20)}"/>
    ${star(150, 335, 14, accent)}
  </g>`
}

function jacket(c: string, accent: string) {
  const dark = shade(c, -28)
  return `<path d="M120 110 L40 200 L40 330 Q40 348 58 348 L80 348 Q96 348 98 330 L104 230 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <path d="M280 110 L360 200 L360 330 Q360 348 342 348 L320 348 Q304 348 302 330 L296 230 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <path d="M120 100 Q200 70 280 100 L300 115 L300 420 Q300 440 280 440 L120 440 Q100 440 100 420 L100 115 Z" fill="${c}" stroke="${dark}" stroke-width="5"/>
  <path d="M140 92 Q200 40 260 92 Q200 120 140 92 Z" fill="${shade(c, 15)}" stroke="${dark}" stroke-width="5"/>
  <line x1="200" y1="110" x2="200" y2="440" stroke="${dark}" stroke-width="5"/>
  ${[150, 210, 270, 330, 390].map((y) => `<path d="M100 ${y} Q200 ${y + 14} 300 ${y}" fill="none" stroke="${dark}" stroke-width="3" opacity=".45"/>`).join('')}
  ${star(150, 180, 14, accent)}`
}

export function demoSvg(art: Art, color: string, accent: string, bg: string): string {
  let body = ''
  switch (art) {
    case 'onesie': body = onesie(color, accent); break
    case 'pajama': body = pajama(color, accent); break
    case 'hat': body = hat(color, accent); break
    case 'socks': body = sock(40, color, accent) + sock(200, shade(color, 8), accent, true); break
    case 'bib': body = bib(color, accent); break
    case 'blanket': body = blanket(color, accent); break
    case 'mittens': body = mitten(30, color, accent) + mitten(210, color, accent); break
    case 'gift': body = gift(color, accent); break
    case 'bear': body = bear(color, accent); break
    case 'bottle': body = bottle(color, accent); break
    case 'booties': body = bootie(10, color, accent) + bootie(190, shade(color, 6), accent); break
    case 'jacket': body = jacket(color, accent); break
    case 'set':
      body = `<g transform="translate(-30 40) scale(.7)">${onesie(color, accent, true)}</g>
              <g transform="translate(210 0) scale(.5)">${hat(color, accent)}</g>
              <g transform="translate(200 250) scale(.55)">${sock(40, color, accent) + sock(200, color, accent, true)}</g>`
      break
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 400 500">
  <defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${shade(bg, 10)}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
  <rect width="400" height="500" fill="url(#g)"/>
  ${cloud(10, 30, 0.9, '#FFFFFF', 0.75)}${cloud(280, 410, 0.8, '#FFFFFF', 0.7)}
  ${star(345, 60, 10, '#FFFFFF', 0.9)}${star(40, 430, 8, '#FFFFFF', 0.9)}${star(365, 270, 6, '#FFFFFF', 0.8)}
  <g transform="translate(0 6)">${body}</g>
</svg>`
}

export function bannerSvg(bg1: string, bg2: string, accent: string, art: Art, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="800" viewBox="0 0 900 400">
  <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="900" height="400" fill="url(#b)"/>
  ${cloud(60, 40, 1.4, '#FFFFFF', 0.8)}${cloud(380, 300, 1.1, '#FFFFFF', 0.6)}
  ${star(330, 70, 14, '#FFFFFF')}${star(420, 140, 9, '#FFFFFF')}${star(80, 330, 10, '#FFFFFF')}
  <path d="M520 90 a60 60 0 1 0 52 92 a46 46 0 1 1 -52 -92z" fill="#FFF6D6" opacity=".9"/>
  <g transform="translate(40 40) scale(.7)">${demoArtOnly(art, color, accent)}</g>
</svg>`
}

function demoArtOnly(art: Art, color: string, accent: string) {
  switch (art) {
    case 'bear': return bear(color, accent)
    case 'gift': return gift(color, accent)
    default: return onesie(color, accent)
  }
}

export type { Art }

export function bannerSvgMobile(bg1: string, bg2: string, accent: string, art: Art, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 450 550">
  <defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="450" height="550" fill="url(#b)"/>
  ${cloud(20, 30, 1.1, '#FFFFFF', 0.8)}${cloud(300, 250, 0.9, '#FFFFFF', 0.6)}
  ${star(380, 50, 12, '#FFFFFF')}${star(60, 200, 8, '#FFFFFF')}${star(400, 180, 7, '#FFFFFF')}
  <path d="M330 70 a44 44 0 1 0 38 68 a34 34 0 1 1 -38 -68z" fill="#FFF6D6" opacity=".9"/>
  <g transform="translate(110 20) scale(.58)">${demoArtOnly(art, color, accent)}</g>
</svg>`
}
