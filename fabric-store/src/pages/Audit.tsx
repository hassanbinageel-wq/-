import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { matches } from '../lib/data';
import { fmtDateTime } from '../lib/format';
import { Empty, SearchBox } from '../ui/kit';

export default function Audit() {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(200);
  const rows = useLiveQuery(() => db.audit.orderBy('ts').reverse().limit(5000).toArray(), []) ?? [];
  const list = rows.filter((r) => matches(q, r.user, r.action, r.entity, r.details));
  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="المستخدم، العملية، رقم الفاتورة…" />
      </div>
      {!list.length ? (
        <Empty icon="history" text="لا توجد عمليات" />
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>التفاصيل</th></tr></thead>
            <tbody>
              {list.slice(0, limit).map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.ts)}</td>
                  <td>{r.user}</td>
                  <td className="bold">{r.action}</td>
                  <td>{r.entity}</td>
                  <td className="small" style={{ maxWidth: 420, wordBreak: 'break-word' }}>{r.details.length > 300 ? r.details.slice(0, 300) + '…' : r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > limit && <button className="btn" style={{ marginTop: 10, width: '100%' }} onClick={() => setLimit(limit + 200)}>عرض المزيد</button>}
    </div>
  );
}
