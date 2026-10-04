import { hmac } from './db'

// ملف تعريف (Cookie) موقّع يحفظ أرقام الطلبات التي أنشأها هذا المتصفح،
// لعرض بيانات العميل كاملة في رسالة واتساب لصاحب الطلب فقط.
export const OWNER_COOKIE = 'gh_orders'

export function readOwned(value: string | undefined | null): number[] {
  if (!value) return []
  const [data, sig] = value.split('.')
  if (!data || !sig || hmac('orders:' + data) !== sig) return []
  try {
    const ids = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    return Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)) : []
  } catch {
    return []
  }
}

export function addOwned(value: string | undefined | null, id: number): string {
  const ids = [id, ...readOwned(value).filter((x) => x !== id)].slice(0, 20)
  const data = Buffer.from(JSON.stringify(ids)).toString('base64url')
  return `${data}.${hmac('orders:' + data)}`
}
