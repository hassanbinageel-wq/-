# مولّد هوية «غيمة» البصرية

يبني كل ملفات الهوية برمجياً: الشعار، الألوان والخطوط، العناصر، قوالب إنستغرام (PSD بطبقات)، الريلز، التغليف، هوية الموقع، ودليل PDF.

```bash
cd brand
npm install            # harfbuzzjs, ag-psd, @napi-rs/canvas
pip install fonttools skia-pathops psd-tools pypdf Pillow
npm run build          # يُخرج dist/Ghayma_Brand_Identity
python3 scripts/qa_psd.py   # فحص ملفات PSD
```

يتطلب Chromium عبر Playwright و ffmpeg. الخطوط في `assets/fonts` برخصة OFL.
