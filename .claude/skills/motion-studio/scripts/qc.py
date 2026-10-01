#!/usr/bin/env python3
"""qc.py — النظر هو المنهج. أدوات حلقة النقد على الفيديو النهائي أو مجلد لقطات.

    python3 qc.py sheet  out/video.mp4 [--fps 4]          ورقة تماس للفيلم كله
    python3 qc.py strip  out/video.mp4 --at 2.0           12 إطارًا حول قطع أو حركة سريعة
    python3 qc.py phone  out/video.mp4 --at 1,3,5         عرض 360px: هل يُقرأ على جوال؟
    python3 qc.py safe   out/video.mp4 --at 1,3,5         تراكب المنطقة الآمنة (أزرار تيك توك/ريلز)
    python3 qc.py centre out/video.mp4 --at 3 --band 800:1100   مركز الحبر أفقيًا داخل شريط
    python3 qc.py motion out/video.mp4                    طاقة الحركة: الوسيط ونسبة الثبات
    python3 qc.py stills out/stills                       ورقة تماس من مجلد لقطات
كل الصور تُكتب في out/qc/ — افتحها وانظر فيها فعلًا.
"""
import os, subprocess, sys, tempfile, glob
import numpy as np
from PIL import Image, ImageDraw

cmd, src = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
d = os.path.dirname(os.path.abspath(src))
while os.path.basename(d) in ('out', 'stills', 'qc'):
    d = os.path.dirname(d)
QC = os.path.join(d, 'out', 'qc')   # دائمًا <film>/out/qc
os.makedirs(QC, exist_ok=True)


def frame_at(t, w=None):
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        p = f.name
    vf = ['-vf', f'scale={w}:-2'] if w else []
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(t), '-i', src, '-frames:v', '1', *vf, p], check=True)
    im = Image.open(p).convert('RGB'); os.unlink(p)
    return im


def duration():
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)


def tile(ims, labels, cols, path, cw=270):
    ims = [im.resize((cw, int(im.height * cw / im.width))) for im in ims]
    ch = ims[0].height + 26; rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), (24, 24, 24)); d = ImageDraw.Draw(sheet)
    for i, (im, lb) in enumerate(zip(ims, labels)):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(im, (x, y + 26)); d.text((x + 6, y + 6), lb, fill=(230, 230, 230))
    sheet.save(path); print('→', os.path.relpath(path))


ats = [float(x) for x in opt('--at', '').split(',') if x]

if cmd == 'sheet':
    fps = float(opt('--fps', 4)); D = duration(); ts = np.arange(0, D, 1 / fps)
    for page, i in enumerate(range(0, len(ts), 24)):
        chunk = ts[i:i + 24]
        tile([frame_at(t, 360) for t in chunk], [f'{t:.2f}s' for t in chunk], 6, f'{QC}/sheet_{page + 1}.png', 220)
elif cmd == 'stills':
    fs = sorted(glob.glob(os.path.join(src, '*.png')))
    for page, i in enumerate(range(0, len(fs), 24)):
        chunk = fs[i:i + 24]
        tile([Image.open(f).convert('RGB') for f in chunk], [os.path.basename(f)[2:-4] + 's' for f in chunk], 6, f'{QC}/stills_{page + 1}.png', 220)
elif cmd == 'strip':
    for t in ats:
        fps = 30; ts = [t + (k - 6) / fps for k in range(12)]
        tile([frame_at(max(0, x), 360) for x in ts], [f'{x:.3f}' for x in ts], 6, f'{QC}/strip_{t:.2f}.png', 220)
elif cmd == 'phone':
    for t in ats:
        frame_at(t, 360).save(f'{QC}/phone_{t:.2f}.png'); print('→', f'{QC}/phone_{t:.2f}.png')
elif cmd == 'safe':
    for t in ats:
        im = frame_at(t); W, H = im.size; k = W / 1080
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        d.rectangle([0, 0, W, 250 * k], fill=(255, 0, 0, 70))                 # شريط علوي (حساب/بحث)
        d.rectangle([0, 1440 * k, W, H], fill=(255, 0, 0, 70))                # الوصف والأزرار السفلية
        d.rectangle([890 * k, 880 * k, W, 1440 * k], fill=(255, 0, 0, 70))  # أزرار اللايك/التعليق
        d.line([540 * k, 0, 540 * k, H], fill=(0, 255, 255, 120), width=2)
        Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB').save(f'{QC}/safe_{t:.2f}.png'); print('→', f'{QC}/safe_{t:.2f}.png')
elif cmd == 'centre':
    y0, y1 = [int(v) for v in opt('--band', '0:1920').split(':')]
    for t in ats:
        a = np.asarray(frame_at(t)).astype(float); band = a[y0:y1]
        bg = np.median(band.reshape(-1, 3), axis=0); ink = np.abs(band - bg).sum(2) > 60
        xs = np.where(ink.any(0))[0]
        if not len(xs): print(f'{t:.2f}s: لا حبر في الشريط'); continue
        c = (xs[0] + xs[-1]) / 2 * 1080 / a.shape[1]
        print(f'{t:.2f}s: الحبر {xs[0]}–{xs[-1]}  المركز {c:.0f}  الانحراف {c - 540:+.0f}px {"✓" if abs(c - 540) <= 6 else "✗"}')
elif cmd == 'motion':
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', src, '-vf', 'scale=180:-2,format=gray', '-f', 'rawvideo', '-'], capture_output=True)
    W = 180; H = int(round(180 * 1920 / 1080 / 2) * 2)
    fr = np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W).astype(float)
    diff = np.abs(np.diff(fr, axis=0)).mean((1, 2)); still = diff < float(opt('--still', .15))
    runs, cur = [], 0
    for s in still:
        cur = cur + 1 if s else 0; runs.append(cur)
    print(f'الوسيط {np.median(diff):.2f}  الثبات {still.mean() * 100:.0f}%  أطول ثبات {max(runs) / 30:.2f}s')
    print('الهدف: حماسي — وسيط ≥ 3، ثبات ≤ 15%، لا ثبات ≥ 0.6s | هادئ/فاخر — ثبات ≤ 35%، لا ثبات ≥ 1s (إلا فراغ مقصود أو بطاقة الختام)')
    print('timeline:')
    for i in range(0, len(diff), 15):
        print(f'  {i / 30:5.2f} ' + ''.join('.' if s else '#' for s in still[i:i + 15]))
