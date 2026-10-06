"""
اختبار منطقي محلي: نسخة Python طبق الأصل من f_track و f_result وقاعدة الفترة في HasanGold.pine.
لا يشغل Pine ولا TradingView؛ يفحص القواعد الحسابية فقط، ولا يقول شيئًا عن الربحية.
"""
from datetime import datetime, timedelta, timezone

class T:
    def __init__(s, d, entry, sl, tp1, tp2, bar=0):
        s.dir, s.entry, s.sl, s.tp1, s.tp2, s.bar = d, entry, sl, tp1, tp2, bar
        s.tp1Hit = s.tp2Hit = s.slHit = s.amb1 = s.amb2 = s.closed = s.expired = False
        s.tp1Exec = s.tp2Exec = s.slExec = None
        s.tp1B = s.tp2B = s.slB = None

def track(t, bi, o, h, l, MAX_TRACK=3000):
    ev = set()
    if not t.closed and bi > t.bar:
        L = t.dir == 1
        gapSL = o <= t.sl if L else o >= t.sl
        if gapSL:
            t.slHit, t.slExec, t.slB = True, o, bi; ev.add('SL')
        else:
            if not t.tp1Hit and (o >= t.tp1 if L else o <= t.tp1):
                t.tp1Hit, t.tp1Exec, t.tp1B = True, o, bi; ev.add('TP1')
            if not t.tp2Hit and (o >= t.tp2 if L else o <= t.tp2):
                t.tp2Hit, t.tp2Exec, t.tp2B = True, o, bi; ev.add('TP2')
            if not t.tp2Hit:
                sT = l <= t.sl if L else h >= t.sl
                t1T = (not t.tp1Hit) and (h >= t.tp1 if L else l <= t.tp1)
                t2T = (not t.tp2Hit) and (h >= t.tp2 if L else l <= t.tp2)
                if sT and (t1T or t2T):
                    t.amb1, t.amb2 = t1T, t2T
                    t.slHit, t.slExec, t.slB = True, t.sl, bi; ev.add('AMB')
                else:
                    if t1T: t.tp1Hit, t.tp1Exec, t.tp1B = True, t.tp1, bi; ev.add('TP1')
                    if t2T: t.tp2Hit, t.tp2Exec, t.tp2B = True, t.tp2, bi; ev.add('TP2')
                    if sT:  t.slHit, t.slExec, t.slB = True, t.sl, bi; ev.add('SL')
        if t.tp2Hit or t.slHit:
            t.closed = True
        if not t.closed and bi - t.bar >= MAX_TRACK:
            t.expired = t.closed = True; ev.add('EXP')
    return ev

def result(t, onTP2):
    if onTP2:
        return 1 if t.tp2Hit else 2 if t.amb2 else -1 if t.slHit else 3 if t.expired else 0
    return 1 if t.tp1Hit else 2 if t.amb1 else -1 if t.slHit else 3 if t.expired else 0

def run(t, bars):
    evs = []
    for i, (o, h, l) in enumerate(bars, start=1):
        evs.append(track(t, i, o, h, l))
    return evs

def R(t, onTP2, cost=0.0):
    risk = abs(t.entry - t.sl); r = result(t, onTP2)
    if r == 1: g = abs((t.tp2 if onTP2 else t.tp1) - t.entry) / risk
    elif r == -1: g = (t.slExec - t.entry) * t.dir / risk
    else: return None
    return g, g - cost / risk

def test_entry_bar_ignored():
    t = T(1, 100, 98, 103, 106, bar=5)
    assert track(t, 5, 100, 110, 90) == set()          # شمعة الدخول نفسها لا تُحتسب
    assert not (t.tp1Hit or t.slHit)

