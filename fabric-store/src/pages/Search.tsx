import { useState } from 'react';
import { matches, useData } from '../lib/data';
import { fmtDate } from '../lib/format';
import { Empty, Money, SearchBox, StatusBadge, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';

export default function Search() {
  const d = useData();
  const { go } = useNav();
  const [q, setQ] = useState('');
  const has = q.trim().length >= 1;
  const invoices = has
    ? d.invoices.filter((i) => {
        const c = d.customerById.get(i.customerId);
        return matches(q, i.number, c?.name, c?.phone, fmtDate(i.date));
      }).slice(0, 15)
    : [];
  const customers = has ? d.customers.filter((c) => matches(q, c.name, c.phone, c.code, c.city)).slice(0, 10) : [];
  const products = has ? d.products.filter((p) => matches(q, p.name, p.code, p.color, p.colorCode, p.modelNo)).slice(0, 10) : [];
  const payments = has ? d.payments.filter((p) => matches(q, p.number)).slice(0, 10) : [];
  const suppliers = has ? d.suppliers.filter((s) => matches(q, s.name, s.phone)).slice(0, 10) : [];
  const nothing = has && !invoices.length && !customers.length && !products.length && !payments.length && !suppliers.length;

  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث عن فاتورة، عميل، هاتف، صنف، كود، لون، سند…" />
      </div>
      {!has && <Empty icon="search" text="اكتب للبحث في كل أقسام التطبيق (يشمل المؤرشف)" />}
      {nothing && <Empty icon="search" text="لا توجد نتائج" />}
      {customers.length > 0 && (
        <div className="card"><div className="card-title"><h3>العملاء</h3></div><div className="list">
          {customers.map((c) => (
            <div key={c.id} className="list-item" onClick={() => go({ name: 'customer', id: c.id })}>
              <div className="avatar">{c.name.trim()[0]}</div>
              <div className="main-col"><div className="title">{c.name} {c.archived ? <span className="badge muted">مؤرشف</span> : null}</div><div className="meta">{c.code} · {c.phone}</div></div>
              <Money v={d.balance.get(c.id!) ?? 0} className="bold" />
            </div>
          ))}
        </div></div>
      )}
      {invoices.length > 0 && (
        <div className="card"><div className="card-title"><h3>الفواتير</h3></div><div className="list">
          {invoices.map((i) => (
            <div key={i.id} className="list-item" onClick={() => go(i.state === 'draft' ? { name: 'invoice-edit', id: i.id } : { name: 'invoice', id: i.id })}>
              <div className="main-col"><div className="title">{i.number} — {d.customerById.get(i.customerId)?.name}</div><div className="meta">{fmtDate(i.date)}</div></div>
              <div className="end"><Money v={i.net} className="bold" /><StatusBadge info={d.status.get(i.id!)!} /></div>
            </div>
          ))}
        </div></div>
      )}
      {products.length > 0 && (
        <div className="card"><div className="card-title"><h3>الأصناف</h3></div><div className="list">
          {products.map((p) => (
            <div key={p.id} className="list-item" onClick={() => go({ name: 'product', id: p.id })}>
              <div className="avatar"><Icon name="layers" /></div>
              <div className="main-col"><div className="title">{p.name} {p.color && `— ${p.color}`}</div><div className="meta">{p.code} · {p.fabricType}</div></div>
              <span className="badge info">{p.stock} {p.baseUnit}</span>
            </div>
          ))}
        </div></div>
      )}
      {payments.length > 0 && (
        <div className="card"><div className="card-title"><h3>سندات القبض</h3></div><div className="list">
          {payments.map((p) => (
            <div key={p.id} className="list-item" onClick={() => go({ name: 'payments', params: { q: p.number } })}>
              <div className="main-col"><div className="title">{p.number} — {d.customerById.get(p.customerId)?.name}</div><div className="meta">{fmtDate(p.date)}</div></div>
              <Money v={p.amount} className="bold" />
            </div>
          ))}
        </div></div>
      )}
      {suppliers.length > 0 && (
        <div className="card"><div className="card-title"><h3>الموردون</h3></div><div className="list">
          {suppliers.map((s) => (
            <div key={s.id} className="list-item" onClick={() => go({ name: 'supplier', id: s.id })}>
              <div className="main-col"><div className="title">{s.name}</div><div className="meta">{s.phone}</div></div>
            </div>
          ))}
        </div></div>
      )}
    </div>
  );
}
