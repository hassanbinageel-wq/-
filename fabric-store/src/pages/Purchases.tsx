import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { can, cancelPurchase, saveSupplier, savePurchase } from '../db/service';
import { db, type Product, type PurchaseLine, type Supplier } from '../db/schema';
import { round2 } from '../lib/calc';
import { DAY, fmtDate, fmtNum, fromInputDate, fromInputDateNow, toInputDate } from '../lib/format';
import { Empty, Field, Modal, Money, NumInput, Picker, SearchBox, promptDialog, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ProductForm } from './Products';

export function SupplierForm({ initial, onClose, onSaved }: { initial?: Partial<Supplier>; onClose: () => void; onSaved?: (id: number) => void }) {
  const [s, setS] = useState<Partial<Supplier>>({ name: '', phone: '', address: '', notes: '', openingBalance: 0, ...initial });
  const save = async () => {
    const id = await run(() => saveSupplier(s as any), 'تم حفظ المورد');
    if (id) {
      onSaved?.(id);
      onClose();
    }
  };
  return (
    <Modal title={s.id ? 'تعديل المورد' : 'مورد جديد'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={save}>حفظ</button></>}>
      <div className="grid grid-2">
        <Field label="اسم المورد *"><input autoFocus className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
        <Field label="الهاتف"><input className="input" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
        <Field label="العنوان"><input className="input" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
        <Field label="رصيد افتتاحي (مستحق له)"><NumInput value={s.openingBalance} onChange={(v) => setS({ ...s, openingBalance: v })} /></Field>
      </div>
      <Field label="ملاحظات" className="section"><textarea className="input" value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} /></Field>
    </Modal>
  );
}

