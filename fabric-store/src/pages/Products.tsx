import { useMemo, useState } from 'react';
import { matches, useData } from '../lib/data';
import { can, saveProduct } from '../db/service';
import type { Product, UnitDef } from '../db/schema';
import { round2 } from '../lib/calc';
import { fmtNum } from '../lib/format';
import { Empty, Field, Modal, Money, NumInput, SearchBox, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';

/** عرض الكمية بأكبر الوحدات: مثال 3150 ياردة = 10 كرتون + 5 طاقة */
export function stockBreakdown(p: Pick<Product, 'stock' | 'units' | 'baseUnit'>) {
  const units = [...p.units].filter((u) => u.factor > 1).sort((a, b) => b.factor - a.factor);
  if (!units.length || p.stock <= 0) return '';
  let left = p.stock;
  const parts: string[] = [];
  for (const u of units) {
    const n = Math.floor(left / u.factor + 1e-9);
    if (n > 0) {
      parts.push(`${fmtNum(n)} ${u.name}`);
      left = round2(left - n * u.factor);
    }
  }
  if (left > 0) parts.push(`${fmtNum(left)} ${p.baseUnit}`);
  return parts.join(' + ');
}

interface FormState extends Partial<Product> {
  perBolt: number;
  boltsPerCarton: number;
  extra: UnitDef[];
  openingQty: number;
  openingUnit: string;
}

function toForm(p?: Product): FormState {
  const bolt = p?.units.find((u) => u.name === 'طاقة');
  const carton = p?.units.find((u) => u.name === 'كرتون');
  return {
    name: '', code: '', brand: '', fabricType: '', origin: '', modelNo: '', color: '', colorCode: '', composition: '', batch: '',
    baseUnit: 'ياردة', cost: 0, price: 0, lowStock: 0,
    ...p,
    perBolt: bolt?.factor ?? 0,
    boltsPerCarton: carton && bolt ? round2(carton.factor / bolt.factor) : 0,
    extra: p?.units.filter((u) => !['طاقة', 'كرتون', p.baseUnit].includes(u.name)) ?? [],
    openingQty: 0,
    openingUnit: 'ياردة',
  };
}

export function ProductForm({ product, onClose, onSaved }: { product?: Product; onClose: () => void; onSaved?: (id: number) => void }) {
  const d = useData();
  const s = d.settings;
  const [f, setF] = useState<FormState>(() => toForm(product));
  const set = (p: Partial<FormState>) => setF((x) => ({ ...x, ...p }));
  const canPrice = can('prices_discounts') || !product;

  const units: UnitDef[] = [
    { name: f.baseUnit!, factor: 1 },
    ...(f.perBolt > 0 ? [{ name: 'طاقة', factor: f.perBolt }] : []),
    ...(f.perBolt > 0 && f.boltsPerCarton > 0 ? [{ name: 'كرتون', factor: round2(f.perBolt * f.boltsPerCarton) }] : []),
    ...f.extra.filter((u) => u.name.trim() && u.factor > 0),
  ];

  const save = async () => {
    const openingFactor = units.find((u) => u.name === f.openingUnit)?.factor ?? 1;
    const { perBolt: _a, boltsPerCarton: _b, extra: _c, openingQty, openingUnit: _d, ...rest } = f;
    const id = await run(
      () => saveProduct({ ...(rest as Product), units, openingStock: product ? 0 : round2(openingQty * openingFactor) }),
      'تم حفظ الصنف',
    );
    if (id) {
      onSaved?.(id);
      onClose();
    }
  };

  return (
    <Modal
      wide
      title={product ? 'تعديل الصنف' : 'صنف جديد'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>إلغاء</button>
          <button className="btn primary" onClick={save}><Icon name="check" /> حفظ</button>
        </>
      }
    >
      <div className="stack">
        <div className="grid grid-3">
          <Field label="اسم القماش / الموديل *"><input autoFocus className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="كود الصنف (تلقائي إذا تُرك فارغًا)"><input className="input" value={f.code} onChange={(e) => set({ code: e.target.value })} /></Field>
          <Field label="نوع القماش (المنشأ)">
            <select className="input" value={f.fabricType} onChange={(e) => set({ fabricType: e.target.value })}>
              <option value="">—</option>
              {s.fabricTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="العلامة التجارية"><input className="input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
          <Field label="بلد المنشأ"><input className="input" value={f.origin} onChange={(e) => set({ origin: e.target.value })} /></Field>
          <Field label="رقم الموديل"><input className="input" value={f.modelNo} onChange={(e) => set({ modelNo: e.target.value })} /></Field>
          <Field label="اللون / الدرجة"><input className="input" value={f.color} onChange={(e) => set({ color: e.target.value })} /></Field>
          <Field label="رمز اللون"><input className="input" value={f.colorCode} onChange={(e) => set({ colorCode: e.target.value })} /></Field>
          <Field label="التركيبة (قطن، بوليستر…)"><input className="input" value={f.composition} onChange={(e) => set({ composition: e.target.value })} /></Field>
          <Field label="رقم التشغيلة / الدفعة"><input className="input" value={f.batch} onChange={(e) => set({ batch: e.target.value })} /></Field>
          <Field label="المورد">
            <select className="input" value={f.supplierId ?? ''} onChange={(e) => set({ supplierId: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option>
              {d.suppliers.filter((x) => !x.archived).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
          <div className="card-title"><h3>وحدات القياس والتحويل</h3></div>
          <div className="grid grid-3">
            <Field label="الوحدة الأساسية (للمخزون)">
              <select className="input" value={f.baseUnit} onChange={(e) => set({ baseUnit: e.target.value })} disabled={!!product}>
                <option>ياردة</option>
                <option>متر</option>
              </select>
            </Field>
            <Field label={`عدد ${f.baseUnit === 'متر' ? 'الأمتار' : 'الياردات'} في الطاقة`}><NumInput value={f.perBolt} min={0} onChange={(v) => set({ perBolt: v })} /></Field>
            <Field label="عدد الطاقات في الكرتون"><NumInput value={f.boltsPerCarton} min={0} onChange={(v) => set({ boltsPerCarton: v })} /></Field>
          </div>
          {f.extra.map((u, i) => (
            <div className="row" key={i} style={{ marginTop: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="اسم الوحدة (مثال: ربطة)" value={u.name} onChange={(e) => set({ extra: f.extra.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <div style={{ width: 140 }}><NumInput aria-label="المعامل" value={u.factor} min={0} onChange={(v) => set({ extra: f.extra.map((x, j) => (j === i ? { ...x, factor: v } : x)) })} /></div>
              <span className="small muted">{f.baseUnit}</span>
              <button className="icon-btn" onClick={() => set({ extra: f.extra.filter((_, j) => j !== i) })} aria-label="حذف"><Icon name="trash" /></button>
            </div>
          ))}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => set({ extra: [...f.extra, { name: '', factor: 0 }] })}><Icon name="plus" /> وحدة أخرى</button>
          <div className="small muted" style={{ marginTop: 8 }}>
            الوحدات المتاحة للبيع: {units.map((u) => `${u.name}${u.factor !== 1 ? ` = ${fmtNum(u.factor)} ${f.baseUnit}` : ''}`).join(' · ')}
          </div>
        </div>

        <div className="grid grid-3">
          <Field label={`تكلفة الشراء لكل ${f.baseUnit}`}><NumInput value={f.cost} min={0} disabled={!canPrice} onChange={(v) => set({ cost: v })} /></Field>
          <Field label={`سعر البيع بالجملة لكل ${f.baseUnit}`}><NumInput value={f.price} min={0} disabled={!canPrice} onChange={(v) => set({ price: v })} /></Field>
          <Field label={`حد التنبيه (${f.baseUnit})`}><NumInput value={f.lowStock} min={0} onChange={(v) => set({ lowStock: v })} /></Field>
        </div>
        {units.length > 1 && (f.price ?? 0) > 0 && (
          <div className="small muted">
            أسعار البيع حسب الوحدة: {units.map((u) => `${u.name}: ${fmtNum((f.price ?? 0) * u.factor)}`).join(' · ')}
          </div>
        )}
        {!product && (
          <div className="grid grid-3">
            <Field label="الرصيد الافتتاحي (الكمية الحالية)"><NumInput value={f.openingQty} min={0} onChange={(v) => set({ openingQty: v })} /></Field>
            <Field label="بوحدة">
              <select className="input" value={f.openingUnit} onChange={(e) => set({ openingUnit: e.target.value })}>
                {units.map((u) => <option key={u.name}>{u.name}</option>)}
              </select>
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Products() {
  const d = useData();
  const { go } = useNav();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'archived'>('all');
  const [form, setForm] = useState(false);
  const showCost = can('profits');

  const list = useMemo(
    () =>
      d.products
        .filter((p) => (filter === 'archived' ? p.archived : !p.archived))
        .filter((p) => filter !== 'low' || (p.lowStock > 0 && p.stock <= p.lowStock))
        .filter((p) => !type || p.fabricType === type)
        .filter((p) => matches(q, p.name, p.code, p.color, p.colorCode, p.modelNo, p.brand, p.origin, p.batch, d.supplierById.get(p.supplierId!)?.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [d, q, type, filter],
  );
  const value = list.reduce((s, p) => s + Math.max(0, p.stock) * p.cost, 0);

  return (
    <div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="الاسم، الكود، اللون، الموديل، المورد…" />
        <select className="input" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)} aria-label="نوع القماش">
          <option value="">كل الأنواع</option>
          {d.settings.fabricTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        {can('inventory') && <button className="btn primary" onClick={() => setForm(true)}><Icon name="plus" /> صنف جديد</button>}
      </div>
      <div className="tabs">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>كل الأصناف</button>
        <button className={filter === 'low' ? 'on' : ''} onClick={() => setFilter('low')}>قاربت النفاد</button>
        <button className={filter === 'archived' ? 'on' : ''} onClick={() => setFilter('archived')}>المؤرشفة</button>
      </div>
      <div className="small muted" style={{ marginBottom: 8 }}>
        {fmtNum(list.length)} صنف {showCost && <>· قيمة المخزون بالتكلفة <Money v={value} /></>}
      </div>
      {!list.length ? (
        <Empty icon="box" text="لا توجد أصناف">
          {can('inventory') && <button className="btn primary" onClick={() => setForm(true)}><Icon name="plus" /> أضف أول صنف</button>}
        </Empty>
      ) : (
        <div className="list">
          {list.map((p) => {
            const low = p.lowStock > 0 && p.stock <= p.lowStock;
            return (
              <div key={p.id} className="list-item" onClick={() => go({ name: 'product', id: p.id })}>
                <div className="avatar"><Icon name="layers" /></div>
                <div className="main-col">
                  <div className="title">{p.name}{p.color && ` — ${p.color}`}{p.colorCode && ` (${p.colorCode})`}</div>
                  <div className="meta">{[p.code, p.fabricType, p.brand, p.modelNo].filter(Boolean).join(' · ')} · السعر {fmtNum(p.price)}/{p.baseUnit}</div>
                </div>
                <div className="end">
                  <span className={`badge ${p.stock <= 0 ? 'bad' : low ? 'warn' : 'good'}`}>{fmtNum(p.stock)} {p.baseUnit}</span>
                  <div className="small muted">{stockBreakdown(p)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && <ProductForm onClose={() => setForm(false)} />}
    </div>
  );
}
