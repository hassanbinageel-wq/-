import { useState } from 'react';
import { useData } from '../lib/data';
import { can, reverseSupplierPayment, saveSupplierPayment, setArchived } from '../db/service';
import { fmtDate, fmtNum, fromInputDateNow, toInputDate } from '../lib/format';
import { Empty, Field, KPI, Modal, Money, NumInput, confirmDialog, run } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { SupplierForm } from './Purchases';

export default function SupplierView({ id }: { id: number }) {
  const d = useData();
  const s = d.supplierById.get(id);
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const [amount, setAmount] = useState(0);
  const [purchaseId, setPurchaseId] = useState<number | ''>('');
  const [method, setMethod] = useState(d.settings.paymentMethods[0]);
  const [date, setDate] = useState(toInputDate());
  const [notes, setNotes] = useState('');

  if (!d.ready) return null;
  if (!s) return <Empty icon="truck" text="المورد غير موجود" />;
  const purchases = d.purchases.filter((p) => p.supplierId === id).sort((a, b) => b.date - a.date);
  const payments = d.supplierPayments.filter((p) => p.supplierId === id).sort((a, b) => b.date - a.date);
  const bal = d.supplierBal.get(id) ?? 0;
  const totalPurchases = purchases.filter((p) => p.state === 'approved').reduce((a, p) => a + p.total, 0);
  const totalPaid = payments.filter((p) => !p.reversed).reduce((a, p) => a + p.amount, 0);
  const open = purchases.filter((p) => (d.purchaseRemaining.get(p.id!) ?? 0) > 0);

  const savePay = async () => {
    const ok = await run(
      () => saveSupplierPayment({ supplierId: id, purchaseId: purchaseId || undefined, amount, method, notes, date: fromInputDateNow(date) }),
      'تم تسجيل الدفعة للمورد',
    );
    if (ok) {
      setPay(false);
      setAmount(0);
      setNotes('');
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <h2 style={{ fontSize: 20 }}>{s.name} {s.archived ? <span className="badge muted">مؤرشف</span> : null}</h2>
        <div className="small muted">{[s.phone, s.address].filter(Boolean).join(' · ') || '—'}</div>
        {s.notes && <div className="small">{s.notes}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          {can('purchases') && <button className="btn primary" onClick={() => setPay(true)}><Icon name="wallet" /> دفعة للمورد</button>}
          {can('purchases') && <button className="btn" onClick={() => setEdit(true)}><Icon name="edit" /> تعديل</button>}
          {can('purchases') && (
            <button className="btn ghost" onClick={() => run(() => setArchived('suppliers', id, !s.archived), s.archived ? 'تمت الاستعادة' : 'تمت الأرشفة')}>
              <Icon name="archive" /> {s.archived ? 'استعادة' : 'أرشفة'}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-3">
        <KPI accent icon="debt" label={bal >= 0 ? 'المستحق للمورد' : 'مدفوع مقدمًا'} value={<Money v={Math.abs(bal)} />} />
        <KPI icon="truck" label="إجمالي المشتريات" value={<Money v={totalPurchases} />} sub={s.openingBalance ? <>رصيد افتتاحي <Money v={s.openingBalance} /></> : undefined} />
        <KPI icon="wallet" label="إجمالي المدفوع" value={<Money v={totalPaid} />} />
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><h3>فواتير الشراء</h3></div>
          {purchases.length ? (
            <div className="list">
              {purchases.map((p) => (
                <div key={p.id} className="list-item" style={{ cursor: 'default' }}>
                  <div className="main-col">
                    <div className="title">{p.number} {p.state === 'cancelled' && <span className="badge muted">ملغاة</span>}</div>
                    <div className="meta">{fmtDate(p.date)} · {p.lines.map((l) => `${l.name} ${fmtNum(l.qty)} ${l.unit}`).join('، ')}</div>
                    {p.dueDate && (d.purchaseRemaining.get(p.id!) ?? 0) > 0 && <div className="small warn">يستحق {fmtDate(p.dueDate)}</div>}
                  </div>
                  <div className="end">
                    <div className="bold"><Money v={p.total} /></div>
                    <div className="small">متبقي <Money v={d.purchaseRemaining.get(p.id!) ?? 0} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="truck" text="لا توجد مشتريات" />
          )}
        </div>
        <div className="card">
          <div className="card-title"><h3>الدفعات للمورد</h3></div>
          {payments.length ? (
            <div className="list">
              {payments.map((p) => (
                <div key={p.id} className="list-item" style={{ cursor: 'default' }}>
                  <div className="main-col">
                    <div className="title">{fmtDate(p.date)} · {p.method}</div>
                    <div className="meta">{p.purchaseId ? d.purchases.find((x) => x.id === p.purchaseId)?.number : 'دفعة على الحساب'} {p.notes && `· ${p.notes}`}</div>
                  </div>
                  <div className="end">
                    <Money v={p.amount} className={p.reversed ? 'muted' : 'bold'} />
                    {p.reversed ? (
                      <div className="badge muted">معكوسة</div>
                    ) : (
                      can('payment_reverse') && (
                        <button className="btn sm ghost" onClick={async () => (await confirmDialog('عكس الدفعة', 'هل تريد عكس هذه الدفعة؟', { danger: true })) && run(() => reverseSupplierPayment(p.id!), 'تم العكس')}>
                          عكس
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="wallet" text="لا توجد دفعات" />
          )}
        </div>
      </div>
      {edit && <SupplierForm initial={s} onClose={() => setEdit(false)} />}
      {pay && (
        <Modal title="دفعة للمورد" onClose={() => setPay(false)} footer={<><button className="btn" onClick={() => setPay(false)}>إلغاء</button><button className="btn primary" onClick={savePay}>حفظ</button></>}>
          <div className="grid grid-2">
            <Field label="المبلغ *"><NumInput value={amount} min={0} onChange={setAmount} /></Field>
            <Field label="التاريخ"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="على فاتورة شراء">
              <select className="input" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">على الحساب العام</option>
                {open.map((p) => <option key={p.id} value={p.id}>{p.number} — متبقي {fmtNum(d.purchaseRemaining.get(p.id!) ?? 0)}</option>)}
              </select>
            </Field>
            <Field label="طريقة الدفع">
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
