import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Seg, run, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { elementToPdf } from '../lib/pdf';
import { isNative, shareFile } from '../lib/platform';
import { PAPER_WIDTH } from './Docs';

/** معاينة المستند مع: مشاركة PDF، حفظ PDF، طباعة (على الكمبيوتر) */
export function PrintPreview({
  title,
  filename,
  render,
  defaultSize = 'a4',
  allowThermal = true,
  actions,
  onClose,
}: {
  actions?: ReactNode;
  title: string;
  filename: string;
  render: (size: 'a4' | 'thermal') => ReactNode;
  defaultSize?: 'a4' | 'thermal';
  allowThermal?: boolean;
  onClose: () => void;
}) {
  const [size, setSize] = useState<'a4' | 'thermal'>(defaultSize);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const offscreen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const el = paper.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight * scale + 4);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, size]);

  useLayoutEffect(() => {
    const fit = () => {
      const w = wrap.current?.clientWidth ?? 800;
      setScale(Math.min(1, (w - 24) / PAPER_WIDTH[size]));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [size]);

  useEffect(() => {
    if (!printing) return;
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(() => window.print(), 300);
    return () => document.body.classList.remove('printing');
  }, [printing]);

  const makePdf = async () => {
    const el = offscreen.current?.querySelector('.paper') as HTMLElement | null;
    if (!el) throw new Error('لا يوجد مستند');
    return elementToPdf(el, size);
  };

  const share = () =>
    run(async () => {
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 80));
        const blob = await makePdf();
        const r = await shareFile(blob, `${filename}.pdf`, title);
        if (r === 'downloaded') toast.ok('تم حفظ ملف PDF');
      } finally {
        setBusy(false);
      }
    });

  return (
    <Modal
      wide
      title={title}
      onClose={onClose}
      footer={
        <>
          {allowThermal && (
            <Seg
              value={size}
              onChange={setSize}
              options={[
                { key: 'a4', label: 'A4' },
                { key: 'thermal', label: 'حراري 80مم' },
              ]}
            />
          )}
          {actions}
          <span className="spacer" />
          {!isNative() && (
            <button className="btn" onClick={() => setPrinting(true)}>
              <Icon name="print" /> طباعة
            </button>
          )}
          <button className="btn primary" onClick={share} disabled={busy}>
            <Icon name="share" /> {busy ? 'جارٍ التجهيز…' : isNative() ? 'مشاركة / حفظ PDF' : 'حفظ PDF'}
          </button>
        </>
      }
    >
      <div className="paper-scroller" ref={wrap}>
        <div style={{ height, display: 'flex', justifyContent: 'center' }}>
          <div ref={paper} className="paper-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: PAPER_WIDTH[size], boxShadow: '0 4px 20px rgba(0,0,0,.15)' }}>
            {render(size)}
          </div>
        </div>
      </div>
      {busy &&
        createPortal(
          <div ref={offscreen} style={{ position: 'fixed', top: 0, left: -20000, width: PAPER_WIDTH[size], pointerEvents: 'none' }} aria-hidden="true">
            {render(size)}
          </div>,
          document.body,
        )}
      {printing && createPortal(<div id="print-root">{render(size)}</div>, document.body)}
    </Modal>
  );
}
