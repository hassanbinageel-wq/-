// كل العمليات التي تكتب في قاعدة البيانات — كل عملية مترابطة تتم داخل معاملة واحدة (transaction)
import {
  db,
  DEFAULT_SETTINGS,
  ALL_PERMISSIONS,
  TABLES,
  type Allocation,
  type CashEntry,
  type Customer,
  type Expense,
  type ID,
  type Invoice,
  type InvoiceLine,
  type Payment,
  type Permission,
  type Product,
  type Purchase,
  type PurchaseLine,
  type ReturnLine,
  type SaleReturn,
  type Settings,
  type StockMoveType,
  type Supplier,
  type SupplierPayment,
  type User,
} from './schema';
import {
  computeInvoiceTotals,
  computeLine,
  customerBalance,
  invoiceLineRatio,
  invoicePaid,
  invoiceReturned,
  purchasePaid,
  returnableQty,
  round2,
  weightedCost,
} from '../lib/calc';

// ---------------- الجلسة ----------------
let sessionUser: User | null = null;
export const setSessionUser = (u: User | null) => (sessionUser = u);
export const getSessionUser = () => sessionUser;
const who = () => sessionUser?.name ?? 'النظام';

export class AppError extends Error {}

export function can(p: Permission, u: User | null = sessionUser): boolean {
  if (!u) return false;
  if (u.role === 'admin') return true;
  return u.permissions.includes(p);
}
function need(p: Permission) {
  if (!can(p)) {
    const label = ALL_PERMISSIONS.find((x) => x.key === p)?.label ?? p;
    throw new AppError(`لا تملك صلاحية: ${label}`);
  }
}

async function audit(action: string, entity: string, entityId: ID | undefined, details: unknown = '') {
  await db.audit.add({
    ts: Date.now(),
    user: who(),
    action,
    entity,
    entityId,
    details: typeof details === 'string' ? details : JSON.stringify(details),
  });
}

async function nextNumber(key: string, prefix: string): Promise<string> {
  const c = await db.counters.get(key);
  const value = (c?.value ?? 0) + 1;
  await db.counters.put({ key, value });
  return `${prefix}${String(value).padStart(5, '0')}`;
}

