import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useData, type AppData } from '../lib/data';
import { db, type StockMove } from '../db/schema';
import { can } from '../db/service';
import { profitSummary, round2 } from '../lib/calc';
import { cashMoves, balancesByMethod } from '../lib/cash';
import { DAY, fmtDate, fmtNum, fromInputDate, inRange, MONTHS, periodRange, PERIODS, toInputDate, type PeriodKey } from '../lib/format';
import { Field, Seg, Empty } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { PrintPreview } from '../print/PrintPreview';
import { ReportDoc, type ReportTable } from '../print/Docs';
import { csvBlob, shareFile } from '../lib/platform';
import { STATUS_LABEL } from '../ui/kit';
import { MOVE_LABEL } from './ProductView';

type Range = { from: number; to: number };
type Group = 'day' | 'week' | 'month' | 'year';

const REPORTS: { key: string; label: string; profit?: boolean }[] = [
  { key: 'summary', label: 'الملخص الدوري (يومي/أسبوعي/شهري/سنوي)' },
  { key: 'sales', label: 'تقرير المبيعات (الفواتير)' },
  { key: 'by_product', label: 'المبيعات حسب الصنف والموديل واللون' },
  { key: 'by_customer', label: 'المبيعات حسب العميل' },
  { key: 'top', label: 'الأصناف الأكثر مبيعًا' },
  { key: 'collections', label: 'التحصيل والدفعات' },
  { key: 'debts', label: 'مديونيات العملاء' },
  { key: 'overdue', label: 'الفواتير المتأخرة' },
  { key: 'purchases', label: 'المشتريات والموردين' },
  { key: 'stock', label: 'أرصدة المخزون' },
  { key: 'stock_moves', label: 'حركة المخزون' },
  { key: 'profit', label: 'الأرباح التقديرية', profit: true },
  { key: 'expenses', label: 'المصروفات التشغيلية' },
  { key: 'cash', label: 'حركة الصندوق وطرق الدفع' },
  { key: 'returns', label: 'المرتجعات والخصومات' },
];

function groupBuckets(r: Range, g: Group) {
  const out: { from: number; to: number; label: string }[] = [];
  let cur = new Date(r.from);
  if (g === 'week') cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - ((cur.getDay() + 1) % 7));
  if (g === 'month') cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
  if (g === 'year') cur = new Date(cur.getFullYear(), 0, 1);
  let guard = 0;
  while (cur.getTime() <= r.to && guard++ < 1000) {
    let next: Date;
    let label: string;
    if (g === 'day') {
      next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      label = fmtDate(cur.getTime());
    } else if (g === 'week') {
      next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
      label = `أسبوع ${fmtDate(cur.getTime())}`;
    } else if (g === 'month') {
      next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      label = `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`;
    } else {
      next = new Date(cur.getFullYear() + 1, 0, 1);
      label = String(cur.getFullYear());
    }
    out.push({ from: Math.max(cur.getTime(), r.from), to: Math.min(next.getTime() - 1, r.to), label });
    cur = next;
  }
  return out;
}

