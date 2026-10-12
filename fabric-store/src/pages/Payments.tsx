import { useEffect, useMemo, useState } from 'react';
import { matches, useData, type AppData } from '../lib/data';
import { can, openInvoicesFor, reversePayment, savePayment } from '../db/service';
import type { Customer, Payment } from '../db/schema';
import { autoAllocate, customerStatement, round2 } from '../lib/calc';
import { fmtDate, fmtDateTime, fmtNum, fromInputDateNow, inRange, periodRange, PERIODS, toInputDate, type PeriodKey } from '../lib/format';
import { Empty, Field, Modal, Money, NumInput, Picker, SearchBox, Seg, promptDialog, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { PrintPreview } from '../print/PrintPreview';
import { ReceiptDoc } from '../print/Docs';

/** رصيد العميل مباشرة بعد هذه الدفعة (من كشف الحساب) */
export function balanceAfterPayment(d: AppData, p: Payment) {
  const c = d.customerById.get(p.customerId);
  if (!c) return 0;
  const rows = customerStatement(c, d.invoices, d.payments, d.returns);
  const row = rows.find((r) => r.kind === 'payment' && r.refId === p.id);
  return row?.balance ?? d.balance.get(p.customerId) ?? 0;
}

export function PaymentForm({ customerId, invoiceId, onClose }: { customerId?: number; invoiceId?: number; onClose: () => void }) {
  const d = useData();
  const [cid, setCid] = useState<number | undefined>(customerId);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toInputDate());
  const [method, setMethod] = useState(d.settings.paymentMethods[0] ?? 'نقدًا');
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState<{ id: number; number: string; date: number; due?: number; remaining: number }[]>([]);
  const [alloc, setAlloc] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<Payment | null>(null);

  useEffect(() => {
    if (!cid) return setOpen([]);
    openInvoicesFor(cid).then((list) => {
      const o = list.map((x) => ({ id: x.invoice.id!, number: x.invoice.number, date: x.invoice.date, due: x.invoice.dueDate, remaining: x.remaining }));
      setOpen(o);
      if (invoiceId) {
        const inv = o.find((x) => x.id === invoiceId);
        if (inv) {
          setAmount(inv.remaining);
          setAlloc({ [inv.id]: inv.remaining });
        }
      } else setAlloc({});
    });
  }, [cid]);

  const allocated = round2(Object.values(alloc).reduce((s, v) => s + (v || 0), 0));
  const free = round2(amount - allocated);
  const auto = () => {
    const r = autoAllocate(amount, open.map((o) => ({ invoiceId: o.id, remaining: o.remaining })));
    setAlloc(Object.fromEntries(r.map((x) => [x.invoiceId, x.amount])));
  };

  const save = async () => {
    const p = await run(
      () => savePayment({ customerId: cid!, amount, date: fromInputDateNow(date), method, notes, allocations: Object.entries(alloc).map(([k, v]) => ({ invoiceId: Number(k), amount: v })) }),
      'تم تسجيل الدفعة',
    );
    if (p) setSaved(p);
  };

  if (saved) {
    return (
      <PrintPreview
        title={`سند قبض ${saved.number}`}
        filename={`سند-${saved.number}`}
        defaultSize={d.settings.printSize}
        onClose={onClose}
        render={(size) => (
          <ReceiptDoc p={saved} customer={d.customerById.get(saved.customerId)} s={d.settings} size={size} balanceAfter={balanceAfterPayment(d, { ...saved })} invoiceNumbers={new Map(d.invoices.map((i) => [i.id!, i.number]))} />
        )}
      />
    );
  }

  const customer = cid ? d.customerById.get(cid) : undefined;
  return (
    <Modal
      title="سند قبض — تسجيل دفعة"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" onClick={save} disabled={!cid || !(amount > 0) || free < -0.001}><Icon name="check" /> حفظ وإصدار السند</button>
        </>
      }
    >
      <div className="stack">
        <Field label="العميل *">
          <Picker<Customer>
            items={d.customers.filter((c) => !c.archived)}
            value={customer}
            onSelect={(c) => setCid(c.id)}
            getKey={(c) => c.id!}
            getLabel={(c) => c.name}
            getSub={(c) => `${c.code} · ${c.phone} · الرصيد ${fmtNum(d.balance.get(c.id!) ?? 0)}`}
            filter={(c, q) => matches(q, c.name, c.phone, c.code)}
            placeholder="ابحث عن العميل…"
          />
        </Field>
        {customer && <div className="small">الرصيد الحالي: <Money v={d.balance.get(customer.id!) ?? 0} className="bold bad" /></div>}
        <div className="grid grid-2">
          <Field label="قيمة الدفعة *"><NumInput value={amount} min={0} onChange={setAmount} /></Field>
          <Field label="تاريخ الاستلام"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="طريقة الدفع">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {d.settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="ملاحظات"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        {cid && (
          <div>
            <div className="row between" style={{ marginBottom: 6 }}>
              <b>توزيع الدفعة على الفواتير المفتوحة</b>
              {open.length > 0 && <button className="btn sm" onClick={auto} disabled={!(amount > 0)}>توزيع تلقائي (الأقدم أولًا)</button>}
            </div>
            {open.length ? (
              <div className="list">
                {open.map((o) => (
                  <div key={o.id} className="list-item" style={{ cursor: 'default' }}>
                    <div className="main-col">
                      <div className="title">{o.number}</div>
                      <div className="meta">{fmtDate(o.date)} {o.due ? `· يستحق ${fmtDate(o.due)}` : ''} · المتبقي <Money v={o.remaining} /></div>
                    </div>
                    <div style={{ width: 130 }}>
                      <NumInput aria-label={`المبلغ لـ ${o.number}`} value={alloc[o.id] ?? 0} min={0} onChange={(v) => setAlloc({ ...alloc, [o.id]: Math.min(v, o.remaining) })} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small muted">لا توجد فواتير مفتوحة — ستُسجل الدفعة رصيدًا دائنًا للعميل.</div>
            )}
            <div className="summary-box" style={{ marginTop: 10 }}>
              <div className="r"><span>الموزع على الفواتير</span><Money v={allocated} /></div>
              <div className="r bold"><span>غير موزع (رصيد دائن للعميل)</span><Money v={free} className={free < 0 ? 'bad' : ''} /></div>
            </div>
            {free < -0.001 && <div className="alert bad"><Icon name="alert" /> مجموع التوزيع أكبر من قيمة الدفعة</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Payments() {
  const d = useData();
  const { go, route } = useNav();
  const [q, setQ] = useState(route.params?.q ?? '');
  const [period, setPeriod] = useState<PeriodKey | 'all'>('all');
  const [method, setMethod] = useState('');
  const [form, setForm] = useState(false);
  const [view, setView] = useState<Payment | null>(null);

  const list = useMemo(() => {
    const r = period === 'all' ? null : periodRange(period);
    return d.payments
      .filter((p) => (!r || inRange(p.date, r)) && (!method || p.method === method))
      .filter((p) => {
        const c = d.customerById.get(p.customerId);
        return matches(q, p.number, c?.name, c?.phone, p.notes);
      })
      .sort((a, b) => b.date - a.date);
  }, [d, q, period, method]);
  const total = round2(list.filter((p) => !p.reversed).reduce((s, p) => s + p.amount, 0));

  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="رقم السند، العميل، الهاتف…" />
        <select className="input" style={{ width: 'auto' }} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="طريقة الدفع">
          <option value="">كل الطرق</option>
          {d.settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
        </select>
        {can('payment_create') && <button className="btn primary" onClick={() => setForm(true)}><Icon name="plus" /> سند قبض</button>}
      </div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <Seg value={period} onChange={setPeriod} options={[{ key: 'all', label: 'الكل' }, ...PERIODS.filter((p) => p.key !== 'custom')]} />
        <div className="small">الإجمالي المحصّل: <Money v={total} className="bold good" /> ({fmtNum(list.length)} سند)</div>
      </div>
      {!list.length ? (
        <Empty icon="wallet" text="لا توجد دفعات" />
      ) : (
        <div className="list">
          {list.map((p) => {
            const c = d.customerById.get(p.customerId);
            const free = round2(p.amount - p.allocations.reduce((s, a) => s + a.amount, 0));
            return (
              <div key={p.id} className="list-item" onClick={() => setView(p)}>
                <div className="avatar"><Icon name="wallet" /></div>
                <div className="main-col">
                  <div className="title">{c?.name ?? '—'}</div>
                  <div className="meta">
                    {p.number} · {fmtDateTime(p.date)} · {p.method}
                    {p.allocations.length > 0 && ` · ${p.allocations.map((a) => d.invoiceById.get(a.invoiceId)?.number).join('، ')}`}
                    {free > 0.009 && !p.reversed && ' · غير موزع ' + fmtNum(free)}
                  </div>
                </div>
                <div className="end">
                  <Money v={p.amount} className={p.reversed ? 'muted' : 'good bold'} />
                  {p.reversed ? <div className="badge muted">معكوسة</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && <PaymentForm onClose={() => setForm(false)} />}
      {view && (
        <PrintPreview
          title={`سند قبض ${view.number}`}
          filename={`سند-${view.number}`}
          defaultSize={d.settings.printSize}
          onClose={() => setView(null)}
          actions={
            <>
              <button className="btn" onClick={() => { const id = view.customerId; setView(null); go({ name: 'customer', id }); }}>
                <Icon name="user" /> ملف العميل
              </button>
              {!view.reversed && can('payment_reverse') && (
                <button
                  className="btn danger"
                  onClick={async () => {
                    const reason = await promptDialog('عكس الدفعة', `سيتم عكس السند ${view.number} بقيمة ${fmtNum(view.amount)} مع الاحتفاظ بسجله. اكتب السبب:`);
                    if (reason && (await run(() => reversePayment(view.id!, reason), 'تم عكس الدفعة')) !== undefined) setView(null);
                  }}
                >
                  <Icon name="return" /> عكس الدفعة
                </button>
              )}
            </>
          }
          render={(size) => (
            <ReceiptDoc p={view} customer={d.customerById.get(view.customerId)} s={d.settings} size={size} balanceAfter={balanceAfterPayment(d, view)} invoiceNumbers={new Map(d.invoices.map((i) => [i.id!, i.number]))} />
          )}
        />
      )}
    </div>
  );
}
