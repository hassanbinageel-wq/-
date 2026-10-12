import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useData } from '../lib/data';
import { db, type StockMoveType } from '../db/schema';
import { adjustStock, can, setArchived } from '../db/service';
import { fmtDateTime, fmtNum } from '../lib/format';
import { Empty, Field, KPI, Modal, Money, NumInput, Seg, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { ProductForm, stockBreakdown } from './Products';

export const MOVE_LABEL: Record<StockMoveType, string> = {
  opening: 'رصيد افتتاحي',
  purchase: 'مشتريات',
  sale: 'مبيعات',
  sale_cancel: 'إلغاء/تعديل بيع',
  return_in: 'مرتجع مبيعات',
  damaged: 'تالف',
  adjust: 'تسوية',
  purchase_cancel: 'إلغاء شراء',
};

export default function ProductView({ id }: { id: number }) {
  const d = useData();
  const { go } = useNav();
  const p = d.productById.get(id);
  const moves = useLiveQuery(() => db.stockMoves.where('productId').equals(id).reverse().sortBy('id'), [id]) ?? [];
  const [edit, setEdit] = useState(false);
  const [adj, setAdj] = useState(false);
  const [mode, setMode] = useState<'adjust' | 'damaged'>('adjust');
  const [qty, setQty] = useState(0);
  const [unit, setUnit] = useState('');
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [note, setNote] = useState('');

  if (!d.ready) return null;
  if (!p) return <Empty icon="box" text="الصنف غير موجود" />;
  const showCost = can('profits');
  const sold = moves.filter((m) => m.type === 'sale').reduce((s, m) => s - m.qty, 0) - moves.filter((m) => m.type === 'sale_cancel').reduce((s, m) => s + m.qty, 0);

  const doAdjust = async () => {
    const f = p.units.find((u) => u.name === (unit || p.baseUnit))?.factor ?? 1;
    const base = qty * f * (mode === 'adjust' && dir === 'out' ? -1 : 1);
    const ok = await run(() => adjustStock(id, base, mode, note), 'تم تسجيل الحركة');
    if (ok !== undefined) {
      setAdj(false);
      setQty(0);
      setNote('');
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="row between">
          <div>
            <h2 style={{ fontSize: 20 }}>{p.name} {p.archived ? <span className="badge muted">مؤرشف</span> : null}</h2>
            <div className="muted small">{[p.code, p.fabricType, p.brand, p.origin, p.modelNo && `موديل ${p.modelNo}`].filter(Boolean).join(' · ')}</div>
            <div className="small">
              اللون: {p.color || '—'} {p.colorCode && `(${p.colorCode})`} · التركيبة: {p.composition || '—'} · التشغيلة: {p.batch || '—'} · المورد: {d.supplierById.get(p.supplierId!)?.name ?? '—'}
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {can('inventory') && <button className="btn primary" onClick={() => setEdit(true)}><Icon name="edit" /> تعديل</button>}
          {can('inventory') && <button className="btn" onClick={() => { setAdj(true); setUnit(p.baseUnit); }}><Icon name="refresh" /> تسوية / تالف</button>}
          {can('purchases') && <button className="btn" onClick={() => go({ name: 'purchases', params: { new: String(id) } })}><Icon name="truck" /> شراء كمية</button>}
          {can('inventory') && (
            <button className="btn ghost" onClick={() => run(() => setArchived('products', id, !p.archived), p.archived ? 'تمت الاستعادة' : 'تمت الأرشفة')}>
              <Icon name="archive" /> {p.archived ? 'استعادة' : 'أرشفة'}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-4">
        <KPI accent icon="box" label="الرصيد الحالي" value={`${fmtNum(p.stock)} ${p.baseUnit}`} sub={stockBreakdown(p) || undefined} />
        <KPI icon="chart" label="سعر البيع" value={<Money v={p.price} />} sub={p.units.filter((u) => u.factor !== 1).map((u) => `${u.name}: ${fmtNum(p.price * u.factor)}`).join(' · ') || `لكل ${p.baseUnit}`} />
        {showCost && <KPI icon="truck" label="متوسط التكلفة" value={<Money v={p.cost} />} sub={`هامش ${p.price ? fmtNum(((p.price - p.cost) / p.price) * 100, 1) : 0}%`} />}
        <KPI icon="invoice" label="إجمالي المباع" value={`${fmtNum(sold)} ${p.baseUnit}`} sub={`حد التنبيه ${fmtNum(p.lowStock)}`} />
      </div>
      <div className="card">
        <div className="card-title"><h3>وحدات البيع</h3></div>
        <div className="row">
          {p.units.map((u) => <span key={u.name} className="badge info">{u.name}{u.factor !== 1 && ` = ${fmtNum(u.factor)} ${p.baseUnit}`}</span>)}
        </div>
      </div>
      <div className="card">
        <div className="card-title"><h3>حركة المخزون</h3></div>
        {moves.length ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>التاريخ</th><th>النوع</th><th>المرجع</th><th>الكمية</th><th>قبل</th><th>بعد</th><th>ملاحظة</th><th>المستخدم</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className={m.refType === 'invoice' ? 'click' : ''} onClick={() => m.refType === 'invoice' && go({ name: 'invoice', id: m.refId })}>
                    <td>{fmtDateTime(m.date)}</td>
                    <td>{MOVE_LABEL[m.type]}</td>
                    <td>{m.refNumber || '—'}</td>
                    <td className={m.qty < 0 ? 'bad bold' : 'good bold'}><span className="num">{m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}</span></td>
                    <td>{fmtNum(m.before)}</td>
                    <td className="bold">{fmtNum(m.after)}</td>
                    <td>{m.note || '—'}</td>
                    <td>{m.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="history" text="لا توجد حركات" />
        )}
      </div>
      {edit && <ProductForm product={p} onClose={() => setEdit(false)} />}
      {adj && (
        <Modal
          title="تسوية مخزون / تسجيل تالف"
          onClose={() => setAdj(false)}
          footer={
            <>
              <button className="btn" onClick={() => setAdj(false)}>إلغاء</button>
              <button className="btn primary" onClick={doAdjust}>حفظ الحركة</button>
            </>
          }
        >
          <div className="stack">
            <Seg value={mode} onChange={setMode} options={[{ key: 'adjust', label: 'تسوية (جرد)' }, { key: 'damaged', label: 'تالف' }]} />
            {mode === 'adjust' && <Seg value={dir} onChange={setDir} options={[{ key: 'in', label: 'زيادة' }, { key: 'out', label: 'نقص' }]} />}
            <div className="grid grid-2">
              <Field label="الكمية"><NumInput value={qty} min={0} onChange={setQty} /></Field>
              <Field label="الوحدة">
                <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {p.units.map((u) => <option key={u.name}>{u.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="السبب / ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
