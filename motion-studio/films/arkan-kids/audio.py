"""أركان الدين — تسجيل الطفل + مؤثرات ورقية لطيفة بلا موسيقى، على نفس توقيت film.html (timing.json)."""
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
ev = dict(boy=.25, title=.15, road=at(4) + .2, three=at(5, 'b') - .6, c0=at(6), outline=at(8) + .1,
          p=[at(9, 'b') - .75, at(12, 'b') - .75, at(14, 'b') - .75], icons=[at(11) + .35, at(11) + .95, at(13) + .45, at(16) + .15],
          roof=at(18) + .05, ribbon=at(18, 'b') - .35, rem=at(19), k=[at(21), at(22), at(23)], bravo=at(24))
sfx.add(k.pop(.3, .9), ev['title'] - E); sfx.add(k.whoosh(.4, .2), ev['boy'] - .1); sfx.add(thud(.35), ev['boy'] + .5)
sfx.add(paper(1.6, .1), ev['road']); sfx.add(k.pop(.35, 1.2), ev['three'] - E); sfx.add(paper(.4, .18), ev['c0']); sfx.add(sparkle(.6, .08), ev['outline'])
for t in ev['p']:
    sfx.add(k.whoosh(.3, .14), t - .1); sfx.add(thud(.4), t + .3 - E); sfx.add(thud(.5), t + .62 - E); sfx.add(paper(.35, .15), t + .2)
for i, t in enumerate(ev['icons']): sfx.add(k.pop(.28, 1 + .12 * i), t - E)
sfx.add(sparkle(1.0, .1), ev['roof'] - .6)
sfx.add(k.whoosh(.5, .26, up=False), ev['roof'] - .2); sfx.add(thud(.9), ev['roof'] + .35 - E); sfx.add(paper(.8, .2), ev['roof'] + .38); sfx.add(sparkle(1.2, .12), ev['roof'] + .45)
sfx.add(k.pop(.3, 1.2), ev['ribbon'] - E); sfx.add(k.pop(.28, 1.0), ev['rem'] - E)
for i, t in enumerate(ev['k']): sfx.add(k.pop(.32, 1 + .15 * i), t - E)
sfx.add(sparkle(1.4, .16), ev['bravo'] + .1)
for i in range(12): sfx.add(k.click(.1, pitch=k.vary()), ev['bravo'] + .2 + i * .08)
sfx.x *= .5                                    # المؤثرات تحت صوت الطفل بوضوح
k.finish([vo, sfx], os.path.join(HERE, 'out/score.wav'), verb=.05)
