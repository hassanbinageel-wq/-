import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDB, useDatabase, db, type InvoiceLine } from '../../src/db/schema';
import * as svc from '../../src/db/service';
import { customerBalance, customerStatement, invoiceStatus, profitSummary, unallocatedCredit, computeInvoiceTotals } from '../../src/lib/calc';

let n = 0;
beforeEach(async () => {
  useDatabase(new AppDB('test-' + ++n));
  await svc.ensureSeed();
  await svc.login('admin', '1234');
});

const line = (p: any, unit: string, qty: number, unitPrice: number, discount = 0): InvoiceLine => {
  const u = p.units.find((x: any) => x.name === unit);
  return {
    productId: p.id, name: p.name, brand: '', fabricType: p.fabricType, origin: '', color: p.color, colorCode: '', code: p.code,
    baseUnit: p.baseUnit, unit, factor: u.factor, cartons: 0, bolts: 0, qty, baseQty: 0, unitPrice, total: 0, discount, net: 0, unitCost: 0,
  };
};

async function setup() {
  const cid = await svc.saveCustomer({ name: 'أحمد', phone: '777', city: 'صنعاء', address: '', creditLimit: 0, openingBalance: 0, notes: '' });
  const pid = await svc.saveProduct({
    name: 'قماش ياباني', fabricType: 'ياباني', baseUnit: 'ياردة',
    units: [{ name: 'طاقة', factor: 30 }, { name: 'كرتون', factor: 300 }],
    cost: 1000, price: 1500, lowStock: 100, openingStock: 3000,
  });
  return { cid, product: (await db.products.get(pid))! };
}

const base = (cid: number, lines: InvoiceLine[], extra: Partial<svc.InvoiceInput> = {}): svc.InvoiceInput => ({
  date: Date.now(), customerId: cid, saleType: 'credit', dueDate: Date.now() + 86400000 * 30, sellerName: 'المدير',
  paymentMethod: 'نقدًا', notes: '', deliveryNotes: '', lines, invoiceDiscount: 0, extraFees: 0, paidAtIssue: 0, ...extra,
});

async function snapshot(cid: number) {
  const [c, inv, pay, ret] = await Promise.all([db.customers.get(cid), db.invoices.toArray(), db.payments.toArray(), db.returns.toArray()]);
  return { c: c!, inv, pay, ret, balance: customerBalance(c!, inv, pay, ret) };
}

describe('حسابات الفاتورة', () => {
  it('يحسب الإجماليات والخصومات والرسوم', () => {
    const l = (q: number, p: number, d: number) => ({ qty: q, unitPrice: p, discount: d, factor: 1 }) as any;
    const t = computeInvoiceTotals([l(2, 100, 10), l(3, 50, 0)], 40, 25);
    expect(t).toEqual({ subtotal: 350, lineDiscounts: 10, totalDiscount: 50, net: 325 });
  });
});

