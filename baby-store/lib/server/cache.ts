import { db } from './db'

// تنسيق الذاكرة المؤقتة بين نسخ الخادم المتعددة (الاستضافة السحابية تشغّل أكثر من نسخة):
// كل تعديل على الإعدادات أو المظهر أو الكتالوج يرفع رقم الإصدار في قاعدة البيانات،
// وكل نسخة تتحقق من الرقم كل بضع ثوانٍ وتفرغ ذاكرتها المؤقتة عند تغيره.

const CHECK_MS = 3000

type State = { version: string | null; checkedAt: number; listeners: Set<() => void> }
const g = globalThis as unknown as { __cacheState?: State }
const state: State = (g.__cacheState ||= { version: null, checkedAt: 0, listeners: new Set() })

export function onInvalidate(fn: () => void) {
  state.listeners.add(fn)
}

function clearLocal() {
  for (const fn of state.listeners) fn()
}

/** يتحقق (بحد أقصى مرة كل 3 ثوانٍ) من أن الذاكرة المؤقتة لم تتقادم */
export async function ensureFresh() {
  if (Date.now() - state.checkedAt < CHECK_MS) return
  state.checkedAt = Date.now()
  const row = await db().prepare("SELECT value FROM meta WHERE key='cache_version'").get<{ value: string }>()
  const v = row?.value ?? '0'
  if (state.version !== null && v !== state.version) clearLocal()
  state.version = v
}

/** يُستدعى بعد أي تعديل يؤثر على البيانات المخزنة مؤقتاً */
export async function bumpCacheVersion() {
  await db()
    .prepare("INSERT INTO meta(key,value) VALUES('cache_version','1') ON CONFLICT(key) DO UPDATE SET value=(CAST(meta.value AS BIGINT)+1)::text")
    .run()
  clearLocal()
  // نعيد القراءة لاحقاً (بعد إتمام المعاملة) لالتقاط أي قراءة قديمة حدثت أثناءها
  state.checkedAt = 0
}
