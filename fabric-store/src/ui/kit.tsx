import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { fmtMoney, fmtNum } from '../lib/format';
import type { InvoiceStatusInfo } from '../lib/calc';

// ---------------- التنبيهات ----------------
type Toast = { id: number; text: string; kind: 'info' | 'error' | 'success' };
let pushToast: (t: Omit<Toast, 'id'>) => void = () => {};
export const toast = {
  info: (text: string) => pushToast({ text, kind: 'info' }),
  ok: (text: string) => pushToast({ text, kind: 'success' }),
  error: (e: unknown) => pushToast({ text: e instanceof Error ? e.message : String(e), kind: 'error' }),
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.kind === 'error' ? 4500 : 2600);
    };
  }, []);
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** ينفّذ عملية ويعرض الخطأ كتنبيه */
export async function run<T>(fn: () => Promise<T>, okText?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (okText) toast.ok(okText);
    return r;
  } catch (e) {
    console.error(e);
    toast.error(e);
    return undefined;
  }
}

// ---------------- النوافذ ----------------
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const back = () => onClose();
    window.addEventListener('app:back', back);
    document.body.dataset.modal = String(Number(document.body.dataset.modal || 0) + 1);
    return () => {
      window.removeEventListener('keydown', h);
      window.removeEventListener('app:back', back);
      document.body.dataset.modal = String(Math.max(0, Number(document.body.dataset.modal || 1) - 1));
    };
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

type DialogReq =
  | { kind: 'confirm'; title: string; text: string; danger?: boolean; ok?: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; text: string; placeholder?: string; resolve: (v: string | null) => void };

let openDialog: (d: DialogReq) => void = () => {};
export const confirmDialog = (title: string, text: string, opts: { danger?: boolean; ok?: string } = {}) =>
  new Promise<boolean>((resolve) => openDialog({ kind: 'confirm', title, text, ...opts, resolve }));
export const promptDialog = (title: string, text: string, placeholder?: string) =>
  new Promise<string | null>((resolve) => openDialog({ kind: 'prompt', title, text, placeholder, resolve }));

export function Dialogs() {
  const [d, setD] = useState<DialogReq | null>(null);
  const [val, setVal] = useState('');
  useEffect(() => {
    openDialog = (x) => {
      setVal('');
      setD(x);
    };
  }, []);
  if (!d) return null;
  const close = (v: any) => {
    (d.resolve as (x: any) => void)(v);
    setD(null);
  };
  return (
    <Modal
      title={d.title}
      onClose={() => close(d.kind === 'confirm' ? false : null)}
      footer={
        <>
          <button className="btn" onClick={() => close(d.kind === 'confirm' ? false : null)}>
            تراجع
          </button>
          <button
            className={`btn ${d.kind === 'confirm' && d.danger ? 'danger solid' : 'primary'}`}
            onClick={() => close(d.kind === 'confirm' ? true : val)}
          >
            {(d.kind === 'confirm' && d.ok) || 'تأكيد'}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{d.text}</p>
      {d.kind === 'prompt' && (
        <input autoFocus className="input" value={val} placeholder={d.placeholder} onChange={(e) => setVal(e.target.value)} />
      )}
    </Modal>
  );
}

// ---------------- الحقول ----------------
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className ?? ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function NumInput({
  value,
  onChange,
  min,
  placeholder,
  disabled,
  ...rest
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value ? String(value) : '');
      last.current = value;
    }
  }, [value]);
  return (
    <input
      {...rest}
      className="input num"
      style={{ textAlign: 'right' }}
      inputMode="decimal"
      value={text}
      placeholder={placeholder ?? '0'}
      disabled={disabled}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬]/g, '').replace('٫', '.');
        if (!/^-?\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        let n = Number(raw) || 0;
        if (min != null && n < min) n = min;
        last.current = n;
        onChange(n);
      }}
    />
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.key} type="button" className={o.key === value ? 'on' : ''} onClick={() => onChange(o.key)} role="tab" aria-selected={o.key === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search">
      <Icon name="search" />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'بحث…'} />
    </div>
  );
}

