// منطق الحسابات المالية — دوال صافية بدون قاعدة بيانات حتى يسهل اختبارها
import type {
  Customer,
  Invoice,
  InvoiceLine,
  Payment,
  Purchase,
  SaleReturn,
  Supplier,
  SupplierPayment,
} from '../db/schema';

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);

export function computeLine(line: InvoiceLine): InvoiceLine {
  const qty = num(line.qty);
  const factor = num(line.factor) || 1;
  const total = round2(qty * num(line.unitPrice));
  const discount = Math.min(round2(num(line.discount)), total);
  return {
    ...line,
    qty,
    factor,
    baseQty: round2(qty * factor),
    total,
    discount,
    net: round2(total - discount),
  };
}

export interface InvoiceTotals {
  subtotal: number;
  lineDiscounts: number;
  totalDiscount: number;
  net: number;
}

/** صافي الفاتورة = إجمالي الأصناف − الخصومات + الرسوم الإضافية */
export function computeInvoiceTotals(lines: InvoiceLine[], invoiceDiscount: number, extraFees: number): InvoiceTotals {
  const computed = lines.map(computeLine);
  const subtotal = round2(computed.reduce((s, l) => s + l.total, 0));
  const lineDiscounts = round2(computed.reduce((s, l) => s + l.discount, 0));
  const afterLines = round2(subtotal - lineDiscounts);
  const invDisc = Math.min(round2(num(invoiceDiscount)), afterLines);
  const totalDiscount = round2(lineDiscounts + invDisc);
  const net = round2(subtotal - totalDiscount + num(extraFees));
  return { subtotal, lineDiscounts, totalDiscount, net };
}

export const activePayments = (payments: Payment[]) => payments.filter((p) => !p.reversed);

/** مجموع الدفعات المخصصة لفاتورة معينة (الدفعات المعكوسة لا تُحتسب) */
export function invoicePaid(invoiceId: number, payments: Payment[]): number {
  let s = 0;
  for (const p of payments) {
    if (p.reversed) continue;
    for (const a of p.allocations) if (a.invoiceId === invoiceId) s += num(a.amount);
  }
  return round2(s);
}

export function invoiceReturned(invoiceId: number, returns: SaleReturn[]): number {
  return round2(returns.filter((r) => r.invoiceId === invoiceId).reduce((s, r) => s + num(r.total), 0));
}

/** المتبقي من الفاتورة = الصافي − الدفعات المخصصة − المرتجعات المعتمدة */
export function invoiceRemaining(inv: Invoice, paid: number, returned: number): number {
  if (inv.state !== 'approved') return 0;
  return Math.max(0, round2(inv.net - paid - returned));
}

export type PayStatus = 'draft' | 'cancelled' | 'paid' | 'partial' | 'unpaid';

export interface InvoiceStatusInfo {
  status: PayStatus;
  paid: number;
  returned: number;
  remaining: number;
  overdue: boolean;
  returnState: 'none' | 'partial' | 'full';
}

export function invoiceStatus(
  inv: Invoice,
  payments: Payment[],
  returns: SaleReturn[],
  now = Date.now(),
): InvoiceStatusInfo {
  const paid = inv.id ? invoicePaid(inv.id, payments) : 0;
  const returned = inv.id ? invoiceReturned(inv.id, returns) : 0;
  const remaining = invoiceRemaining(inv, paid, returned);
  let status: PayStatus;
  if (inv.state === 'draft') status = 'draft';
  else if (inv.state === 'cancelled') status = 'cancelled';
  else if (remaining <= 0.009) status = 'paid';
  else if (paid > 0 || returned > 0) status = 'partial';
  else status = 'unpaid';
  const overdue = status !== 'paid' && inv.state === 'approved' && !!inv.dueDate && inv.dueDate < now && remaining > 0;
  const returnState = returned <= 0 ? 'none' : returned >= inv.net - 0.009 ? 'full' : 'partial';
  return { status, paid, returned, remaining, overdue, returnState };
}

/**
 * رصيد العميل = الرصيد الافتتاحي + الفواتير المعتمدة − كل الدفعات غير المعكوسة − المرتجعات + المبالغ المردودة نقدًا
 * (الدفعة تُحتسب مرة واحدة بقيمتها الكاملة بغض النظر عن توزيعها على الفواتير)
 */
