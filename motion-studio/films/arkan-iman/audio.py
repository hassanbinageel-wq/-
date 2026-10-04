"""أركان الإيمان — صوت المقدّم + مؤثرات ناعمة بلا موسيقى (فوانيس تضيء، نور يملأ القلب)، على توقيت film.html."""
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
    t = k.ts(d); return l * k.filt(k.noise(d), 'bandpass', [1800, 7000]) * np.sin(np.pi * np.minimum(1, t / d)) ** 2
def sparkle(d=.7, l=.1):
    t = k.ts(d); return l * k.filt(k.noise(d), 'bandpass', [6000, 12000]) * np.minimum(1, t / .01) * np.exp(-t / (d / 4))
HEAD, NAME = [9, 14, 21, 27, 32, 37], [10, 15, 22, 28, 33, 38]
sfx.add(k.pop(.3, .9), .15 - E); sfx.add(k.whoosh(.4, .2), .15)
sfx.add(paper(.4, .16), at(3) + .1)
for j, d in enumerate((.05, .65, 1.25)): sfx.add(k.pop(.25, 1 + .1 * j), at(4) + d - E)
sfx.add(k.whoosh(.8, .15), at(7) - .1)
for j in range(6): sfx.add(k.click(.22, pitch=1 + .06 * j), at(7) + .2 + j * .14)
sfx.add(sparkle(.9, .08), at(8) + .1)
for h, n in zip(HEAD, NAME):
    sfx.add(paper(.4, .14), at(h) - .1)
    u = at(n) + .15
    sfx.add(k.pop(.35, 1.3), u - E); sfx.add(sparkle(1.0, .14), u)
    sfx.add(k.whoosh(.9, .1), u + .45); sfx.add(sparkle(.8, .1), u + 1.45); sfx.add(k.pop(.22, .8), u + 1.45 - E)
for i in range(42, 48): sfx.add(k.pop(.3, 1 + .08 * (i - 42)), at(i) - E); sfx.add(sparkle(.5, .07), at(i))
sfx.add(k.pop(.3, .7), at(48) - E); sfx.add(sparkle(1.4, .18), at(49)); sfx.add(k.impact(.4), at(49) - E)
bravo = at(50)
sfx.add(sparkle(1.4, .16), bravo + .1)
for i in range(12): sfx.add(k.click(.1, pitch=k.vary()), bravo + .2 + i * .08)
sfx.x *= .5
k.finish([vo, sfx], os.path.join(HERE, 'out/score.wav'), verb=.05)
