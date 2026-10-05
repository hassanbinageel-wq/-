// يبني كل ملفات الهوية من الصفر
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { DIST } from '../lib/out.mjs'
fs.rmSync(DIST, { recursive: true, force: true })
const run = (f, ...a) => { console.log('▶', f, ...a); execFileSync('node', ['--experimental-strip-types', '--no-warnings', f, ...a], { stdio: 'inherit' }) }
run('scripts/photos.mjs')
run('scripts/build-logos.mjs')
run('scripts/build-kit.mjs')
for (const k of ['posts', 'stories', 'reels', 'highlights']) run('scripts/build-social.mjs', k)
run('scripts/build-video.mjs')
run('scripts/build-profile.mjs')
run('scripts/build-packaging.mjs')
run('scripts/build-web.mjs')
run('scripts/build-guide.mjs')
