// لوحة ألوان «غيمة» — المصدر الوحيد للقيم في كل الملفات المولدة
export const PALETTE = [
  { key: 'ink', name: 'حبر الغسق', en: 'Dusk Ink', hex: '#3D3347', cmyk: [55, 65, 35, 60], role: 'primary' },
  { key: 'cotton', name: 'قطن', en: 'Cotton', hex: '#FBF6EF', cmyk: [1, 3, 6, 0], role: 'background' },
  { key: 'apricot', name: 'شفق المشمش', en: 'Apricot Glow', hex: '#F0AD82', cmyk: [0, 35, 48, 0], role: 'accent' },
  { key: 'sage', name: 'مريمية الصباح', en: 'Morning Sage', hex: '#A9BFA3', cmyk: [35, 12, 38, 0], role: 'secondary' },
  { key: 'sageDeep', name: 'مريمية عميقة', en: 'Deep Sage', hex: '#55705A', cmyk: [62, 33, 62, 18], role: 'support' },
  { key: 'mist', name: 'ضباب السماء', en: 'Sky Mist', hex: '#DCE5EC', cmyk: [13, 5, 4, 0], role: 'support' },
  { key: 'sand', name: 'رمل ناعم', en: 'Soft Sand', hex: '#F2E7D9', cmyk: [4, 9, 15, 0], role: 'background' },
  { key: 'milk', name: 'حليب', en: 'Milk', hex: '#FFFDF9', cmyk: [0, 1, 2, 0], role: 'background' },
  { key: 'clay', name: 'طين دافئ', en: 'Warm Clay', hex: '#B0503A', cmyk: [18, 78, 82, 6], role: 'support' },
  { key: 'muted', name: 'رمادي الغيم', en: 'Cloud Grey', hex: '#6E6475', cmyk: [50, 52, 35, 18], role: 'text' },
  { key: 'line', name: 'خيط', en: 'Thread', hex: '#E6DCCF', cmyk: [8, 12, 17, 0], role: 'support' },
]
export const C = Object.fromEntries(PALETTE.map((p) => [p.key, p.hex]))
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
export const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
