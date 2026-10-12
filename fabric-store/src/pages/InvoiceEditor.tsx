import { useEffect, useMemo, useState } from 'react';
import { useData, matches } from '../lib/data';
import { db, type Customer, type InvoiceLine, type Product } from '../db/schema';
import { approveInvoice, can, editApprovedInvoice, getSessionUser, saveDraft, deleteDraft, type InvoiceInput } from '../db/service';
import { computeInvoiceTotals, computeLine, round2 } from '../lib/calc';
import { DAY, fmtNum, fromInputDate, fromInputDateNow, toInputDate } from '../lib/format';
import { Field, Money, NumInput, Picker, Seg, confirmDialog, run, toast, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { CustomerForm } from './Customers';

const emptyLine = (): InvoiceLine => ({
  name: '', brand: '', fabricType: '', origin: '', color: '', colorCode: '', code: '', baseUnit: 'ياردة', unit: 'ياردة', factor: 1,
  cartons: 0, bolts: 0, qty: 0, baseQty: 0, unitPrice: 0, total: 0, discount: 0, net: 0, unitCost: 0,
});

/** يملأ عدد الكراتين والطاقات تلقائيًا من الكمية حسب معاملات تحويل الصنف */
function autoPacks(l: InvoiceLine, p?: Product): InvoiceLine {
  if (!p) return l;
  const carton = p.units.find((u) => u.name === 'كرتون');
  const bolt = p.units.find((u) => u.name === 'طاقة');
  const base = l.qty * l.factor;
  return {
    ...l,
    cartons: carton ? round2(base / carton.factor) : l.cartons,
    bolts: bolt ? round2(base / bolt.factor) : l.bolts,
  };
}

export default function InvoiceEditor({ id }: { id?: number }) {
  const d = useData();
  const { go, route } = useNav();
  const user = getSessionUser();
  const s = d.settings;
  const canPrice = can('prices_discounts');
  const [loaded, setLoaded] = useState(!id);
  const [state, setState] = useState<'new' | 'draft' | 'approved'>('new');
  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState<number | undefined>(route.params?.customer ? Number(route.params.customer) : undefined);
  const [date, setDate] = useState(toInputDate());
  const [saleType, setSaleType] = useState<'cash' | 'credit'>('cash');
  const [dueDate, setDueDate] = useState(toInputDate(Date.now() + s.defaultDueDays * DAY));
  const [sellerName, setSellerName] = useState(user?.name ?? '');
  const [paymentMethod, setPaymentMethod] = useState(s.paymentMethods[0] ?? 'نقدًا');
  const [notes, setNotes] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [extraFees, setExtraFees] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);
  const [newCustomer, setNewCustomer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.invoices.get(id).then((inv) => {
      if (!inv) return;
      setState(inv.state === 'draft' ? 'draft' : 'approved');
      setNumber(inv.number);
      setCustomerId(inv.customerId);
      setDate(toInputDate(inv.date));
      setSaleType(inv.saleType);
      if (inv.dueDate) setDueDate(toInputDate(inv.dueDate));
      setSellerName(inv.sellerName);
      setPaymentMethod(inv.paymentMethod);
      setNotes(inv.notes);
      setDeliveryNotes(inv.deliveryNotes);
      setLines(inv.lines.length ? inv.lines : [emptyLine()]);
      setInvoiceDiscount(inv.invoiceDiscount);
      setExtraFees(inv.extraFees);
      setPaid(inv.paidAtIssue);
      setPaidTouched(true);
      setLoaded(true);
    });
  }, [id]);

  const customer = customerId ? d.customerById.get(customerId) : undefined;
  const prevBalance = customerId ? d.balance.get(customerId) ?? 0 : 0;
  const computed = useMemo(() => lines.map(computeLine), [lines]);
  const totals = useMemo(() => computeInvoiceTotals(computed.filter((l) => l.qty > 0), invoiceDiscount, extraFees), [computed, invoiceDiscount, extraFees]);

  // البيع النقدي: المدفوع = الصافي تلقائيًا ما لم يعدّله المستخدم
  useEffect(() => {
    if (state === 'approved') return;
    if (saleType === 'cash' && !paidTouched) setPaid(totals.net);
    if (saleType === 'credit' && !paidTouched) setPaid(0);
  }, [totals.net, saleType, paidTouched, state]);

  const remaining = round2(totals.net - (state === 'approved' ? 0 : paid));
  const products = useMemo(() => d.products.filter((p) => !p.archived), [d.products]);
  const customers = useMemo(() => d.customers.filter((c) => !c.archived), [d.customers]);

  const setLine = (i: number, patch: Partial<InvoiceLine>, recalcPacks = false) =>
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        return recalcPacks ? autoPacks(next, next.productId ? d.productById.get(next.productId) : undefined) : next;
      }),
    );

  const pickProduct = (i: number, p: Product) => {
    const unit = p.units[p.units.length - 1]?.name === 'كرتون' ? p.baseUnit : p.baseUnit;
    setLine(
      i,
      {
        productId: p.id,
        name: p.name,
        brand: p.brand,
        fabricType: p.fabricType,
        origin: p.origin,
        color: p.color,
        colorCode: p.colorCode,
        code: p.code,
        baseUnit: p.baseUnit,
        unit,
        factor: 1,
        unitPrice: p.price,
        unitCost: p.cost,
      },
      true,
    );
  };

  const changeUnit = (i: number, unitName: string) => {
    const l = lines[i];
    const p = l.productId ? d.productById.get(l.productId) : undefined;
    if (p) {
      const u = p.units.find((x) => x.name === unitName) ?? { name: p.baseUnit, factor: 1 };
      setLine(i, { unit: u.name, factor: u.factor, unitPrice: round2(p.price * u.factor) }, true);
    } else {
      setLine(i, { unit: unitName, baseUnit: unitName, factor: 1 });
    }
  };

  const input = (): InvoiceInput => ({
    id: state === 'draft' ? id : undefined,
    date: state === 'approved' ? fromInputDateNow(date) : fromInputDateNow(date),
    customerId: customerId!,
    saleType,
    dueDate: saleType === 'credit' ? fromInputDate(dueDate, true) : undefined,
    sellerName,
    paymentMethod,
    notes,
    deliveryNotes,
    lines: computed.filter((l) => l.name.trim() || l.qty > 0),
    invoiceDiscount,
    extraFees,
    paidAtIssue: paid,
  });

  const stockWarnings = computed
    .filter((l) => l.productId && l.qty > 0)
    .map((l) => ({ l, p: d.productById.get(l.productId!)! }))
    .filter(({ l, p }) => p && l.baseQty > p.stock + (state === 'approved' ? 0 : 0))
    .map(({ l, p }) => `${l.name}: المطلوب ${fmtNum(l.baseQty)} ${p.baseUnit} والمتوفر ${fmtNum(p.stock)}`);

  const approve = async () => {
    if (!customerId) return toast.error('اختر العميل أولًا');
    if (stockWarnings.length && state !== 'approved') {
      const ok = await confirmDialog('الكمية غير كافية في المخزون', stockWarnings.join('\n') + '\n\nهل تريد المتابعة؟ سيصبح رصيد المخزون بالسالب.', { ok: 'متابعة' });
      if (!ok) return;
    }
    if (customer && customer.creditLimit > 0 && state !== 'approved') {
      const after = prevBalance + totals.net - paid;
      if (after > customer.creditLimit) {
        const ok = await confirmDialog('تجاوز الحد الائتماني', `مديونية العميل بعد الفاتورة ستصبح ${fmtNum(after)} والحد المسموح ${fmtNum(customer.creditLimit)}.\nهل تريد المتابعة؟`, { ok: 'متابعة' });
        if (!ok) return;
      }
    }
    setBusy(true);
    const inv = await run(() => (state === 'approved' ? editApprovedInvoice(id!, input()) : approveInvoice(input())), state === 'approved' ? 'تم حفظ التعديلات' : 'تم اعتماد الفاتورة');
    setBusy(false);
    if (inv) {
      history.replaceState(null, '', '#/invoices');
      go({ name: 'invoice', id: inv.id, params: state === 'approved' ? undefined : { print: '1' } });
    }
  };

  const draft = async () => {
    if (!customerId) return toast.error('اختر العميل أولًا');
    const newId = await run(() => saveDraft(input()), 'تم حفظ المسودة');
    if (newId) go('invoices');
  };

  if (!loaded) return <div className="muted">جارٍ التحميل…</div>;

  return (
    <div className="stack">
      {state === 'approved' && (
        <div className="alert warn">
          <Icon name="alert" />
          <span>أنت تعدّل فاتورة معتمدة ({number}). سيتم تصحيح المخزون والحسابات تلقائيًا وتوثيق النسخة السابقة في سجل العمليات.</span>
        </div>
      )}
      <div className="card">
        <div className="grid grid-3">
          <Field label="العميل *">
            <Picker<Customer>
              items={customers}
              value={customer}
              onSelect={(c) => setCustomerId(c.id)}
              getKey={(c) => c.id!}
              getLabel={(c) => c.name}
              getSub={(c) => [c.code, c.phone, c.city].filter(Boolean).join(' · ')}
              filter={(c, q) => matches(q, c.name, c.phone, c.code, c.city)}
              placeholder="ابحث بالاسم أو الهاتف…"
              onCreate={can('customers') ? (q) => setNewCustomer(q) : undefined}
              createLabel="عميل جديد"
            />
          </Field>
          <Field label="تاريخ الفاتورة">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="نوع البيع">
            <Seg value={saleType} onChange={(v) => { setSaleType(v); setPaidTouched(false); }} options={[{ key: 'cash', label: 'نقدًا' }, { key: 'credit', label: 'آجل' }]} />
          </Field>
          {saleType === 'credit' && (
            <Field label="تاريخ الاستحقاق *">
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          )}
          <Field label="وسيلة الدفع">
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {s.paymentMethods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="اسم البائع">
            <input className="input" value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
          </Field>
        </div>
        {customer && (
          <div className="row small" style={{ marginTop: 10, gap: 14 }}>
            <span className="muted">رصيد العميل الحالي:</span>
            <Money v={prevBalance} className={prevBalance > 0 ? 'bad bold' : 'good bold'} />
            {customer.creditLimit > 0 && <span className="muted">الحد الائتماني: <Money v={customer.creditLimit} /></span>}
            {(d.credit.get(customer.id!) ?? 0) > 0 && <span className="badge good">له رصيد دائن غير موزع <Money v={d.credit.get(customer.id!)!} /></span>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>أصناف الفاتورة</h3>
          <button className="btn sm" onClick={() => setLines((l) => [...l, emptyLine()])}><Icon name="plus" /> سطر</button>
        </div>
        {lines.map((l, i) => {
          const c = computed[i];
          const p = l.productId ? d.productById.get(l.productId) : undefined;
          const units = p ? p.units : s.units.map((u) => ({ name: u, factor: 1 }));
          return (
            <div className="line-card" key={i} style={{ marginTop: 14 }}>
              <span className="line-no">{i + 1}</span>
              <div className="line-grid">
                <Field label="الصنف / الموديل" className="span3">
                  <Picker<Product>
                    items={products}
                    value={p}
                    onSelect={(x) => pickProduct(i, x)}
                    getKey={(x) => x.id!}
                    getLabel={(x) => `${x.name}${x.color ? ' — ' + x.color : ''}`}
                    getSub={(x) => `${x.code} · ${x.fabricType || '—'} · المتوفر ${fmtNum(x.stock)} ${x.baseUnit} · ${fmtNum(x.price)}/${x.baseUnit}`}
                    filter={(x, q) => matches(q, x.name, x.code, x.color, x.colorCode, x.modelNo, x.fabricType, x.brand)}
                    placeholder={l.name && !p ? l.name : 'ابحث بالاسم أو الكود أو اللون…'}
                    onCreate={(q) => setLine(i, { ...emptyLine(), name: q || 'صنف', unit: s.units[0], baseUnit: s.units[0] })}
                    createLabel="صنف غير مسجل"
                  />
                </Field>
                <Field label="نوع القماش">
                  <select className="input" value={l.fabricType} onChange={(e) => setLine(i, { fabricType: e.target.value })}>
                    <option value="">—</option>
                    {[...new Set([...s.fabricTypes, l.fabricType].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="اللون / الدرجة">
                  <input className="input" value={l.color} onChange={(e) => setLine(i, { color: e.target.value })} />
                </Field>
                <Field label="رمز اللون">
                  <input className="input" value={l.colorCode} onChange={(e) => setLine(i, { colorCode: e.target.value })} />
                </Field>
                {!p && (
                  <Field label="اسم الصنف" className="span2">
                    <input className="input" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="اسم القماش أو الموديل" />
                  </Field>
                )}
                <Field label="وحدة البيع">
                  <select className="input" value={l.unit} onChange={(e) => changeUnit(i, e.target.value)}>
                    {units.map((u) => (
                      <option key={u.name} value={u.name}>
                        {u.name}{p && u.factor !== 1 ? ` (${fmtNum(u.factor)} ${p.baseUnit})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`الكمية (${l.unit})`}>
                  <NumInput value={l.qty} min={0} onChange={(v) => setLine(i, { qty: v }, true)} />
                </Field>
                <Field label="عدد الكراتين">
                  <NumInput value={l.cartons} min={0} onChange={(v) => setLine(i, { cartons: v })} />
                </Field>
                <Field label="عدد الطاقات">
                  <NumInput value={l.bolts} min={0} onChange={(v) => setLine(i, { bolts: v })} />
                </Field>
                <Field label={`سعر الـ${l.unit}`}>
                  <NumInput value={l.unitPrice} min={0} disabled={!canPrice && !!p} onChange={(v) => setLine(i, { unitPrice: v })} />
                </Field>
                <Field label="الخصم">
                  <NumInput value={l.discount} min={0} disabled={!canPrice} onChange={(v) => setLine(i, { discount: v })} />
                </Field>
              </div>
              <div className="row between" style={{ marginTop: 10 }}>
                <div className="row small" style={{ gap: 12 }}>
                  <span className="muted">الكمية الفعلية: <b className="num">{fmtNum(c.baseQty)}</b> {l.baseUnit}</span>
                  <span className="muted">الإجمالي: <Money v={c.total} /></span>
                  <span>صافي الصنف: <b><Money v={c.net} /></b></span>
                  {p && c.baseQty > p.stock && <span className="badge warn">المتوفر {fmtNum(p.stock)} فقط</span>}
                </div>
                <button className="btn sm danger" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, x) => x !== i) : [emptyLine()]))}>
                  <Icon name="trash" /> حذف
                </button>
              </div>
            </div>
          );
        })}
        <button className="btn" style={{ marginTop: 12, width: '100%', borderStyle: 'dashed' }} onClick={() => setLines((l) => [...l, emptyLine()])}>
          <Icon name="plus" /> إضافة صنف آخر
        </button>
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <div className="grid grid-2">
            <Field label="خصم على الفاتورة">
              <NumInput value={invoiceDiscount} min={0} disabled={!canPrice} onChange={setInvoiceDiscount} />
            </Field>
            <Field label="رسوم إضافية (نقل/تحميل)">
              <NumInput value={extraFees} min={0} onChange={setExtraFees} />
            </Field>
          </div>
          {state !== 'approved' && (
            <Field label="المبلغ المدفوع عند الإصدار">
              <NumInput value={paid} min={0} onChange={(v) => { setPaid(v); setPaidTouched(true); }} />
            </Field>
          )}
          <Field label="ملاحظات البيع">
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="ملاحظات التسليم">
            <textarea className="input" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
          </Field>
        </div>
        <div className="card">
          <div className="card-title"><h3>ملخص الحساب</h3></div>
          <div className="summary-box">
            <div className="r"><span>إجمالي الفاتورة قبل الخصم</span><Money v={totals.subtotal} /></div>
            <div className="r"><span>إجمالي الخصومات</span><Money v={totals.totalDiscount} /></div>
            {extraFees > 0 && <div className="r"><span>رسوم إضافية</span><Money v={extraFees} /></div>}
            <div className="r total"><span>صافي قيمة الفاتورة</span><Money v={totals.net} /></div>
            {state !== 'approved' && (
              <>
                <div className="r"><span>المدفوع عند الإصدار</span><Money v={paid} className="good" /></div>
                <div className="r bold"><span>المتبقي من الفاتورة</span><Money v={remaining} className={remaining > 0 ? 'bad' : ''} /></div>
                <div className="r muted"><span>الرصيد السابق للعميل (مستقل)</span><Money v={prevBalance} /></div>
                <div className="r total"><span>إجمالي المستحق على العميل بعد الفاتورة</span><Money v={round2(prevBalance + remaining)} /></div>
              </>
            )}
            {paid > totals.net && <div className="alert bad"><Icon name="alert" /> المدفوع أكبر من صافي الفاتورة</div>}
          </div>
        </div>
      </div>

      <div className="sticky-actions">
        {state === 'draft' && (
          <button
            className="btn danger"
            onClick={async () => {
              if (await confirmDialog('حذف المسودة', 'سيتم حذف هذه المسودة نهائيًا.', { danger: true, ok: 'حذف' })) {
                if ((await run(() => deleteDraft(id!), 'تم الحذف')) !== undefined || true) go('invoices');
              }
            }}
          >
            <Icon name="trash" /> حذف المسودة
          </button>
        )}
        <span className="spacer" />
        {state !== 'approved' && (
          <button className="btn" onClick={draft} disabled={busy}>
            حفظ كمسودة
          </button>
        )}
        {(state === 'approved' ? can('invoice_edit') : can('invoice_approve')) && (
          <button className="btn primary" onClick={approve} disabled={busy}>
            <Icon name="check" /> {state === 'approved' ? 'حفظ التعديلات' : 'اعتماد الفاتورة'}
          </button>
        )}
      </div>

      {newCustomer !== null && (
        <CustomerForm
          initial={{ name: newCustomer }}
          onClose={() => setNewCustomer(null)}
          onSaved={(cid) => {
            setCustomerId(cid);
            setNewCustomer(null);
          }}
        />
      )}
    </div>
  );
}
