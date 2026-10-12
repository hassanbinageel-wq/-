import type { CSSProperties, ReactNode } from 'react';
import type { Customer, Invoice, Payment, Settings, SaleReturn } from '../db/schema';
import type { InvoiceStatusInfo, StatementRow } from '../lib/calc';
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format';
import { STATUS_LABEL } from '../ui/kit';
import { mix, onColor } from '../lib/theme';

export const PAPER_WIDTH = { a4: 794, thermal: 302 };

const ink = '#111827';
const ink2 = '#4b5563';
const line = '#d1d5db';

function Paper({ size, children }: { size: 'a4' | 'thermal'; children: ReactNode }) {
  return (
    <div
      className="paper"
      dir="rtl"
      style={{
        width: PAPER_WIDTH[size],
        minHeight: size === 'a4' ? 1123 : undefined,
        background: '#fff',
        color: ink,
        fontFamily: "'Cairo', sans-serif",
        padding: size === 'a4' ? '36px 40px' : '12px 10px',
        fontSize: size === 'a4' ? 13 : 11.5,
        lineHeight: 1.6,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}

function Header({ s, title, number, date, size }: { s: Settings; title: string; number: string; date: number; size: 'a4' | 'thermal' }) {
  const c = s.invoiceColor || '#0f766e';
  if (size === 'thermal') {
    return (
      <div style={{ textAlign: 'center', borderBottom: `1px dashed ${ink}`, paddingBottom: 6, marginBottom: 6 }}>
        {s.logo && <img src={s.logo} style={{ width: 54, height: 54, objectFit: 'contain' }} />}
        <div style={{ fontWeight: 800, fontSize: 15 }}>{s.shopName}</div>
        {s.phone && <div>{s.phone}{s.phone2 && ` — ${s.phone2}`}</div>}
        {s.address && <div>{s.address}</div>}
        <div style={{ fontWeight: 800, marginTop: 4 }}>{title}</div>
        <div>رقم: {number} — {fmtDateTime(date)}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, marginBottom: 18 }}>
      <div style={{ flex: 1, display: 'flex', gap: 14, alignItems: 'center' }}>
        {s.logo ? (
          <img src={s.logo} style={{ width: 78, height: 78, objectFit: 'contain', borderRadius: 12 }} />
        ) : (
          <div style={{ width: 70, height: 70, borderRadius: 14, background: c, color: onColor(c), display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800 }}>
            {s.shopName.trim()[0] || 'م'}
          </div>
        )}
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: c, lineHeight: 1.3 }}>{s.shopName}</div>
          {s.activity && <div style={{ color: ink2 }}>{s.activity}</div>}
          <div style={{ color: ink2, fontSize: 12 }}>
            {[s.phone, s.phone2].filter(Boolean).join(' — ')}
            {s.address && ` | ${s.address}`}
          </div>
          {s.taxNo && <div style={{ color: ink2, fontSize: 12 }}>الرقم الضريبي: {s.taxNo}</div>}
        </div>
      </div>
      <div style={{ background: c, color: onColor(c), borderRadius: 14, padding: '10px 18px', minWidth: 190, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
        <div>الرقم: <b>{number}</b></div>
        <div style={{ fontSize: 12 }}>{fmtDateTime(date)}</div>
      </div>
    </div>
  );
}

const cell = (size: 'a4' | 'thermal', extra: CSSProperties = {}): CSSProperties => ({
  border: size === 'a4' ? `1px solid ${line}` : 'none',
  borderBottom: `1px solid ${line}`,
  padding: size === 'a4' ? '6px 6px' : '3px 2px',
  textAlign: 'center',
  ...extra,
});

function InfoGrid({ items, color }: { items: [string, ReactNode][]; color: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: `1px solid ${line}`, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      {items.map(([k, v], i) => (
        <div key={i} style={{ padding: '6px 10px', borderBottom: `1px solid ${line}`, borderInlineStart: i % 3 ? `1px solid ${line}` : 'none' }}>
          <div style={{ fontSize: 11, color: mix(color, '#000000', 0.1), fontWeight: 700 }}>{k}</div>
          <div style={{ fontWeight: 700 }}>{v || '—'}</div>
        </div>
      ))}
    </div>
  );
}

function SumRow({ k, v, strong, color }: { k: string; v: ReactNode; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: `1px dashed ${line}`, fontWeight: strong ? 800 : 500, fontSize: strong ? 14.5 : undefined, color }}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export function InvoiceDoc({
  inv,
  customer,
  s,
  info,
  size,
}: {
  inv: Invoice;
  customer?: Customer;
  s: Settings;
  info: InvoiceStatusInfo;
  size: 'a4' | 'thermal';
}) {
  const c = s.invoiceColor || '#0f766e';
  const acc = s.invoiceAccent || '#b45309';
  const title = inv.state === 'draft' ? 'مسودة فاتورة' : inv.saleType === 'cash' ? 'فاتورة مبيعات نقدية' : 'فاتورة مبيعات آجلة';
  const totalDue = round(inv.prevBalance + inv.net - info.paid - info.returned);
  const hasCartons = inv.lines.some((l) => l.cartons > 0);
  const hasBolts = inv.lines.some((l) => l.bolts > 0);
  const hasDisc = inv.lines.some((l) => l.discount > 0);
  const thermal = size === 'thermal';
  return (
    <Paper size={size}>
      <Header s={s} title={title} number={inv.number} date={inv.date} size={size} />
      {inv.state === 'cancelled' && (
        <div style={{ border: '2px solid #c62828', color: '#c62828', textAlign: 'center', fontWeight: 800, padding: 4, borderRadius: 8, marginBottom: 10 }}>
          فاتورة ملغاة {inv.cancelReason && `— ${inv.cancelReason}`}
        </div>
      )}
      {thermal ? (
        <div style={{ marginBottom: 6 }}>
          <div>العميل: <b>{customer?.name}</b> {customer?.phone && `— ${customer.phone}`}</div>
          <div>البيع: {inv.saleType === 'cash' ? 'نقدًا' : 'آجل'} — الحالة: {STATUS_LABEL[info.status]}</div>
          {inv.dueDate && inv.saleType === 'credit' && <div>الاستحقاق: {fmtDate(inv.dueDate)}</div>}
        </div>
      ) : (
        <InfoGrid
          color={c}
          items={[
            ['اسم العميل', customer?.name],
            ['رقم العميل', customer?.code],
            ['الهاتف', customer?.phone && <span dir="ltr">{customer.phone}</span>],
            ['المنطقة / العنوان', [customer?.city, customer?.address].filter(Boolean).join(' — ')],
            ['نوع العملية', inv.saleType === 'cash' ? 'نقدًا' : 'آجل'],
            ['حالة الفاتورة', STATUS_LABEL[info.status] + (info.overdue ? ' (متأخرة)' : '')],
          ]}
        />
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: thermal ? 11 : 12 }}>
        <thead>
          <tr style={{ background: thermal ? 'transparent' : c, color: thermal ? ink : onColor(c) }}>
            <th style={cell(size, { width: 24 })}>#</th>
            <th style={cell(size, { textAlign: 'start' })}>الصنف</th>
            {!thermal && <th style={cell(size)}>النوع</th>}
            {!thermal && <th style={cell(size)}>اللون</th>}
            {!thermal && hasCartons && <th style={cell(size)}>كراتين</th>}
            {!thermal && hasBolts && <th style={cell(size)}>طاقات</th>}
            <th style={cell(size)}>الكمية</th>
            {!thermal && <th style={cell(size)}>الأمتار/الياردات</th>}
            <th style={cell(size)}>السعر</th>
            {!thermal && <th style={cell(size)}>الإجمالي</th>}
            {!thermal && hasDisc && <th style={cell(size)}>الخصم</th>}
            <th style={cell(size)}>الصافي</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i} style={{ background: !thermal && i % 2 ? mix(c, '#ffffff', 0.94) : undefined }}>
              <td style={cell(size)}>{i + 1}</td>
              <td style={cell(size, { textAlign: 'start' })}>
                <b>{l.name}</b>
                {thermal && <div style={{ color: ink2 }}>{[l.fabricType, l.color].filter(Boolean).join(' — ')}</div>}
                {!thermal && (l.code || l.brand) && <div style={{ color: ink2, fontSize: 11 }}>{[l.code, l.brand, l.origin].filter(Boolean).join(' | ')}</div>}
              </td>
              {!thermal && <td style={cell(size)}>{l.fabricType || '—'}</td>}
              {!thermal && <td style={cell(size)}>{l.color || '—'}{l.colorCode && <div style={{ fontSize: 11, color: ink2 }}>{l.colorCode}</div>}</td>}
              {!thermal && hasCartons && <td style={cell(size)}>{l.cartons ? fmtNum(l.cartons) : '—'}</td>}
              {!thermal && hasBolts && <td style={cell(size)}>{l.bolts ? fmtNum(l.bolts) : '—'}</td>}
              <td style={cell(size)}>{fmtNum(l.qty)} {l.unit}</td>
              {!thermal && <td style={cell(size)}>{fmtNum(l.baseQty)} {l.baseUnit}</td>}
              <td style={cell(size)}>{fmtNum(l.unitPrice)}</td>
              {!thermal && <td style={cell(size)}>{fmtNum(l.total)}</td>}
              {!thermal && hasDisc && <td style={cell(size)}>{l.discount ? fmtNum(l.discount) : '—'}</td>}
              <td style={cell(size, { fontWeight: 700 })}>{fmtNum(l.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 18, marginTop: 14, flexDirection: thermal ? 'column' : 'row' }} className="avoid-break">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!thermal && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Box label="وسيلة الدفع" value={inv.paymentMethod || '—'} />
              <Box label="موعد الاستحقاق" value={inv.saleType === 'credit' ? fmtDate(inv.dueDate) : '—'} />
              <Box label="اسم البائع" value={inv.sellerName || '—'} />
              <Box label="إجمالي الكمية" value={summarizeQty(inv)} />
            </div>
          )}
          {(inv.notes || inv.deliveryNotes) && (
            <div style={{ border: `1px solid ${line}`, borderRadius: 10, padding: '6px 10px' }}>
              {inv.notes && <div><b>ملاحظات البيع:</b> {inv.notes}</div>}
              {inv.deliveryNotes && <div><b>ملاحظات التسليم:</b> {inv.deliveryNotes}</div>}
            </div>
          )}
        </div>
        <div style={{ width: thermal ? '100%' : 300 }}>
          <SumRow k="إجمالي الفاتورة قبل الخصم" v={fmtMoney(inv.subtotal)} />
          {inv.totalDiscount > 0 && <SumRow k="إجمالي الخصومات" v={fmtMoney(inv.totalDiscount)} />}
          {inv.extraFees > 0 && <SumRow k="رسوم إضافية" v={fmtMoney(inv.extraFees)} />}
          <div style={{ background: thermal ? 'transparent' : mix(c, '#ffffff', 0.88), borderRadius: 8, padding: thermal ? 0 : '2px 8px', margin: '4px 0' }}>
            <SumRow k="صافي قيمة الفاتورة" v={fmtMoney(inv.net)} strong color={thermal ? ink : c} />
          </div>
          <SumRow k="المبلغ المدفوع" v={fmtMoney(info.paid)} />
          {info.returned > 0 && <SumRow k="مرتجعات" v={fmtMoney(info.returned)} />}
          <SumRow k="المتبقي من الفاتورة" v={fmtMoney(info.remaining)} strong />
          {s.showPrevBalanceOnInvoice && inv.state === 'approved' && (
            <>
              <SumRow k="الرصيد السابق للعميل" v={fmtMoney(inv.prevBalance)} />
              <div style={{ background: thermal ? 'transparent' : mix(acc, '#ffffff', 0.86), borderRadius: 8, padding: thermal ? 0 : '2px 8px', marginTop: 4 }}>
                <SumRow k="إجمالي المستحق على العميل" v={fmtMoney(totalDue)} strong color={thermal ? ink : mix(acc, '#000000', 0.15)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />
      {thermal ? (
        <div style={{ marginTop: 10, borderTop: `1px dashed ${ink}`, paddingTop: 6, textAlign: 'center' }}>
          <div>البائع: {inv.sellerName} — الدفع: {inv.paymentMethod}</div>
          <div style={{ marginTop: 16 }}>توقيع المستلم: ..................</div>
          {s.invoiceFooter && <div style={{ marginTop: 6 }}>{s.invoiceFooter}</div>}
        </div>
      ) : (
        <div className="avoid-break" style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
            <Sign label="توقيع البائع" name={inv.sellerName} />
            <Sign label="توقيع المستلم" />
            <Sign label="الختم" />
          </div>
          {s.invoiceFooter && (
            <div style={{ marginTop: 18, textAlign: 'center', color: ink2, borderTop: `3px solid ${c}`, paddingTop: 8, fontSize: 12 }}>{s.invoiceFooter}</div>
          )}
        </div>
      )}
    </Paper>
  );
}

function summarizeQty(inv: Invoice) {
  const m = new Map<string, number>();
  for (const l of inv.lines) m.set(l.baseUnit, (m.get(l.baseUnit) ?? 0) + l.baseQty);
  return [...m].map(([u, q]) => `${fmtNum(q)} ${u}`).join(' + ') || '—';
}

const round = (n: number) => Math.round(n * 100) / 100;

function Box({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${line}`, borderRadius: 10, padding: '4px 10px' }}>
      <div style={{ fontSize: 11, color: ink2 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Sign({ label, name }: { label: string; name?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ height: 44 }} />
      <div style={{ borderTop: `1px solid ${ink2}`, paddingTop: 2, color: ink2, fontSize: 12 }}>{name || ' '}</div>
    </div>
  );
}

export function ReceiptDoc({
  p,
  customer,
  s,
  invoiceNumbers,
  balanceAfter,
  size,
}: {
  p: Payment;
  customer?: Customer;
  s: Settings;
  invoiceNumbers: Map<number, string>;
  balanceAfter: number;
  size: 'a4' | 'thermal';
}) {
  const c = s.invoiceColor;
  const thermal = size === 'thermal';
  const allocated = p.allocations.reduce((a, x) => a + x.amount, 0);
  return (
    <Paper size={size}>
      <Header s={s} title="سند قبض" number={p.number} date={p.date} size={size} />
      {p.reversed ? (
        <div style={{ border: '2px solid #c62828', color: '#c62828', textAlign: 'center', fontWeight: 800, padding: 4, borderRadius: 8, marginBottom: 10 }}>
          سند معكوس {p.reverseReason && `— ${p.reverseReason}`}
        </div>
      ) : null}
      <div style={{ fontSize: thermal ? 12 : 15, lineHeight: 2.1 }}>
        <div>استلمنا من: <b>{customer?.name}</b> {customer?.phone && <span dir="ltr">({customer.phone})</span>}</div>
        <div>
          مبلغًا وقدره: <b style={{ fontSize: thermal ? 14 : 20, color: thermal ? ink : c }}>{fmtMoney(p.amount)}</b>
        </div>
        <div>طريقة الدفع: <b>{p.method}</b></div>
        {p.notes && <div>وذلك عن: {p.notes}</div>}
      </div>
      {p.allocations.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ background: thermal ? 'transparent' : mix(c, '#ffffff', 0.85) }}>
              <th style={cell(size)}>الفاتورة</th>
              <th style={cell(size)}>المبلغ المخصص</th>
            </tr>
          </thead>
          <tbody>
            {p.allocations.map((a) => (
              <tr key={a.invoiceId}>
                <td style={cell(size)}>{invoiceNumbers.get(a.invoiceId) ?? a.invoiceId}</td>
                <td style={cell(size)}>{fmtMoney(a.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 12, width: thermal ? '100%' : 320 }}>
        {p.amount - allocated > 0.009 && <SumRow k="رصيد دائن غير موزع" v={fmtMoney(p.amount - allocated)} />}
        <SumRow k="رصيد العميل بعد السداد" v={fmtMoney(balanceAfter)} strong />
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 30 }}>
        <Sign label="المستلم" name={p.createdBy} />
        {!thermal && <Sign label="الدافع" name={customer?.name} />}
      </div>
    </Paper>
  );
}

export function ReturnDoc({ r, inv, customer, s, size }: { r: SaleReturn; inv?: Invoice; customer?: Customer; s: Settings; size: 'a4' | 'thermal' }) {
  return (
    <Paper size={size}>
      <Header s={s} title="إشعار مرتجع مبيعات" number={r.number} date={r.date} size={size} />
      <div>العميل: <b>{customer?.name}</b> — على الفاتورة: <b>{inv?.number}</b></div>
      <div>السبب: {r.reason || '—'} — حالة البضاعة: {r.condition === 'restock' ? 'سليمة (أعيدت للمخزون)' : 'تالفة'}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
        <thead>
          <tr style={{ background: mix(s.invoiceColor, '#ffffff', 0.85) }}>
            <th style={cell(size)}>الصنف</th>
            <th style={cell(size)}>الكمية</th>
            <th style={cell(size)}>سعر الوحدة</th>
            <th style={cell(size)}>القيمة</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i}>
              <td style={cell(size)}>{l.name}</td>
              <td style={cell(size)}>{fmtNum(l.qty)} {l.unit}</td>
              <td style={cell(size)}>{fmtNum(l.unitNet)}</td>
              <td style={cell(size)}>{fmtNum(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, width: size === 'thermal' ? '100%' : 320 }}>
        <SumRow k="إجمالي المرتجع" v={fmtMoney(r.total)} strong />
        {r.refundAmount > 0 && <SumRow k={`مبلغ مردود (${r.refundMethod})`} v={fmtMoney(r.refundAmount)} />}
      </div>
    </Paper>
  );
}

export function StatementDoc({
  customer,
  rows,
  s,
  from,
  to,
  balance,
}: {
  customer: Customer;
  rows: StatementRow[];
  s: Settings;
  from?: number;
  to?: number;
  balance: number;
}) {
  const c = s.invoiceColor;
  const debit = rows.reduce((a, r) => a + r.debit, 0);
  const credit = rows.reduce((a, r) => a + r.credit, 0);
  return (
    <Paper size="a4">
      <Header s={s} title="كشف حساب عميل" number={customer.code} date={Date.now()} size="a4" />
      <InfoGrid
        color={c}
        items={[
          ['العميل', customer.name],
          ['الهاتف', customer.phone],
          ['المنطقة', customer.city],
          ['من تاريخ', from ? fmtDate(from) : 'البداية'],
          ['إلى تاريخ', to ? fmtDate(to) : fmtDate(Date.now())],
          ['الرصيد الحالي', fmtMoney(balance)],
        ]}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: c, color: onColor(c) }}>
            <th style={cell('a4')}>التاريخ</th>
            <th style={cell('a4')}>المرجع</th>
            <th style={cell('a4', { textAlign: 'start' })}>البيان</th>
            <th style={cell('a4')}>مدين (عليه)</th>
            <th style={cell('a4')}>دائن (له)</th>
            <th style={cell('a4')}>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? mix(c, '#ffffff', 0.94) : undefined }}>
              <td style={cell('a4')}>{fmtDate(r.date)}</td>
              <td style={cell('a4')}>{r.ref}</td>
              <td style={cell('a4', { textAlign: 'start' })}>{r.description}</td>
              <td style={cell('a4')}>{r.debit ? fmtNum(r.debit) : '—'}</td>
              <td style={cell('a4')}>{r.credit ? fmtNum(r.credit) : '—'}</td>
              <td style={cell('a4', { fontWeight: 700 })}>{fmtNum(r.balance)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800, background: mix(c, '#ffffff', 0.85) }}>
            <td style={cell('a4')} colSpan={3}>الإجمالي</td>
            <td style={cell('a4')}>{fmtNum(debit)}</td>
            <td style={cell('a4')}>{fmtNum(credit)}</td>
            <td style={cell('a4')}>{fmtNum(rows.length ? rows[rows.length - 1].balance : 0)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ flex: 1 }} />
      <div style={{ marginTop: 20, textAlign: 'center', color: ink2, fontSize: 12 }}>
        الرصيد الموجب = مستحق على العميل، والسالب = رصيد دائن للعميل
      </div>
    </Paper>
  );
}

export interface ReportTable {
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | number)[][];
  foot?: (string | number)[];
  summary?: [string, string][];
}

export function ReportDoc({ s, report }: { s: Settings; report: ReportTable }) {
  const c = s.invoiceColor;
  return (
    <Paper size="a4">
      <Header s={s} title={report.title} number={report.subtitle ?? ''} date={Date.now()} size="a4" />
      {report.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {report.summary.map(([k, v]) => (
            <Box key={k} label={k} value={v} />
          ))}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: c, color: onColor(c) }}>
            {report.head.map((h) => (
              <th key={h} style={cell('a4')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? mix(c, '#ffffff', 0.94) : undefined }}>
              {r.map((v, j) => (
                <td key={j} style={cell('a4')}>{typeof v === 'number' ? fmtNum(v) : v}</td>
              ))}
            </tr>
          ))}
          {report.foot && (
            <tr style={{ fontWeight: 800, background: mix(c, '#ffffff', 0.85) }}>
              {report.foot.map((v, j) => (
                <td key={j} style={cell('a4')}>{typeof v === 'number' ? fmtNum(v) : v}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </Paper>
  );
}
