import { requirePage } from '@/lib/server/auth'
import { PERMISSION_LABELS } from '@/lib/shared/constants'
import { PageHead } from '@/components/admin/ui'
import { AccountForm } from '@/components/admin/AccountForm'

export const metadata = { title: 'حسابي' }

export default async function AccountPage() {
  const u = await requirePage()
  return (
    <>
      <PageHead title="حسابي" subtitle={`${u.name} — ${u.username}`} />
      <div className="a-grid a-grid--2">
        <AccountForm />
        <div className="a-card">
          <h2>صلاحياتك</h2>
          <ul style={{ margin: 0 }}>
            {u.permissions.map((p) => (
              <li key={p}>{PERMISSION_LABELS[p]}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
