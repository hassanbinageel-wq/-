import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** تحويل عنصر HTML (ورقة الفاتورة) إلى ملف PDF — يحافظ على الخط العربي لأنه يُرسم كصورة عالية الدقة */
export async function elementToPdf(el: HTMLElement, format: 'a4' | 'thermal'): Promise<Blob> {
  await (document as any).fonts?.ready;
  const canvas = await html2canvas(el, {
    scale: format === 'thermal' ? 3 : 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });
  if (format === 'thermal') {
    const widthMm = 80;
    const heightMm = (canvas.height / canvas.width) * widthMm;
    const pdf = new jsPDF({ unit: 'mm', format: [widthMm, Math.max(heightMm, 60)], orientation: 'portrait' });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, widthMm, heightMm);
    return pdf.output('blob');
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = 210;
  const pageH = 297;
  const pxPerMm = canvas.width / pageW;
  const pagePx = Math.floor(pageH * pxPerMm);
  // نقاط القطع: نتجنب قطع صف من الجدول في المنتصف
  const breaks = findBreaks(el, canvas.width / el.scrollWidth, pagePx, canvas.height);
  breaks.forEach((start, i) => {
    const end = breaks[i + 1] ?? canvas.height;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = end - start;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, start, canvas.width, end - start, 0, 0, canvas.width, end - start);
    if (i > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (end - start) / pxPerMm);
  });
  return pdf.output('blob');
}

function findBreaks(el: HTMLElement, scale: number, pagePx: number, total: number): number[] {
  const top = el.getBoundingClientRect().top;
  const rowBottoms = Array.from(el.querySelectorAll('tr, .avoid-break'))
    .map((r) => Math.round((r.getBoundingClientRect().bottom - top) * scale))
    .sort((a, b) => a - b);
  const out = [0];
  let start = 0;
  while (total - start > pagePx) {
    const limit = start + pagePx;
    const candidates = rowBottoms.filter((b) => b > start + pagePx * 0.5 && b <= limit);
    const cut = candidates.length ? candidates[candidates.length - 1] : limit;
    out.push(cut);
    start = cut;
  }
  return out;
}