function build(key: string, d: AppData, r: Range, group: Group, moves: StockMove[], showProfit: boolean): ReportTable {
  const inv = d.invoices.filter((i) => i.state === 'approved' && inRange(i.date, r));
  const pays = d.payments.filter((p) => !p.reversed && inRange(p.date, r));
  const rets = d.returns.filter((x) => inRange(x.date, r));
  const exps = d.expenses.filter((e) => !e.reversed && inRange(e.date, r));
  const cname = (id: number) => d.customerById.get(id)?.name ?? '—';
  const sum = (a: number[]) => round2(a.reduce((s, x) => s + x, 0));

  switch (key) {
    case 'summary': {
      const rows = groupBuckets(r, group).map((b) => {
        const bi = inv.filter((i) => inRange(i.date, b));
        const br = rets.filter((x) => inRange(x.date, b));
        const be = exps.filter((x) => inRange(x.date, b));
        const p = profitSummary(bi, br, be);
        const col = sum(pays.filter((x) => inRange(x.date, b)).map((x) => x.amount));
        return showProfit
          ? [b.label, bi.length, p.sales, p.returns, p.netSales, col, p.cogs, p.grossProfit, p.expenses, p.netProfit]
          : [b.label, bi.length, p.sales, p.returns, p.netSales, col, p.expenses];
      });
      const tot = profitSummary(inv, rets, exps);
      const col = sum(pays.map((p) => p.amount));
      return {
        title: 'الملخص الدوري للمبيعات والتحصيل' + (showProfit ? ' والأرباح' : ''),
        head: showProfit
          ? ['الفترة', 'عدد الفواتير', 'المبيعات', 'المرتجعات', 'صافي المبيعات', 'التحصيل', 'تكلفة البضاعة', 'مجمل الربح', 'المصروفات', 'صافي الربح']
          : ['الفترة', 'عدد الفواتير', 'المبيعات', 'المرتجعات', 'صافي المبيعات', 'التحصيل', 'المصروفات'],
        rows,
        foot: showProfit
          ? ['الإجمالي', inv.length, tot.sales, tot.returns, tot.netSales, col, tot.cogs, tot.grossProfit, tot.expenses, tot.netProfit]
          : ['الإجمالي', inv.length, tot.sales, tot.returns, tot.netSales, col, tot.expenses],
        summary: [
          ['صافي المبيعات', fmtNum(tot.netSales)],
          ['التحصيل', fmtNum(col)],
          showProfit ? ['صافي الربح', fmtNum(tot.netProfit)] : ['المصروفات', fmtNum(tot.expenses)],
        ],
      };
    }
    case 'sales': {
      const list = [...inv].sort((a, b) => a.date - b.date);
      return {
        title: 'تقرير المبيعات',
        head: ['الرقم', 'التاريخ', 'العميل', 'النوع', 'الإجمالي', 'الخصم', 'الصافي', 'المدفوع', 'المتبقي', 'الحالة'],
        rows: list.map((i) => {
          const st = d.status.get(i.id!)!;
          return [i.number, fmtDate(i.date), cname(i.customerId), i.saleType === 'cash' ? 'نقدي' : 'آجل', i.subtotal, i.totalDiscount, i.net, st.paid, st.remaining, STATUS_LABEL[st.status]];
        }),
        foot: ['الإجمالي', '', '', '', sum(list.map((i) => i.subtotal)), sum(list.map((i) => i.totalDiscount)), sum(list.map((i) => i.net)), sum(list.map((i) => d.status.get(i.id!)!.paid)), sum(list.map((i) => d.status.get(i.id!)!.remaining)), ''],
        summary: [['عدد الفواتير', fmtNum(list.length)], ['نقدي', fmtNum(sum(list.filter((i) => i.saleType === 'cash').map((i) => i.net)))], ['آجل', fmtNum(sum(list.filter((i) => i.saleType === 'credit').map((i) => i.net)))]],
      };
    }
    case 'by_product':
    case 'top': {
      const m = new Map<string, { name: string; code: string; type: string; color: string; unit: string; qty: number; amount: number; cost: number; n: number }>();
      for (const i of inv)
        for (const l of i.lines) {
          const k = `${l.productId ?? l.name}|${l.color}`;
          const v = m.get(k) ?? { name: l.name, code: l.code, type: l.fabricType, color: l.color, unit: l.baseUnit, qty: 0, amount: 0, cost: 0, n: 0 };
          v.qty += l.baseQty;
          v.amount += l.net;
          v.cost += l.baseQty * l.unitCost;
          v.n += 1;
          m.set(k, v);
        }
      let list = [...m.values()].sort((a, b) => b.amount - a.amount);
      if (key === 'top') list = list.slice(0, 20);
      const head = ['الصنف', 'الكود', 'النوع', 'اللون', 'الكمية', 'الوحدة', 'عدد مرات البيع', 'قيمة المبيعات'];
      if (showProfit) head.push('التكلفة', 'الربح');
      return {
        title: key === 'top' ? 'الأصناف الأكثر مبيعًا' : 'المبيعات حسب الصنف والموديل واللون',
        head,
        rows: list.map((v) => {
          const row: (string | number)[] = [v.name, v.code || '—', v.type || '—', v.color || '—', round2(v.qty), v.unit, v.n, round2(v.amount)];
          if (showProfit) row.push(round2(v.cost), round2(v.amount - v.cost));
          return row;
        }),
        foot: showProfit
          ? ['الإجمالي', '', '', '', '', '', '', sum(list.map((v) => v.amount)), sum(list.map((v) => v.cost)), sum(list.map((v) => v.amount - v.cost))]
          : ['الإجمالي', '', '', '', '', '', '', sum(list.map((v) => v.amount))],
      };
    }
    case 'by_customer': {
      const m = new Map<number, { n: number; amount: number; paid: number }>();
      for (const i of inv) {
        const v = m.get(i.customerId) ?? { n: 0, amount: 0, paid: 0 };
        v.n++;
        v.amount += i.net;
        m.set(i.customerId, v);
      }
      for (const p of pays) {
        const v = m.get(p.customerId) ?? { n: 0, amount: 0, paid: 0 };
        v.paid += p.amount;
        m.set(p.customerId, v);
      }
      const list = [...m].sort((a, b) => b[1].amount - a[1].amount);
      return {
        title: 'المبيعات حسب العميل',
        head: ['العميل', 'الهاتف', 'عدد الفواتير', 'المبيعات', 'المحصّل في الفترة', 'الرصيد الحالي'],
        rows: list.map(([id, v]) => [cname(id), d.customerById.get(id)?.phone ?? '', v.n, round2(v.amount), round2(v.paid), d.balance.get(id) ?? 0]),
        foot: ['الإجمالي', '', sum(list.map(([, v]) => v.n)), sum(list.map(([, v]) => v.amount)), sum(list.map(([, v]) => v.paid)), ''],
      };
    }
    case 'collections': {
      const list = [...pays].sort((a, b) => a.date - b.date);
      const byMethod = new Map<string, number>();
      for (const p of list) byMethod.set(p.method, round2((byMethod.get(p.method) ?? 0) + p.amount));
      return {
        title: 'تقرير التحصيل والدفعات',
        head: ['رقم السند', 'التاريخ', 'العميل', 'الطريقة', 'المبلغ', 'الموزع على', 'المستخدم'],
        rows: list.map((p) => [p.number, fmtDate(p.date), cname(p.customerId), p.method, p.amount, p.allocations.map((a) => d.invoiceById.get(a.invoiceId)?.number).join('، ') || 'غير موزع', p.createdBy]),
        foot: ['الإجمالي', '', '', '', sum(list.map((p) => p.amount)), '', ''],
        summary: [...byMethod].slice(0, 3).map(([k, v]) => [k, fmtNum(v)] as [string, string]),
      };
    }
    case 'debts': {
      const list = d.customers.filter((c) => (d.balance.get(c.id!) ?? 0) > 0.009).sort((a, b) => (d.balance.get(b.id!) ?? 0) - (d.balance.get(a.id!) ?? 0));
      return {
        title: 'تقرير مديونيات العملاء',
        head: ['العميل', 'الهاتف', 'المنطقة', 'فواتير مفتوحة', 'الرصيد المستحق'],
        rows: list.map((c) => [c.name, c.phone, c.city, d.invoices.filter((i) => i.customerId === c.id && (d.status.get(i.id!)?.remaining ?? 0) > 0).length, d.balance.get(c.id!) ?? 0]),
        foot: ['الإجمالي', '', '', '', sum(list.map((c) => d.balance.get(c.id!) ?? 0))],
      };
    }
    case 'overdue': {
      const now = Date.now();
      const list = d.invoices.filter((i) => d.status.get(i.id!)?.overdue).sort((a, b) => a.dueDate! - b.dueDate!);
      return {
        title: 'تقرير الفواتير المتأخرة',
        head: ['الرقم', 'العميل', 'الهاتف', 'تاريخ الفاتورة', 'الاستحقاق', 'أيام التأخير', 'الصافي', 'المتبقي'],
        rows: list.map((i) => [i.number, cname(i.customerId), d.customerById.get(i.customerId)?.phone ?? '', fmtDate(i.date), fmtDate(i.dueDate), Math.floor((now - i.dueDate!) / DAY), i.net, d.status.get(i.id!)!.remaining]),
        foot: ['الإجمالي', '', '', '', '', '', sum(list.map((i) => i.net)), sum(list.map((i) => d.status.get(i.id!)!.remaining))],
      };
    }
    case 'purchases': {
      const list = d.purchases.filter((p) => p.state === 'approved' && inRange(p.date, r)).sort((a, b) => a.date - b.date);
      const paidIn = sum(d.supplierPayments.filter((p) => !p.reversed && inRange(p.date, r)).map((p) => p.amount));
      return {
        title: 'تقرير المشتريات والموردين',
        head: ['الرقم', 'فاتورة المورد', 'التاريخ', 'المورد', 'الأصناف', 'المصاريف', 'الإجمالي', 'المتبقي'],
        rows: list.map((p) => [p.number, p.supplierInvoiceNo || '—', fmtDate(p.date), d.supplierById.get(p.supplierId)?.name ?? '', p.lines.length, p.extraCosts, p.total, d.purchaseRemaining.get(p.id!) ?? 0]),
        foot: ['الإجمالي', '', '', '', '', sum(list.map((p) => p.extraCosts)), sum(list.map((p) => p.total)), sum(list.map((p) => d.purchaseRemaining.get(p.id!) ?? 0))],
        summary: [
          ['المدفوع للموردين في الفترة', fmtNum(paidIn)],
          ['المستحق للموردين (حاليًا)', fmtNum(sum([...d.supplierBal.values()].filter((v) => v > 0)))],
          ['عدد فواتير الشراء', fmtNum(list.length)],
        ],
      };
    }
    case 'stock': {
      const list = d.products.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      const head = ['الكود', 'الصنف', 'النوع', 'اللون', 'الرصيد', 'الوحدة', 'حد التنبيه', 'سعر البيع'];
      if (showProfit) head.push('التكلفة', 'قيمة المخزون');
      return {
        title: 'تقرير أرصدة المخزون',
        head,
        rows: list.map((p) => {
          const row: (string | number)[] = [p.code, p.name, p.fabricType || '—', p.color || '—', p.stock, p.baseUnit, p.lowStock, p.price];
          if (showProfit) row.push(p.cost, round2(Math.max(0, p.stock) * p.cost));
          return row;
        }),
        foot: showProfit ? ['الإجمالي', '', '', '', '', '', '', '', '', sum(list.map((p) => Math.max(0, p.stock) * p.cost))] : undefined,
      };
    }
    case 'stock_moves': {
      const list = moves.filter((m) => inRange(m.date, r)).sort((a, b) => a.date - b.date);
      return {
        title: 'تقرير حركة المخزون',
        head: ['التاريخ', 'الصنف', 'النوع', 'المرجع', 'الكمية', 'قبل', 'بعد', 'المستخدم'],
        rows: list.map((m) => {
          const p = d.productById.get(m.productId);
          return [fmtDate(m.date), p ? `${p.name} ${p.color}` : '—', MOVE_LABEL[m.type], m.refNumber || m.note || '—', m.qty, m.before, m.after, m.createdBy];
        }),
      };
    }
    case 'profit': {
      const p = profitSummary(inv, rets, exps);
      return {
        title: 'تقرير الأرباح التقديرية',
        head: ['البند', 'المبلغ'],
        rows: [
          ['إجمالي المبيعات (صافي الفواتير)', p.sales],
          ['(−) المرتجعات', p.returns],
          ['= صافي المبيعات', p.netSales],
          ['(−) تكلفة البضاعة المباعة', p.cogs],
          ['= مجمل الربح', p.grossProfit],
          ['(−) المصروفات التشغيلية', p.expenses],
          ['= صافي الربح', p.netProfit],
        ],
        summary: [
          ['هامش مجمل الربح', p.netSales ? fmtNum((p.grossProfit / p.netSales) * 100, 1) + '%' : '—'],
          ['هامش صافي الربح', p.netSales ? fmtNum((p.netProfit / p.netSales) * 100, 1) + '%' : '—'],
          ['التحصيل في الفترة (للمقارنة)', fmtNum(sum(pays.map((x) => x.amount)))],
        ],
      };
    }
    case 'expenses': {
      const list = [...exps].sort((a, b) => a.date - b.date);
      const byCat = new Map<string, number>();
      for (const e of list) byCat.set(e.category, round2((byCat.get(e.category) ?? 0) + e.amount));
      return {
        title: 'تقرير المصروفات التشغيلية',
        head: ['التاريخ', 'التصنيف', 'الطريقة', 'المبلغ', 'ملاحظات', 'المستخدم'],
        rows: list.map((e) => [fmtDate(e.date), e.category, e.method, e.amount, e.notes || '—', e.createdBy]),
        foot: ['الإجمالي', '', '', sum(list.map((e) => e.amount)), '', ''],
        summary: [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => [k, fmtNum(v)] as [string, string]),
      };
    }
    case 'cash': {
      const all = cashMoves(d);
      const list = all.filter((m) => inRange(m.date, r));
      const bal = balancesByMethod(all);
      return {
        title: 'تقرير حركة الصندوق وطرق الدفع',
        head: ['التاريخ', 'البيان', 'المرجع', 'الطريقة', 'داخل', 'خارج', 'تفاصيل'],
        rows: list.map((m) => [fmtDate(m.date), m.kind, m.ref, m.method, m.inAmt || '—', m.outAmt || '—', m.note || '—']),
        foot: ['الإجمالي', '', '', '', sum(list.map((m) => m.inAmt)), sum(list.map((m) => m.outAmt)), ''],
        summary: [...bal].slice(0, 3).map(([k, v]) => [`رصيد ${k}`, fmtNum(v.in - v.out)] as [string, string]),
      };
    }
    case 'returns': {
      const list = [...rets].sort((a, b) => a.date - b.date);
      const disc = sum(inv.map((i) => i.totalDiscount));
      return {
        title: 'تقرير المرتجعات والخصومات',
        head: ['رقم المرتجع', 'التاريخ', 'العميل', 'الفاتورة', 'السبب', 'الحالة', 'القيمة', 'المردود نقدًا'],
        rows: list.map((x) => [x.number, fmtDate(x.date), cname(x.customerId), d.invoiceById.get(x.invoiceId)?.number ?? '', x.reason || '—', x.condition === 'restock' ? 'سليمة' : 'تالفة', x.total, x.refundAmount]),
        foot: ['الإجمالي', '', '', '', '', '', sum(list.map((x) => x.total)), sum(list.map((x) => x.refundAmount))],
        summary: [['إجمالي المرتجعات', fmtNum(sum(list.map((x) => x.total)))], ['إجمالي الخصومات على الفواتير', fmtNum(disc)], ['عدد المرتجعات', fmtNum(list.length)]],
      };
    }
  }
  return { title: '', head: [], rows: [] };
}

