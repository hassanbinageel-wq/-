import { useMemo, useState } from 'react';
import { useData } from '../lib/data';
import { allocateCredit, can, openInvoicesFor, setArchived, touchCustomerContact } from '../db/service';
import { customerStatement, round2 } from '../lib/calc';
import { fmtDate, fmtDateTime, fromInputDate, toInputDate } from '../lib/format';
import { Empty, Field, KPI, Money, StatusBadge, confirmDialog, run, toast, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { CustomerForm } from './Customers';
import { PaymentForm } from './Payments';
import { PrintPreview } from '../print/PrintPreview';
import { StatementDoc } from '../print/Docs';

export default function CustomerView({ id }: { id: number }) {
  const d = useData();
  const { go } = useNav();
  const c = d.customerById.get(id);
  const [tab, setTab] = useState<'statement' | 'invoices' | 'payments' | 'info'>('statement');
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const [print, setPrint] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const invoices = useMemo(() => d.invoices.filter((i) => i.customerId === id).sort((a, b) => b.date - a.date), [d.invoices, id]);
  const payments = useMemo(() => d.payments.filter((p) => p.customerId === id).sort((a, b) => b.date - a.date), [d.payments, id]);
  const returns = useMemo(() => d.returns.filter((r) => r.customerId === id), [d.returns, id]);
  const rows = useMemo(
    () => (c ? customerStatement(c, d.invoices, d.payments, d.returns, fromInputDate(from), fromInputDate(to, true)) : []),
    [c, d.invoices, d.payments, d.returns, from, to],
  );

  if (!d.ready) return null;
  if (!c) return <Empty icon="user" text="العميل غير موجود" />;
  const balance = d.balance.get(id) ?? 0;
  const credit = d.credit.get(id) ?? 0;
  const totalSales = round2(invoices.filter((i) => i.state === 'approved').reduce((s, i) => s + i.net, 0));
  const totalPaid = round2(payments.filter((p) => !p.reversed).reduce((s, p) => s + p.amount, 0));
  const totalReturns = round2(returns.reduce((s, r) => s + r.total, 0));
  const totalDiscounts = round2(invoices.filter((i) => i.state === 'approved').reduce((s, i) => s + i.totalDiscount, 0));
  const openCount = invoices.filter((i) => (d.status.get(i.id!)?.remaining ?? 0) > 0).length;

  const distributeCredit = async () => {
    const open = await openInvoicesFor(id);
    if (!open.length) return toast.info('لا توجد فواتير مفتوحة');
    if (!(await confirmDialog('توزيع الرصيد الدائن', 'سيتم توزيع الدفعات غير الموزعة على الفواتير المفتوحة بدءًا من الأقدم استحقاقًا.'))) return;
    await run(async () => {
      for (const p of payments.filter((x) => !x.reversed)) {
        let free = round2(p.amount - p.allocations.reduce((s, a) => s + a.amount, 0));
        for (const o of await openInvoicesFor(id)) {
          if (free <= 0) break;
          const amt = Math.min(free, o.remaining);
          await allocateCredit(p.id!, o.invoice.id!, amt);
          free = round2(free - amt);
        }
      }
    }, 'تم التوزيع');
  };

  const phone = c.phone.replace(/[^\d+]/g, '');
  const waPhone = phone.startsWith('0') ? '967' + phone.slice(1) : phone.replace('+', '');

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="avatar" style={{ width: 54, height: 54, fontSize: 22 }}>{c.name.trim()[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20 }}>{c.name} {c.archived ? <span className="badge muted">مؤرشف</span> : null}</h2>
            <div className="muted small">رقم العميل {c.code} · مسجّل منذ {fmtDate(c.createdAt)}</div>
            <div className="small">{[c.phone, c.city, c.address].filter(Boolean).join(' · ') || '—'}</div>
            {c.lastContact && <div className="small muted">آخر تواصل/تحصيل: {fmtDateTime(c.lastContact)}</div>}
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {can('invoice_create') && <button className="btn primary" onClick={() => go({ name: 'invoice-new', params: { customer: String(id) } })}><Icon name="plus" /> فاتورة</button>}
          {can('payment_create') && <button className="btn" onClick={() => setPay(true)}><Icon name="wallet" /> سند قبض</button>}
          <button className="btn" onClick={() => setPrint(true)}><Icon name="print" /> كشف الحساب</button>
          {phone && <a className="btn" href={`tel:${phone}`}><Icon name="phone" /> اتصال</a>}
          {phone && (
            <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`مرحبًا ${c.name}، رصيدكم المستحق لدى ${d.settings.shopName} هو ${round2(balance)} ${d.settings.currency}.`)}`}>
              واتساب
            </a>
          )}
          <button className="btn ghost" onClick={() => run(() => touchCustomerContact(id), 'تم تسجيل التواصل')}><Icon name="clock" /> تسجيل تواصل</button>
          {can('customers') && <button className="btn ghost" onClick={() => setEdit(true)}><Icon name="edit" /> تعديل</button>}
          {can('customers') && (
            <button className="btn ghost" onClick={() => run(() => setArchived('customers', id, !c.archived), c.archived ? 'تمت الاستعادة' : 'تمت الأرشفة — تبقى سجلاته المالية محفوظة')}>
              <Icon name="archive" /> {c.archived ? 'استعادة' : 'أرشفة'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-4">
        <KPI accent icon="debt" label={balance >= 0 ? 'الرصيد المستحق عليه' : 'رصيد دائن له'} value={<Money v={Math.abs(balance)} />} sub={`${openCount} فاتورة مفتوحة`} />
        <KPI icon="invoice" label="إجمالي المبيعات" value={<Money v={totalSales} />} sub={c.openingBalance ? <>رصيد افتتاحي <Money v={c.openingBalance} /></> : undefined} />
        <KPI icon="wallet" label="إجمالي المسدد" value={<Money v={totalPaid} className="good" />} />
        <KPI icon="return" label="المرتجعات والخصومات" value={<Money v={totalReturns + totalDiscounts} />} sub={<>مرتجعات <Money v={totalReturns} /> · خصومات <Money v={totalDiscounts} /></>} />
      </div>
      {c.creditLimit > 0 && balance > c.creditLimit && (
        <div className="alert bad"><Icon name="alert" /> تجاوز العميل الحد الائتماني (<Money v={c.creditLimit} />)</div>
      )}
      {credit > 0.009 && (
        <div className="alert info">
          <Icon name="info" />
          <span style={{ flex: 1 }}>لدى العميل دفعات غير موزعة على فواتير بقيمة <b><Money v={credit} /></b> (محتسبة في رصيده).</span>
          {can('payment_create') && openCount > 0 && <button className="btn sm" onClick={distributeCredit}>توزيعها على الفواتير</button>}
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <button className={tab === 'statement' ? 'on' : ''} onClick={() => setTab('statement')}>كشف الحساب</button>
          <button className={tab === 'invoices' ? 'on' : ''} onClick={() => setTab('invoices')}>الفواتير ({invoices.length})</button>
          <button className={tab === 'payments' ? 'on' : ''} onClick={() => setTab('payments')}>الدفعات ({payments.length})</button>
          <button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>ملاحظات</button>
        </div>
        {tab === 'statement' && (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <Field label="من"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label="إلى"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              {(from || to) && <button className="btn sm ghost" style={{ alignSelf: 'flex-end' }} onClick={() => { setFrom(''); setTo(''); }}>كل الفترات</button>}
            </div>
            {rows.length ? (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>التاريخ</th><th>المرجع</th><th>البيان</th><th>مدين (عليه)</th><th>دائن (له)</th><th>الرصيد</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r.kind === 'invoice' ? 'click' : ''} onClick={() => r.kind === 'invoice' && go({ name: 'invoice', id: r.refId })}>
                        <td>{fmtDate(r.date)}</td>
                        <td className="bold">{r.ref}</td>
                        <td>{r.description}</td>
                        <td>{r.debit ? <Money v={r.debit} /> : '—'}</td>
                        <td className="good">{r.credit ? <Money v={r.credit} /> : '—'}</td>
                        <td className={`bold ${r.balance > 0 ? 'bad' : ''}`}><Money v={r.balance} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="history" text="لا توجد حركات" />
            )}
          </>
        )}
        {tab === 'invoices' && (
          invoices.length ? (
            <div className="list">
              {invoices.map((i) => {
                const st = d.status.get(i.id!)!;
                return (
                  <div key={i.id} className="list-item" onClick={() => go(i.state === 'draft' ? { name: 'invoice-edit', id: i.id } : { name: 'invoice', id: i.id })}>
                    <div className="main-col">
                      <div className="title">{i.number}</div>
                      <div className="meta">{fmtDate(i.date)} · {i.saleType === 'cash' ? 'نقدي' : `آجل — يستحق ${fmtDate(i.dueDate)}`}</div>
                    </div>
                    <div className="end">
                      <div className="bold"><Money v={i.net} /></div>
                      <StatusBadge info={st} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty icon="invoice" text="لا توجد فواتير" />
        )}
        {tab === 'payments' && (
          payments.length ? (
            <div className="list">
              {payments.map((p) => (
                <div key={p.id} className="list-item" onClick={() => go({ name: 'payments', params: { q: p.number } })}>
                  <div className="main-col">
                    <div className="title">{p.number} · {p.method}</div>
                    <div className="meta">{fmtDateTime(p.date)} · {p.allocations.length ? `على ${p.allocations.length} فاتورة` : 'غير موزعة'}</div>
                  </div>
                  <div className="end">
                    <Money v={p.amount} className={p.reversed ? 'muted' : 'good bold'} />
                    {p.reversed ? <div className="badge muted">معكوسة</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty icon="wallet" text="لا توجد دفعات" />
        )}
        {tab === 'info' && <p style={{ whiteSpace: 'pre-line' }}>{c.notes || 'لا توجد ملاحظات'}</p>}
      </div>

      {edit && <CustomerForm initial={c} onClose={() => setEdit(false)} />}
      {pay && <PaymentForm customerId={id} onClose={() => setPay(false)} />}
      {print && (
        <PrintPreview
          title={`كشف حساب — ${c.name}`}
          filename={`كشف-حساب-${c.name}-${toInputDate()}`}
          allowThermal={false}
          onClose={() => setPrint(false)}
          render={() => <StatementDoc customer={c} rows={rows} s={d.settings} from={fromInputDate(from)} to={fromInputDate(to, true)} balance={balance} />}
        />
      )}
    </div>
  );
}
