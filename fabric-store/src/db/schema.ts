import Dexie, { type Table } from 'dexie';

export type ID = number;

export type Permission =
  | 'view'
  | 'invoice_create'
  | 'invoice_edit'
  | 'invoice_approve'
  | 'invoice_cancel'
  | 'payment_create'
  | 'payment_reverse'
  | 'customers'
  | 'inventory'
  | 'purchases'
  | 'expenses'
  | 'reports'
  | 'profits'
  | 'prices_discounts'
  | 'settings'
  | 'users';

export const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'view', label: 'عرض البيانات' },
  { key: 'invoice_create', label: 'إنشاء الفواتير' },
  { key: 'invoice_edit', label: 'تعديل الفواتير المعتمدة' },
  { key: 'invoice_approve', label: 'اعتماد الفواتير' },
  { key: 'invoice_cancel', label: 'إلغاء الفواتير والمرتجعات' },
  { key: 'payment_create', label: 'تسجيل الدفعات' },
  { key: 'payment_reverse', label: 'عكس الدفعات' },
  { key: 'customers', label: 'إدارة العملاء' },
  { key: 'inventory', label: 'إدارة المخزون والأصناف' },
  { key: 'purchases', label: 'المشتريات والموردون' },
  { key: 'expenses', label: 'المصروفات والصندوق' },
  { key: 'reports', label: 'عرض التقارير' },
  { key: 'profits', label: 'عرض الأرباح والتكاليف' },
  { key: 'prices_discounts', label: 'تعديل الأسعار والخصومات' },
  { key: 'settings', label: 'الإعدادات والنسخ الاحتياطي' },
  { key: 'users', label: 'إدارة المستخدمين' },
];

export interface User {
  id?: ID;
  name: string;
  username: string;
  pinHash: string;
  role: 'admin' | 'staff';
  permissions: Permission[];
  active: boolean;
  createdAt: number;
}

export interface UnitDef {
  name: string; // كرتون، طاقة، ياردة، متر ...
  factor: number; // كم وحدة أساسية تساوي هذه الوحدة
}

export interface Settings {
  id: 1;
  shopName: string;
  activity: string;
  logo: string; // dataURL
  phone: string;
  phone2: string;
  address: string;
  taxNo: string;
  currency: string;
  numberFormat: 'latin' | 'arabic';
  dateFormat: 'dmy' | 'ymd';
  themeMode: 'system' | 'light' | 'dark';
  primaryColor: string;
  invoiceColor: string;
  invoiceAccent: string;
  invoicePrefix: string;
  receiptPrefix: string;
  purchasePrefix: string;
  returnPrefix: string;
  invoiceFooter: string;
  printSize: 'a4' | 'thermal';
  showPrevBalanceOnInvoice: boolean;
  fabricTypes: string[];
  units: string[];
  paymentMethods: string[];
  expenseCategories: string[];
  defaultDueDays: number;
  autoBackup: boolean;
  lastAutoBackup: number;
  sessionMinutes: number;
}

export interface Customer {
  id?: ID;
  code: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  creditLimit: number;
  openingBalance: number;
  notes: string;
  archived: 0 | 1;
  createdAt: number;
  lastContact?: number;
}

export interface Supplier {
  id?: ID;
  name: string;
  phone: string;
  address: string;
  openingBalance: number;
  notes: string;
  archived: 0 | 1;
  createdAt: number;
}

export interface Product {
  id?: ID;
  code: string;
  name: string;
  brand: string;
  fabricType: string; // ياباني، كوري ...
  origin: string;
  modelNo: string;
  color: string;
  colorCode: string;
  composition: string;
  batch: string;
  supplierId?: ID;
  baseUnit: string; // ياردة أو متر
  units: UnitDef[]; // تشمل الوحدة الأساسية بمعامل 1
  cost: number; // تكلفة الوحدة الأساسية
  price: number; // سعر بيع الوحدة الأساسية
  stock: number; // بالوحدة الأساسية (يُحدَّث عبر حركات المخزون فقط)
  lowStock: number; // بالوحدة الأساسية
  archived: 0 | 1;
  createdAt: number;
}

export interface InvoiceLine {
  productId?: ID;
  name: string;
  brand: string;
  fabricType: string;
  origin: string;
  color: string;
  colorCode: string;
  code: string;
  baseUnit: string;
  unit: string;
  factor: number;
  cartons: number;
  bolts: number;
  qty: number; // بوحدة البيع
  baseQty: number; // qty * factor (أمتار/ياردات)
  unitPrice: number;
  total: number;
  discount: number;
  net: number;
  unitCost: number; // تكلفة الوحدة الأساسية لحظة البيع
}

export type InvoiceState = 'draft' | 'approved' | 'cancelled';

export interface Invoice {
  id?: ID;
  number: string;
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
  subtotal: number;
  lineDiscounts: number;
  totalDiscount: number;
  net: number;
  paidAtIssue: number;
  prevBalance: number; // رصيد العميل السابق لحظة الاعتماد (للعرض فقط)
  state: InvoiceState;
  archived: 0 | 1;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  cancelReason?: string;
}

export interface Allocation {
  invoiceId: ID;
  amount: number;
}

export interface Payment {
  id?: ID;
  number: string;
  date: number;
  customerId: ID;
  amount: number;
  method: string;
  allocations: Allocation[];
  notes: string;
  createdBy: string;
  reversed: 0 | 1;
  reverseReason?: string;
  reversedAt?: number;
  createdAt: number;
  source: 'receipt' | 'invoice';
}

export interface ReturnLine {
  lineIndex: number;
  productId?: ID;
  name: string;
  unit: string;
  factor: number;
  qty: number;
  baseQty: number;
  unitNet: number; // صافي سعر الوحدة بعد الخصم
  amount: number;
  unitCost: number;
}