function PurchaseForm({ onClose, productId }: { onClose: () => void; productId?: number }) {
  const d = useData();
  const products = d.products.filter((p) => !p.archived);
  const mkLine = (p?: Product): PurchaseLine =>
    p
      ? { productId: p.id!, name: p.name, unit: p.baseUnit, factor: 1, qty: 0, baseQty: 0, unitCost: p.cost, total: 0 }
      : { productId: 0, name: '', unit: '', factor: 1, qty: 0, baseQty: 0, unitCost: 0, total: 0 };
  const [supplierId, setSupplierId] = useState<number>();
  const [no, setNo] = useState('');
  const [date, setDate] = useState(toInputDate());
  const [lines, setLines] = useState<PurchaseLine[]>([mkLine(productId ? d.productById.get(productId) : undefined)]);
  const [extra, setExtra] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState(d.settings.paymentMethods[0]);
  const [due, setDue] = useState(toInputDate(Date.now() + 30 * DAY));
  const [notes, setNotes] = useState('');
  const [newSupplier, setNewSupplier] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<number | null>(null);

  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitCost, 0));
  const total = round2(subtotal + extra);
  const setLine = (i: number, p: Partial<PurchaseLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const save = async () => {
    const r = await run(
      () => savePurchase({ supplierId: supplierId!, supplierInvoiceNo: no, date: fromInputDateNow(date), lines, extraCosts: extra, paid, method, dueDate: fromInputDate(due, true), notes }),
      'تم تسجيل فاتورة الشراء وإضافة الكميات للمخزون',
    );
    if (r) onClose();
  };

  return (
    <Modal
      wide
      title="فاتورة شراء جديدة"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={save}><Icon name="check" /> اعتماد الشراء</button></>}
    >
      <div className="stack">
        <div className="grid grid-3">
          <Field label="المورد *">
            <Picker<Supplier>
              items={d.suppliers.filter((s) => !s.archived)}
              value={supplierId ? d.supplierById.get(supplierId) : undefined}
              onSelect={(s) => setSupplierId(s.id)}
              getKey={(s) => s.id!}
              getLabel={(s) => s.name}
              getSub={(s) => s.phone}
              filter={(s, q) => matches(q, s.name, s.phone)}
              onCreate={(q) => setNewSupplier(q)}
              createLabel="مورد جديد"
              placeholder="ابحث عن المورد…"
            />
          </Field>
          <Field label="رقم فاتورة المورد"><input className="input" value={no} onChange={(e) => setNo(e.target.value)} /></Field>
          <Field label="تاريخ الشراء"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {lines.map((l, i) => {
          const p = d.productById.get(l.productId);
          return (
            <div className="line-card" key={i}>
              <span className="line-no">{i + 1}</span>
              <div className="line-grid">
                <Field label="الصنف" className="span2">
                  <Picker<Product>
                    items={products}
                    value={p}
                    onSelect={(x) => setLine(i, mkLine(x))}
                    getKey={(x) => x.id!}
                    getLabel={(x) => `${x.name}${x.color ? ' — ' + x.color : ''}`}
                    getSub={(x) => `${x.code} · المتوفر ${fmtNum(x.stock)} ${x.baseUnit}`}
                    filter={(x, q) => matches(q, x.name, x.code, x.color)}
                    onCreate={() => setNewProduct(i)}
                    createLabel="صنف جديد"
                    placeholder="اختر الصنف…"
                  />
                </Field>
                <Field label="الوحدة">
                  <select className="input" value={l.unit} disabled={!p} onChange={(e) => {
                    const u = p!.units.find((x) => x.name === e.target.value)!;
                    setLine(i, { unit: u.name, factor: u.factor, unitCost: round2(p!.cost * u.factor) });
                  }}>
                    {(p?.units ?? []).map((u) => <option key={u.name}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="الكمية"><NumInput value={l.qty} min={0} onChange={(v) => setLine(i, { qty: v })} /></Field>
                <Field label={`تكلفة الـ${l.unit || 'وحدة'}`}><NumInput value={l.unitCost} min={0} onChange={(v) => setLine(i, { unitCost: v })} /></Field>
                <Field label="الإجمالي"><div className="input num" style={{ display: 'flex', alignItems: 'center' }}>{fmtNum(l.qty * l.unitCost)}</div></Field>
              </div>
              <div className="row between small" style={{ marginTop: 6 }}>
                <span className="muted">{p && l.factor !== 1 ? `= ${fmtNum(l.qty * l.factor)} ${p.baseUnit}` : ''}</span>
                <button className="btn sm danger" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [mkLine()]))}><Icon name="trash" /></button>
              </div>
            </div>
          );
        })}
        <button className="btn" style={{ borderStyle: 'dashed' }} onClick={() => setLines((l) => [...l, mkLine()])}><Icon name="plus" /> إضافة صنف</button>
        <div className="grid grid-3">
          <Field label="مصاريف إضافية (نقل، جمارك…)"><NumInput value={extra} min={0} onChange={setExtra} /></Field>
          <Field label="المدفوع للمورد الآن"><NumInput value={paid} min={0} onChange={setPaid} /></Field>
          <Field label="طريقة الدفع">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {d.settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="تاريخ استحقاق المتبقي"><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="ملاحظات" className="span2"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div className="summary-box">
          <div className="r"><span>إجمالي الأصناف</span><Money v={subtotal} /></div>
          <div className="r"><span>المصاريف الإضافية (توزع على تكلفة الأصناف)</span><Money v={extra} /></div>
          <div className="r total"><span>إجمالي المشتريات</span><Money v={total} /></div>
          <div className="r"><span>المدفوع</span><Money v={paid} /></div>
          <div className="r bold"><span>المتبقي للمورد</span><Money v={round2(total - paid)} /></div>
        </div>
      </div>
      {newSupplier !== null && <SupplierForm initial={{ name: newSupplier }} onClose={() => setNewSupplier(null)} onSaved={setSupplierId} />}
      {newProduct !== null && (
        <ProductForm
          onClose={() => setNewProduct(null)}
          onSaved={async (pid) => {
            const p = await db.products.get(pid);
            if (p) setLine(newProduct, mkLine(p));
          }}
        />
      )}
    </Modal>
  );
}

