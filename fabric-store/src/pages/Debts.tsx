import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { round2 } from '../lib/calc';
import { DAY, fmtDate, fmtNum, toInputDate } from '../lib/format';
import { Empty, KPI, Money, NumInput, SearchBox, Field, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { PrintPreview } from '../print/PrintPreview';
import { ReportDoc } from '../print/Docs';
import { csvBlob, shareFile } from '../lib/platform';

export default function Debts() {
  const d = useData();
  const { go } = useNav();
  const [q, setQ] = useState('');
  const [min, setMin] = useState(0);
  const [lateDays, setLateDays] = useState(0);
  const [sort, setSort] = useState<'amount' | 'due' | 'late'>('amount');
  const [print, setPrint] = useState(false);
  const now = Date.now();

  const rows = useMemo(() => {
    return d.customers
      .map((c) => {
        const bal = d.balance.get(c.id!) ?? 0;
        const open = d.invoices.filter((i) => i.customerId === c.id && (d.status.get(i.id!)?.remaining ?? 0) > 0);
        const overdue = open.filter((i) => d.status.get(i.id!)?.overdue);
        const oldestDue = open.reduce<number | undefined>((m, i) => (i.dueDate && (!m || i.dueDate < m) ? i.dueDate : m), undefined);
        const lastPay = d.payments.filter((p) => p.customerId === c.id && !p.reversed).sort((a, b) => b.date - a.date)[0];
        return {
          c,
          bal,
          openCount: open.length,
          overdueAmount: round2(overdue.reduce((s, i) => s + d.status.get(i.id!)!.remaining, 0)),
          oldestDue,
          lateDays: oldestDue && oldestDue < now ? Math.floor((now - oldestDue) / DAY) : 0,
          lastPay,
        };
      })
      .filter((r) => r.bal > 0.009 && r.bal >= min && r.lateDays >= lateDays && matches(q, r.c.name, r.c.phone, r.c.code, r.c.city))
      .sort((a, b) => (sort === 'amount' ? b.bal - a.bal : sort === 'late' ? b.lateDays - a.lateDays : (a.oldestDue ?? Infinity) - (b.oldestDue ?? Infinity)));
  }, [d, q, min, lateDays, sort]);

  const total = round2(rows.reduce((s, r) => s + r.bal, 0));
  const overdue = round2(rows.reduce((s, r) => s + r.overdueAmount, 0));
  const head = ['العميل', 'الهاتف', 'الرصيد المستحق', 'فواتير مفتوحة', 'المتأخر', 'أقدم استحقاق', 'أيام التأخير', 'آخر دفعة', 'آخر تواصل'];
  const table = rows.map((r) => [
    r.c.name,
    r.c.phone,
    r.bal,
    r.openCount,
    r.overdueAmount,
    r.oldestDue ? fmtDate(r.oldestDue) : '—',
    r.lateDays || '—',
    r.lastPay ? `${fmtNum(r.lastPay.amount)} (${fmtDate(r.lastPay.date)})` : '—',
    r.c.lastContact ? fmtDate(r.c.lastContact) : '—',
  ]);

  return (
    <div className="stack">
      <div className="grid grid-3">
        <KPI accent icon="debt" label="إجمالي المديونيات" value={<Money v={total} />} sub={`${rows.length} عميل`} />
        <KPI icon="alert" label="مبالغ متأخرة عن الاستحقاق" value={<Money v={overdue} className="bad" />} />
        <KPI icon="users" label="عملاء متأخرون" value={fmtNum(rows.filter((r) => r.lateDays > 0).length)} />
      </div>
      <div className="card">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="بحث بالاسم أو الهاتف…" />
          <Field label="أقل مبلغ"><NumInput value={min} min={0} onChange={setMin} /></Field>
          <Field label="تأخير لا يقل عن (يوم)"><NumInput value={lateDays} min={0} onChange={setLateDays} /></Field>
          <Field label="الترتيب">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="amount">الأعلى مبلغًا</option>
              <option value="late">الأكثر تأخيرًا</option>
              <option value="due">أقرب استحقاق</option>
            </select>
          </Field>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setPrint(true)}><Icon name="print" /> طباعة التقرير</button>
          <button className="btn" onClick={() => shareFile(csvBlob([head, ...table]), `مديونيات-${toInputDate()}.csv`)}><Icon name="download" /> تصدير Excel (CSV)</button>
        </div>
      </div>
      {!rows.length ? (
        <Empty icon="check" text="لا توجد مديونيات مطابقة" />
      ) : (
        <div className="list">
          {rows.map((r) => (
            <div key={r.c.id} className="list-item" onClick={() => go({ name: 'customer', id: r.c.id })}>
              <div className="avatar">{r.c.name.trim()[0]}</div>
              <div className="main-col">
                <div className="title">{r.c.name}</div>
                <div className="meta">
                  {r.c.phone || '—'} · {r.openCount} فاتورة مفتوحة
                  {r.oldestDue && ` · أقدم استحقاق ${fmtDate(r.oldestDue)}`}
                  {r.lastPay && ` · آخر دفعة ${fmtDate(r.lastPay.date)}`}
                </div>
                {r.lateDays > 0 && <span className="badge bad" style={{ marginTop: 4 }}>متأخر {r.lateDays} يوم — <Money v={r.overdueAmount} /></span>}
              </div>
              <div className="end bold bad"><Money v={r.bal} /></div>
            </div>
          ))}
        </div>
      )}
      {print && (
        <PrintPreview
          title="تقرير مديونيات العملاء"
          filename={`مديونيات-${toInputDate()}`}
          allowThermal={false}
          onClose={() => setPrint(false)}
          render={() => (
            <ReportDoc
              s={d.settings}
              report={{
                title: 'تقرير مديونيات العملاء',
                subtitle: fmtDate(Date.now()),
                head,
                rows: table,
                foot: ['الإجمالي', '', total, '', overdue, '', '', '', ''],
                summary: [['إجمالي المديونيات', fmtNum(total)], ['المتأخر', fmtNum(overdue)], ['عدد العملاء', fmtNum(rows.length)]],
              }}
            />
          )}
        />
      )}
    </div>
  );
}
