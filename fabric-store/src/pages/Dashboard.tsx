import { useMemo, useState } from 'react';
import { useData } from '../lib/data';
import { profitSummary, round2 } from '../lib/calc';
import { DAY, fmtDate, fmtMoney, fmtNum, fromInputDate, inRange, MONTHS, periodRange, PERIODS, toInputDate, type PeriodKey } from '../lib/format';
import { can } from '../db/service';
import { Empty, Field, KPI, Money, Seg, StatusBadge, useNav } from '../ui/kit';
import { BarChart, type Bucket } from '../ui/Chart';
import { Icon } from '../ui/Icon';

type Gran = 'day' | 'week' | 'month' | 'year';

export function buildBuckets(gran: Gran, now = new Date()) {
  const out: { from: number; to: number; label: string; full: string }[] = [];
  if (gran === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push({ from: d.getTime(), to: d.getTime() + DAY - 1, label: `${d.getDate()}/${d.getMonth() + 1}`, full: fmtDate(d.getTime()) });
    }
  } else if (gran === 'week') {
    const diff = (now.getDay() + 1) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    for (let i = 11; i >= 0; i--) {
      const s = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i * 7);
      out.push({ from: s.getTime(), to: s.getTime() + 7 * DAY - 1, label: `${s.getDate()}/${s.getMonth() + 1}`, full: `أسبوع ${fmtDate(s.getTime())}` });
    }
  } else if (gran === 'month') {
    for (let i = 11; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ from: s.getTime(), to: e.getTime() - 1, label: MONTHS[s.getMonth()].slice(0, 3), full: `${MONTHS[s.getMonth()]} ${s.getFullYear()}` });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      out.push({ from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime() - 1, label: String(y), full: `سنة ${y}` });
    }
  }
  return out;
}