export const Money = ({ v, className }: { v: number; className?: string }) => <span className={`num ${className ?? ''}`}>{fmtMoney(v)}</span>;
export const Num = ({ v, className }: { v: number; className?: string }) => <span className={`num ${className ?? ''}`}>{fmtNum(v)}</span>;

export function Empty({ icon = 'info', text, children }: { icon?: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <p>{text}</p>
      {children}
    </div>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  cancelled: 'ملغاة',
  paid: 'مدفوعة',
  partial: 'مدفوعة جزئيًا',
  unpaid: 'غير مدفوعة',
};

export function StatusBadge({ info }: { info: InvoiceStatusInfo }) {
  const cls = { draft: 'muted', cancelled: 'muted', paid: 'good', partial: 'warn', unpaid: 'bad' }[info.status];
  return (
    <span className="row" style={{ gap: 4 }}>
      <span className={`badge ${cls}`}>{STATUS_LABEL[info.status]}</span>
      {info.overdue && <span className="badge bad">متأخرة</span>}
      {info.returnState !== 'none' && <span className="badge info">{info.returnState === 'full' ? 'مرتجعة' : 'مرتجع جزئي'}</span>}
    </span>
  );
}

// ---------------- منتقي بالبحث ----------------
export function Picker<T>({
  items,
  value,
  onSelect,
  getKey,
  getLabel,
  getSub,
  filter,
  placeholder,
  onCreate,
  createLabel,
}: {
  items: T[];
  value?: T;
  onSelect: (item: T) => void;
  getKey: (i: T) => string | number;
  getLabel: (i: T) => string;
  getSub?: (i: T) => string;
  filter: (i: T, q: string) => boolean;
  placeholder?: string;
  onCreate?: (q: string) => void;
  createLabel?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const list = useMemo(() => items.filter((i) => !q || filter(i, q.trim().toLowerCase())).slice(0, 40), [items, q, filter]);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const choose = (i: T) => {
    onSelect(i);
    setQ('');
    setOpen(false);
  };
  return (
    <div className="picker" ref={ref}>
      <input
        className="input"
        value={open ? q : value ? getLabel(value) : ''}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQ('');
          setHl(0);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHl(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHl((h) => Math.min(h + 1, list.length - 1));
          else if (e.key === 'ArrowUp') setHl((h) => Math.max(h - 1, 0));
          else if (e.key === 'Enter' && list[hl]) {
            e.preventDefault();
            choose(list[hl]);
          }
        }}
      />
      {open && (
        <div className="picker-list">
          {list.map((i, idx) => (
            <button type="button" key={getKey(i)} className={idx === hl ? 'hl' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
              <div className="bold">{getLabel(i)}</div>
              {getSub && <div className="small muted">{getSub(i)}</div>}
            </button>
          ))}
          {!list.length && <div className="small muted" style={{ padding: 12 }}>لا توجد نتائج</div>}
          {onCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCreate(q);
                setOpen(false);
              }}
              style={{ color: 'var(--primary)', fontWeight: 700 }}
            >
              + {createLabel ?? 'إضافة جديد'} {q && `«${q}»`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- سياق التطبيق ----------------
export interface Route {
  name: string;
  id?: number;
  params?: Record<string, string>;
}
export const NavContext = createContext<{ go: (r: Route | string) => void; back: () => void; route: Route }>({
  go: () => {},
  back: () => {},
  route: { name: 'dashboard' },
});
export const useNav = () => useContext(NavContext);

export function routeToHash(r: Route) {
  const q = r.params ? '?' + new URLSearchParams(r.params).toString() : '';
  return `#/${r.name}${r.id != null ? '/' + r.id : ''}${q}`;
}
export function hashToRoute(h: string): Route {
  const [path, query] = h.replace(/^#\/?/, '').split('?');
  const [name, id] = path.split('/');
  return {
    name: name || 'dashboard',
    id: id ? Number(id) : undefined,
    params: query ? Object.fromEntries(new URLSearchParams(query)) : undefined,
  };
}

export function PageHeader({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

export function KPI({ label, value, sub, icon, accent, onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string; accent?: boolean; onClick?: () => void }) {
  return (
    <div className={`card kpi ${accent ? 'accent' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="label">
        {icon && <Icon name={icon} />}
        {label}
      </div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