export default function Purchases() {
  const d = useData();
  const { go, route } = useNav();
  const [tab, setTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(!!route.params?.new);
  const [supForm, setSupForm] = useState(false);
  const [archived, setArchivedView] = useState(false);

  const purchases = useMemo(
    () => d.purchases.filter((p) => matches(q, p.number, p.supplierInvoiceNo, d.supplierById.get(p.supplierId)?.name, p.lines.map((l) => l.name).join(' '))).sort((a, b) => b.date - a.date),
    [d, q],
  );
  const suppliers = useMemo(() => d.suppliers.filter((s) => (archived ? s.archived : !s.archived) && matches(q, s.name, s.phone)), [d, q, archived]);

  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder={tab === 'purchases' ? 'رقم الفاتورة، المورد، الصنف…' : 'اسم المورد أو الهاتف…'} />
        {tab === 'purchases' ? (
          <button className="btn primary" onClick={() => setForm(true)}><Icon name="plus" /> فاتورة شراء</button>
        ) : (
          <>
            <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchivedView(e.target.checked)} /> المؤرشفون</label>
            <button className="btn primary" onClick={() => setSupForm(true)}><Icon name="plus" /> مورد جديد</button>
          </>
        )}
      </div>
      <div className="tabs">
        <button className={tab === 'purchases' ? 'on' : ''} onClick={() => setTab('purchases')}>فواتير الشراء</button>
        <button className={tab === 'suppliers' ? 'on' : ''} onClick={() => setTab('suppliers')}>الموردون</button>
      </div>
      {tab === 'purchases' ? (
        purchases.length ? (
          <div className="list">
            {purchases.map((p) => {
              const rem = d.purchaseRemaining.get(p.id!) ?? 0;
              return (
                <div key={p.id} className="list-item" onClick={() => go({ name: 'supplier', id: p.supplierId })}>
                  <div className="avatar"><Icon name="truck" /></div>
                  <div className="main-col">
                    <div className="title">{d.supplierById.get(p.supplierId)?.name} {p.state === 'cancelled' && <span className="badge muted">ملغاة</span>}</div>
                    <div className="meta">{p.number}{p.supplierInvoiceNo && ` (${p.supplierInvoiceNo})`} · {fmtDate(p.date)} · {p.lines.length} صنف</div>
                  </div>
                  <div className="end">
                    <div className="bold"><Money v={p.total} /></div>
                    {rem > 0 && <div className="small bad">متبقي <Money v={rem} /></div>}
                    {p.state === 'approved' && can('purchases') && (
                      <button
                        className="btn sm ghost"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const reason = await promptDialog('إلغاء فاتورة الشراء', 'ستُخصم الكميات من المخزون. اكتب السبب:');
                          if (reason) await run(() => cancelPurchase(p.id!, reason), 'تم الإلغاء');
                        }}
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="truck" text="لا توجد مشتريات" />
        )
      ) : suppliers.length ? (
        <div className="list">
          {suppliers.map((s) => {
            const bal = d.supplierBal.get(s.id!) ?? 0;
            return (
              <div key={s.id} className="list-item" onClick={() => go({ name: 'supplier', id: s.id })}>
                <div className="avatar">{s.name.trim()[0]}</div>
                <div className="main-col">
                  <div className="title">{s.name}</div>
                  <div className="meta">{s.phone || '—'}</div>
                </div>
                <div className="end">
                  <div className={`bold ${bal > 0 ? 'bad' : ''}`}><Money v={Math.abs(bal)} /></div>
                  <div className="small muted">{bal > 0 ? 'مستحق له' : bal < 0 ? 'مدفوع له مقدمًا' : 'مسدد'}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon="users" text="لا يوجد موردون" />
      )}
      {form && <PurchaseForm productId={route.params?.new ? Number(route.params.new) : undefined} onClose={() => setForm(false)} />}
      {supForm && <SupplierForm onClose={() => setSupForm(false)} />}
    </div>
  );
}