export default function Dashboard() {
  const d = useData();
  const { go } = useNav();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [custom, setCustom] = useState({ from: toInputDate(Date.now() - 30 * DAY), to: toInputDate() });
  const [gran, setGran] = useState<Gran>('day');
  const showProfit = can('profits');

  const range = periodRange(period, { from: fromInputDate(custom.from), to: fromInputDate(custom.to, true) });

  const stats = useMemo(() => {
    const approved = d.invoices.filter((i) => i.state === 'approved');
    const sum = (r: { from: number; to: number }) => round2(approved.filter((i) => inRange(i.date, r)).reduce((s, i) => s + i.net, 0));
    const pInv = approved.filter((i) => inRange(i.date, range));
    const pPay = d.payments.filter((p) => !p.reversed && inRange(p.date, range));
    const pRet = d.returns.filter((r) => inRange(r.date, range));
    const pExp = d.expenses.filter((e) => inRange(e.date, range));
    const unpaid = approved.filter((i) => d.status.get(i.id!)?.status === 'unpaid');
    const partial = approved.filter((i) => d.status.get(i.id!)?.status === 'partial');
    const debts = [...d.balance.values()].filter((b) => b > 0).reduce((s, b) => s + b, 0);
    const stockValue = d.products.filter((p) => !p.archived).reduce((s, p) => s + Math.max(0, p.stock) * p.cost, 0);
    const purchases = d.purchases.filter((p) => p.state === 'approved' && inRange(p.date, range)).reduce((s, p) => s + p.total, 0);
    return {
      today: sum(periodRange('today')),
      month: sum(periodRange('month')),
      period: round2(pInv.reduce((s, i) => s + i.net, 0)),
      count: pInv.length,
      collected: round2(pPay.reduce((s, p) => s + p.amount, 0)),
      debts: round2(debts),
      unpaid: { n: unpaid.length, v: round2(unpaid.reduce((s, i) => s + (d.status.get(i.id!)?.remaining ?? 0), 0)) },
      partial: { n: partial.length, v: round2(partial.reduce((s, i) => s + (d.status.get(i.id!)?.remaining ?? 0), 0)) },
      stockValue: round2(stockValue),
      purchases: round2(purchases),
      profit: profitSummary(pInv, pRet, pExp),
    };
  }, [d, range.from, range.to]);

  const chart = useMemo(() => {
    const bk = buildBuckets(gran);
    const approved = d.invoices.filter((i) => i.state === 'approved');
    const sales: Bucket[] = [];
    const profit: Bucket[] = [];
    for (const b of bk) {
      const inv = approved.filter((i) => inRange(i.date, b));
      const ret = d.returns.filter((r) => inRange(r.date, b));
      const s = inv.reduce((a, i) => a + i.net, 0) - ret.reduce((a, r) => a + r.total, 0);
      const c = d.payments.filter((p) => !p.reversed && inRange(p.date, b)).reduce((a, p) => a + p.amount, 0);
      const ps = profitSummary(inv, ret, d.expenses.filter((e) => inRange(e.date, b)));
      sales.push({ label: b.label, full: b.full, values: [round2(s), round2(c)] });
      profit.push({ label: b.label, full: b.full, values: [ps.grossProfit, ps.netProfit] });
    }
    return { sales, profit };
  }, [d, gran]);

  const now = Date.now();
  const dueSoon = useMemo(() => {
    return d.invoices
      .filter((i) => i.state === 'approved' && i.dueDate && (d.status.get(i.id!)?.remaining ?? 0) > 0 && i.dueDate < now + 7 * DAY)
      .sort((a, b) => a.dueDate! - b.dueDate!)
      .slice(0, 8);
  }, [d]);
  const lowStock = d.products.filter((p) => !p.archived && p.lowStock > 0 && p.stock <= p.lowStock).slice(0, 8);
  const lastInvoices = [...d.invoices].filter((i) => i.state !== 'draft').sort((a, b) => b.date - a.date).slice(0, 6);
  const lastPayments = [...d.payments].sort((a, b) => b.date - a.date).slice(0, 6);

  return (
    <div className="stack">
      <div className="row between">
        <Seg value={period} onChange={setPeriod} options={PERIODS} />
        {period === 'custom' && (
          <div className="row">
            <Field label="من"><input type="date" className="input" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></Field>
            <Field label="إلى"><input type="date" className="input" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></Field>
          </div>
        )}
      </div>

      <div className="grid grid-4">
        <KPI accent icon="chart" label="مبيعات الفترة" value={<Money v={stats.period} />} sub={`${fmtNum(stats.count)} فاتورة`} onClick={() => go('invoices')} />
        <KPI icon="wallet" label="المحصّل في الفترة" value={<Money v={stats.collected} />} sub="من العملاء" onClick={() => go('payments')} />
        <KPI icon="debt" label="إجمالي الديون المستحقة" value={<Money v={stats.debts} className="bad" />} sub="على كل العملاء" onClick={() => go('debts')} />
        <KPI icon="clock" label="مبيعات اليوم / الشهر" value={<Money v={stats.today} />} sub={<>الشهر: <Money v={stats.month} /></>} />
        <KPI icon="alert" label="فواتير غير مدفوعة" value={<Money v={stats.unpaid.v} />} sub={`${fmtNum(stats.unpaid.n)} فاتورة`} onClick={() => go({ name: 'invoices', params: { status: 'unpaid' } })} />
        <KPI icon="receipt" label="مدفوعة جزئيًا (المتبقي)" value={<Money v={stats.partial.v} />} sub={`${fmtNum(stats.partial.n)} فاتورة`} onClick={() => go({ name: 'invoices', params: { status: 'partial' } })} />
        <KPI icon="users" label="العملاء المسجلون" value={fmtNum(d.customers.filter((c) => !c.archived).length)} sub={`الفواتير الصادرة: ${fmtNum(d.invoices.filter((i) => i.state === 'approved').length)}`} onClick={() => go('customers')} />
        {showProfit ? (
          <KPI icon="box" label="قيمة المخزون (بالتكلفة)" value={<Money v={stats.stockValue} />} sub={<>مشتريات الفترة: <Money v={stats.purchases} /></>} onClick={() => go('products')} />
        ) : (
          <KPI icon="box" label="أصناف قاربت النفاد" value={fmtNum(lowStock.length)} onClick={() => go('products')} />
        )}
      </div>

      {showProfit && (
        <div className="grid grid-3">
          <KPI icon="chart" label="الربح التقديري (مجمل)" value={<Money v={stats.profit.grossProfit} className={stats.profit.grossProfit < 0 ? 'bad' : 'good'} />} sub={<>صافي المبيعات <Money v={stats.profit.netSales} /> − التكلفة <Money v={stats.profit.cogs} /></>} />
          <KPI icon="cash" label="المصروفات" value={<Money v={stats.profit.expenses} />} sub="في الفترة" onClick={() => go('expenses')} />
          <KPI icon="check" label="صافي الربح الفعلي" value={<Money v={stats.profit.netProfit} className={stats.profit.netProfit < 0 ? 'bad' : 'good'} />} sub="بعد خصم المصروفات" />
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h3>المبيعات والتحصيل</h3>
          <Seg
            value={gran}
            onChange={setGran}
            options={[
              { key: 'day', label: 'يومي' },
              { key: 'week', label: 'أسبوعي' },
              { key: 'month', label: 'شهري' },
              { key: 'year', label: 'سنوي' },
            ]}
          />
        </div>
        <BarChart
          buckets={chart.sales}
          series={[
            { name: 'صافي المبيعات', color: 'var(--series-1)' },
            { name: 'التحصيل', color: 'var(--series-2)' },
          ]}
        />
      </div>

      {showProfit && (
        <div className="card">
          <div className="card-title"><h3>الأرباح</h3></div>
          <BarChart
            buckets={chart.profit}
            series={[
              { name: 'مجمل الربح', color: 'var(--series-1)' },
              { name: 'صافي الربح', color: 'var(--series-2)' },
            ]}
          />
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h3>آخر الفواتير</h3>
            <button className="btn sm ghost" onClick={() => go('invoices')}>الكل</button>
          </div>
          {lastInvoices.length ? (
            <div className="list">
              {lastInvoices.map((i) => (
                <div key={i.id} className="list-item" onClick={() => go({ name: 'invoice', id: i.id })}>
                  <div className="main-col">
                    <div className="title">{d.customerById.get(i.customerId)?.name}</div>
                    <div className="meta">{i.number} — {fmtDate(i.date)}</div>
                  </div>
                  <div className="end">
                    <div className="bold"><Money v={i.net} /></div>
                    <StatusBadge info={d.status.get(i.id!)!} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="invoice" text="لا توجد فواتير بعد">
              <button className="btn primary" onClick={() => go('invoice-new')}><Icon name="plus" /> أنشئ أول فاتورة</button>
            </Empty>
          )}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>آخر الدفعات المستلمة</h3>
            <button className="btn sm ghost" onClick={() => go('payments')}>الكل</button>
          </div>
          {lastPayments.length ? (
            <div className="list">
              {lastPayments.map((p) => (
                <div key={p.id} className="list-item" onClick={() => go({ name: 'customer', id: p.customerId })}>
                  <div className="main-col">
                    <div className="title">{d.customerById.get(p.customerId)?.name}</div>
                    <div className="meta">{p.number} — {fmtDate(p.date)} — {p.method}</div>
                  </div>
                  <div className="end bold">
                    <Money v={p.amount} className={p.reversed ? 'muted' : 'good'} />
                    {p.reversed ? <div className="badge muted">معكوسة</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="wallet" text="لا توجد دفعات بعد" />
          )}
        </div>
        <div className="card">
          <div className="card-title"><h3>استحقاقات قريبة ومتأخرة</h3></div>
          {dueSoon.length ? (
            <div className="list">
              {dueSoon.map((i) => {
                const late = i.dueDate! < now;
                return (
                  <div key={i.id} className="list-item" onClick={() => go({ name: 'invoice', id: i.id })}>
                    <div className="main-col">
                      <div className="title">{d.customerById.get(i.customerId)?.name}</div>
                      <div className="meta">{i.number} — يستحق {fmtDate(i.dueDate)}</div>
                    </div>
                    <div className="end">
                      <div className="bold"><Money v={d.status.get(i.id!)!.remaining} /></div>
                      <span className={`badge ${late ? 'bad' : 'warn'}`}>{late ? `متأخرة ${Math.floor((now - i.dueDate!) / DAY)} يوم` : 'قريبًا'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon="check" text="لا توجد استحقاقات قريبة" />
          )}
        </div>
        <div className="card">
          <div className="card-title"><h3>أصناف قاربت على النفاد</h3></div>
          {lowStock.length ? (
            <div className="list">
              {lowStock.map((p) => (
                <div key={p.id} className="list-item" onClick={() => go({ name: 'product', id: p.id })}>
                  <div className="main-col">
                    <div className="title">{p.name} {p.color && `— ${p.color}`}</div>
                    <div className="meta">{p.code} — حد التنبيه {fmtNum(p.lowStock)} {p.baseUnit}</div>
                  </div>
                  <span className={`badge ${p.stock <= 0 ? 'bad' : 'warn'}`}>{fmtNum(p.stock)} {p.baseUnit}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="box" text="المخزون بحالة جيدة" />
          )}
        </div>
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>الفترة: {fmtDate(range.from)} — {fmtDate(range.to)} · العملة {fmtMoney(0).replace(/^0\s*/, '')}</div>
    </div>
  );
}
