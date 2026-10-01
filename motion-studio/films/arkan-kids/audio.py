"""أركان الدين — التعليق الصوتي (إن وُجد) + مؤثرات ورقية بلا موسيقى، على نفس توقيت film.html (timing.json)."""
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/motion-studio/scripts'))
from audio_kit import Kit

T = json.load(open(os.path.join(HERE, 'timing.json')))
V = T['vo']
at = lambda i, f=0: V[i - 1]['start'] + V[i - 1]['dur'] * f
k = Kit(dur=T['duration'], bpm=100)
E = k.EARLY
vo, sfx = k.bus(), k.bus()

def load(path):                         # mp3/wav → mono 48k
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(k.SR), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, np.float32).astype(float)

for v in V:
    if v['file']:
        x = load(os.path.join(HERE, v['file']))
        vo.add(x / (np.max(np.abs(x)) + 1e-9) * .9, v['start'])

def paper(d=.35, level=.25):            # حفيف ورق
    t = k.ts(d); n = k.filt(k.noise(d), 'bandpass', [1800, 7000])
    return level * n * np.sin(np.pi * np.minimum(1, t / d)) ** 2 * (1 + .6 * np.sin(t * 90))
def sparkle(d=.7, level=.12):
    t = k.ts(d); return level * k.filt(k.noise(d), 'bandpass', [6000, 12000]) * np.minimum(1, t / .01) * np.exp(-t / (d / 4))
def thud(level=.8):                     # خبطة خشب
    x = k.filt(k.kick(level, tail=.12), 'lowpass', 400); c = k.click(.6, .5); x[:len(c)] += .3 * c
    return x

ev = {'title': .3, 'three': at(1, .72), 'road': at(2, .02), 'c0': at(2, .45), 'outline': at(2, .78),
      'p': [at(3, .12), at(4, .12), at(5, .1)], 'c': [at(3, .2), at(4, .2), at(5, .18)],
      'icons': [at(3, .62), at(3, .82), at(4, .6), at(5, .55)], 'roof': at(6, .25), 'ribbon': at(6, .6),
      'rem': at(7, .02), 'k': [at(7, .5), at(7, .68), at(7, .86)], 'scroll': at(7) + V[6]['dur'] + .5}
sfx.add(k.pop(.35, .9), ev['title'] - E); sfx.add(paper(.4, .2), ev['title'])
sfx.add(k.pop(.4, 1.1), ev['three'] - E); sfx.add(k.pop(.3, 1.4), ev['three'] + .25 - E)
sfx.add(paper(1.4, .14), ev['road'])
sfx.add(paper(.4, .22), ev['c0'] - .1); sfx.add(sparkle(.6, .1), ev['outline'])
for i, t in enumerate(ev['p']):
    sfx.add(k.whoosh(.35, .18), t - .1); sfx.add(thud(.55), t + .32 - E)
for t in ev['c']: sfx.add(paper(.4, .2), t - .05)
for i, t in enumerate(ev['icons']): sfx.add(k.pop(.33, 1 + .12 * i), t - E)
sfx.add(k.whoosh(.5, .3, up=False), ev['roof'] - .2); sfx.add(thud(1.0), ev['roof'] + .35 - E); sfx.add(paper(.8, .25), ev['roof'] + .38)
sfx.add(sparkle(.9, .15), ev['ribbon']); sfx.add(k.pop(.35, 1.2), ev['ribbon'] - E)
sfx.add(k.pop(.3, 1.0), ev['rem'] - E)
for i, t in enumerate(ev['k']): sfx.add(k.pop(.38, 1 + .15 * i), t - E)
sfx.add(paper(.5, .22), ev['scroll'] - .1); sfx.add(sparkle(1.4, .2), ev['scroll'] + .2)
for i in range(10): sfx.add(k.click(.12, pitch=k.vary()), ev['scroll'] + .3 + i * .09)

# المؤثرات أخفض من التعليق بوضوح
if any(v['file'] for v in V): sfx.x *= .45
k.finish([vo, sfx], os.path.join(HERE, 'out/score.wav'), verb=.08)
