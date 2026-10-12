import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { fmtDate, fmtNum } from '../lib/format';
import { can } from '../db/service';
import { Empty, Money, SearchBox, StatusBadge, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'unpaid', label: 'غير مدفوعة' },
  { key: 'partial', label: 'جزئية' },
  { key: 'paid', label: 'مدفوعة' },
  { key: 'overdue', label: 'متأخرة' },
  { key: 'draft', label: 'مسودات' },
  { key: 'cancelled', label: 'ملغاة' },
  { key: 'archived', label: 'مؤرشفة' },
];

export default function Invoices() {
  const d = useData();
  const { go, route } = useNav();
  const [q, setQ] = useState('');
  const [f, setF] = useState(route.params?.status ?? 'all');
  const [type, setType] = useState<'all' | 'cash' | 'credit'>('all');

  const list = useMemo(() => {
    return d.invoices
      .filter((i) => {
        const st = d.status.get(i.id!)!;
        if (f === 'archived') { if (!i.archived) return false; }
        else if (i.archived) return false;
        if (type !== 'all' && i.saleType !== type) return false;
        if (f === 'overdue' && !st.overdue) return false;
        if (['unpaid', 'partial', 'paid', 'draft', 'cancelled'].includes(f) && st.status !== f) return false;
        const c = d.customerById.get(i.customerId);
        return matches(q, i.number, c?.name, c?.phone, c?.code, fmtDate(i.date), i.lines.map((l) => l.name).join(' '));
      })
      .sort((a, b) => b.date - a.date || (b.id! - a.id!));
  }, [d, q, f, type]);

  const totals = useMemo(() => {
    let net = 0, rem = 0;
    for (const i of list) {
      if (i.state !== 'approved') continue;
      net += i.net;
      rem += d.status.get(i.id!)!.remaining;
    }
    return { net, rem };
  }, [list]);

  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="رقم الفاتورة، العميل، الهاتف، التاريخ، الصنف…" />
        <select className="input" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value as any)} aria-label="نوع البيع">
          <option value="all">نقدي وآجل</option>
          <option value="cash">نقدي</option>
          <option value="credit">آجل</option>
        </select>
        {can('invoice_create') && (
          <button className="btn primary" onClick={() => go('invoice-new')}>
            <Icon name="plus" /> فاتورة جديدة
          </button>
        )}
      </div>
      <div className="tabs">
        {FILTERS.map((x) => (
          <button key={x.key} className={f === x.key ? 'on' : ''} onClick={() => setF(x.key)}>{x.label}</button>
        ))}
      </div>
      <div className="row small muted" style={{ marginBottom: 10 }}>
        <span>{fmtNum(list.length)} فاتورة</span>·<span>الإجمالي <Money v={totals.net} /></span>·<span>المتبقي <Money v={totals.rem} className="bad" /></span>
      </div>
      {!list.length ? (
        <Empty icon="invoice" text="لا توجد فواتير مطابقة" />
      ) : (
        <>
          <div className="table-wrap desktop-only">
            <table className="t">
              <thead>
                <tr>
                  <th>الرقم</th><th>التاريخ</th><th>العميل</th><th>النوع</th><th>الصافي</th><th>المدفوع</th><th>المتبقي</th><th>الاستحقاق</th><th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const st = d.status.get(i.id!)!;
                  return (
                    <tr key={i.id} className="click" onClick={() => go(i.state === 'draft' ? { name: 'invoice-edit', id: i.id } : { name: 'invoice', id: i.id })}>
                      <td className="bold">{i.number}</td>
                      <td>{fmtDate(i.date)}</td>
                      <td>{d.customerById.get(i.customerId)?.name ?? '—'}</td>
                      <td>{i.saleType === 'cash' ? 'نقدي' : 'آجل'}</td>
                      <td><Money v={i.net} /></td>
                      <td><Money v={st.paid} /></td>
                      <td className={st.remaining > 0 ? 'bad bold' : ''}><Money v={st.remaining} /></td>
                      <td>{i.saleType === 'credit' ? fmtDate(i.dueDate) : '—'}</td>
                      <td><StatusBadge info={st} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="list mobile-only">
            {list.map((i) => {
              const st = d.status.get(i.id!)!;
              return (
                <div key={i.id} className="list-item" onClick={() => go(i.state === 'draft' ? { name: 'invoice-edit', id: i.id } : { name: 'invoice', id: i.id })}>
                  <div className="main-col">
                    <div className="title">{d.customerById.get(i.customerId)?.name ?? '—'}</div>
                    <div className="meta">{i.number} · {fmtDate(i.date)} · {i.saleType === 'cash' ? 'نقدي' : 'آجل'}</div>
                    <div style={{ marginTop: 4 }}><StatusBadge info={st} /></div>
                  </div>
                  <div className="end">
                    <div className="bold"><Money v={i.net} /></div>
                    {st.remaining > 0 && <div className="small bad">متبقي <Money v={st.remaining} /></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
