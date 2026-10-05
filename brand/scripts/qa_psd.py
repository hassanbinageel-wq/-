# فحص آلي: كل ملفات PSD تُفتح، عدد الطبقات، طبقات النص قابلة للقراءة، والصورة المركبة تطابق المعاينة
import glob, sys, os
from psd_tools import PSDImage
from PIL import Image, ImageChops, ImageStat
import warnings; warnings.filterwarnings('ignore')
D = 'dist/Ghayma_Brand_Identity'
files = sorted(glob.glob(D + '/**/*.psd', recursive=True))
bad = 0; texts = 0; layers = 0
for f in files:
    try:
        p = PSDImage.open(f)
        ls = list(p.descendants()); layers += len(ls)
        for l in ls:
            if l.kind == 'type':
                t = l.text; texts += 1
                assert t and len(t) > 0
        # مقارنة التركيب مع المعاينة (إن وُجدت)
        base = os.path.basename(f).replace('.psd', '.jpg')
        prev = glob.glob(D + '/**/' + base, recursive=True)
        if prev:
            a = p.composite().convert('RGB'); b = Image.open(prev[0]).convert('RGB').resize(a.size)
            diff = ImageStat.Stat(ImageChops.difference(a, b)).mean
            if max(diff) > 6: print('DIFF', f, [round(x, 1) for x in diff]); bad += 1
    except Exception as e:
        print('FAIL', f, e); bad += 1
print(f'{len(files)} PSD files, {layers} layers, {texts} editable text layers, problems: {bad}')
