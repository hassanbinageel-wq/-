import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { createReturn } from '../db/service';
import type { SaleReturn } from '../db/schema';
import { invoiceLineRatio, returnableQty, round2 } from '../lib/calc';
import { fmtDate, fmtNum, fromInputDateNow, toInputDate } from '../lib/format';
import { Empty, Field, Modal, Money, NumInput, SearchBox, Seg, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { PrintPreview } from '../print/PrintPreview';
import { ReturnDoc } from '../print/Docs';

export function ReturnForm({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const d = useData();
  const inv = d.invoiceById.get(invoiceId)!;
  const avail = useMemo(() => returnableQty(inv, d.returns), [inv, d.returns]);
  const ratio = invoiceLineRatio(inv);
  const st = d.status.get(invoiceId)!;
  const [qty, setQty] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState<'restock' | 'damaged'>('restock');
  const [settlement, setSettlement] = useState<'credit' | 'refund'>('credit');
  const [refundMethod, setRefundMethod] = useState(d.settings.paymentMethods[0]);
  const [date, setDate] = useState(toInputDate());
  const [done, setDone] = useState<SaleReturn | null>(null);

  const total = round2(inv.lines.reduce((s, l, i) => s + (qty[i] || 0) * (l.qty ? (l.net / l.qty) * ratio : 0), 0));
  const refund = settlement === 'refund' ? Math.max(0, round2(total - st.remaining)) : 0;

  const save = async () => {
    const r = await run(
      () => createReturn({ invoiceId, date: fromInputDateNow(date), lines: Object.entries(qty).map(([k, v]) => ({ lineIndex: Number(k), qty: v })), reason, condition, settlement, refundMethod }),
      'تم تسجيل المرتجع',
    );
    if (r) setDone(r);
  };

  if (done) {
    return (
      <PrintPreview
        title={`مرتجع ${done.number}`}
        filename={`مرتجع-${done.number}`}
        onClose={onClose}
        render={(size) => <ReturnDoc r={done} inv={inv} customer={d.customerById.get(inv.customerId)} s={d.settings} size={size} />}
      />
    );
  }

  return (
    <Modal
      wide
      title={`مرتجع على الفاتورة ${inv.number}`}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={save} disabled={total <= 0}><Icon name="check" /> اعتماد المرتجع</button></>}
    >
      <div className="stack">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>الصنف</th><th>المباع</th><th>المتاح للإرجاع</th><th>الكمية المرتجعة</th><th>القيمة</th></tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td className="bold">{l.name} {l.color && <span className="small muted">— {l.color}</span>}</td>
                  <td>{fmtNum(l.qty)} {l.unit}</td>
                  <td>{fmtNum(avail[i])} {l.unit}</td>
                  <td style={{ width: 140 }}>
                    <NumInput aria-label={`كمية ${l.name}`} value={qty[i] ?? 0} min={0} disabled={avail[i] <= 0} onChange={(v) => setQty({ ...qty, [i]: Math.min(v, avail[i]) })} />
                  </td>
                  <td><Money v={round2((qty[i] || 0) * (l.qty ? (l.net / l.qty) * ratio : 0))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-2">
          <Field label="سبب الإرجاع"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="التاريخ"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="حالة البضاعة">
            <Seg value={condition} onChange={setCondition} options={[{ key: 'restock', label: 'سليمة (تعود للمخزون)' }, { key: 'damaged', label: 'تالفة' }]} />
          </Field>
          <Field label="التسوية المالية">
            <Seg value={settlement} onChange={setSettlement} options={[{ key: 'credit', label: 'تخفيض المديونية / رصيد للعميل' }, { key: 'refund', label: 'رد المبلغ للعميل' }]} />
          </Field>
          {settlement === 'refund' && (
            <Field label="طريقة الرد">
              <select className="input" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                {d.settings.paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="summary-box">
          <div className="r total"><span>قيمة المرتجع</span><Money v={total} /></div>
          <div className="r"><span>المتبقي على الفاتورة قبل المرتجع</span><Money v={st.remaining} /></div>
          {settlement === 'refund' && <div className="r bold"><span>المبلغ الذي سيُرد نقدًا</span><Money v={refund} /></div>}
          <div className="small muted">
            يُخفَّض المتبقي من الفاتورة أولًا؛ {settlement === 'refund' ? 'وما زاد يُرد للعميل.' : 'وما زاد يبقى رصيدًا دائنًا للعميل.'}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Returns() {
  const d = useData();
  const { go } = useNav();
  const [q, setQ] = useState('');
  const [view, setView] = useState<SaleReturn | null>(null);
  const list = d.returns
    .filter((r) => matches(q, r.number, d.invoiceById.get(r.invoiceId)?.number, d.customerById.get(r.customerId)?.name, r.reason))
    .sort((a, b) => b.date - a.date);
  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="رقم المرتجع، الفاتورة، العميل…" />
        <button className="btn" onClick={() => go('invoices')}><Icon name="invoice" /> اختر فاتورة لإرجاع أصناف منها</button>
      </div>
      <div className="alert info" style={{ marginBottom: 12 }}>
        <Icon name="info" /> لإنشاء مرتجع: افتح الفاتورة ثم اضغط زر «مرتجع».
      </div>
      {!list.length ? (
        <Empty icon="return" text="لا توجد مرتجعات" />
      ) : (
        <div className="list">
          {list.map((r) => (
            <div key={r.id} className="list-item" onClick={() => setView(r)}>
              <div className="avatar"><Icon name="return" /></div>
              <div className="main-col">
                <div className="title">{d.customerById.get(r.customerId)?.name}</div>
                <div className="meta">
                  {r.number} · على {d.invoiceById.get(r.invoiceId)?.number} · {fmtDate(r.date)} · {r.condition === 'restock' ? 'سليمة' : 'تالفة'}
                  {r.refundAmount > 0 && ` · رد ${fmtNum(r.refundAmount)}`}
                </div>
              </div>
              <Money v={r.total} className="bold" />
            </div>
          ))}
        </div>
      )}
      {view && (
        <PrintPreview
          title={`مرتجع ${view.number}`}
          filename={`مرتجع-${view.number}`}
          onClose={() => setView(null)}
          actions={<button className="btn" onClick={() => { const id = view.invoiceId; setView(null); go({ name: 'invoice', id }); }}>الفاتورة الأصلية</button>}
          render={(size) => <ReturnDoc r={view} inv={d.invoiceById.get(view.invoiceId)} customer={d.customerById.get(view.customerId)} s={d.settings} size={size} />}
        />
      )}
    </div>
  );
}
