import { useEffect, useState } from 'react';
import { useData } from '../lib/data';
import { can, cancelInvoice, setArchived } from '../db/service';
import { fmtDate, fmtDateTime, fmtNum } from '../lib/format';
import { Empty, Money, StatusBadge, promptDialog, run, useNav } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { PrintPreview } from '../print/PrintPreview';
import { InvoiceDoc, ReceiptDoc } from '../print/Docs';
import { PaymentForm, balanceAfterPayment } from './Payments';
import { ReturnForm } from './Returns';

export default function InvoiceView({ id }: { id: number }) {
  const d = useData();
  const { go, route } = useNav();
  const inv = d.invoiceById.get(id);
  const [print, setPrint] = useState(route.params?.print === '1');
  const [pay, setPay] = useState(false);
  const [ret, setRet] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);

  useEffect(() => {
    if (route.params?.print === '1') history.replaceState(null, '', `#/invoice/${id}`);
  }, []);

  if (!d.ready) return null;
  if (!inv) return <Empty icon="invoice" text="الفاتورة غير موجودة" />;
  const st = d.status.get(id)!;
  const customer = d.customerById.get(inv.customerId);
  const payments = d.payments.filter((p) => p.allocations.some((a) => a.invoiceId === id));
  const returns = d.returns.filter((r) => r.invoiceId === id);
  const approved = inv.state === 'approved';

  return (
    <div className="stack">
      <div className="card">
        <div className="row between">
          <div>
            <h2 style={{ fontSize: 20 }}>{inv.number}</h2>
            <div className="muted small">{fmtDateTime(inv.date)} · {inv.saleType === 'cash' ? 'بيع نقدي' : 'بيع آجل'} · البائع: {inv.sellerName}</div>
          </div>
          <StatusBadge info={st} />
        </div>
        {inv.state === 'cancelled' && <div className="alert bad" style={{ marginTop: 10 }}><Icon name="alert" /> ملغاة: {inv.cancelReason}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={() => setPrint(true)}><Icon name="print" /> طباعة / مشاركة PDF</button>
          {approved && st.remaining > 0 && can('payment_create') && <button className="btn" onClick={() => setPay(true)}><Icon name="wallet" /> تسجيل دفعة</button>}
          {approved && can('invoice_cancel') && st.returnState !== 'full' && <button className="btn" onClick={() => setRet(true)}><Icon name="return" /> مرتجع</button>}
          {approved && can('invoice_edit') && !returns.length && <button className="btn" onClick={() => go({ name: 'invoice-edit', id })}><Icon name="edit" /> تعديل</button>}
          {approved && can('invoice_cancel') && !returns.length && (
            <button
              className="btn danger"
              onClick={async () => {
                const reason = await promptDialog('إلغاء الفاتورة', 'سيتم إرجاع الكميات للمخزون وتحويل أي دفعات مسجلة عليها إلى رصيد دائن للعميل. اكتب سبب الإلغاء:');
                if (reason) await run(() => cancelInvoice(id, reason), 'تم إلغاء الفاتورة');
              }}
            >
              <Icon name="close" /> إلغاء
            </button>
          )}
          {inv.state !== 'draft' && can('invoice_edit') && (
            <button className="btn ghost" onClick={() => run(() => setArchived('invoices', id, !inv.archived), inv.archived ? 'تمت الاستعادة' : 'تمت الأرشفة')}>
              <Icon name="archive" /> {inv.archived ? 'استعادة من الأرشيف' : 'أرشفة'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><h3>العميل</h3></div>
          {customer && (
            <div className="list-item" onClick={() => go({ name: 'customer', id: customer.id })}>
              <div className="avatar">{customer.name.trim()[0]}</div>
              <div className="main-col">
                <div className="title">{customer.name}</div>
                <div className="meta">{customer.code} · {customer.phone} · {customer.city}</div>
              </div>
              <div className="end small">الرصيد الحالي<br /><Money v={d.balance.get(customer.id!) ?? 0} className="bold" /></div>
            </div>
          )}
          {(inv.notes || inv.deliveryNotes) && (
            <div className="small" style={{ marginTop: 10 }}>
              {inv.notes && <div><b>ملاحظات البيع:</b> {inv.notes}</div>}
              {inv.deliveryNotes && <div><b>ملاحظات التسليم:</b> {inv.deliveryNotes}</div>}
            </div>
          )}
          {inv.saleType === 'credit' && <div className="small" style={{ marginTop: 8 }}>تاريخ الاستحقاق: <b>{fmtDate(inv.dueDate)}</b></div>}
          <div className="small" style={{ marginTop: 4 }}>وسيلة الدفع: <b>{inv.paymentMethod}</b></div>
        </div>
        <div className="card">
          <div className="card-title"><h3>ملخص الحساب</h3></div>
          <div className="summary-box">
            <div className="r"><span>إجمالي قبل الخصم</span><Money v={inv.subtotal} /></div>
            <div className="r"><span>إجمالي الخصومات</span><Money v={inv.totalDiscount} /></div>
            {inv.extraFees > 0 && <div className="r"><span>رسوم إضافية</span><Money v={inv.extraFees} /></div>}
            <div className="r total"><span>صافي الفاتورة</span><Money v={inv.net} /></div>
            <div className="r"><span>المدفوع</span><Money v={st.paid} className="good" /></div>
            {st.returned > 0 && <div className="r"><span>المرتجعات</span><Money v={st.returned} /></div>}
            <div className="r bold"><span>المتبقي من الفاتورة</span><Money v={st.remaining} className={st.remaining > 0 ? 'bad' : ''} /></div>
            {approved && <div className="r muted"><span>رصيد العميل السابق عند الإصدار</span><Money v={inv.prevBalance} /></div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><h3>الأصناف</h3></div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr><th>#</th><th>الصنف</th><th>النوع</th><th>اللون</th><th>كراتين</th><th>طاقات</th><th>الكمية</th><th>الفعلية</th><th>السعر</th><th>الإجمالي</th><th>الخصم</th><th>الصافي</th></tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} className={l.productId ? 'click' : ''} onClick={() => l.productId && go({ name: 'product', id: l.productId })}>
                  <td>{i + 1}</td>
                  <td className="bold">{l.name}<div className="small muted">{l.code}</div></td>
                  <td>{l.fabricType || '—'}</td>
                  <td>{l.color || '—'} {l.colorCode && <span className="small muted">({l.colorCode})</span>}</td>
                  <td>{l.cartons ? fmtNum(l.cartons) : '—'}</td>
                  <td>{l.bolts ? fmtNum(l.bolts) : '—'}</td>
                  <td>{fmtNum(l.qty)} {l.unit}</td>
                  <td>{fmtNum(l.baseQty)} {l.baseUnit}</td>
                  <td><Money v={l.unitPrice} /></td>
                  <td><Money v={l.total} /></td>
                  <td>{l.discount ? <Money v={l.discount} /> : '—'}</td>
                  <td className="bold"><Money v={l.net} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title"><h3>الدفعات على الفاتورة</h3></div>
          {payments.length ? (
            <div className="list">
              {payments.map((p) => (
                <div key={p.id} className="list-item" onClick={() => setReceipt(p.id!)}>
                  <div className="main-col">
                    <div className="title">{p.number} · {p.method}</div>
                    <div className="meta">{fmtDateTime(p.date)} · {p.createdBy}</div>
                  </div>
                  <div className="end">
                    <Money v={p.allocations.find((a) => a.invoiceId === id)?.amount ?? 0} className={p.reversed ? 'muted' : 'good bold'} />
                    {p.reversed ? <div className="badge muted">معكوسة</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="wallet" text="لا توجد دفعات" />
          )}
        </div>
        <div className="card">
          <div className="card-title"><h3>المرتجعات</h3></div>
          {returns.length ? (
            <div className="list">
              {returns.map((r) => (
                <div key={r.id} className="list-item" onClick={() => go('returns')}>
                  <div className="main-col">
                    <div className="title">{r.number}</div>
                    <div className="meta">{fmtDate(r.date)} · {r.reason || '—'}</div>
                  </div>
                  <Money v={r.total} className="bold" />
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="return" text="لا توجد مرتجعات" />
          )}
        </div>
      </div>

      {print && (
        <PrintPreview
          title={`فاتورة ${inv.number}`}
          filename={`فاتورة-${inv.number}`}
          defaultSize={d.settings.printSize}
          onClose={() => setPrint(false)}
          render={(size) => <InvoiceDoc inv={inv} customer={customer} s={d.settings} info={st} size={size} />}
        />
      )}
      {receipt != null && (() => {
        const p = d.payments.find((x) => x.id === receipt)!;
        return (
          <PrintPreview
            title={`سند قبض ${p.number}`}
            filename={`سند-${p.number}`}
            defaultSize={d.settings.printSize}
            onClose={() => setReceipt(null)}
            render={(size) => (
              <ReceiptDoc p={p} customer={customer} s={d.settings} size={size} balanceAfter={balanceAfterPayment(d, p)} invoiceNumbers={new Map(d.invoices.map((i) => [i.id!, i.number]))} />
            )}
          />
        );
      })()}
      {pay && <PaymentForm customerId={inv.customerId} invoiceId={id} onClose={() => setPay(false)} />}
      {ret && <ReturnForm invoiceId={id} onClose={() => setRet(false)} />}
    </div>
  );
}