// ---------------- التهيئة والإعدادات ----------------
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode('fabric-store::' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function ensureSeed() {
  const defaultPin = await hashPin('1234');
  await db.transaction('rw', db.settings, db.users, async () => {
    const s = await db.settings.get(1);
    if (!s) await db.settings.put({ ...DEFAULT_SETTINGS });
    else await db.settings.put({ ...DEFAULT_SETTINGS, ...s });
    if ((await db.users.count()) === 0) {
      await db.users.add({
        name: 'المدير',
        username: 'admin',
        pinHash: defaultPin,
        role: 'admin',
        permissions: ALL_PERMISSIONS.map((p) => p.key),
        active: true,
        createdAt: Date.now(),
      });
    }
  });
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(1)) ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(patch: Partial<Settings>, silent = false) {
  if (!silent) need('settings');
  const s = await getSettings();
  await db.settings.put({ ...s, ...patch, id: 1 });
  if (!silent) await audit('تعديل', 'الإعدادات', 1, Object.keys(patch).join('، '));
}

// ---------------- المستخدمون ----------------
export async function login(username: string, pin: string): Promise<User> {
  const u = await db.users.where('username').equals(username.trim().toLowerCase()).first();
  if (!u || !u.active || u.pinHash !== (await hashPin(pin))) throw new AppError('اسم المستخدم أو الرمز السري غير صحيح');
  setSessionUser(u);
  await audit('تسجيل دخول', 'المستخدمون', u.id);
  return u;
}

export async function saveUser(u: Omit<User, 'pinHash' | 'createdAt'> & { id?: ID; pin?: string }) {
  need('users');
  const username = u.username.trim().toLowerCase();
  if (!u.name.trim() || !username) throw new AppError('الاسم واسم المستخدم مطلوبان');
  const dup = await db.users.where('username').equals(username).first();
  if (dup && dup.id !== u.id) throw new AppError('اسم المستخدم مستخدم مسبقًا');
  if (u.id) {
    const old = await db.users.get(u.id);
    if (!old) throw new AppError('المستخدم غير موجود');
    if (old.role === 'admin' && (u.role !== 'admin' || !u.active)) {
      const admins = await db.users.filter((x) => x.role === 'admin' && x.active).count();
      if (admins <= 1) throw new AppError('يجب أن يبقى مدير واحد نشط على الأقل');
    }
    await db.users.put({
      ...old,
      name: u.name.trim(),
      username,
      role: u.role,
      permissions: u.permissions,
      active: u.active,
      pinHash: u.pin ? await hashPin(u.pin) : old.pinHash,
    });
    await audit('تعديل', 'المستخدمون', u.id, u.name);
    if (sessionUser?.id === u.id) setSessionUser((await db.users.get(u.id))!);
    return u.id;
  }
  if (!u.pin || u.pin.length < 4) throw new AppError('الرمز السري يجب أن يكون 4 أرقام على الأقل');
  const id = await db.users.add({
    name: u.name.trim(),
    username,
    role: u.role,
    permissions: u.permissions,
    active: u.active,
    pinHash: await hashPin(u.pin),
    createdAt: Date.now(),
  });
  await audit('إضافة', 'المستخدمون', id, u.name);
  return id;
}

export async function changeOwnPin(oldPin: string, newPin: string) {
  if (!sessionUser?.id) throw new AppError('لا يوجد مستخدم');
  const u = await db.users.get(sessionUser.id);
  if (!u || u.pinHash !== (await hashPin(oldPin))) throw new AppError('الرمز الحالي غير صحيح');
  if (newPin.length < 4) throw new AppError('الرمز الجديد يجب أن يكون 4 أرقام على الأقل');
  await db.users.update(u.id!, { pinHash: await hashPin(newPin) });
  await audit('تغيير الرمز السري', 'المستخدمون', u.id);
}

// ---------------- العملاء ----------------
export async function saveCustomer(c: Omit<Customer, 'id' | 'code' | 'createdAt' | 'archived'> & Partial<Customer>) {
  need('customers');
  if (!c.name?.trim()) throw new AppError('اسم العميل مطلوب');
  return db.transaction('rw', db.customers, db.counters, db.audit, async () => {
    if (c.id) {
      const old = await db.customers.get(c.id);
      if (!old) throw new AppError('العميل غير موجود');
      await db.customers.put({ ...old, ...c, name: c.name.trim(), id: c.id } as Customer);
      await audit('تعديل', 'العملاء', c.id, c.name);
      return c.id;
    }
    const code = await nextNumber('customer', 'C-');
    const id = await db.customers.add({
      code,
      name: c.name.trim(),
      phone: c.phone || '',
      city: c.city || '',
      address: c.address || '',
      creditLimit: Number(c.creditLimit) || 0,
      openingBalance: Number(c.openingBalance) || 0,
      notes: c.notes || '',
      archived: 0,
      createdAt: c.createdAt ?? Date.now(),
    });
    await audit('إضافة', 'العملاء', id, c.name);
    return id;
  });
}

export async function setArchived(table: 'customers' | 'suppliers' | 'products' | 'invoices', id: ID, archived: boolean) {
  need(table === 'products' ? 'inventory' : table === 'suppliers' ? 'purchases' : table === 'invoices' ? 'invoice_edit' : 'customers');
  await (db[table] as any).update(id, { archived: archived ? 1 : 0 });
  await audit(archived ? 'أرشفة' : 'استعادة', table, id);
}

export async function touchCustomerContact(id: ID) {
  await db.customers.update(id, { lastContact: Date.now() });
  await audit('تسجيل تواصل', 'العملاء', id);
}

// ---------------- الموردون ----------------
export async function saveSupplier(s: Partial<Supplier> & { name: string }) {
  need('purchases');
  if (!s.name.trim()) throw new AppError('اسم المورد مطلوب');
  if (s.id) {
    const old = await db.suppliers.get(s.id);
    await db.suppliers.put({ ...old!, ...s, id: s.id } as Supplier);
    await audit('تعديل', 'الموردون', s.id, s.name);
    return s.id;
  }
  const id = await db.suppliers.add({
    name: s.name.trim(),
    phone: s.phone || '',
    address: s.address || '',
    openingBalance: Number(s.openingBalance) || 0,
    notes: s.notes || '',
    archived: 0,
    createdAt: Date.now(),
  });
  await audit('إضافة', 'الموردون', id, s.name);
  return id;
}

// ---------------- الأصناف والمخزون ----------------
async function moveStock(
  productId: ID,
  qty: number,
  type: StockMoveType,
  ref: { refType?: string; refId?: ID; refNumber?: string; note?: string; date?: number },
) {
  const p = await db.products.get(productId);
  if (!p) return;
  const before = round2(p.stock);
  const after = round2(before + qty);
  await db.products.update(productId, { stock: after });
  await db.stockMoves.add({
    date: ref.date ?? Date.now(),
    productId,
    type,
    qty: round2(qty),
    before,
    after,
    refType: ref.refType,
    refId: ref.refId,
    refNumber: ref.refNumber,
    note: ref.note ?? '',
    createdBy: who(),
  });
}

export function normalizeUnits(p: Pick<Product, 'baseUnit' | 'units'>) {
  const list = (p.units || []).filter((u) => u.name.trim() && Number(u.factor) > 0 && u.name !== p.baseUnit);
  return [{ name: p.baseUnit, factor: 1 }, ...list.map((u) => ({ name: u.name.trim(), factor: Number(u.factor) }))];
}

export async function saveProduct(p: Partial<Product> & { name: string; openingStock?: number }) {
  need('inventory');
  if (!p.name.trim()) throw new AppError('اسم الصنف مطلوب');
  return db.transaction('rw', [db.products, db.stockMoves, db.counters, db.audit], async () => {
    const code = (p.code || '').trim() || (await nextNumber('product', 'P-'));
    const dup = await db.products.where('code').equals(code).first();
    if (dup && dup.id !== p.id) throw new AppError('كود الصنف مستخدم لصنف آخر');
    const units = normalizeUnits({ baseUnit: p.baseUnit || 'ياردة', units: p.units || [] });
    if (p.id) {
      const old = await db.products.get(p.id);
      if (!old) throw new AppError('الصنف غير موجود');
      if ((old.price !== p.price || old.cost !== p.cost) && !can('prices_discounts')) {
        throw new AppError('لا تملك صلاحية تعديل الأسعار');
      }
      const { openingStock: _o, ...rest } = p;
      await db.products.put({ ...old, ...rest, code, units, stock: old.stock, id: p.id } as Product);
      await audit('تعديل', 'الأصناف', p.id, `${p.name} | سعر ${old.price}→${p.price} | تكلفة ${old.cost}→${p.cost}`);
      return p.id;
    }
    const id = await db.products.add({
      code,
      name: p.name.trim(),
      brand: p.brand || '',
      fabricType: p.fabricType || '',
      origin: p.origin || '',
      modelNo: p.modelNo || '',
      color: p.color || '',
      colorCode: p.colorCode || '',
      composition: p.composition || '',
      batch: p.batch || '',
      supplierId: p.supplierId,
      baseUnit: p.baseUnit || 'ياردة',
      units,
      cost: Number(p.cost) || 0,
      price: Number(p.price) || 0,
      stock: 0,
      lowStock: Number(p.lowStock) || 0,
      archived: 0,
      createdAt: Date.now(),
    });
    if (Number(p.openingStock) > 0) await moveStock(id, Number(p.openingStock), 'opening', { note: 'رصيد افتتاحي' });
    await audit('إضافة', 'الأصناف', id, p.name);
    return id;
  });
}

/** تسوية أو تسجيل تالف (الكمية بالوحدة الأساسية: موجبة للزيادة وسالبة للنقص) */
export async function adjustStock(productId: ID, qty: number, type: 'adjust' | 'damaged', note: string) {
  need('inventory');
  if (!qty) throw new AppError('أدخل الكمية');
  await db.transaction('rw', [db.products, db.stockMoves, db.audit], async () => {
    await moveStock(productId, type === 'damaged' ? -Math.abs(qty) : qty, type, { note });
    await audit(type === 'damaged' ? 'تسجيل تالف' : 'تسوية مخزون', 'الأصناف', productId, `${qty} — ${note}`);
  });
}

// ---------------- الفواتير ----------------
export interface InvoiceInput {
  id?: ID;
  date: number;
  customerId: ID;
  saleType: 'cash' | 'credit';
  dueDate?: number;
  sellerName: string;
  paymentMethod: string;
  notes: string;
  deliveryNotes: string;
  lines: InvoiceLine[];
  invoiceDiscount: number;
  extraFees: number;
  paidAtIssue: number;
}

function buildInvoice(input: InvoiceInput) {
  const lines = input.lines.filter((l) => l.name.trim() && Number(l.qty) > 0).map(computeLine);
  if (!lines.length) throw new AppError('أضف صنفًا واحدًا على الأقل بكمية صحيحة');
  if (!input.customerId) throw new AppError('اختر العميل');
  for (const l of lines) if (l.unitPrice < 0 || l.discount < 0) throw new AppError('لا يُسمح بقيم سالبة');
  const totals = computeInvoiceTotals(lines, input.invoiceDiscount, input.extraFees);
  const paid = round2(Math.max(0, Number(input.paidAtIssue) || 0));
  if (paid > totals.net) throw new AppError('المبلغ المدفوع أكبر من صافي الفاتورة');
  if (input.saleType === 'credit' && !input.dueDate) throw new AppError('حدد تاريخ الاستحقاق للفاتورة الآجلة');
  return { lines, totals, paid };
}

async function checkDiscountPermission(lines: InvoiceLine[], invoiceDiscount: number) {
  if (can('prices_discounts')) return;
  if (invoiceDiscount > 0 || lines.some((l) => l.discount > 0)) throw new AppError('لا تملك صلاحية منح الخصومات');
  for (const l of lines) {
    if (!l.productId) continue;
    const p = await db.products.get(l.productId);
    if (p && round2(p.price * l.factor) !== round2(l.unitPrice)) throw new AppError(`لا تملك صلاحية تعديل سعر "${l.name}"`);
  }
}

/** حفظ مسودة (لا تؤثر على المخزون أو الحسابات) */
export async function saveDraft(input: InvoiceInput): Promise<ID> {
  need('invoice_create');
  const lines = input.lines.map(computeLine);
  const totals = computeInvoiceTotals(lines, input.invoiceDiscount, input.extraFees);
  return db.transaction('rw', [db.invoices, db.counters, db.audit], async () => {
    const now = Date.now();
    if (input.id) {
      const old = await db.invoices.get(input.id);
      if (!old || old.state !== 'draft') throw new AppError('لا يمكن حفظ فاتورة معتمدة كمسودة');
      await db.invoices.put({ ...old, ...input, lines, ...totals, updatedAt: now, id: input.id });
      await audit('تعديل مسودة', 'الفواتير', input.id, old.number);
      return input.id;
    }
    const number = 'D-' + (await nextNumber('draft', '')).slice(-5);
    const id = await db.invoices.add({
      ...input,
      number,
      lines,
      ...totals,
      prevBalance: 0,
      state: 'draft',
      archived: 0,
      createdBy: who(),
      createdAt: now,
      updatedAt: now,
    } as Invoice);
    await audit('إنشاء مسودة', 'الفواتير', id, number);
    return id;
  });
}

export async function deleteDraft(id: ID) {
  need('invoice_create');
  const inv = await db.invoices.get(id);
  if (!inv || inv.state !== 'draft') throw new AppError('يمكن حذف المسودات فقط');
  await db.invoices.delete(id);
  await audit('حذف مسودة', 'الفواتير', id, inv.number);
}

async function balanceOf(customerId: ID) {
  const c = await db.customers.get(customerId);
  if (!c) throw new AppError('العميل غير موجود');
  const [invoices, payments, returns] = await Promise.all([
    db.invoices.where('customerId').equals(customerId).toArray(),
    db.payments.where('customerId').equals(customerId).toArray(),
    db.returns.where('customerId').equals(customerId).toArray(),
  ]);
  return customerBalance(c, invoices, payments, returns);
}

const INVOICE_TABLES = () => [
  db.invoices,
  db.payments,
  db.products,
  db.stockMoves,
  db.counters,
  db.audit,
  db.customers,
  db.returns,
  db.settings,
];

/** اعتماد فاتورة: ترقيم نهائي + خصم المخزون + تسجيل الدفعة المقدمة — كلها في معاملة واحدة */
export async function approveInvoice(input: InvoiceInput): Promise<Invoice> {
  need('invoice_create');
  need('invoice_approve');
  const { lines, totals, paid } = buildInvoice(input);
  await checkDiscountPermission(lines, input.invoiceDiscount);
  return db.transaction('rw', INVOICE_TABLES(), async () => {
    const settings = await getSettings();
    const now = Date.now();
    if (input.id) {
      const old = await db.invoices.get(input.id);
      if (!old || old.state !== 'draft') throw new AppError('الفاتورة ليست مسودة');
    }
    const prevBalance = await balanceOf(input.customerId);
    const number = await nextNumber('invoice', settings.invoicePrefix);
    // تكلفة الوحدة الحالية لحساب الربح
    for (const l of lines) {
      if (!l.productId) continue;
      const p = await db.products.get(l.productId);
      l.unitCost = p?.cost ?? l.unitCost ?? 0;
    }
    const data: Invoice = {
      ...input,
      id: input.id,
      number,
      lines,
      ...totals,
      paidAtIssue: paid,
      prevBalance,
      state: 'approved',
      archived: 0,
      createdBy: who(),
      createdAt: now,
      updatedAt: now,
    };
    if (!input.id) delete data.id;
    const id = input.id ? (await db.invoices.put(data), input.id) : await db.invoices.add(data);
    data.id = id;
    for (const l of lines) {
      if (l.productId) await moveStock(l.productId, -l.baseQty, 'sale', { refType: 'invoice', refId: id, refNumber: number, date: input.date });
    }
    if (paid > 0) {
      const pnum = await nextNumber('receipt', settings.receiptPrefix);
      await db.payments.add({
        number: pnum,
        date: input.date,
        customerId: input.customerId,
        amount: paid,
        method: input.paymentMethod || 'نقدًا',
        allocations: [{ invoiceId: id, amount: paid }],
        notes: `مدفوع عند إصدار الفاتورة ${number}`,
        createdBy: who(),
        reversed: 0,
        createdAt: now,
        source: 'invoice',
      });
    }
    await audit('اعتماد فاتورة', 'الفواتير', id, `${number} — صافي ${totals.net} — مدفوع ${paid}`);
    return data;
  });
}

/** تعديل فاتورة معتمدة: عكس أثرها السابق على المخزون ثم تطبيق الأثر الجديد مع توثيق النسخة القديمة */
export async function editApprovedInvoice(id: ID, input: InvoiceInput): Promise<Invoice> {
  need('invoice_edit');
  const { lines, totals } = buildInvoice({ ...input, paidAtIssue: 0 });
  await checkDiscountPermission(lines, input.invoiceDiscount);
  return db.transaction('rw', INVOICE_TABLES(), async () => {
    const old = await db.invoices.get(id);
    if (!old || old.state !== 'approved') throw new AppError('الفاتورة غير معتمدة');
    if ((await db.returns.where('invoiceId').equals(id).count()) > 0) throw new AppError('لا يمكن تعديل فاتورة عليها مرتجعات');
    if (old.customerId !== input.customerId) {
      const anyPay = await db.payments.filter((p) => !p.reversed && p.allocations.some((a) => a.invoiceId === id)).count();
      if (anyPay) throw new AppError('لا يمكن تغيير العميل لفاتورة عليها دفعات — اعكس الدفعات أولًا');
    }
    for (const l of old.lines) {
      if (l.productId) await moveStock(l.productId, l.baseQty, 'sale_cancel', { refType: 'invoice', refId: id, refNumber: old.number, note: 'تعديل فاتورة' });
    }
    for (const l of lines) {
      if (!l.productId) continue;
      const prev = old.lines.find((x) => x.productId === l.productId);
      const p = await db.products.get(l.productId);
      l.unitCost = prev?.unitCost ?? p?.cost ?? 0;
      await moveStock(l.productId, -l.baseQty, 'sale', { refType: 'invoice', refId: id, refNumber: old.number, note: 'تعديل فاتورة' });
    }
    // إذا أصبح الصافي أقل من المدفوع: يُقلَّص التوزيع ويصبح الفائض رصيدًا دائنًا للعميل
    const pays = await db.payments.filter((p) => !p.reversed && p.allocations.some((a) => a.invoiceId === id)).toArray();
    let excess = round2(invoicePaid(id, pays) - totals.net);
    for (const p of pays.sort((a, b) => b.date - a.date)) {
      if (excess <= 0) break;
      const allocations = p.allocations.map((a) => {
        if (a.invoiceId !== id || excess <= 0) return a;
        const cut = Math.min(a.amount, excess);
        excess = round2(excess - cut);
        return { ...a, amount: round2(a.amount - cut) };
      }).filter((a) => a.amount > 0);
      await db.payments.update(p.id!, { allocations });
    }
    const updated: Invoice = {
      ...old,
      date: input.date,
      customerId: input.customerId,
      saleType: input.saleType,
      dueDate: input.dueDate,
      sellerName: input.sellerName,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      deliveryNotes: input.deliveryNotes,
      invoiceDiscount: input.invoiceDiscount,
      extraFees: input.extraFees,
      lines,
      ...totals,
      updatedAt: Date.now(),
    };
    await db.invoices.put(updated);
    await audit('تعديل فاتورة معتمدة', 'الفواتير', id, { number: old.number, oldNet: old.net, newNet: totals.net, before: old });
    return updated;
  });
}

/** إلغاء فاتورة: لا تُحذف — تُعاد الكميات للمخزون وتتحول دفعاتها إلى رصيد دائن غير موزع */
export async function cancelInvoice(id: ID, reason: string) {
  need('invoice_cancel');
  if (!reason.trim()) throw new AppError('اكتب سبب الإلغاء');
  await db.transaction('rw', INVOICE_TABLES(), async () => {
    const inv = await db.invoices.get(id);
    if (!inv || inv.state !== 'approved') throw new AppError('لا يمكن إلغاء هذه الفاتورة');
    if ((await db.returns.where('invoiceId').equals(id).count()) > 0) throw new AppError('الفاتورة عليها مرتجعات؛ لا يمكن إلغاؤها');
    for (const l of inv.lines) {
      if (l.productId) await moveStock(l.productId, l.baseQty, 'sale_cancel', { refType: 'invoice', refId: id, refNumber: inv.number, note: 'إلغاء فاتورة' });
    }
    const pays = await db.payments.filter((p) => p.allocations.some((a) => a.invoiceId === id)).toArray();
    for (const p of pays) await db.payments.update(p.id!, { allocations: p.allocations.filter((a) => a.invoiceId !== id) });
    await db.invoices.update(id, { state: 'cancelled', cancelReason: reason, updatedAt: Date.now() });
    await audit('إلغاء فاتورة', 'الفواتير', id, `${inv.number} — ${reason}`);
  });
}

// ---------------- الدفعات ----------------
export async function openInvoicesFor(customerId: ID) {
  const [invoices, payments, returns] = await Promise.all([
    db.invoices.where('customerId').equals(customerId).toArray(),
    db.payments.where('customerId').equals(customerId).toArray(),
    db.returns.where('customerId').equals(customerId).toArray(),
  ]);
  return invoices
    .filter((i) => i.state === 'approved')
    .map((i) => ({ invoice: i, remaining: round2(i.net - invoicePaid(i.id!, payments) - invoiceReturned(i.id!, returns)) }))
    .filter((x) => x.remaining > 0.009)
    .sort((a, b) => (a.invoice.dueDate ?? a.invoice.date) - (b.invoice.dueDate ?? b.invoice.date) || a.invoice.date - b.invoice.date);
}

export async function savePayment(input: {
  customerId: ID;
  amount: number;
  date: number;
  method: string;
  allocations: Allocation[];
  notes: string;
}): Promise<Payment> {
  need('payment_create');
  const amount = round2(Number(input.amount));
  if (!input.customerId) throw new AppError('اختر العميل');
  if (!(amount > 0)) throw new AppError('أدخل مبلغًا صحيحًا');
  const allocations = input.allocations.filter((a) => a.amount > 0).map((a) => ({ invoiceId: a.invoiceId, amount: round2(a.amount) }));
  const allocSum = round2(allocations.reduce((s, a) => s + a.amount, 0));
  if (allocSum > amount + 0.001) throw new AppError('مجموع التوزيع أكبر من مبلغ الدفعة');
  if (new Set(allocations.map((a) => a.invoiceId)).size !== allocations.length) throw new AppError('فاتورة مكررة في التوزيع');
  return db.transaction('rw', [db.payments, db.invoices, db.returns, db.counters, db.audit, db.settings, db.customers], async () => {
    const open = await openInvoicesFor(input.customerId);
    for (const a of allocations) {
      const o = open.find((x) => x.invoice.id === a.invoiceId);
      if (!o) throw new AppError('الفاتورة المحددة غير مفتوحة لهذا العميل');
      if (a.amount > o.remaining + 0.001) throw new AppError(`المبلغ الموزع على ${o.invoice.number} أكبر من المتبقي (${o.remaining})`);
    }
    const settings = await getSettings();
    const number = await nextNumber('receipt', settings.receiptPrefix);
    const p: Payment = {
      number,
      date: input.date,
      customerId: input.customerId,
      amount,
      method: input.method,
      allocations,
      notes: input.notes,
      createdBy: who(),
      reversed: 0,
      createdAt: Date.now(),
      source: 'receipt',
    };
    p.id = await db.payments.add(p);
    await db.customers.update(input.customerId, { lastContact: Date.now() });
    await audit('سند قبض', 'الدفعات', p.id, `${number} — ${amount} — موزع ${allocSum}`);
    return p;
  });
}

/** توزيع رصيد دائن (دفعة غير موزعة) على فاتورة مفتوحة */
export async function allocateCredit(paymentId: ID, invoiceId: ID, amount: number) {
  need('payment_create');
  await db.transaction('rw', [db.payments, db.invoices, db.returns, db.audit], async () => {
    const p = await db.payments.get(paymentId);
    if (!p || p.reversed) throw new AppError('الدفعة غير متاحة');
    const free = round2(p.amount - p.allocations.reduce((s, a) => s + a.amount, 0));
    const open = await openInvoicesFor(p.customerId);
    const o = open.find((x) => x.invoice.id === invoiceId);
    if (!o) throw new AppError('الفاتورة غير مفتوحة');
    const amt = round2(Math.min(amount, free, o.remaining));
    if (amt <= 0) throw new AppError('لا يوجد مبلغ متاح للتوزيع');
    const existing = p.allocations.find((a) => a.invoiceId === invoiceId);
    const allocations = existing
      ? p.allocations.map((a) => (a.invoiceId === invoiceId ? { ...a, amount: round2(a.amount + amt) } : a))
      : [...p.allocations, { invoiceId, amount: amt }];
    await db.payments.update(paymentId, { allocations });
    await audit('توزيع رصيد دائن', 'الدفعات', paymentId, `${p.number} → ${o.invoice.number}: ${amt}`);
  });
}

export async function reversePayment(id: ID, reason: string) {
  need('payment_reverse');
  if (!reason.trim()) throw new AppError('اكتب سبب العكس');
  const p = await db.payments.get(id);
  if (!p || p.reversed) throw new AppError('الدفعة غير موجودة أو معكوسة مسبقًا');
  await db.payments.update(id, { reversed: 1, reverseReason: reason, reversedAt: Date.now() });
  await audit('عكس دفعة', 'الدفعات', id, `${p.number} — ${p.amount} — ${reason}`);
}

// ---------------- المرتجعات ----------------
export async function createReturn(input: {
  invoiceId: ID;
  date: number;
  lines: { lineIndex: number; qty: number }[];
  reason: string;
  condition: 'restock' | 'damaged';
  settlement: 'credit' | 'refund';
  refundMethod: string;
}): Promise<SaleReturn> {
  need('invoice_cancel');
  return db.transaction('rw', [db.returns, db.invoices, db.payments, db.products, db.stockMoves, db.counters, db.audit, db.settings], async () => {
    const inv = await db.invoices.get(input.invoiceId);
    if (!inv || inv.state !== 'approved') throw new AppError('الفاتورة غير معتمدة');
    const prev = await db.returns.where('invoiceId').equals(inv.id!).toArray();
    const avail = returnableQty(inv, prev);
    const ratio = invoiceLineRatio(inv);
    const lines: ReturnLine[] = [];
    for (const r of input.lines) {
      const qty = round2(Number(r.qty));
      if (!(qty > 0)) continue;
      const l = inv.lines[r.lineIndex];
      if (!l) throw new AppError('سطر غير موجود');
      if (qty > avail[r.lineIndex] + 0.0001) throw new AppError(`الكمية المرتجعة من "${l.name}" أكبر من المتاح (${avail[r.lineIndex]})`);
      const unitNet = l.qty ? (l.net / l.qty) * ratio : 0;
      lines.push({
        lineIndex: r.lineIndex,
        productId: l.productId,
        name: l.name,
        unit: l.unit,
        factor: l.factor,
        qty,
        baseQty: round2(qty * l.factor),
        unitNet: round2(unitNet),
        amount: round2(qty * unitNet),
        unitCost: l.unitCost,
      });
    }
    if (!lines.length) throw new AppError('حدد كمية مرتجعة واحدة على الأقل');
    const prevReturned = invoiceReturned(inv.id!, prev);
    let total = round2(lines.reduce((s, l) => s + l.amount, 0));
    total = Math.min(total, round2(inv.net - prevReturned)); // لا يتجاوز مجموع المرتجعات صافي الفاتورة
    const pays = await db.payments.filter((p) => p.customerId === inv.customerId).toArray();
    const remainingBefore = Math.max(0, round2(inv.net - invoicePaid(inv.id!, pays) - prevReturned));
    const refundAmount = input.settlement === 'refund' ? Math.max(0, round2(total - remainingBefore)) : 0;
    const settings = await getSettings();
    const number = await nextNumber('return', settings.returnPrefix);
    const ret: SaleReturn = {
      number,
      date: input.date,
      invoiceId: inv.id!,
      customerId: inv.customerId,
      lines,
      total,
      reason: input.reason,
      condition: input.condition,
      settlement: input.settlement,
      refundMethod: input.refundMethod,
      refundAmount,
      createdBy: who(),
      createdAt: Date.now(),
    };
    ret.id = await db.returns.add(ret);
    for (const l of lines) {
      if (!l.productId) continue;
      await moveStock(l.productId, l.baseQty, 'return_in', { refType: 'return', refId: ret.id, refNumber: number, date: input.date });
      if (input.condition === 'damaged') {
        await moveStock(l.productId, -l.baseQty, 'damaged', { refType: 'return', refId: ret.id, refNumber: number, note: 'مرتجع تالف', date: input.date });
      }
    }
    await audit('مرتجع مبيعات', 'المرتجعات', ret.id, `${number} على ${inv.number} — ${total} — رد ${refundAmount}`);
    return ret;
  });
}

// ---------------- المشتريات ----------------
export async function savePurchase(input: {
  supplierId: ID;
  supplierInvoiceNo: string;
  date: number;
  lines: PurchaseLine[];
  extraCosts: number;
  paid: number;
  method: string;
  dueDate?: number;
  notes: string;
}): Promise<Purchase> {
  need('purchases');
  if (!input.supplierId) throw new AppError('اختر المورد');
  const lines = input.lines
    .filter((l) => l.productId && Number(l.qty) > 0)
    .map((l) => ({ ...l, qty: round2(l.qty), baseQty: round2(l.qty * l.factor), total: round2(l.qty * l.unitCost) }));
  if (!lines.length) throw new AppError('أضف صنفًا واحدًا على الأقل');
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const extra = round2(Number(input.extraCosts) || 0);
  const total = round2(subtotal + extra);
  const paid = round2(Number(input.paid) || 0);
  if (paid > total) throw new AppError('المبلغ المدفوع أكبر من إجمالي الشراء');
  return db.transaction('rw', [db.purchases, db.supplierPayments, db.products, db.stockMoves, db.counters, db.audit, db.settings], async () => {
    const settings = await getSettings();
    const number = await nextNumber('purchase', settings.purchasePrefix);
    const pur: Purchase = {
      number,
      supplierInvoiceNo: input.supplierInvoiceNo,
      date: input.date,
      supplierId: input.supplierId,
      lines,
      subtotal,
      extraCosts: extra,
      total,
      dueDate: input.dueDate,
      notes: input.notes,
      state: 'approved',
      createdBy: who(),
      createdAt: Date.now(),
    };
    pur.id = await db.purchases.add(pur);
    for (const l of lines) {
      const p = await db.products.get(l.productId);
      if (!p) continue;
      // توزيع المصاريف الإضافية على الأصناف بنسبة قيمتها
      const share = subtotal > 0 ? (l.total / subtotal) * extra : 0;
      const baseCost = l.baseQty > 0 ? (l.total + share) / l.baseQty : 0;
      await db.products.update(l.productId, { cost: weightedCost(p.stock, p.cost, l.baseQty, baseCost) });
      await moveStock(l.productId, l.baseQty, 'purchase', { refType: 'purchase', refId: pur.id, refNumber: number, date: input.date });
    }
    if (paid > 0) {
      await db.supplierPayments.add({
        date: input.date,
        supplierId: input.supplierId,
        purchaseId: pur.id,
        amount: paid,
        method: input.method,
        notes: `مدفوع عند الشراء ${number}`,
        reversed: 0,
        createdBy: who(),
        createdAt: Date.now(),
      });
    }
    await audit('فاتورة شراء', 'المشتريات', pur.id, `${number} — ${total}`);
    return pur;
  });
}

export async function cancelPurchase(id: ID, reason: string) {
  need('purchases');
  if (!reason.trim()) throw new AppError('اكتب سبب الإلغاء');
  await db.transaction('rw', [db.purchases, db.products, db.stockMoves, db.audit], async () => {
    const p = await db.purchases.get(id);
    if (!p || p.state !== 'approved') throw new AppError('لا يمكن إلغاء هذه الفاتورة');
    for (const l of p.lines) await moveStock(l.productId, -l.baseQty, 'purchase_cancel', { refType: 'purchase', refId: id, refNumber: p.number, note: reason });
    await db.purchases.update(id, { state: 'cancelled', notes: `${p.notes}\nملغاة: ${reason}` });
    await audit('إلغاء شراء', 'المشتريات', id, `${p.number} — ${reason}`);
  });
}

export async function saveSupplierPayment(input: Omit<SupplierPayment, 'id' | 'reversed' | 'createdBy' | 'createdAt'>) {
  need('purchases');
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new AppError('أدخل مبلغًا صحيحًا');
  if (input.purchaseId) {
    const pur = await db.purchases.get(input.purchaseId);
    const paid = purchasePaid(input.purchaseId, await db.supplierPayments.where('purchaseId').equals(input.purchaseId).toArray());
    if (pur && amount > round2(pur.total - paid) + 0.001) throw new AppError('المبلغ أكبر من المتبقي على فاتورة الشراء');
  }
  const id = await db.supplierPayments.add({ ...input, amount, reversed: 0, createdBy: who(), createdAt: Date.now() });
  await audit('دفعة لمورد', 'الموردون', id, `${amount}`);
  return id;
}

export async function reverseSupplierPayment(id: ID) {
  need('payment_reverse');
  await db.supplierPayments.update(id, { reversed: 1 });
  await audit('عكس دفعة مورد', 'الموردون', id);
}

// ---------------- المصروفات والصندوق ----------------
export async function saveExpense(e: Omit<Expense, 'id' | 'createdBy' | 'createdAt' | 'reversed'>) {
  need('expenses');
  if (!(e.amount > 0)) throw new AppError('أدخل مبلغًا صحيحًا');
  const id = await db.expenses.add({ ...e, amount: round2(e.amount), reversed: 0, createdBy: who(), createdAt: Date.now() });
  await audit('مصروف', 'المصروفات', id, `${e.category} — ${e.amount}`);
  return id;
}

export async function reverseExpense(id: ID) {
  need('expenses');
  await db.expenses.update(id, { reversed: 1 });
  await audit('إلغاء مصروف', 'المصروفات', id);
}

export async function saveCashEntry(e: Omit<CashEntry, 'id' | 'createdBy' | 'createdAt'>) {
  need('expenses');
  if (!(e.amount > 0)) throw new AppError('أدخل مبلغًا صحيحًا');
  const id = await db.cashEntries.add({ ...e, amount: round2(e.amount), createdBy: who(), createdAt: Date.now() });
  await audit(e.direction === 'in' ? 'إيداع في الصندوق' : 'سحب من الصندوق', 'الصندوق', id, `${e.amount}`);
  return id;
}

// ---------------- النسخ الاحتياطي ----------------
export const BACKUP_MAGIC = 'fabric-store-backup';

export async function exportAll() {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await (db as any)[t].toArray();
  return { app: BACKUP_MAGIC, version: 1, exportedAt: Date.now(), tables };
}

export async function importAll(data: any, skipPermission = false) {
  if (!skipPermission) need('settings');
  if (!data || data.app !== BACKUP_MAGIC || !data.tables) throw new AppError('الملف ليس نسخة احتياطية صالحة لهذا التطبيق');
  if (!Array.isArray(data.tables.users) || !data.tables.users.length) throw new AppError('النسخة لا تحتوي على مستخدمين');
  await db.transaction('rw', TABLES.map((t) => (db as any)[t]), async () => {
    for (const t of TABLES) {
      await (db as any)[t].clear();
      const rows = data.tables[t];
      if (Array.isArray(rows) && rows.length) await (db as any)[t].bulkAdd(rows);
    }
  });
  await ensureSeed();
}

export async function wipeAll() {
  need('settings');
  await db.transaction('rw', TABLES.map((t) => (db as any)[t]), async () => {
    for (const t of TABLES) if (t !== 'users' && t !== 'settings') await (db as any)[t].clear();
  });
  await audit('مسح البيانات', 'الإعدادات', 1);
}
