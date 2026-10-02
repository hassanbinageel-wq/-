"""فن أخضر 2 — الصوت الأصلي للقطة (كلام المتحدثة) في مكانه مع تلاشٍ ناعم، ومؤثرات انتقال خفيفة بلا موسيقى."""
import os, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/motion-studio/scripts'))
from audio_kit import Kit
T0, DUR, T_OUT = 1.6, 12.2, 8.7
k = Kit(dur=DUR)
src, sfx = k.bus(), k.bus()
r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(HERE, 'assets/source_audio.wav'), '-ac', '2', '-ar', str(k.SR), '-f', 'f32le', '-'], capture_output=True)
x = np.frombuffer(r.stdout, np.float32).astype(float).reshape(-1, 2).T
n = x.shape[1]; t = np.arange(n) / k.SR
fade = np.minimum(1, t / .35) * np.clip((n / k.SR - t) / .6, 0, 1)
dip = 1 - .55 * np.clip((t - (T_OUT - T0)) / .5, 0, 1)          # يخفت تحت لوح الختام
src.add(x * fade * dip, T0)
def air(d, level):
    tt = k.ts(d); return level * k.filt(k.noise(d), 'bandpass', [3000, 10000]) * np.minimum(1, tt / .02) * np.exp(-tt / (d / 4))
sfx.add(k.whoosh(.5, .16), .1); sfx.add(air(1.2, .08), .35)
sfx.add(k.whoosh(.55, .3), T0 - .5)                              # خروج لوح الافتتاح
sfx.add(k.click(.12), 2.45); sfx.add(k.click(.1), 6.25)          # الشريط السفلي
sfx.add(k.whoosh(.6, .28, up=False), T_OUT - .05)
sfx.add(air(1.6, .1), T_OUT + .7)
k.finish([src, sfx], os.path.join(HERE, 'out/score.wav'), verb=0)
