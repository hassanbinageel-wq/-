import type { Settings } from '../db/schema';

let numberFormat: Settings['numberFormat'] = 'latin';
let dateFormat: Settings['dateFormat'] = 'dmy';
let currency = 'ر.ي';

export function configureFormat(s: Pick<Settings, 'numberFormat' | 'dateFormat' | 'currency'>) {
  numberFormat = s.numberFormat;
  dateFormat = s.dateFormat;
  currency = s.currency;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toDigits = (s: string) => (numberFormat === 'arabic' ? s.replace(/\d/g, (d) => AR_DIGITS[+d]) : s);

export function fmtNum(n: number, maxFrac = 2): string {
  const v = Number(n) || 0;
  const s = v.toLocaleString('en-US', { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 });
  return toDigits(s);
}

export const fmtMoney = (n: number) => `${fmtNum(n)} ${currency}`;
export const getCurrency = () => currency;

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const s =
    dateFormat === 'ymd'
      ? `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
      : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return toDigits(s);
}

export function fmtDateTime(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${fmtDate(ts)} ${toDigits(`${h}:${pad(d.getMinutes())}`)} ${ampm}`;
}

/** قيمة حقل input[type=date] */
export const toInputDate = (ts?: number) => {
  const d = ts ? new Date(ts) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const fromInputDate = (s: string, endOfDay = false) => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
};
/** تاريخ من حقل الإدخال مع وقت الآن (للعمليات المسجلة اليوم) */
export const fromInputDateNow = (s: string) => {
  const base = fromInputDate(s) ?? Date.now();
  const now = new Date();
  const d = new Date(base);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return d.getTime();
};

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const endOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
export const DAY = 86400000;

export type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom';
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' },
  { key: 'year', label: 'السنة' },
  { key: 'custom', label: 'مخصص' },
];

/** نطاق الفترة: الأسبوع يبدأ السبت */
export function periodRange(key: PeriodKey, custom?: { from?: number; to?: number }): { from: number; to: number } {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'week': {
      const diff = (now.getDay() + 1) % 7; // السبت = 0
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)), to: endOfDay(now) };
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: endOfDay(now) };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: endOfDay(now) };
    default:
      return { from: custom?.from ?? startOfDay(now), to: custom?.to ?? endOfDay(now) };
  }
}

export const inRange = (ts: number, r: { from: number; to: number }) => ts >= r.from && ts <= r.to;

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
