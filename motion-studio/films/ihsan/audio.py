"""الإحسان — صوت المقدّم + مؤثرات كتاب (تقليب صفحات، نوافذ، لمعات) بلا موسيقى، على توقيت film.html."""
import json, os, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/motion-studio/scripts'))
from audio_kit import Kit
T = json.load(open(os.path.join(HERE, 'timing.json'))); P = T['phrases']
at = lambda i, k='a': P[i][k]
k = Kit(dur=T['duration']); E = k.EARLY
vo, sfx = k.bus(), k.bus()
r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(HERE, 'assets/vo/voice.wav'), '-ac', '1', '-ar', str(k.SR), '-f', 'f32le', '-'], capture_output=True)
x = np.frombuffer(r.stdout, np.float32).astype(float); vo.add(x / (np.max(np.abs(x)) + 1e-9) * .95, T['off'])
def paper(d=.35, l=.2):
    t = k.ts(d); return l * k.filt(k.noise(d), 'bandpass', [1500, 7000]) * np.sin(np.pi * np.minimum(1, t / d)) ** 2
def sparkle(d=.7, l=.1):
    t = k.ts(d); return l * k.filt(k.noise(d), 'bandpass', [6000, 12000]) * np.minimum(1, t / .01) * np.exp(-t / (d / 4))
sfx.add(k.whoosh(.5, .2), 0); sfx.add(k.pop(.3, .9), .15 - E)
for d in (.9, 1.6): sfx.add(k.pop(.25, 1.1), at(1) + d - E)
sfx.add(sparkle(1.0, .1), at(2) + 1.2)
sfx.add(paper(1.1, .3), at(3) - .55)                                       # فتح الغلاف
for d in (.9, 1.7): sfx.add(k.pop(.25, 1.2), at(4) + d - E)
sfx.add(k.click(.3, pitch=1.3), at(5) - E)
for j in range(4): sfx.add(k.tick(.12, pitch=.7), at(6) + .3 + j * .3)  # خطوات المعلّم
sfx.add(sparkle(.9, .12), at(7) + .2); sfx.add(k.pop(.28, 1.1), at(8) + .5 - E)
for i in (9, 12, 15, 18, 21): sfx.add(paper(.9, .32), at(i) - .45)     # تقليب الصفحات
sfx.add(sparkle(1.6, .1), at(10)); sfx.add(sparkle(1.6, .1), at(11))
for d in (1.3, 2.0): sfx.add(k.pop(.28, 1.0), at(12) + d - E)
sfx.add(sparkle(.8, .1), at(13) + .4)
for j in range(3): sfx.add(k.pop(.25, .9 + .15 * j), at(14) + .2 + .3 * j - E)
sfx.add(sparkle(1.0, .12), at(14) + 1.6)
sfx.add(k.whoosh(1.2, .08), at(16)); sfx.add(sparkle(1.2, .1), at(17) + .2)
sfx.add(k.pop(.3, 1.2), at(19) + .4 - E); sfx.add(k.click(.4, pitch=.6), at(19) + 1.4 - E); sfx.add(sparkle(.9, .1), at(20) + .2)
sfx.add(k.pop(.35, .8), at(22) - E); sfx.add(sparkle(1.4, .08), at(23)); sfx.add(sparkle(1.6, .08), at(24))
b = at(25); sfx.add(sparkle(1.4, .16), b + .1)
for i in range(12): sfx.add(k.click(.1, pitch=k.vary()), b + .2 + i * .08)
for d in (.9, 1.7, 2.6): sfx.add(k.pop(.28, 1.1), at(26) + d - E)
sfx.x *= .5
k.finish([vo, sfx], os.path.join(HERE, 'out/score.wav'), verb=.05)
