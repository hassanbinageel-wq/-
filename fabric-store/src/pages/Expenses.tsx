import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { reverseExpense, saveCashEntry, saveExpense } from '../db/service';
import { round2 } from '../lib/calc';
import { cashMoves, balancesByMethod } from '../lib/cash';
import { fmtDate, fmtDateTime, fromInputDate, fromInputDateNow, inRange, periodRange, PERIODS, toInputDate, type PeriodKey } from '../lib/format';
import { Empty, Field, KPI, Modal, Money, NumInput, SearchBox, Seg, confirmDialog, run } from '../ui/kit';
import { Icon } from '../ui/Icon';

export default function Expenses() {
  const d = useData();
  const [tab, setTab] = useState<'expenses' | 'cash'>('expenses');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [custom, setCustom] = useState({ from: toInputDate(), to: toInputDate() });
  const [q, setQ] = useState('');
  const [form, setForm] = useState<null | 'expense' | 'in' | 'out'>(null);
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState(d.settings.expenseCategories[0]);
  const [method, setMethod] = useState(d.settings.paymentMethods[0]);
  const [date, setDate] = useState(toInputDate());
  const [notes, setNotes] = useState('');

  const range = periodRange(period, { from: fromInputDate(custom.from), to: fromInputDate(custom.to, true) });
  const expenses = useMemo(
    () => d.expenses.filter((e) => inRange(e.date, range) && matches(q, e.category, e.notes, e.method)).sort((a, b) => b.date - a.date),
    [d.expenses, range.from, range.to, q],
  );
  const total = round2(expenses.filter((e) => !e.reversed).reduce((s, e) => s + e.amount, 0));
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) if (!e.reversed) m.set(e.category, round2((m.get(e.category) ?? 0) + e.amount));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const allMoves = useMemo(() => cashMoves(d), [d]);
  const allBal = balancesByMethod(allMoves);
  const periodMoves = allMoves.filter((m) => inRange(m.date, range));
  const pIn = round2(periodMoves.reduce((s, m) => s + m.inAmt, 0));
  const pOut = round2(periodMoves.reduce((s, m) => s + m.outAmt, 0));

  const save = async () => {
    const ok = await run(
      () =>
        form === 'expense'
          ? saveExpense({ date: fromInputDateNow(date), category, amount, method, notes })
          : saveCashEntry({ date: fromInputDateNow(date), direction: form === 'in' ? 'in' : 'out', amount, method, notes }),
      'تم الحفظ',
    );
    if (ok) {
      setForm(null);
      setAmount(0);
      setNotes('');
    }
  };

  return (
    <div className="stack">
      <div className="row between">
        <Seg value={period} onChange={setPeriod} options={PERIODS} />
        {period === 'custom' && (
          <div className="row">
            <input type="date" className="input" style={{ width: 'auto' }} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <input type="date" className="input" style={{ width: 'auto' }} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
      </div>
      <div className="tabs">
        <button className={tab === 'expenses' ? 'on' : ''} onClick={() => setTab('expenses')}>المصروفات</button>
        <button className={tab === 'cash' ? 'on' : ''} onClick={() => setTab('cash')}>الصندوق والحسابات</button>
      </div>

      {tab === 'expenses' ? (
        <>
          <div className="grid grid-3">
            <KPI accent icon="cash" label="مصروفات الفترة" value={<Money v={total} />} sub={`${expenses.length} عملية`} />
            {byCat.slice(0, 2).map(([c, v]) => <KPI key={c} icon="receipt" label={c} value={<Money v={v} />} />)}
          </div>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="بحث في المصروفات…" />
            <button className="btn primary" onClick={() => setForm('expense')}><Icon name="plus" /> مصروف جديد</button>
          </div>
          {expenses.length ? (
            <div className="list">
              {expenses.map((e) => (
                <div key={e.id} className="list-item" style={{ cursor: 'default' }}>
                  <div className="avatar"><Icon name="receipt" /></div>
                  <div className="main-col">
                    <div className="title">{e.category} {e.reversed ? <span className="badge muted">ملغى</span> : null}</div>
                    <div className="meta">{fmtDateTime(e.date)} · {e.method} · {e.createdBy}{e.notes && ` · ${e.notes}`}</div>
                  </div>
                  <div className="end">
                    <Money v={e.amount} className={e.reversed ? 'muted' : 'bold bad'} />
                    {!e.reversed && (
                      <button className="btn sm ghost" onClick={async () => (await confirmDialog('إلغاء المصروف', 'سيتم إلغاء هذا المصروف مع بقاء سجله.', { danger: true })) && run(() => reverseExpense(e.id!), 'تم الإلغاء')}>
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="cash" text="لا توجد مصروفات في هذه الفترة" />
          )}
        </>
      ) : (
        <>
          <div className="grid grid-3">
            <KPI icon="download" label="الداخل في الفترة" value={<Money v={pIn} className="good" />} />
            <KPI icon="upload" label="الخارج في الفترة" value={<Money v={pOut} className="bad" />} />
            <KPI accent icon="wallet" label="صافي حركة الفترة" value={<Money v={round2(pIn - pOut)} />} />
          </div>
          <div className="card">
            <div className="card-title">
              <h3>الرصيد الحالي حسب طريقة الدفع</h3>
              <div className="row">
                <button className="btn sm" onClick={() => setForm('in')}><Icon name="plus" /> إيداع</button>
                <button className="btn sm" onClick={() => setForm('out')}>سحب</button>
              </div>
            </div>
            <div className="grid grid-3">
              {[...allBal].map(([m, v]) => (
                <div key={m} className="card kpi" style={{ boxShadow: 'none' }}>
                  <div className="label">{m}</div>
                  <div className="value"><Money v={round2(v.in - v.out)} /></div>
                  <div className="sub">داخل <Money v={v.in} /> · خارج <Money v={v.out} /></div>
                </div>
              ))}
              {!allBal.size && <div className="muted">لا توجد حركات نقدية بعد</div>}
            </div>
            <p className="small muted">يُحتسب الرصيد من التحصيل الفعلي والمصروفات ودفعات الموردين والمبالغ المردودة والإيداعات اليدوية. لإدخال رصيد افتتاحي للصندوق استخدم «إيداع».</p>
          </div>
          <div className="card">
            <div className="card-title"><h3>حركة الصندوق في الفترة</h3></div>
            {periodMoves.length ? (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>الطريقة</th><th>داخل</th><th>خارج</th><th>تفاصيل</th></tr></thead>
                  <tbody>
                    {[...periodMoves].reverse().map((m, i) => (
                      <tr key={i}>
                        <td>{fmtDate(m.date)}</td>
                        <td>{m.kind}</td>
                        <td>{m.ref}</td>
                        <td>{m.method}</td>
                        <td className="good">{m.inAmt ? <Money v={m.inAmt} /> : '—'}</td>
                        <td className="bad">{m.outAmt ? <Money v={m.outAmt} /> : '—'}</td>
                        <td>{m.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="cash" text="لا توجد حركات" />
            )}
          </div>
        </>
      )}

      {form && (
        <Modal
          title={form === 'expense' ? 'مصروف جديد' : form === 'in' ? 'إيداع في الصندوق' : 'سحب من الصندوق'}
          onClose={() => setForm(null)}
          footer={<><button className="btn" onClick={() => setForm(null)}>إلغاء</button><button className="btn primary" onClick={save}>حفظ</button></>}
        >
          <div className="grid grid-2">
            <Field label="المبلغ *"><NumInput value={amount} min={0} onChange={setAmount} /></Field>
            <Field label="التاريخ"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            {form === 'expense' && (
              <Field label="التصنيف">
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {d.settings.expenseCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            )}
            <Field label="طريقة الدفع / الحساب">
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {d.settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Field label="ملاحظات" className="section"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}
