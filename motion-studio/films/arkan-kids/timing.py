"""timing.py — يقسّم تسجيل الطفل إلى عبارات (من السكتات) ويطابقها مع النص، ويحسب غلاف الصوت لحركة الفم.
يكتب timing.js (للصورة) و timing.json (للصوت). OFF = تأخير بداية الصوت (مقدمة العنوان)."""
import json, os, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, 'assets/vo/child_full.wav')
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
s = subprocess.run(['ffmpeg', '-hide_banner', '-i', VO, '-af', 'silencedetect=n=-38dB:d=0.35', '-f', 'null', '-'], capture_output=True, text=True).stderr
import re
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', s)]; en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', s)]
chunks, cur = [], 0.0
for a, b in zip(st, en):
    if a - cur > .15: chunks.append((cur, a))
    cur = b
if dur - cur > .15: chunks.append((cur, dur))
assert len(chunks) == len(PHRASES), f'{len(chunks)} مقاطع صوتية ≠ {len(PHRASES)} عبارة — راجع عتبة السكتات'
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
