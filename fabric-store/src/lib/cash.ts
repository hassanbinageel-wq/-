import type { AppData } from './data';
import { round2 } from './calc';

export interface CashMove {
  date: number;
  kind: string;
  ref: string;
  method: string;
  inAmt: number;
  outAmt: number;
  note: string;
}

/**
 * حركة الصندوق: تحصيل العملاء (داخل) — المصروفات ودفعات الموردين والمبالغ المردودة (خارج) — الإيداعات والسحوبات اليدوية.
 * تحصيل العميل ليس إيرادًا جديدًا؛ إنما حركة نقدية لمبيعات احتُسبت مسبقًا.
 */
export function cashMoves(d: Pick<AppData, 'payments' | 'expenses' | 'supplierPayments' | 'returns' | 'cashEntries' | 'customerById' | 'supplierById'>): CashMove[] {
  const out: CashMove[] = [];
  for (const p of d.payments) {
    if (p.reversed) continue;
    out.push({ date: p.date, kind: 'تحصيل من عميل', ref: p.number, method: p.method, inAmt: p.amount, outAmt: 0, note: d.customerById.get(p.customerId)?.name ?? '' });
  }
  for (const e of d.expenses) {
    if (e.reversed) continue;
    out.push({ date: e.date, kind: `مصروف: ${e.category}`, ref: '—', method: e.method, inAmt: 0, outAmt: e.amount, note: e.notes });
  }
  for (const s of d.supplierPayments) {
    if (s.reversed) continue;
    out.push({ date: s.date, kind: 'دفعة لمورد', ref: '—', method: s.method, inAmt: 0, outAmt: s.amount, note: d.supplierById.get(s.supplierId)?.name ?? '' });
  }
  for (const r of d.returns) {
    if (r.refundAmount > 0) out.push({ date: r.date, kind: 'رد مبلغ مرتجع', ref: r.number, method: r.refundMethod, inAmt: 0, outAmt: r.refundAmount, note: d.customerById.get(r.customerId)?.name ?? '' });
  }
  for (const c of d.cashEntries) {
    out.push({ date: c.date, kind: c.direction === 'in' ? 'إيداع يدوي' : 'سحب يدوي', ref: '—', method: c.method, inAmt: c.direction === 'in' ? c.amount : 0, outAmt: c.direction === 'out' ? c.amount : 0, note: c.notes });
  }
  return out.sort((a, b) => a.date - b.date);
}

export function balancesByMethod(moves: CashMove[]) {
  const m = new Map<string, { in: number; out: number }>();
  for (const x of moves) {
    const v = m.get(x.method) ?? { in: 0, out: 0 };
    v.in = round2(v.in + x.inAmt);
    v.out = round2(v.out + x.outAmt);
    m.set(x.method, v);
  }
  return m;
}
