import path from 'node:path'
import fs from 'node:fs'
import { ROOT } from './browser.mjs'
export const DIST = path.join(ROOT, 'dist', 'Ghayma_Brand_Identity')
export const OUT = (...p) => { const d = path.join(DIST, ...p); fs.mkdirSync(d, { recursive: true }); return d }
