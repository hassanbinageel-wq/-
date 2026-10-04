/** تحويل تاريخ SQLite (UTC بدون منطقة زمنية) أو ISO إلى Date */
export function toDate(s: string | Date | null | undefined): Date | null {
  if (!s) return null
  if (s instanceof Date) return s
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z')
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDateTime(s: string | Date | null | undefined, tz = 'Asia/Aden', numerals: 'latn' | 'arab' = 'latn'): string {
  const d = toDate(s)
  if (!d) return ''
  return new Intl.DateTimeFormat(`ar-YE-u-nu-${numerals}`, {
    timeZone: tz,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function formatDate(s: string | Date | null | undefined, tz = 'Asia/Aden', numerals: 'latn' | 'arab' = 'latn'): string {
  const d = toDate(s)
  if (!d) return ''
  return new Intl.DateTimeFormat(`ar-YE-u-nu-${numerals}`, { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

/** قيمة input[type=datetime-local] بتوقيت المتصفح من تاريخ ISO */
export function toLocalInput(iso: string | null | undefined): string {
  const d = toDate(iso || null)
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** من قيمة datetime-local (توقيت المتصفح) إلى ISO بتوقيت UTC */
export function fromLocalInput(v: string | null | undefined): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function relativeHours(target: Date, now = new Date()): string {
  const diff = Math.round((target.getTime() - now.getTime()) / 60000)
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const txt = h ? `${h} ساعة${m ? ` و${m} دقيقة` : ''}` : `${m} دقيقة`
  return diff >= 0 ? `متبقي ${txt}` : `انتهت منذ ${txt}`
}
