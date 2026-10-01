"""ابتسم — مؤثرات وإيقاع بلا آلات موسيقية (لا pad ولا bass ولا bell)، على خط زمن الصورة."""
import os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/motion-studio/scripts'))
from audio_kit import Kit

k = Kit(dur=15, bpm=100)
E = k.EARLY
pulse, sfx, ui = k.bus(), k.bus(), k.bus()


def thump(level=.5, tail=.18):          # نبضة sub بلا نغمة
    return k.filt(k.kick(level, tail=tail), 'lowpass', 180)


def air(d=.9, level=.18):               # "لمعة" هوائية من ضوضاء مفلترة (بديل الجرس)
    t = k.ts(d)
    return level * k.filt(k.noise(d), 'bandpass', [5000, 11000]) * np.minimum(1, t / .02) * np.exp(-t / (d / 4))


# 0–3.6: المشكلة — نبض بطيء ثقيل
sfx.add(k.whoosh(.6, .18), 0.05)                      # رسم الخط
for n in range(1, 6):
    pulse.add(thump(.55, .22), k.beat(n) - E)
for i in range(16):                                   # عدّاد ٩٠٪
    ui.add(k.tick(.14, pitch=k.vary()), 1.0 + .9 * (1 - (1 - i / 16) ** 1.7))
ui.add(k.pop(.3, .8), 1.0 - E)
for i in range(5):                                    # كلمات السطر الثاني
    ui.add(k.click(.22, pitch=k.vary()), 2.4 + i * .12 - E)

# 3.6: الانقلاب — الخط يبتسم والأرضية تتفتح
sfx.add(k.whoosh(.45, .4), 3.6 - .45)
sfx.add(k.impact(.55), 3.6 - E)
sfx.add(air(1.2, .22), 3.62)
sfx.add(k.impact(.5), 4.2 - E)                        # «ابتسم»
sfx.add(air(1.1, .2), 4.22)                           # انفجار الأوراق
for n in range(7, 10):
    pulse.add(thump(.6, .14), k.beat(n) - E)          # نبض أسرع وأخف = أمل
sfx.add(k.whoosh(.4, .3), 5.45)                       # الخروج يسارًا

# 6–11.4: الأرقام
for j, t0 in enumerate((6.0, 7.8, 9.6)):
    ui.add(k.pop(.35, 1 + .15 * j), t0 - E)
    for i in range(18):
        ui.add(k.tick(.13, pitch=k.vary() * (1 + .08 * j)), t0 + .05 + 1.0 * (1 - (1 - i / 18) ** 1.7))
    sfx.add(air(.8, .16), t0 + 1.0)
    pulse.add(thump(.7, .2), t0 - E)
    sfx.add(k.whoosh(.35, .22), t0 - .3)              # البطاقة تدخل
for t in np.arange(6.6, 11.4, .6):
    pulse.add(thump(.35, .1), t - E)

# 11.4–11.7: فراغ. ثم الورقة والشعار
sfx.add(k.whoosh(.6, .3), 11.75)
sfx.add(k.impact(.7), 12.1 - E)                       # الشعار
sfx.add(air(1.6, .25), 12.12)
ui.add(k.click(.2), 12.85)                            # منحنى السلوقن
ui.add(k.pop(.4, 1.3), 13.3 - E)                      # CTA
sfx.add(air(.7, .14), 13.8)                           # اللمعة

k.vacuum([pulse, sfx, ui], 11.4, 11.7)
k.finish([pulse, sfx, ui], os.path.join(HERE, 'out/score.wav'), verb=.15,
         sections=[(0, 3.6, 'problem'), (3.6, 6, 'turn'), (6, 11.4, 'impact'), (11.4, 11.7, 'vacuum'), (11.7, 15, 'end')])