describe('دورة البيع والتحصيل', () => {
  it('مثال 500,000 − 200,000 − 100,000 = 200,000', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 1000, 500)]));
    expect(inv.net).toBe(500000);
    expect(inv.number).toBe('INV-00001');
    const open1 = await svc.openInvoicesFor(cid);
    await svc.savePayment({ customerId: cid, amount: 200000, date: Date.now(), method: 'نقدًا', allocations: [{ invoiceId: inv.id!, amount: 200000 }], notes: '' });
    await svc.savePayment({ customerId: cid, amount: 100000, date: Date.now(), method: 'تحويل', allocations: [{ invoiceId: inv.id!, amount: 100000 }], notes: '' });
    expect(open1[0].remaining).toBe(500000);
    const s = await snapshot(cid);
    expect(s.balance).toBe(200000);
    const st = invoiceStatus(s.inv[0], s.pay, s.ret);
    expect(st.status).toBe('partial');
    expect(st.remaining).toBe(200000);
    const rows = customerStatement(s.c, s.inv, s.pay, s.ret);
    expect(rows.map((r) => r.balance)).toEqual([500000, 300000, 200000]);
  });

  it('يخصم المخزون بالتحويل الصحيح للوحدات', async () => {
    const { cid, product } = await setup();
    await svc.approveInvoice(base(cid, [line(product, 'كرتون', 2, 400000), line(product, 'طاقة', 3, 40000)]));
    const p = await db.products.get(product.id!);
    expect(p!.stock).toBe(3000 - 600 - 90);
    const moves = await db.stockMoves.where('productId').equals(product.id!).toArray();
    expect(moves.map((m) => m.qty)).toEqual([3000, -600, -90]);
    expect(moves[2].before).toBe(2400);
    expect(moves[2].after).toBe(2310);
  });

  it('الدفع عند الإصدار يُسجَّل مرة واحدة فقط ولا يتكرر في الرصيد', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 100, 1500)], { saleType: 'cash', paidAtIssue: 150000 }));
    const s = await snapshot(cid);
    expect(s.pay.length).toBe(1);
    expect(s.balance).toBe(0);
    expect(invoiceStatus(inv, s.pay, s.ret).status).toBe('paid');
  });

  it('يرفض التوزيع الزائد على فاتورة', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 10, 1000)]));
    await expect(
      svc.savePayment({ customerId: cid, amount: 20000, date: Date.now(), method: 'نقدًا', allocations: [{ invoiceId: inv.id!, amount: 20000 }], notes: '' }),
    ).rejects.toThrow();
  });

  it('الدفعة غير المخصصة تبقى رصيدًا دائنًا ولا تُخصم من فاتورة عشوائيًا', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 10, 1000)]));
    const p = await svc.savePayment({ customerId: cid, amount: 4000, date: Date.now(), method: 'نقدًا', allocations: [], notes: '' });
    let s = await snapshot(cid);
    expect(s.balance).toBe(6000);
    expect(invoiceStatus(inv, s.pay, s.ret).remaining).toBe(10000);
    expect(unallocatedCredit(cid, s.pay)).toBe(4000);
    await svc.allocateCredit(p.id!, inv.id!, 4000);
    s = await snapshot(cid);
    expect(invoiceStatus(inv, s.pay, s.ret).remaining).toBe(6000);
    expect(s.balance).toBe(6000);
  });

  it('عكس الدفعة يعيد الرصيد مع بقاء السجل', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 10, 1000)]));
    const p = await svc.savePayment({ customerId: cid, amount: 5000, date: Date.now(), method: 'نقدًا', allocations: [{ invoiceId: inv.id!, amount: 5000 }], notes: '' });
    await svc.reversePayment(p.id!, 'خطأ إدخال');
    const s = await snapshot(cid);
    expect(s.balance).toBe(10000);
    expect(s.pay.length).toBe(1);
    const rows = customerStatement(s.c, s.inv, s.pay, s.ret);
    expect(rows[rows.length - 1].balance).toBe(10000);
  });

  it('الإلغاء يعيد المخزون ويحول الدفعات لرصيد دائن', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 100, 1000)], { paidAtIssue: 30000 }));
    await svc.cancelInvoice(inv.id!, 'طلب العميل');
    const s = await snapshot(cid);
    expect(s.balance).toBe(-30000);
    expect(unallocatedCredit(cid, s.pay)).toBe(30000);
    expect((await db.products.get(product.id!))!.stock).toBe(3000);
    expect(s.inv[0].state).toBe('cancelled');
  });

  it('المرتجع يخفض المديونية ويمنع إرجاع أكثر من المباع', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 100, 1000, 10000)], { invoiceDiscount: 9000 }));
    expect(inv.net).toBe(81000);
    const r = await svc.createReturn({ invoiceId: inv.id!, date: Date.now(), lines: [{ lineIndex: 0, qty: 50 }], reason: 'عيب', condition: 'restock', settlement: 'credit', refundMethod: 'نقدًا' });
    expect(r.total).toBe(40500);
    await expect(
      svc.createReturn({ invoiceId: inv.id!, date: Date.now(), lines: [{ lineIndex: 0, qty: 51 }], reason: '', condition: 'restock', settlement: 'credit', refundMethod: 'نقدًا' }),
    ).rejects.toThrow();
    const s = await snapshot(cid);
    expect(s.balance).toBe(40500);
    expect((await db.products.get(product.id!))!.stock).toBe(3000 - 100 + 50);
  });

  it('رد المبلغ نقدًا لفاتورة مدفوعة بالكامل', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 10, 1000)], { saleType: 'cash', paidAtIssue: 10000 }));
    const r = await svc.createReturn({ invoiceId: inv.id!, date: Date.now(), lines: [{ lineIndex: 0, qty: 4 }], reason: '', condition: 'damaged', settlement: 'refund', refundMethod: 'نقدًا' });
    expect(r.refundAmount).toBe(4000);
    const s = await snapshot(cid);
    expect(s.balance).toBe(0);
    expect((await db.products.get(product.id!))!.stock).toBe(2990); // التالف لا يعود للمخزون
  });

  it('الربح = صافي المبيعات − تكلفة البضاعة − المصروفات', async () => {
    const { cid, product } = await setup();
    await svc.approveInvoice(base(cid, [line(product, 'ياردة', 100, 1500)]));
    await svc.saveExpense({ date: Date.now(), category: 'نقل', amount: 5000, method: 'نقدًا', notes: '' });
    const p = profitSummary(await db.invoices.toArray(), await db.returns.toArray(), await db.expenses.toArray());
    expect(p).toMatchObject({ netSales: 150000, cogs: 100000, grossProfit: 50000, expenses: 5000, netProfit: 45000 });
  });

  it('تعديل فاتورة معتمدة يصحح المخزون ويقلص التوزيع الزائد', async () => {
    const { cid, product } = await setup();
    const inv = await svc.approveInvoice(base(cid, [line(product, 'ياردة', 100, 1000)], { paidAtIssue: 80000 }));
    await svc.editApprovedInvoice(inv.id!, base(cid, [line(product, 'ياردة', 50, 1000)]));
    const s = await snapshot(cid);
    expect((await db.products.get(product.id!))!.stock).toBe(2950);
    expect(invoiceStatus(s.inv[0], s.pay, s.ret).status).toBe('paid');
    expect(unallocatedCredit(cid, s.pay)).toBe(30000);
    expect(s.balance).toBe(-30000);
  });

  it('المشتريات تزيد المخزون وتحدث متوسط التكلفة وحساب المورد', async () => {
    const { product } = await setup();
    const sid = await svc.saveSupplier({ name: 'مورد', phone: '', address: '', openingBalance: 0, notes: '' });
    await svc.savePurchase({
      supplierId: sid, supplierInvoiceNo: 'A1', date: Date.now(), extraCosts: 30000, paid: 100000, method: 'نقدًا', notes: '',
      lines: [{ productId: product.id!, name: product.name, unit: 'كرتون', factor: 300, qty: 10, baseQty: 0, unitCost: 297000, total: 0 }],
    });
    const p = (await db.products.get(product.id!))!;
    expect(p.stock).toBe(6000);
    expect(p.cost).toBe(1000); // (3000×1000 + 3000×1000) / 6000
    const { supplierBalance } = await import('../../src/lib/calc');
    expect(supplierBalance((await db.suppliers.get(sid))!, await db.purchases.toArray(), await db.supplierPayments.toArray())).toBe(2900000);
  });

  it('صلاحيات الموظف تمنع العمليات الحساسة', async () => {
    const { cid, product } = await setup();
    await svc.saveUser({ name: 'موظف', username: 'emp', pin: '1111', role: 'staff', permissions: ['view', 'invoice_create'], active: true });
    await svc.login('emp', '1111');
    await expect(svc.approveInvoice(base(cid, [line(product, 'ياردة', 1, 1500)]))).rejects.toThrow('اعتماد');
    await expect(svc.reversePayment(1, 'x')).rejects.toThrow();
    const id = await svc.saveDraft(base(cid, [line(product, 'ياردة', 1, 1500)]));
    expect((await db.invoices.get(id))!.state).toBe('draft');
  });

  it('النسخ الاحتياطي والاستعادة يعيدان نفس البيانات', async () => {
    const { cid, product } = await setup();
    await svc.approveInvoice(base(cid, [line(product, 'ياردة', 10, 1000)]));
    const dump = JSON.parse(JSON.stringify(await svc.exportAll()));
    useDatabase(new AppDB('restore-' + n));
    await svc.ensureSeed();
    await svc.importAll(dump, true);
    expect(await db.invoices.count()).toBe(1);
    expect((await db.products.get(product.id!))!.stock).toBe(2990);
    const s = await snapshot(cid);
    expect(s.balance).toBe(10000);
  });
});
