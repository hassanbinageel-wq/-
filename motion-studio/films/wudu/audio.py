"""فروض الوضوء — صوت المقدّم + مؤثرات ماء خفيفة بلا موسيقى، على توقيت film.html."""
import json, os, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/my-motion-graphic/scripts'))
from audio_kit import Kit
T = json.load(open(os.path.join(HERE, 'timing.json'))); P = T['phrases']
at = lambda i, k='a': P[i][k]
k = Kit(dur=T['duration']); E = k.EARLY
vo, sfx = k.bus(), k.bus()
r = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(HERE, 'assets/vo/voice.wav'), '-ac', '1', '-ar', str(k.SR), '-f', 'f32le', '-'], capture_output=True)
x = np.frombuffer(r.stdout, np.float32).astype(float); vo.add(x / (np.max(np.abs(x)) + 1e-9) * .95, T['off'])
def water(d=1.2, l=.08):          # خرير ماء ناعم: ضوضاء مفلترة مع تموّج
    t = k.ts(d); n = k.filt(k.noise(d), 'bandpass', [900, 4500])
    return l * n * (.6 + .4 * np.sin(t * 23) ** 2) * np.sin(np.pi * np.minimum(1, t / d)) ** .5
def drip(l=.25):                  # قطرة: نغمة قصيرة تنزلق للأعلى
    t = k.ts(.12); f = 900 + 2200 * t / .12
    return l * np.sin(2 * np.pi * np.cumsum(f) / k.SR) * np.exp(-t / .03)
def sparkle(d=.7, l=.1):
    t = k.ts(d); return l * k.filt(k.noise(d), 'bandpass', [6000, 12000]) * np.minimum(1, t / .01) * np.exp(-t / (d / 4))
sfx.add(k.pop(.3, .9), .15 - E); sfx.add(k.whoosh(.4, .2), .15)
sfx.add(k.pop(.35, 1.0), at(2) + 1.6 - E); sfx.add(k.click(.3, pitch=.7), at(3) + .4 - E)
for i in range(6, 12): sfx.add(k.pop(.22, 1 + .06 * (i - 6)), at(i) - E); sfx.add(drip(.15), at(i) + .1)
for i in range(14, 20): sfx.add(k.tick(.14, pitch=1.2), at(i) - E)
for n, i in enumerate((21, 26, 30, 34, 36, 39)):
    sfx.add(k.whoosh(.35, .14), at(i) - .45); sfx.add(drip(.3), at(i) + .8)
    if n in (1, 2, 4): sfx.add(water(2.4, .07), at(i) + .4)
    if n == 3: sfx.add(water(1.2, .05), at(35) + .8)
    if n == 0: sfx.add(sparkle(1.0, .1), at(22) + .2)
for i in (43, 44): sfx.add(k.pop(.25, 1.1), at(i) - E)
for i in (46, 47): sfx.add(k.pop(.22, .9), at(i) + .1 - E)
sfx.add(water(1.0, .06), at(47) + .4)
for j, i in enumerate(range(49, 54)): sfx.add(k.pop(.22, 1 + .08 * j), at(i) - E); sfx.add(drip(.12), at(i) + .1)
sfx.add(sparkle(1.0, .14), at(55))
sfx.add(k.click(.4, pitch=.6), at(58) + .6 - E)
sfx.add(k.pop(.3, .8), at(59) + .2 - E)
for j, i in enumerate(range(64, 70)): sfx.add(k.tick(.14, pitch=1 + .05 * j), at(i) - E)
b = at(70); sfx.add(sparkle(1.4, .16), b + .1)
for i in range(12): sfx.add(k.click(.1, pitch=k.vary()), b + .2 + i * .08)
sfx.x *= .5
k.finish([vo, sfx], os.path.join(HERE, 'out/score.wav'), verb=.05)
