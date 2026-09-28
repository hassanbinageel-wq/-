import numpy as np, wave
from scipy.signal import butter, sosfilt, fftconvolve

SR, DUR = 48000, 11.5
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)
out = np.zeros((N, 2))

def env(a, b, attack=0.01, release=0.3, curve=3):
    e = np.zeros(N)
    m = (t >= a) & (t < b + release * 4)
    tt = t[m] - a
    e[m] = np.clip(tt / attack, 0, 1) * np.where(tt < b - a, 1, np.exp(-(tt - (b - a)) / release))
    return e

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)

def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x)

def pan(x, p):  # p -1..1
    return np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], 1)

noise = rng.standard_normal(N)

# drone bed
fade = np.clip(t / 2.5, 0, 1) * np.clip((11.3 - t) / 1.8, 0, 1)
drone = (np.sin(2 * np.pi * 41.2 * t) * 0.5 + np.sin(2 * np.pi * 61.7 * t + 0.4) * 0.25
         + np.sin(2 * np.pi * 82.4 * t * (1 + 0.002 * np.sin(t))) * 0.18)
drone += lp(noise, 180) * 0.6
out += pan(drone * fade * 0.22, 0)
air = bp(rng.standard_normal(N), 2000, 7000) * fade * 0.015
out += np.stack([air, np.roll(air, 900)], 1)

# horizon line: bright swell (shimmering sweep)
sw = env(0.25, 0.9, attack=0.4, release=0.6)
f = 600 + 2400 * np.clip((t - 0.25) / 0.7, 0, 1) ** 2
ph = 2 * np.pi * np.cumsum(f) / SR
out += pan((np.sin(ph) * 0.05 + bp(noise, 3000, 9000) * 0.25) * sw, 0) * 0.5

# riser into ignition
r = np.clip((t - 0.7) / 0.9, 0, 1) ** 3 * (t < 1.6)
out += pan(bp(rng.standard_normal(N), 800, 6000) * r * 0.35, 0)

# ignition impact at 1.6
def boom(at, amp=1.0, f0=90, f1=32, dec=1.2, p=0.0):
    m = t >= at; tt = t[m] - at
    fr = f1 + (f0 - f1) * np.exp(-tt * 9)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / dec)
    s += lp(rng.standard_normal(m.sum()), 1500) * np.exp(-tt / 0.08) * 0.8
    s += bp(rng.standard_normal(m.sum()), 2000, 10000) * np.exp(-tt / 0.03) * 0.3
    x = np.zeros(N); x[m] = s * amp
    return pan(x, p)
out += boom(1.6, 1.0, dec=1.6)

# whooshes + clicks for each monogram block
pans = [-0.4, -0.2, -0.7, 0.2, 0.3, 0.7]
for i in range(6):
    st = 2.05 + i * 0.13
    w = env(st - 0.05, st + 0.12, attack=0.12, release=0.08)
    out += pan(bp(rng.standard_normal(N), 400, 3500) * w * 0.35, pans[i])
    out += boom(st + 0.2, 0.35, f0=160, f1=60, dec=0.18, p=pans[i])

# letters dropping: soft taps
for i in range(11):
    st = 3.25 + i * 0.055 + 0.18
    m = t >= st; tt = t[m] - st
    x = np.zeros(N)
    x[m] = np.sin(2 * np.pi * (900 + i * 40) * tt) * np.exp(-tt / 0.04) * 0.08
    x[m] += bp(rng.standard_normal(m.sum()), 1500, 6000) * np.exp(-tt / 0.02) * 0.12
    out += pan(x, -0.6 + i * 0.12)
out += boom(3.45, 0.35, f0=70, f1=35, dec=1.0)

# production: airy swell pad
sw = env(4.3, 5.8, attack=0.9, release=1.5)
chord = sum(np.sin(2 * np.pi * fq * t + k) for k, fq in enumerate([220, 277.2, 329.6, 440]))
out += pan(chord * sw * 0.035, 0)

# glint shimmer
for k, fq in enumerate([1760, 2637, 3520, 5274]):
    st = 6.1 + k * 0.08
    m = t >= st; tt = t[m] - st
    x = np.zeros(N); x[m] = np.sin(2 * np.pi * fq * tt) * np.exp(-tt / 0.9) * 0.04
    out += pan(x, -0.5 + k * 0.33)

# final low resolve
sw = env(6.8, 9.5, attack=1.2, release=1.2)
out += pan((np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * sw * 0.16, 0)

# reverb
irl = int(SR * 2.8); it = np.arange(irl) / SR
ir = rng.standard_normal((irl, 2)) * np.exp(-it / 0.7)[:, None]
ir = np.stack([lp(ir[:, 0], 6000), lp(ir[:, 1], 6000)], 1) * 0.012
wet = np.stack([fftconvolve(out[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = out + wet * 0.9
mix *= np.clip((11.5 - t) / 0.6, 0, 1)[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix /= np.abs(mix).max() / 0.89
with wave.open("audio.wav", "wb") as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok")
