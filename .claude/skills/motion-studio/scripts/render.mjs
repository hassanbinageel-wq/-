#!/usr/bin/env node
// render.mjs — رندر حتمي لفيلم seek(t): Chromium بدون واجهة يرسم كل إطار عبر window.renderAt(t)،
// وffmpeg يرمّز. ضبابية حركة حقيقية من إطارات فرعية (--sub) تُدمج بـ tmix.
//
//   node render.mjs --film film.html --out out/video.mp4 [--fps 30] [--from 0] [--to <dur>] [--sub 3] [--shutter .5]
//   node render.mjs --film film.html --stills 0.5,1,2.25        → out/stills/t_0.50.png ...
//   node render.mjs --film film.html --every 0.5                → لقطة لكل نبضة (للنقد قبل الرندر الكامل)
//   --workers N (افتراضي: نصف الأنوية، حد 6)   --capture jpeg|png   --scale 0.5 (مسودة سريعة)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const film = path.resolve(args.film || 'film.html');
const root = path.dirname(film);

function loadPlaywright() {
  const tries = [root, process.cwd(), path.resolve(root, '..'), path.resolve(root, '../..')];
  for (const base of tries) for (const name of ['playwright-core', 'playwright']) {
    try { return createRequire(path.join(base, 'noop.js'))(name); } catch {}
  }
  for (const g of ['/opt/node-tools/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) {
    try { return createRequire(import.meta.url)(g); } catch {}
  }
  console.error('✗ لم أجد playwright-core. نفّذ: npm i playwright-core'); process.exit(2);
}
const { chromium } = loadPlaywright();

function chromePath() {
  if (args.chrome) return args.chrome;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache/ms-playwright');
  const cands = [];
  try { for (const d of fs.readdirSync(base).filter(d => d.startsWith('chromium-')).sort().reverse())
    cands.push(path.join(base, d, 'chrome-linux/chrome'), path.join(base, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'), path.join(base, d, 'chrome-win/chrome.exe')); } catch {}
  cands.push('/opt/pw-browsers/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome');
  return cands.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
}

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--disable-background-networking', '--disable-component-update', '--no-first-run', '--disable-web-security', '--allow-file-access-from-files', '--font-render-hinting=none'] });
async function openPage() {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(pathToFileURL(film).href);
  await page.waitForFunction(() => window.__ready !== undefined);
  await page.evaluate(() => window.__ready);
  const F = await page.evaluate(() => window.FILM);
  const scale = +(args.scale || 1);
  await page.setViewportSize({ width: F.width, height: F.height });
  if (scale !== 1) await page.evaluate(k => { document.getElementById('stage').style.transform = `scale(${k})`; }, scale);
  return { page, F, scale };
}
const capType = args.capture || 'jpeg';
async function grab(ctx, t) {
  await ctx.page.evaluate(t => window.renderAt(t), t);
  const w = Math.round(ctx.F.width * ctx.scale), h = Math.round(ctx.F.height * ctx.scale);
  return ctx.page.screenshot({ type: capType === 'png' ? 'png' : 'jpeg', quality: capType === 'png' ? undefined : 94, clip: { x: 0, y: 0, width: w, height: h }, animations: 'disabled' });
}

const first = await openPage();
const F = first.F;
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

// ------------------------------------------------------------------ لقطات ثابتة
if (args.stills || args.every) {
  const ts = args.stills ? String(args.stills).split(',').map(Number)
    : Array.from({ length: Math.floor(F.duration / +args.every) + 1 }, (_, i) => +(i * +args.every).toFixed(3)).filter(t => t < F.duration);
  const dir = path.join(outDir, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const t of ts) {
    await first.page.evaluate(t => window.renderAt(t), t);
    await first.page.screenshot({ path: path.join(dir, `t_${t.toFixed(2).padStart(6, '0')}.png`), clip: { x: 0, y: 0, width: F.width * first.scale, height: F.height * first.scale } });
  }
  console.log(`✓ ${ts.length} لقطة → ${path.relative(process.cwd(), dir)}`);
  await browser.close(); process.exit(0);
}

// ------------------------------------------------------------------ فيديو كامل
const fps = +(args.fps || F.fps || 30), sub = Math.max(1, +(args.sub || 1)), shutter = +(args.shutter || .5);
const from = +(args.from || 0), to = +(args.to || F.duration);
const nFrames = Math.round((to - from) * fps), total = nFrames * sub;
const out = path.resolve(args.out || path.join(outDir, 'video.mp4'));
const partial = out.replace(/\.mp4$/, '.partial.mp4');
const workers = Math.max(1, Math.min(+(args.workers || Math.max(1, Math.floor(os.cpus().length / 2))), 6));
const times = [];
// الضبابية لا تعبر القطع أبدًا: إطار فرعي على الجهة الأخرى من قطع يُثبَّت على جهة الإطار نفسه
const cuts = (F.cuts || []).map(Number);
const sideOf = (c, tc) => tc >= c;
for (let f = 0; f < nFrames; f++) {
  const tc = from + f / fps;
  for (let s = 0; s < sub; s++) {
    let ts = from + (f + (sub > 1 ? (s / (sub - 1) - .5) * shutter : 0)) / fps;
    for (const c of cuts) if (sideOf(c, tc) !== sideOf(c, ts)) ts = sideOf(c, tc) ? c : c - 1e-4;
    times.push(ts);
  }
}

const vf = [];
if (sub > 1) vf.push(`tmix=frames=${sub}`, `select='eq(mod(n\\,${sub})\\,${sub - 1})'`, `setpts=N/(${fps}*TB)`);
vf.push('format=yuv420p');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', capType === 'png' ? 'png' : 'mjpeg', '-i', '-',
  '-vf', vf.join(','), '-r', String(fps), '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 16), '-movflags', '+faststart', partial],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise(r => ff.on('close', r));

const ctxs = [first, ...await Promise.all(Array.from({ length: workers - 1 }, openPage))];
const done = new Map(); let next = 0, written = 0; const t0 = Date.now();
async function flush() {
  while (done.has(written)) {
    const buf = done.get(written); done.delete(written);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    written++;
    if (written % (fps * sub) === 0) process.stdout.write(`\r  ${(written / total * 100).toFixed(0)}%  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
let flushing = Promise.resolve();
await Promise.all(ctxs.map(async ctx => {
  while (next < total) {
    const i = next++;
    let buf, tries = 0;
    while (!buf) { try { buf = await grab(ctx, times[i]); } catch (e) { if (++tries > 3) throw e; } }
    done.set(i, buf);
    flushing = flushing.then(flush);
    while (done.size > workers * 8) await flushing;
  }
}));
await flushing; ff.stdin.end(); const code = await ffDone; await browser.close();
if (code !== 0) { console.error('\n✗ ffmpeg فشل'); process.exit(1); }
const counted = await new Promise(r => { const p = spawn('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', partial]); let s = ''; p.stdout.on('data', d => s += d); p.on('close', () => r(parseInt(s))); });
if (Math.abs(counted - nFrames) > 1) { console.error(`\n✗ عدد الإطارات ${counted} ≠ ${nFrames}`); process.exit(1); }
fs.renameSync(partial, out);
console.log(`\n✓ ${path.relative(process.cwd(), out)}  ${F.width}×${F.height} @${fps}fps  ${nFrames} إطار  (sub=${sub})  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
