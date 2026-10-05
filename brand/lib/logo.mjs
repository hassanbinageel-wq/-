// هندسة شعار «غيمة»: حروف مبنية على مخطط Baloo Bhaijaan 2 (رخصة OFL) مع استبدال نقطة الغين بـ«نقطة الغيمة»
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { shapeToContours, pathToContours, contourD } from './shape.mjs'
import { cloudPath } from './cloud.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
export const LETTERING_FONT = path.join(here, '../assets/fonts/BalooBhaijaan2-VF.ttf')
export const LETTERING_WGHT = 600

export const CLOUD = { s: 0.95, dx: 0.04, dy: -0.02 }
const small = (c) => { const [x0, y0, x1, y1] = c.bbox; return x1 - x0 < 140 && y1 - y0 < 140 && c.area > 0 }

function build(text, cloudScale = 1) {
  const r = shapeToContours(LETTERING_FONT, text, { wght: LETTERING_WGHT })
  const cs = r.glyphs.flatMap((g) => pathToContours(g.path, g.x, 0))
  // نقاط فوق خط الأحرف (y سالب = أعلى). نقطة الغين هي الأقصى يميناً بينها
  const top = cs.filter((c) => small(c) && c.bbox[3] < -500)
  const gdot = top.sort((a, b) => b.bbox[0] - a.bbox[0])[0]
  const rest = cs.filter((c) => c !== gdot).map((c) => contourD(c))
  const [x0, , x1, y1] = gdot.bbox
  const w = x1 - x0
  const cloud = cloudPath((x0 + x1) / 2 + w * CLOUD.dx, y1 + w * CLOUD.dy, w * CLOUD.s * cloudScale)
  return { d: [...rest, cloud].join(' '), cloud, letters: rest.join(' ') }
}

export const wordmark = () => build('غيمة')
export const symbolGlyph = () => build('غ', 1.3)