export function customerBalance(
  customer: Pick<Customer, 'id' | 'openingBalance'>,
  invoices: Invoice[],
  payments: Payment[],
  returns: SaleReturn[],
): number {
  const cid = customer.id;
  const inv = invoices.filter((i) => i.customerId === cid && i.state === 'approved').reduce((s, i) => s + num(i.net), 0);
  const pay = payments.filter((p) => p.customerId === cid && !p.reversed).reduce((s, p) => s + num(p.amount), 0);
  const ret = returns.filter((r) => r.customerId === cid).reduce((s, r) => s + num(r.total), 0);
  const refunds = returns.filter((r) => r.customerId === cid).reduce((s, r) => s + num(r.refundAmount), 0);
  return round2(num(customer.openingBalance) + inv - pay - ret + refunds);
}

/** الدفعات غير الموزعة (رصيد دائن للعميل) */
export function unallocatedCredit(customerId: number, payments: Payment[]): number {
  return round2(
    payments
      .filter((p) => p.customerId === customerId && !p.reversed)
      .reduce((s, p) => s + num(p.amount) - p.allocations.reduce((a, x) => a + num(x.amount), 0), 0),
  );
}

export interface StatementRow {
  date: number;
  kind: 'opening' | 'invoice' | 'payment' | 'payment_reversal' | 'return' | 'refund';
  ref: string;
  refId?: number;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

/** كشف حساب العميل مرتب زمنيًا مع الرصيد بعد كل حركة */
export function customerStatement(
  customer: Customer,
  invoices: Invoice[],
  payments: Payment[],
  returns: SaleReturn[],
  from?: number,
  to?: number,
): StatementRow[] {
  const rows: Omit<StatementRow, 'balance'>[] = [];
  if (num(customer.openingBalance) !== 0) {
    rows.push({
      date: customer.createdAt,
      kind: 'opening',
      ref: '—',
      description: 'رصيد افتتاحي',
      debit: Math.max(0, customer.openingBalance),
      credit: Math.max(0, -customer.openingBalance),
    });
  }
  for (const i of invoices) {
    if (i.customerId !== customer.id || i.state !== 'approved') continue;
    rows.push({
      date: i.date,
      kind: 'invoice',
      ref: i.number,
      refId: i.id,
      description: `فاتورة ${i.saleType === 'cash' ? 'نقدية' : 'آجلة'}`,
      debit: i.net,
      credit: 0,
    });
  }
  for (const p of payments) {
    if (p.customerId !== customer.id) continue;
    rows.push({
      date: p.date,
      kind: 'payment',
      ref: p.number,
      refId: p.id,
      description: p.source === 'invoice' ? `دفعة عند إصدار الفاتورة (${p.method})` : `سند قبض (${p.method})`,
      debit: 0,
      credit: p.amount,
    });
    if (p.reversed) {
      rows.push({
        date: p.reversedAt || p.date,
        kind: 'payment_reversal',
        ref: p.number,
        refId: p.id,
        description: `عكس دفعة${p.reverseReason ? ' — ' + p.reverseReason : ''}`,
        debit: p.amount,
        credit: 0,
      });
    }
  }
  for (const r of returns) {
    if (r.customerId !== customer.id) continue;
    rows.push({ date: r.date, kind: 'return', ref: r.number, refId: r.id, description: 'مرتجع مبيعات', debit: 0, credit: r.total });
    if (num(r.refundAmount) > 0) {
      rows.push({
        date: r.date,
        kind: 'refund',
        ref: r.number,
        refId: r.id,
        description: `رد مبلغ للعميل (${r.refundMethod})`,
        debit: r.refundAmount,
        credit: 0,
      });
    }
  }
  const order: Record<StatementRow['kind'], number> = { opening: 0, invoice: 1, payment: 2, return: 3, refund: 4, payment_reversal: 5 };
  rows.sort((a, b) => a.date - b.date || order[a.kind] - order[b.kind]);
  let bal = 0;
  const all = rows.map((r) => {
    bal = round2(bal + r.debit - r.credit);
    return { ...r, balance: bal };
  });
  if (from == null && to == null) return all;
  const before = all.filter((r) => from != null && r.date < from);
  const opening = before.length ? before[before.length - 1].balance : 0;
  const inRange = all.filter((r) => (from == null || r.date >= from) && (to == null || r.date <= to));
  return from != null
    ? [{ date: from, kind: 'opening', ref: '—', description: 'رصيد ما قبل الفترة', debit: 0, credit: 0, balance: opening }, ...inRange]
    : inRange;
}

/** نسبة توزيع خصم/رسوم الفاتورة على سطورها (لحساب قيمة المرتجع بدقة) */
export function invoiceLineRatio(inv: Pick<Invoice, 'net' | 'extraFees' | 'subtotal' | 'lineDiscounts'>): number {
  const base = round2(inv.subtotal - inv.lineDiscounts);
  if (base <= 0) return 1;
  return (inv.net - num(inv.extraFees)) / base;
}

/** الكمية المتاحة للإرجاع لكل سطر */
export function returnableQty(inv: Invoice, returns: SaleReturn[]): number[] {
  return inv.lines.map((l, idx) => {
    const done = returns
      .filter((r) => r.invoiceId === inv.id)
      .reduce((s, r) => s + r.lines.filter((x) => x.lineIndex === idx).reduce((a, x) => a + num(x.qty), 0), 0);
    return round2(Math.max(0, l.qty - done));
  });
}

/** توزيع تلقائي لمبلغ على الفواتير المفتوحة — الأقدم أولًا */
export function autoAllocate(amount: number, open: { invoiceId: number; remaining: number }[]) {
  let left = round2(amount);
  const out: { invoiceId: number; amount: number }[] = [];
  for (const o of open) {
    if (left <= 0) break;
    const a = Math.min(left, o.remaining);
    if (a > 0) {
      out.push({ invoiceId: o.invoiceId, amount: round2(a) });
      left = round2(left - a);
    }
  }
  return out;
}

export function supplierBalance(
  supplier: Pick<Supplier, 'id' | 'openingBalance'>,
  purchases: Purchase[],
  payments: SupplierPayment[],
): number {
  const p = purchases.filter((x) => x.supplierId === supplier.id && x.state === 'approved').reduce((s, x) => s + x.total, 0);
  const paid = payments.filter((x) => x.supplierId === supplier.id && !x.reversed).reduce((s, x) => s + x.amount, 0);
  return round2(num(supplier.openingBalance) + p - paid);
}

export function purchasePaid(purchaseId: number, payments: SupplierPayment[]) {
  return round2(payments.filter((p) => p.purchaseId === purchaseId && !p.reversed).reduce((s, p) => s + p.amount, 0));
}

/** متوسط التكلفة المرجّح عند إضافة كمية جديدة */
export function weightedCost(oldStock: number, oldCost: number, addQty: number, addCost: number) {
  const s = Math.max(0, oldStock);
  if (s + addQty <= 0) return addCost;
  return round2((s * oldCost + addQty * addCost) / (s + addQty));
}

export interface ProfitSummary {
  sales: number; // صافي فواتير الفترة
  returns: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

/** الربح = صافي المبيعات − تكلفة البضاعة المباعة؛ صافي الربح = مجمل الربح − المصروفات */
export function profitSummary(
  invoices: Invoice[],
  returns: SaleReturn[],
  expenses: { amount: number; reversed?: 0 | 1 }[],
): ProfitSummary {
  const approved = invoices.filter((i) => i.state === 'approved');
  const sales = round2(approved.reduce((s, i) => s + i.net, 0));
  const ret = round2(returns.reduce((s, r) => s + r.total, 0));
  const cogsOut = approved.reduce((s, i) => s + i.lines.reduce((a, l) => a + l.baseQty * num(l.unitCost), 0), 0);
  const cogsBack = returns.reduce((s, r) => s + r.lines.reduce((a, l) => a + l.baseQty * num(l.unitCost), 0), 0);
  const cogs = round2(cogsOut - cogsBack);
  const netSales = round2(sales - ret);
  const grossProfit = round2(netSales - cogs);
  const exp = round2(expenses.filter((e) => !e.reversed).reduce((s, e) => s + e.amount, 0));
  return { sales, returns: ret, netSales, cogs, grossProfit, expenses: exp, netProfit: round2(grossProfit - exp) };
}
