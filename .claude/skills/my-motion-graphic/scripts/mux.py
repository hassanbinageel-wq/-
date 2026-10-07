#!/usr/bin/env python3
"""mux.py — يدمج الصورة والصوت ويضبط الجهارة: loudnorm بمرورين إلى الهدف تحت سقف true-peak، ثم يعيد القياس.

    python3 mux.py out/video.mp4 out/score.wav ../final.mp4 [--lufs -14] [--tp -1.5]

-14 LUFS لمنصّات السوشال (تيك توك/إنستغرام/يوتيوب). يخرج بخطأ إن لم يصب الهدف ±1 أو إن كان الفيديو أقصر من الصوت.
"""
import json, re, subprocess, sys

a = sys.argv[1:]
video, audio, out = a[0], a[1], a[2]
lufs = float(a[a.index('--lufs') + 1]) if '--lufs' in a else -14.0
tp = float(a[a.index('--tp') + 1]) if '--tp' in a else -1.5


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def dur(p):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).stdout)


def measure(p, extra=''):
    r = run(['ffmpeg', '-hide_banner', '-i', p, '-af', f'{extra}loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json', '-f', 'null', '-'])
    return json.loads(re.findall(r'\{[^{}]+\}', r.stderr)[-1])


if dur(video) + .05 < dur(audio):
    sys.exit(f'✗ الفيديو ({dur(video):.2f}s) أقصر من الصوت ({dur(audio):.2f}s) — رندر توقف مبكرًا؟')
m = measure(audio)
ceiling = tp
for attempt in range(4):
    af = (f"loudnorm=I={lufs}:TP={ceiling}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
          f"aresample=192000,alimiter=limit={10 ** (ceiling / 20):.4f}:attack=1:release=50:level=false,aresample=48000")
    r = run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a',
             '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out])
    if r.returncode:
        sys.exit(r.stderr)
    f = measure(out)
    I, TP = float(f['input_i']), float(f['input_tp'])
    if TP <= tp + .1:
        break
    ceiling -= TP - tp + .2   # AAC يرفع الذروات المتلاحقة؛ اخفض السقف بمقدار التجاوز وأعد
print(f'✓ {out}  {I:.1f} LUFS  {TP:.1f} dBTP  (الهدف {lufs} / {tp})')
if abs(I - lufs) > 1 or TP > tp + .1:
    sys.exit('✗ خارج الهدف — خفّض ذروات المزج وأعد')
