import { toLatinDigits } from './arabic'

export function digitsOnly(s: string): string {
  return toLatinDigits(s || '').replace(/\D/g, '')
}

/** يبني الرقم الدولي (أرقام فقط بدون +) من مفتاح الدولة والرقم المحلي */
export function buildIntlNumber(countryCode: string, local: string): string {
  const cc = digitsOnly(countryCode)
  let n = digitsOnly(local)
  if (cc && n.startsWith('00' + cc)) n = n.slice(2 + cc.length)
  else if (cc && n.startsWith(cc) && n.length > cc.length + 6) n = n.slice(cc.length)
  n = n.replace(/^0+/, '')
  return cc + n
}

export type PhoneCheck = { ok: true; intl: string } | { ok: false; error: string }

/** تحقق من رقم واتساب العميل. لليمن: 9 أرقام تبدأ بـ 7 */
export function validatePhone(countryCode: string, local: string): PhoneCheck {
  const cc = digitsOnly(countryCode)
  if (!cc || cc.length > 4) return { ok: false, error: 'مفتاح الدولة غير صحيح' }
  const intl = buildIntlNumber(cc, local)
  const nat = intl.slice(cc.length)
  if (!nat) return { ok: false, error: 'يرجى إدخال رقم واتساب' }
  if (cc === '967') {
    if (!/^7\d{8}$/.test(nat)) return { ok: false, error: 'رقم الجوال اليمني يتكون من 9 أرقام ويبدأ بالرقم 7' }
  } else if (nat.length < 6 || nat.length > 13) {
    return { ok: false, error: 'رقم واتساب غير صحيح' }
  }
  return { ok: true, intl }
}

/** عرض الرقم الدولي بشكل مقروء: +967 775 038 900 */
export function formatIntl(intl: string, cc?: string): string {
  const d = digitsOnly(intl)
  if (!d) return ''
  const code = cc && d.startsWith(cc) ? cc : d.startsWith('967') ? '967' : d.slice(0, Math.min(3, d.length - 6))
  const rest = d.slice(code.length)
  const groups = rest.replace(/(\d{3})(?=\d)/g, '$1 ')
  return `+${code} ${groups}`.trim()
}

/** إخفاء جزئي للرقم: +967 77*****00 */
export function maskPhone(intl: string): string {
  const d = digitsOnly(intl)
  if (d.length < 6) return '***'
  const cc = d.startsWith('967') ? '967' : d.slice(0, 3)
  const rest = d.slice(cc.length)
  return `+${cc} ${rest.slice(0, 2)}${'*'.repeat(Math.max(1, rest.length - 4))}${rest.slice(-2)}`
}

export function maskName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '***'
  const first = parts[0]
  const rest = parts.slice(1).map((p) => p[0] + '***')
  return [first, ...rest].join(' ')
}

export function waLink(intlNumber: string, text?: string): string {
  const n = digitsOnly(intlNumber)
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
