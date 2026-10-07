"""audio_kit.py — صوت مُركّب على نفس خط زمن الصورة (numpy/scipy فقط).

    import sys; sys.path.insert(0, '<skill>/scripts'); from audio_kit import *
    k = Kit(dur=12, bpm=120)
    music, sfx = k.bus(), k.bus()
    for n in range(24): music.add(k.kick(), k.beat(n))
    sfx.add(k.whoosh(.4), 2.0 - .4 - k.EARLY)     # الووش ينتهي على إطار القطع
    k.vacuum([music], 7.75, 8.0)                   # فراغ قبل الذروة
    k.finish([music, sfx], 'out/score.wav')

قواعد: المؤثر يسبق إطار التلامس بـ ~0.03 ث (EARLY). نوّع طبقة الصوت المكرر (vary). الصوت مُقاس لا مسموع —
قل ذلك عند التسليم واطلب سماعه بسماعات مرة واحدة.
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile


class Bus:
    def __init__(self, kit):
        self.kit = kit
        self.x = np.zeros((2, kit.N))

    def add(self, sig, start, gain=1.0, pan=0.0):
        sr, n_all = self.kit.SR, self.kit.N
        i0 = int(round(start * sr))
        if i0 >= n_all:
            return self
        if sig.ndim == 1:
            th = (pan + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(th), sig * np.sin(th)]) * np.sqrt(2)
        if i0 < 0:
            sig, i0 = sig[:, -i0:], 0
        n = min(sig.shape[1], n_all - i0)
        self.x[:, i0:i0 + n] += gain * sig[:, :n]
        return self

    def gain_env(self, env):
        self.x *= env
        return self


class Kit:
    EARLY = .03

    def __init__(self, dur, bpm=120, sr=48000, seed=7):
        self.SR, self.dur, self.bpm = sr, dur, bpm
        self.N = int(sr * dur)
        self.rng = np.random.default_rng(seed)
        self.t = np.arange(self.N) / sr

    # ---------------------------------------------------------------- أساسيات
    def bus(self): return Bus(self)
    def beat(self, n): return n * 60 / self.bpm
    def ts(self, d): return np.arange(int(d * self.SR)) / self.SR
    def noise(self, d): return self.rng.standard_normal(int(d * self.SR))
    def filt(self, x, kind, f, order=2): return signal.sosfilt(signal.butter(order, f, kind, fs=self.SR, output='sos'), x)
    def vary(self, lo=.92, hi=1.12): return float(lo + (hi - lo) * self.rng.random())
    @staticmethod
    def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

    def env(self, d, a=.005, r=.2):
        t = self.ts(d)
        return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)

    # ---------------------------------------------------------------- إيقاع
    def kick(self, level=1.0, tail=.22):
        t = self.ts(.55); f = 42 + 140 * np.exp(-t / .028)
        ph = 2 * np.pi * np.cumsum(f) / self.SR
        body = np.sin(ph) * np.exp(-t / tail) + np.tanh(3 * np.sin(ph)) * np.exp(-t / .05) * .3
        click = self.filt(self.noise(.55), 'highpass', 3000) * np.exp(-t / .003) * .25
        return level * (body + click)

    def clap(self, level=.6):
        t = self.ts(.4); n = self.filt(self.noise(.4), 'bandpass', [900, 2600])
        e = sum(np.exp(-np.maximum(t - o, 0) / .008) * (t >= o) for o in (0, .011, .022)) * .5 + np.exp(-t / .12) * (t >= .03)
        return level * n * e

    def hat(self, level=.18, open_=False):
        d = .35 if open_ else .08; t = self.ts(d)
        return level * self.filt(self.noise(d), 'highpass', 7000) * np.exp(-t / (d / 3))

    def tick(self, level=.25, pitch=1.0):
        t = self.ts(.05)
        return level * np.sin(2 * np.pi * 3200 * pitch * t) * np.exp(-t / .006)

    # ---------------------------------------------------------------- نغمي
    def bass(self, midi, d, level=.5):
        t = self.ts(d); f = self.hz(midi)
        x = np.sin(2 * np.pi * f * t) + .3 * np.tanh(2 * np.sin(2 * np.pi * f * t))
        return level * x * np.minimum(1, t / .01) * np.exp(-t / (d * .9))

    def pad(self, midis, d, level=.16, bright=1800):
        t = self.ts(d); x = np.zeros_like(t)
        for m in midis:
            for det in (-.08, 0, .08):
                f = self.hz(m + det); x += signal.sawtooth(2 * np.pi * f * t + self.rng.random() * 6)
        x = self.filt(x / (len(midis) * 3), 'lowpass', bright)
        a = np.minimum(1, t / .35); r = np.minimum(1, (d - t) / .4)
        return level * x * a * np.clip(r, 0, 1)

    def pluck(self, midi, level=.3, d=.6):
        t = self.ts(d); f = self.hz(midi)
        x = signal.square(2 * np.pi * f * t) * .4 + np.sin(2 * np.pi * f * 2 * t) * .4
        return level * self.filt(x, 'lowpass', 2600) * np.exp(-t / .18)

    def bell(self, midi, level=.25, d=1.6):
        t = self.ts(d); f = self.hz(midi)
        x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (d * dd)) for r, a, dd in ((1, 1, .5), (2.76, .4, .25), (5.4, .2, .12)))
        return level * x

    # ---------------------------------------------------------------- مؤثرات
    def whoosh(self, d=.45, level=.35, up=True):
        n = self.noise(d); t = self.ts(d); k = t / d
        out = np.zeros_like(n); hop = max(1, len(n) // 24)
        for i in range(0, len(n), hop):
            frac = i / len(n); f = 300 * (12 ** (frac if up else 1 - frac))
            seg = self.filt(n[max(0, i - hop):i + hop], 'bandpass', [f * .7, min(f * 1.4, self.SR / 2 - 100)])
            out[i:i + hop] = seg[-min(hop, len(out) - i):] if i else seg[:hop]
        return level * out * np.sin(np.pi * k) ** 1.5 * (k ** .7 if up else 1)

    def riser(self, d=1.5, level=.25):
        t = self.ts(d); f = 200 * 8 ** (t / d)
        tone = signal.sawtooth(2 * np.pi * np.cumsum(f) / self.SR) * .3
        return level * (self.filt(self.noise(d), 'highpass', 1500) * .5 + tone) * (t / d) ** 2

    def impact(self, level=.8):
        t = self.ts(1.6); f = 30 + 70 * np.exp(-t / .06)
        boom = np.sin(2 * np.pi * np.cumsum(f) / self.SR) * np.exp(-t / .5)
        crack = self.filt(self.noise(1.6), 'bandpass', [1500, 6000]) * np.exp(-t / .03)
        return level * (boom + crack * .4)

    def pop(self, level=.35, pitch=1.0):
        t = self.ts(.12); f = 900 * pitch * np.exp(-t / .03) + 300
        return level * np.sin(2 * np.pi * np.cumsum(f) / self.SR) * np.exp(-t / .03)

    def click(self, level=.3, pitch=1.0):
        t = self.ts(.03)
        return level * self.filt(self.noise(.03), 'bandpass', [2000 * pitch, 6000 * pitch]) * np.exp(-t / .004)

    def chime(self, root=76, level=.22):
        x = np.zeros(int(1.2 * self.SR))
        for i, m in enumerate((root, root + 4, root + 7)):
            b = self.bell(m, level / 2, 1.0); o = int(i * .06 * self.SR); x[o:o + len(b)] += b[:len(x) - o]
        return x

    # ---------------------------------------------------------------- هيكل
    def vacuum(self, buses, t0, t1, floor=.03):
        """إسكات كل شيء قبل الذروة — أقوى أداة لتجعل الضربة تقع"""
        e = np.ones(self.N); a, b = int(t0 * self.SR), int(t1 * self.SR); ramp = int(.02 * self.SR)
        e[a:b] = floor; e[max(0, a - ramp):a] = np.linspace(1, floor, min(ramp, a))
        for bs in buses: bs.gain_env(e)

    def sidechain(self, bus, beats, depth=.6, rel=.18):
        e = np.ones(self.N)
        for b in beats:
            i = int(b * self.SR); n = min(int(rel * 3 * self.SR), self.N - i)
            if n > 0: e[i:i + n] *= 1 - depth * np.exp(-np.arange(n) / self.SR / rel)
        bus.gain_env(e)

    def reverb(self, x, size=1.4, mix=.18):
        ir_t = self.ts(size); ir = self.rng.standard_normal(len(ir_t)) * np.exp(-ir_t / (size / 5))
        ir = self.filt(ir, 'lowpass', 5000)
        wet = np.stack([signal.fftconvolve(c, ir)[:x.shape[1]] for c in x])
        wet *= np.max(np.abs(x)) / (np.max(np.abs(wet)) + 1e-9)
        return x * (1 - mix) + wet * mix

    def finish(self, buses, path, verb=.12, sections=None):
        x = sum(b.x for b in buses)
        if verb: x = self.reverb(x, mix=verb)
        x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * 1.4) * .89  # محدّ ناعم؛ mux.py يضبط الجهارة النهائية
        fade = int(.01 * self.SR); x[:, :fade] *= np.linspace(0, 1, fade); x[:, -fade:] *= np.linspace(1, 0, fade)
        wavfile.write(path, self.SR, (x.T * 32767).astype(np.int16))
        if sections:
            for a, b, name in sections:
                seg = x[:, int(a * self.SR):int(b * self.SR)]
                print(f'  {name:<14} {a:5.2f}-{b:5.2f}s  RMS {20*np.log10(np.sqrt(np.mean(seg**2))+1e-9):6.1f} dB')
        print(f'✓ {path}  {self.dur:.2f}s')
