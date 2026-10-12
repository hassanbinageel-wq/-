import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, type Customer, type Expense, type Invoice, type Payment, type Product, type Purchase, type SaleReturn, type Settings, type Supplier, type SupplierPayment, type CashEntry, type User } from '../db/schema';
import { customerBalance, invoiceStatus, supplierBalance, unallocatedCredit, purchasePaid, type InvoiceStatusInfo } from './calc';

export interface AppData {
  ready: boolean;
  settings: Settings;
  users: User[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  returns: SaleReturn[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  expenses: Expense[];
  cashEntries: CashEntry[];
  // مشتقات محسوبة
  status: Map<number, InvoiceStatusInfo>;
  balance: Map<number, number>;
  credit: Map<number, number>;
  supplierBal: Map<number, number>;
  purchaseRemaining: Map<number, number>;
  customerById: Map<number, Customer>;
  supplierById: Map<number, Supplier>;
  productById: Map<number, Product>;
  invoiceById: Map<number, Invoice>;
}

const Ctx = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const raw = useLiveQuery(async () => {
    const [settings, users, customers, suppliers, products, invoices, payments, returns, purchases, supplierPayments, expenses, cashEntries] =
      await Promise.all([
        db.settings.get(1),
        db.users.toArray(),
        db.customers.toArray(),
        db.suppliers.toArray(),
        db.products.toArray(),
        db.invoices.toArray(),
        db.payments.toArray(),
        db.returns.toArray(),
        db.purchases.toArray(),
        db.supplierPayments.toArray(),
        db.expenses.toArray(),
        db.cashEntries.toArray(),
      ]);
    return { settings: settings ?? DEFAULT_SETTINGS, users, customers, suppliers, products, invoices, payments, returns, purchases, supplierPayments, expenses, cashEntries };
  }, []);

  const value = useMemo<AppData>(() => {
    const r = raw ?? {
      settings: DEFAULT_SETTINGS,
      users: [],
      customers: [],
      suppliers: [],
      products: [],
      invoices: [],
      payments: [],
      returns: [],
      purchases: [],
      supplierPayments: [],
      expenses: [],
      cashEntries: [],
    };
    const now = Date.now();
    const payByCustomer = groupBy(r.payments, (p) => p.customerId);
    const retByCustomer = groupBy(r.returns, (x) => x.customerId);
    const invByCustomer = groupBy(r.invoices, (x) => x.customerId);
    const status = new Map<number, InvoiceStatusInfo>();
    for (const inv of r.invoices) {
      status.set(inv.id!, invoiceStatus(inv, payByCustomer.get(inv.customerId) ?? [], retByCustomer.get(inv.customerId) ?? [], now));
    }
    const balance = new Map<number, number>();
    const credit = new Map<number, number>();
    for (const c of r.customers) {
      const pays = payByCustomer.get(c.id!) ?? [];
      balance.set(c.id!, customerBalance(c, invByCustomer.get(c.id!) ?? [], pays, retByCustomer.get(c.id!) ?? []));
      credit.set(c.id!, unallocatedCredit(c.id!, pays));
    }
    const supplierBal = new Map<number, number>();
    for (const s of r.suppliers) supplierBal.set(s.id!, supplierBalance(s, r.purchases, r.supplierPayments));
    const purchaseRemaining = new Map<number, number>();
    for (const p of r.purchases) purchaseRemaining.set(p.id!, p.state === 'approved' ? Math.max(0, p.total - purchasePaid(p.id!, r.supplierPayments)) : 0);
    return {
      ready: !!raw,
      ...r,
      status,
      balance,
      credit,
      supplierBal,
      purchaseRemaining,
      customerById: new Map(r.customers.map((c) => [c.id!, c])),
      supplierById: new Map(r.suppliers.map((c) => [c.id!, c])),
      productById: new Map(r.products.map((c) => [c.id!, c])),
      invoiceById: new Map(r.invoices.map((c) => [c.id!, c])),
    };
  }, [raw]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('DataProvider missing');
  return v;
}

export function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of arr) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export const matches = (q: string, ...fields: (string | number | undefined)[]) => {
  const nq = norm(q.trim());
  if (!nq) return true;
  return fields.some((f) => norm(String(f ?? '')).includes(nq));
};
