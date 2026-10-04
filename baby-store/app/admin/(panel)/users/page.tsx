import { requirePage } from '@/lib/server/auth'
import { db, parseJson } from '@/lib/server/db'
import { UsersManager } from '@/components/admin/UsersManager'
import type { Permission } from '@/lib/shared/constants'

export const metadata = { title: 'المستخدمون والصلاحيات' }

export default async function UsersPage() {
  const me = await requirePage('owner')
  const rows = await db()
      .prepare("SELECT u.*, (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at > datetime('now')) AS sessions FROM admin_users u ORDER BY u.id")
      .all() as { id: number; username: string; name: string; permissions: string; active: number; last_login_at: string | null; locked_until: string | null; sessions: number }[]
  return (
    <UsersManager
      meId={me.id}
      initial={rows.map((r) => ({ id: r.id, username: r.username, name: r.name, permissions: parseJson<Permission[]>(r.permissions, []), active: !!r.active, lastLogin: r.last_login_at, locked: !!r.locked_until && new Date(r.locked_until + 'Z') > new Date(), sessions: r.sessions }))}
    />
  )
}