export interface SaleReturn {
  id?: ID;
  number: string;
  date: number;
  invoiceId: ID;
  customerId: ID;
  lines: ReturnLine[];
  total: number;
  reason: string;
  condition: 'restock' | 'damaged';
  settlement: 'credit' | 'refund';
  refundMethod: string;
  refundAmount: number;
  createdBy: string;
  createdAt: number;
}

export interface PurchaseLine {
  productId: ID;
  name: string;
  unit: string;
  factor: number;
  qty: number;
  baseQty: number;
  unitCost: number;
  total: number;
}

export interface Purchase {
  id?: ID;
  number: string;
  supplierInvoiceNo: string;
  date: number;
  supplierId: ID;
  lines: PurchaseLine[];
  subtotal: number;
  extraCosts: number;
  total: number;
  dueDate?: number;
  notes: string;
  state: 'approved' | 'cancelled';
  createdBy: string;
  createdAt: number;
}

export interface SupplierPayment {
  id?: ID;
  date: number;
  supplierId: ID;
  purchaseId?: ID;
  amount: number;
  method: string;
  notes: string;
  reversed: 0 | 1;
  createdBy: string;
  createdAt: number;
}

export interface Expense {
  id?: ID;
  date: number;
  category: string;
  amount: number;
  method: string;
  notes: string;
  createdBy: string;
  createdAt: number;
  reversed: 0 | 1;
}

export interface CashEntry {
  id?: ID;
  date: number;
  direction: 'in' | 'out';
  amount: number;
  method: string;
  notes: string;
  createdBy: string;
  createdAt: number;
}

export type StockMoveType =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'sale_cancel'
  | 'return_in'
  | 'damaged'
  | 'adjust'
  | 'purchase_cancel';

export interface StockMove {
  id?: ID;
  date: number;
  productId: ID;
  type: StockMoveType;
  qty: number; // موجب = داخل، سالب = خارج (بالوحدة الأساسية)
  before: number;
  after: number;
  refType?: string;
  refId?: ID;
  refNumber?: string;
  note: string;
  createdBy: string;
}

export interface AuditEntry {
  id?: ID;
  ts: number;
  user: string;
  action: string;
  entity: string;
  entityId?: ID;
  details: string;
}

export interface Counter {
  key: string;
  value: number;
}

export class AppDB extends Dexie {
  settings!: Table<Settings, number>;
  users!: Table<User, ID>;
  customers!: Table<Customer, ID>;
  suppliers!: Table<Supplier, ID>;
  products!: Table<Product, ID>;
  invoices!: Table<Invoice, ID>;
  payments!: Table<Payment, ID>;
  returns!: Table<SaleReturn, ID>;
  purchases!: Table<Purchase, ID>;
  supplierPayments!: Table<SupplierPayment, ID>;
  expenses!: Table<Expense, ID>;
  cashEntries!: Table<CashEntry, ID>;
  stockMoves!: Table<StockMove, ID>;
  audit!: Table<AuditEntry, ID>;
  counters!: Table<Counter, string>;

  constructor(name = 'fabric-store') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      users: '++id, &username',
      customers: '++id, &code, name, phone, archived',
      suppliers: '++id, name, archived',
      products: '++id, &code, name, color, fabricType, archived, supplierId',
      invoices: '++id, &number, date, customerId, state, archived',
      payments: '++id, &number, date, customerId, reversed',
      returns: '++id, &number, date, invoiceId, customerId',
      purchases: '++id, &number, date, supplierId, state',
      supplierPayments: '++id, date, supplierId, purchaseId',
      expenses: '++id, date, category',
      cashEntries: '++id, date',
      stockMoves: '++id, date, productId, refId',
      audit: '++id, ts, entity',
      counters: 'key',
    });
  }
}

export const TABLES = [
  'settings',
  'users',
  'customers',
  'suppliers',
  'products',
  'invoices',
  'payments',
  'returns',
  'purchases',
  'supplierPayments',
  'expenses',
  'cashEntries',
  'stockMoves',
  'audit',
  'counters',
] as const;

export let db = new AppDB();

/** للاختبارات فقط */
export function useDatabase(instance: AppDB) {
  db = instance;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  shopName: 'محل الأقمشة الرجالية',
  activity: 'بيع الأقمشة الرجالية وأقمشة الأثواب بالجملة',
  logo: '',
  phone: '',
  phone2: '',
  address: '',
  taxNo: '',
  currency: 'ر.ي',
  numberFormat: 'latin',
  dateFormat: 'dmy',
  themeMode: 'system',
  primaryColor: '#0f766e',
  invoiceColor: '#0f766e',
  invoiceAccent: '#b45309',
  invoicePrefix: 'INV-',
  receiptPrefix: 'RC-',
  purchasePrefix: 'PO-',
  returnPrefix: 'RT-',
  invoiceFooter: 'شكرًا لتعاملكم معنا — البضاعة المباعة لا ترد إلا وفق سياسة المحل',
  printSize: 'a4',
  showPrevBalanceOnInvoice: true,
  fabricTypes: ['ياباني', 'كوري', 'تايلندي', 'إندونيسي', 'صيني', 'أخرى'],
  units: ['ياردة', 'متر', 'طاقة', 'كرتون'],
  paymentMethods: ['نقدًا', 'تحويل', 'حوالة', 'شيك'],
  expenseCategories: ['إيجار', 'نقل', 'تحميل', 'رواتب', 'كهرباء', 'مصاريف تشغيلية', 'أخرى'],
  defaultDueDays: 30,
  autoBackup: true,
  lastAutoBackup: 0,
  sessionMinutes: 0,
};
