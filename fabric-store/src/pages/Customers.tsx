import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { can, saveCustomer } from '../db/service';
import type { Customer } from '../db/schema';
import { fmtNum, fromInputDate, toInputDate } from '../lib/format';
import { Empty, Field, Modal, Money, NumInput, SearchBox, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';

export function CustomerForm({ initial, onClose, onSaved }: { initial?: Partial<Customer>; onClose: () => void; onSaved?: (id: number) => void }) {
  const [c, setC] = useState<Partial<Customer>>({ name: '', phone: '', city: '', address: '', notes: '', creditLimit: 0, openingBalance: 0, ...initial });
  const set = (p: Partial<Customer>) => setC((x) => ({ ...x, ...p }));
  const save = async () => {
    const id = await run(() => saveCustomer(c as any), 'تم حفظ العميل');
    if (id) {
      onSaved?.(id);
      onClose();
    }
  };
  return (
    <Modal
      title={c.id ? 'تعديل بيانات العميل' : 'عميل جديد'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" onClick={save}><Icon name="check" /> حفظ</button>
        </>
      }
    >
      <div className="grid grid-2">
        <Field label="اسم العميل *"><input autoFocus className="input" value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="رقم الهاتف"><input className="input num" style={{ textAlign: 'right' }} inputMode="tel" value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="المنطقة / المدينة"><input className="input" value={c.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="العنوان (اختياري)"><input className="input" value={c.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="الحد الائتماني (0 = بدون حد)"><NumInput value={c.creditLimit} min={0} onChange={(v) => set({ creditLimit: v })} /></Field>
        <Field label="الرصيد الافتتاحي (دين سابق)">
          <NumInput value={c.openingBalance} onChange={(v) => set({ openingBalance: v })} disabled={!!c.id && !can('invoice_edit')} />
        </Field>
        {!c.id && (
          <Field label="تاريخ التسجيل">
            <input type="date" className="input" value={toInputDate(c.createdAt)} onChange={(e) => set({ createdAt: fromInputDate(e.target.value) })} />
          </Field>
        )}
      </div>
      <Field label="ملاحظات" className="section"><textarea className="input" value={c.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <p className="small muted">الرصيد الافتتاحي الموجب يعني أن على العميل مبلغًا سابقًا، والسالب يعني أن له رصيدًا لدى المحل.</p>
    </Modal>
  );
}

const SORTS = [
  { key: 'name', label: 'الاسم' },
  { key: 'debt', label: 'أعلى مديونية' },
  { key: 'sales', label: 'أعلى مشتريات' },
  { key: 'paid', label: 'أكثر سدادًا' },
  { key: 'recent', label: 'الأحدث' },
];

export default function Customers() {
  const d = useData();
  const { go } = useNav();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [archived, setArchived] = useState(false);
  const [form, setForm] = useState(false);

  const agg = useMemo(() => {
    const sales = new Map<number, number>();
    const paid = new Map<number, number>();
    for (const i of d.invoices) if (i.state === 'approved') sales.set(i.customerId, (sales.get(i.customerId) ?? 0) + i.net);
    for (const p of d.payments) if (!p.reversed) paid.set(p.customerId, (paid.get(p.customerId) ?? 0) + p.amount);
    return { sales, paid };
  }, [d.invoices, d.payments]);

  const list = useMemo(() => {
    const l = d.customers.filter((c) => (archived ? c.archived : !c.archived) && matches(q, c.name, c.phone, c.code, c.city));
    const by: Record<string, (a: Customer, b: Customer) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, 'ar'),
      debt: (a, b) => (d.balance.get(b.id!) ?? 0) - (d.balance.get(a.id!) ?? 0),
      sales: (a, b) => (agg.sales.get(b.id!) ?? 0) - (agg.sales.get(a.id!) ?? 0),
      paid: (a, b) => (agg.paid.get(b.id!) ?? 0) - (agg.paid.get(a.id!) ?? 0),
      recent: (a, b) => b.createdAt - a.createdAt,
    };
    return l.sort(by[sort]);
  }, [d, q, sort, archived, agg]);

  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="الاسم، الهاتف، رقم العميل، المدينة…" />
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="ترتيب">
          {SORTS.map((s) => <option key={s.key} value={s.key}>ترتيب: {s.label}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> المؤرشفون</label>
        {can('customers') && <button className="btn primary" onClick={() => setForm(true)}><Icon name="plus" /> عميل جديد</button>}
      </div>
      <div className="small muted" style={{ marginBottom: 8 }}>{fmtNum(list.length)} عميل</div>
      {!list.length ? (
        <Empty icon="users" text="لا يوجد عملاء" />
      ) : (
        <div className="list">
          {list.map((c) => {
            const bal = d.balance.get(c.id!) ?? 0;
            return (
              <div key={c.id} className="list-item" onClick={() => go({ name: 'customer', id: c.id })}>
                <div className="avatar">{c.name.trim()[0]}</div>
                <div className="main-col">
                  <div className="title">{c.name}</div>
                  <div className="meta">{[c.code, c.phone, c.city].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="end">
                  <div className={`bold ${bal > 0 ? 'bad' : bal < 0 ? 'good' : 'muted'}`}><Money v={Math.abs(bal)} /></div>
                  <div className="small muted">{bal > 0 ? 'عليه' : bal < 0 ? 'له' : 'مسدد'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && <CustomerForm onClose={() => setForm(false)} onSaved={(id) => go({ name: 'customer', id })} />}
    </div>
  );
}
