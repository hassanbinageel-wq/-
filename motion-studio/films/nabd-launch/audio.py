"""نبض — الموسيقى والمؤثرات على خط زمن الصورة نفسه (انظر shotlist.md)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../.claude/skills/motion-studio/scripts'))
from audio_kit import Kit

k = Kit(dur=12, bpm=120)
E = k.EARLY
heart, music, sfx, ui = k.bus(), k.bus(), k.bus(), k.bus()

# 0–3.5: لا موسيقى — نبض قلب ونقرات (الموسيقى تدخل متأخرة مع القطع الأول)
for n in range(7):
    heart.add(k.kick(.55, tail=.12), k.beat(n) - E)
    heart.add(k.kick(.32, tail=.1), k.beat(n) + .16 - E)
for i, t in enumerate((0.5, 1.0, 1.5)):
    sfx.add(k.click(.5, pitch=k.vary()), t - E)
sfx.add(k.impact(.7), 2.0 - E)                       # «بكرة.»
sfx.add(k.whoosh(.25, .3), 2.75 - E)                  # الشطب
sfx.add(k.riser(.55, .35), 2.95)                      # zoom-through

# 3.5–7.5: الموسيقى تدخل — Am F C G
chords = [(3.5, [57, 60, 64], 45), (4.5, [53, 57, 60], 41), (5.5, [48, 52, 55, 60], 36), (6.5, [55, 59, 62], 43)]
for t0, notes, root in chords:
    music.add(k.pad(notes, 1.05, .2), t0)
    music.add(k.bass(root, .48, .45), t0); music.add(k.bass(root, .48, .4), t0 + .5)
beats = [3.5 + .5 * i for i in range(8)]
for b in beats:
    music.add(k.kick(.9), b - E)
    music.add(k.hat(.12), b + .25)
sfx.add(k.impact(.5), 3.5 - E)
for i, t in enumerate((4.0, 4.5, 5.0)):                # صح الثلاث عادات: نغمة صاعدة
    ui.add(k.pop(.4, pitch=1 + .2 * i), t - E)
    ui.add(k.pluck(72 + (0, 4, 7)[i], .25), t)
ui.add(k.chime(79, .3), 5.0)
for i in range(18):                                    # العدّاد: تكّات تتسارع
    t = 5.5 + 1.1 * (1 - (1 - i / 18) ** 1.6)
    ui.add(k.tick(.18, pitch=k.vary()), t)
ui.add(k.pop(.4, 1.5), 6.25 - E); ui.add(k.bell(86, .18, .8), 6.27)    # «+١ اليوم»
sfx.add(k.whoosh(.45, .35), 7.05)                      # البطاقة تخرج للأعلى

# 7.5–7.75: فراغ. ثم الذروة
for t in (7.75, 8.0):
    music.add(k.kick(1.0), t - E); music.add(k.clap(.55), t - E)
music.add(k.impact(1.0), 8.5 - E)
music.add(k.pad([48, 52, 55, 60, 64], 1.0, .22), 8.5)
music.add(k.bass(36, .9, .5), 8.5)
sfx.add(k.whoosh(.3, .3, up=False), 9.2)

# 9.5–12: الختام — يحلّ على C
music.add(k.pad([48, 55, 60, 64, 67], 2.5, .18, bright=2400), 9.5)
music.add(k.bass(36, 2.2, .35), 9.75)
for t in (9.5, 10.0, 10.5, 11.0, 11.5):
    heart.add(k.kick(.4, tail=.1), t - E); heart.add(k.kick(.22, tail=.08), t + .16 - E)
ui.add(k.bell(84, .3), 9.8)                            # الحلقة
sfx.add(k.impact(.45), 10.0 - E)                       # الشعار
ui.add(k.pop(.35, 1.3), 11.0 - E)                      # CTA
ui.add(k.bell(91, .14, 1.0), 11.4)                     # اللمعة

k.sidechain(music, [b for b in beats] + [7.75, 8.0, 8.5], depth=.5)
k.vacuum([music, heart, sfx], 7.5, 7.75)
k.finish([heart, music, sfx, ui], os.path.join(HERE, 'out/score.wav'),
         sections=[(0, 3.5, 'hook'), (3.5, 7.5, 'card'), (7.5, 7.75, 'vacuum'), (7.75, 9.5, 'climax'), (9.5, 12, 'end')])
