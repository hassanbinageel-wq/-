// أدوات النصوص العربية: توحيد الحروف للبحث، تحويل الأرقام، وإنشاء الروابط المختصرة

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** يحول الأرقام العربية الهندية والفارسية إلى أرقام لاتينية */
export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const i = AR_DIGITS.indexOf(ch)
    return String(i >= 0 ? i : FA_DIGITS.indexOf(ch))
  })
}

/** توحيد النص العربي للبحث: إزالة التشكيل والتطويل وتوحيد الألف والياء والتاء المربوطة */
export function normalizeArabic(input: string): string {
  return toLatinDigits(input || '')
    .toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** رابط مختصر يدعم العربية: يبقي الحروف والأرقام ويستبدل المسافات بشرطة */
export function slugify(input: string): string {
  const s = toLatinDigits(input || '')
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return s || 'item'
}
