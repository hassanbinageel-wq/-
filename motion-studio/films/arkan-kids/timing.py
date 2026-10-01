"""timing.py — يقيس مدة كل جملة من التعليق الصوتي ويكتب timing.js (للصورة) و timing.json (للصوت).
إذا لم تتوفر ملفات الصوت بعد يستخدم تقديرات (≈ 2.3 كلمة/ث) — أعد تشغيله بعد تنزيل الملفات."""
import json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
EST = [3.6, 8.2, 6.0, 3.8, 5.8, 3.4, 6.6]          # تقديرات مؤقتة
GAP = [1.0, 1.2, 1.0, 1.0, 1.2, 1.4]               # سكتات بعد كل جملة (يحدث فيها شيء بصري)
START = 2.6
TAIL = 7.5                                          # بطاقة النص الأصلي في الختام

def dur(i):
    for ext in ('wav', 'mp3'):
        p = os.path.join(HERE, 'assets/vo', f'vo{i}.{ext}')
        if os.path.exists(p):
            r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True)
            return float(r.stdout), p
    return EST[i - 1], None

vo, t = [], START
for i in range(1, 8):
    d, p = dur(i)
    vo.append({'i': i, 'start': round(t, 3), 'dur': round(d, 3), 'file': p and os.path.relpath(p, HERE)})
    t += d + (GAP[i - 1] if i <= 6 else 0)
total = round(t + TAIL, 2)
data = {'vo': vo, 'duration': total, 'real': all(v['file'] for v in vo)}
json.dump(data, open(os.path.join(HERE, 'timing.json'), 'w'), ensure_ascii=False, indent=1)
open(os.path.join(HERE, 'timing.js'), 'w').write('window.TIMING = ' + json.dumps(data) + ';\n')
print(('✓ مدد حقيقية' if data['real'] else '⚠ تقديرات (ملفات الصوت غير موجودة)'), f'— المدة {total}s')
for v in vo: print(f"  vo{v['i']}  {v['start']:6.2f}s  +{v['dur']:.2f}s")
