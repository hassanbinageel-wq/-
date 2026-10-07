"""timing.py — يقسّم تسجيل الطفل إلى عبارات (من السكتات) ويطابقها مع النص، ويحسب غلاف الصوت لحركة الفم.
يكتب timing.js (للصورة) و timing.json (للصوت). OFF = تأخير بداية الصوت (مقدمة العنوان)."""
import json, os, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, 'assets/vo/voice.wav')
OFF, TAIL, FPS = 1.0, 3.6, 30
PHRASES = [  # (رقم الفقرة، العبارة كما تظهر في الترجمة) — بترتيب العبارات المنطوقة
 (1, 'السلامُ عليكم يا أصدقائي!'), (1, ''), (1, 'واليومَ سأشرحُ لكم درسًا جميلًا:'), (1, 'أركانُ الدِّين'),
 (2, 'الدِّينُ هو الطريقُ الذي رسمَهُ اللهُ لنا'), (2, 'وله ثلاثةُ أركان'), (2, 'وكلمةُ «أركان» معناها:'), (2, 'أُسُسٌ وأعمدة'), (2, 'مثلُ أعمدةِ البيت!'),
 (3, 'الرُّكنُ الأوَّل: الإسلام'), (3, 'وهو الأعمالُ الظاهرة'), (3, 'مثلُ الصلاةِ والصَّوم'),
 (4, 'الرُّكنُ الثاني: الإيمان'), (4, 'وهو تصديقُ القلب'),
 (5, 'الرُّكنُ الثالث: الإحسان'), (5, 'وهو إخلاصُ العبادة'), (5, 'كأنَّكَ ترى الله'),
 (6, 'والثلاثةُ معًا'), (6, 'تصنعُ المسلمَ الحقيقي!'),
 (7, 'هيّا نتذكَّرُ معًا:'), (7, 'أركانُ الدِّينِ ثلاثة:'), (7, 'الإسلام'), (7, 'والإيمان'), (7, 'والإحسان'),
 (8, 'أحسنتم يا أبطال!'), (8, 'إلى اللقاءِ في درسٍ جديد'),
]
r = subprocess.run(['ffmpeg', '-v', 'error', '-i', VO, '-ac', '1', '-ar', '24000', '-f', 'f32le', '-'], capture_output=True)
x = np.frombuffer(r.stdout, np.float32).astype(float); SR = 24000; dur = len(x) / SR
s = subprocess.run(['ffmpeg', '-hide_banner', '-i', VO, '-af', 'silencedetect=n=-34dB:d=0.12', '-f', 'null', '-'], capture_output=True, text=True).stderr
import re
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', s)]; en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', s)]
sil = list(zip(st, en))
t0 = sil[0][1] if sil and sil[0][0] < .05 else 0.0                 # بداية الكلام
t1 = sil[-1][0] if sil and dur - sil[-1][1] < .05 else dur          # نهاية الكلام
cand = [(a, b) for a, b in sil if a > t0 + .1 and b < t1 - .1]      # سكتات داخلية مرشّحة للحدود
# مواءمة: اختر len(PHRASES)-1 حدًا من السكتات بحيث تقترب مدة كل عبارة من المتوقع (بطول نصّها)، مع تفضيل السكتات الأطول
L = [max(6, len(t.replace(' ', ''))) if t else 10 for _, t in PHRASES]
speech = (t1 - t0) - sum(b - a for a, b in cand) * .35
exp = [speech * l / sum(L) for l in L]
N, K = len(PHRASES), len(cand)
INF = 1e18
cost = [[INF] * (K + 1) for _ in range(N)]; back = [[-1] * (K + 1) for _ in range(N)]
def seg(i, a, b): d = max(.05, b - a); return np.log(d / exp[i]) ** 2
for j in range(K):                                                   # العبارة 0 تنتهي عند السكتة j
    cost[0][j] = seg(0, t0, cand[j][0]) - .6 * (cand[j][1] - cand[j][0])
for i in range(1, N - 1):
    for j in range(i, K):
        for q in range(i - 1, j):
            c = cost[i - 1][q] + seg(i, cand[q][1], cand[j][0]) - .6 * (cand[j][1] - cand[j][0])
            if c < cost[i][j]: cost[i][j], back[i][j] = c, q
best, bj = INF, -1
for j in range(N - 2, K):
    c = cost[N - 2][j] + seg(N - 1, cand[j][1], t1)
    if c < best: best, bj = c, j
ends = []; j = bj
for i in range(N - 2, -1, -1): ends.append(j); j = back[i][j]
ends = ends[::-1]
chunks = []; a = t0
for j in ends: chunks.append((a, cand[j][0])); a = cand[j][1]
chunks.append((a, t1))
ALIGN = os.path.join(HERE, 'assets/vo/align.json')   # مواءمة صوتية (DTW) مع تسجيل مرجعي لنفس النص — تُفضَّل إن وُجدت
if os.path.exists(ALIGN):
    chunks = [tuple(c) for c in json.load(open(ALIGN))]
ph = [{'p': p, 'text': t, 'a': round(a + OFF, 3), 'b': round(b + OFF, 3)} for (p, t), (a, b) in zip(PHRASES, chunks)]
# غلاف الصوت لكل إطار (RMS) مطبّع ومنعّم — يقود فتحة الفم
hop = SR // FPS; n = int((dur + OFF + TAIL) * FPS); env = np.zeros(n)
for i in range(n):
    j = int((i / FPS - OFF) * SR)
    if 0 <= j < len(x) - hop: env[i] = np.sqrt(np.mean(x[j:j + hop] ** 2))
env = env / (np.percentile(env[env > 0], 95) + 1e-9); env = np.clip(env, 0, 1.2)
env = np.convolve(env, [.25, .5, .25], 'same')
data = {'off': OFF, 'duration': round(dur + OFF + TAIL, 2), 'phrases': ph, 'env': [round(v, 3) for v in env], 'fps': FPS}
json.dump(data, open(os.path.join(HERE, 'timing.json'), 'w'), ensure_ascii=False)
open(os.path.join(HERE, 'timing.js'), 'w').write('window.TIMING = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print(f'✓ {len(ph)} عبارة — المدة {data["duration"]}s')
for q in ph: print(f"  {q['p']}  {q['a']:6.2f}–{q['b']:6.2f}  {q['text']}")