def test_buy_tp1_then_sl():
    t = T(1, 100, 98, 103, 106)
    ev = run(t, [(100, 103.5, 99.5), (103, 103.2, 97.5)])
    assert ev[0] == {'TP1'} and ev[1] == {'SL'}
    assert result(t, False) == 1 and result(t, True) == -1   # TP1 يبقى نجاحًا، وTP2 خسارة
    assert R(t, False) == (1.5, 1.5) and R(t, True) == (-1.0, -1.0)

def test_buy_tp2():
    t = T(1, 100, 98, 103, 106)
    run(t, [(100, 103.1, 99), (103, 106.5, 102), (106, 99, 90)])
    assert t.closed and t.tp2Hit and not t.slHit           # لا متابعة بعد TP2
    assert result(t, True) == 1 and R(t, True)[0] == 3.0

def test_same_bar_ambiguous_tp1():
    t = T(1, 100, 98, 103, 106)
    ev = run(t, [(100, 103.5, 97.0)])
    assert ev[0] == {'AMB'} and result(t, False) == 2 and result(t, True) == -1
    assert R(t, False) is None

def test_same_bar_ambiguous_tp2_after_tp1():
    t = T(1, 100, 98, 103, 106)
    run(t, [(100, 103.5, 99), (104, 106.5, 97.5)])
    assert result(t, False) == 1 and result(t, True) == 2

def test_gap_through_sl_conservative():
    t = T(1, 100, 98, 103, 106)
    ev = run(t, [(96.5, 104, 96)])                          # افتتاح تحت الوقف ثم صعد للهدف
    assert ev[0] == {'SL'} and t.slExec == 96.5 and result(t, False) == -1
    assert R(t, False)[0] == -1.75                           # أسوأ من -1R بسبب الفجوة

def test_gap_open_beyond_tp1_then_sl_same_bar():
    t = T(1, 100, 98, 103, 106)
    ev = run(t, [(103.5, 104, 97)])                          # الافتتاح يثبت TP1 أولًا
    assert 'TP1' in ev[0] and 'SL' in ev[0] and result(t, False) == 1 and result(t, True) == -1
    assert t.tp1Exec == 103.5 and R(t, False)[0] == 1.5      # R محسوب على المستوى المرجعي لا الفجوة

def test_sell_mirror_and_cost():
    t = T(-1, 100, 102, 97, 94)
    run(t, [(100, 100.5, 96.8)])
    assert result(t, False) == 1
    g, n = R(t, False, cost=0.4)
    assert g == 1.5 and abs(n - 1.3) < 1e-9

def test_no_double_count_and_no_reclass():
    t = T(1, 100, 98, 103, 106)
    run(t, [(100, 103.5, 99)])
    first = result(t, False)
    run(t, [(103, 104, 97)])                                 # SL لاحق لا يغير نجاح TP1
    assert first == result(t, False) == 1
    assert track(t, 99, 100, 200, 0) == set()                # صفقة مغلقة لا تُعالج مجددًا

def test_expiry():
    t = T(1, 100, 98, 103, 106)
    for i in range(1, 3001): track(t, i, 100, 100.5, 99.5)
    assert t.expired and result(t, False) == 3

AD = timezone(timedelta(hours=3))
def in_period(entry_close, start, end): return start <= entry_close < end

def test_period_midnight_and_exclusive_end():
    day = datetime(2026, 10, 6, tzinfo=AD); nxt = day + timedelta(days=1)
    assert in_period(day, day, nxt)                                   # 00:00 مشمول
    assert not in_period(nxt, day, nxt)                               # 00:00 اليوم التالي غير مشمول
    assert in_period(datetime(2026, 10, 6, 23, 59, tzinfo=AD), day, nxt)
    # شمعة فُتحت 23:55 وأغلقت 00:00 تُنسب لليوم التالي (وقت إغلاق شمعة الدخول)
    assert not in_period(datetime(2026, 10, 7, 0, 0, tzinfo=AD), day, nxt)

if __name__ == '__main__':
    n = 0
    for k, f in list(globals().items()):
        if k.startswith('test_'): f(); n += 1; print('PASS', k)
    print(f'{n} tests passed')
