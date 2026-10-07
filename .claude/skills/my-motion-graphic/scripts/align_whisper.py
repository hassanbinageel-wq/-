"""align_whisper.py <voice.wav> — يقسّم التسجيل عند السكتات ويفرّغ كل مقطع بـ Whisper small (sherpa-onnx، يعمل بلا إنترنت بعد التنزيل).
يطبع: بداية-نهاية  النص. استخدمه لربط عبارات النص بالأزمنة في timing.py (المصدر الوحيد الموثوق للتوقيت).
النموذج يُنزَّل مرة واحدة من GitHub Releases (k2-fsa/sherpa-onnx) — هذا المضيف يمرّ عبر البروكسي، بينما HF/azureedge محجوبة."""
import os, re, subprocess, sys
import numpy as np
try:
    import sherpa_onnx
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'sherpa-onnx'], check=True); import sherpa_onnx
CACHE = os.path.expanduser('~/.cache/my-motion-graphic'); D = os.path.join(CACHE, 'sherpa-onnx-whisper-small/')
if not os.path.exists(D + 'small-encoder.int8.onnx'):
    os.makedirs(CACHE, exist_ok=True); tb = os.path.join(CACHE, 'small.tar.bz2')
    subprocess.run(['curl', '-sSL', '-o', tb, 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2'], check=True)
    subprocess.run(['tar', 'xjf', tb, '-C', CACHE], check=True); os.remove(tb)
VO = sys.argv[1] if len(sys.argv) > 1 else 'assets/vo/voice.wav'
TH = sys.argv[2] if len(sys.argv) > 2 else '-34dB'
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=D + 'small-encoder.int8.onnx', decoder=D + 'small-decoder.int8.onnx', tokens=D + 'small-tokens.txt', language='ar', task='transcribe', num_threads=os.cpu_count() or 4)
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', VO, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
s = subprocess.run(['ffmpeg', '-hide_banner', '-i', VO, '-af', f'silencedetect=n={TH}:d=0.12', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', s)]; en = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', s)]
segs, a = [], (en[0] if st and st[0] < .05 else 0)
for b0, b1 in zip(st, en):
    if b0 > a + .05: segs.append((a, b0))
    a = b1
if len(x) / 16000 - a > .1: segs.append((a, len(x) / 16000))
print(f'# المدة {len(x)/16000:.2f}s — {len(segs)} مقطع')
for a, b in segs:
    st_ = rec.create_stream(); st_.accept_waveform(16000, x[int(max(0, a - .08) * 16000):int((b + .08) * 16000)]); rec.decode_stream(st_)
    print(f'{a:7.2f} {b:7.2f}  {st_.result.text}', flush=True)
