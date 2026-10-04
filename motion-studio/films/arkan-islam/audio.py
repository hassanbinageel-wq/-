"""أركان الإسلام — تسجيل المقدّم + مؤثرات ورقية لطيفة بلا موسيقى، على نفس توقيت film.html (timing.json)."""
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
def thud(l=.8):
    y = k.filt(k.kick(l, tail=.12), 'lowpass', 400); c = k.click(.6, .5); y[:len(c)] += .3 * c; return y
HEAD, NAME = [10, 16, 20, 25, 30], [11, 17, 21, 26, 31]
# العنوان والدخول والتذكير
sfx.add(k.pop(.3, .9), .15 - E); sfx.add(k.whoosh(.4, .2), .15); sfx.add(thud(.35), .75)
sfx.add(paper(1.6, .1), at(3) + .2); sfx.add(paper(.4, .18), at(3) + .1)
for t in (at(4) + .9, at(5), at(6)): sfx.add(k.pop(.25, 1.1), t - E)
sfx.add(sparkle(.6, .08), at(7) + .6); sfx.add(k.pop(.35, 1.2), at(8) - E); sfx.add(sparkle(.6, .08), at(9) + .1)
# الأركان الخمسة: بطاقة + بناء عمود
for h, n in zip(HEAD, NAME):
    sfx.add(paper(.4, .16), at(h) - .1)
    t = at(n) + .1; sfx.add(k.whoosh(.3, .14), t - .1); sfx.add(thud(.4), t + .3 - E); sfx.add(thud(.5), t + .62 - E); sfx.add(k.pop(.25, 1.3), t + .6 - E)
for t in (at(12) + .1, at(13) + .1, at(14) + .2, at(15) + .2): sfx.add(k.click(.25, pitch=1.2), t - E)
sfx.add(k.pop(.28, 1.0), at(17) + .4 - E)
for j in range(5): sfx.add(k.pop(.22, 1 + .1 * j), at(18) + .9 + j * .28 - E)
sfx.add(k.pop(.28, 1.1), at(19) + .3 - E)
for j in range(5): sfx.add(k.tick(.12, pitch=1.3), at(19) + .45 + j * .25)
sfx.add(k.pop(.3, .9), at(22) - E)
for j in range(3): sfx.add(k.tick(.14, pitch=1.5), at(22) + 1.2 + j * 1.1 + .8)
sfx.add(k.pop(.3, 1.2), at(23) - E); sfx.add(k.pop(.25, 1.1), at(27) - E)
sfx.add(paper(at(28, 'b') - at(28) - .2, .06), at(28) + .2); sfx.add(sparkle(.6, .08), at(28, 'b') - .1)
sfx.add(k.pop(.3, .8), at(32) + .3 - E); sfx.add(k.pop(.25, 1.1), at(34) - E); sfx.add(k.pop(.25, 1.2), at(35) - E)
# اليد والسقف والعدّ
sfx.add(k.whoosh(.4, .2), at(36) + .2)
for j in range(5): sfx.add(k.click(.2, pitch=1 + .1 * j), at(37) + .2 + j * .12)
roof = at(38) + .1
sfx.add(sparkle(1.0, .1), roof - .6); sfx.add(k.whoosh(.5, .26, up=False), roof - .2); sfx.add(thud(.9), roof + .35 - E); sfx.add(paper(.8, .2), roof + .38); sfx.add(sparkle(1.2, .12), roof + .45)
for j, i in enumerate(range(39, 44)): sfx.add(k.pop(.32, 1 + .12 * j), at(i) - E)
bravo = at(44)
sfx.add(sparkle(1.4, .16), bravo + .1)
for i in range(12): sfx.add(k.click(.1, pitch=k.vary()), bravo + .2 + i * .08)
sfx.x *= .5
k.finish([vo, sfx], os.path.join(HERE, 'out/score.wav'), verb=.05)