export default function Reports() {
  const d = useData();
  const showProfit = can('profits');
  const [key, setKey] = useState('summary');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [group, setGroup] = useState<Group>('day');
  const [custom, setCustom] = useState({ from: toInputDate(Date.now() - 30 * DAY), to: toInputDate() });
  const [print, setPrint] = useState(false);
  const moves = useLiveQuery(() => (key === 'stock_moves' ? db.stockMoves.toArray() : Promise.resolve([] as StockMove[])), [key]) ?? [];

  const range = periodRange(period, { from: fromInputDate(custom.from), to: fromInputDate(custom.to, true) });
  const report = useMemo(() => {
    const r = build(key, d, range, group, moves, showProfit);
    return { ...r, subtitle: `${fmtDate(range.from)} — ${fmtDate(range.to)}` };
  }, [key, d, range.from, range.to, group, moves, showProfit]);

  const available = REPORTS.filter((r) => !r.profit || showProfit);
  const periodless = ['debts', 'overdue', 'stock'].includes(key);

  return (
    <div className="stack">
      <div className="card stack">
        <Field label="نوع التقرير">
          <select className="input" value={key} onChange={(e) => setKey(e.target.value)}>
            {available.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </Field>
        {!periodless && (
          <div className="row">
            <Seg value={period} onChange={(v) => { setPeriod(v); if (v === 'year') setGroup('month'); if (v === 'week' || v === 'month') setGroup('day'); }} options={PERIODS} />
            {period === 'custom' && (
              <>
                <input type="date" className="input" style={{ width: 'auto' }} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="من" />
                <input type="date" className="input" style={{ width: 'auto' }} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="إلى" />
              </>
            )}
          </div>
        )}
        {key === 'summary' && (
          <div className="row">
            <span className="small bold">التجميع:</span>
            <Seg value={group} onChange={setGroup} options={[{ key: 'day', label: 'يومي' }, { key: 'week', label: 'أسبوعي' }, { key: 'month', label: 'شهري' }, { key: 'year', label: 'سنوي' }]} />
          </div>
        )}
        <div className="row">
          <button className="btn primary" onClick={() => setPrint(true)}><Icon name="print" /> طباعة / PDF</button>
          <button className="btn" onClick={() => shareFile(csvBlob([report.head, ...report.rows, ...(report.foot ? [report.foot] : [])]), `${report.title}-${toInputDate()}.csv`)}>
            <Icon name="download" /> تصدير Excel (CSV)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>{report.title}</h3>
          {!periodless && <span className="small muted">{report.subtitle}</span>}
        </div>
        {report.summary && (
          <div className="grid grid-3" style={{ marginBottom: 12 }}>
            {report.summary.map(([k, v]) => (
              <div key={k} className="card kpi" style={{ boxShadow: 'none' }}>
                <div className="label">{k}</div>
                <div className="value num">{v}</div>
              </div>
            ))}
          </div>
        )}
        {report.rows.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr>{report.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {report.rows.map((row, i) => (
                  <tr key={i}>{row.map((v, j) => <td key={j}>{typeof v === 'number' ? <span className="num">{fmtNum(v)}</span> : v}</td>)}</tr>
                ))}
              </tbody>
              {report.foot && (
                <tfoot><tr>{report.foot.map((v, j) => <td key={j}>{typeof v === 'number' ? <span className="num">{fmtNum(v)}</span> : v}</td>)}</tr></tfoot>
              )}
            </table>
          </div>
        ) : (
          <Empty icon="bars" text="لا توجد بيانات في هذه الفترة" />
        )}
      </div>
      {print && (
        <PrintPreview title={report.title} filename={`${report.title}-${toInputDate()}`} allowThermal={false} onClose={() => setPrint(false)} render={() => <ReportDoc s={d.settings} report={report} />} />
      )}
    </div>
  );
}
