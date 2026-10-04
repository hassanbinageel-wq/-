import { redirect } from 'next/navigation'
import { currentUser, hasAnyUser } from '@/lib/server/auth'
import { LoginForm } from '@/components/admin/LoginForm'

export default async function LoginPage() {
  if (await currentUser()) redirect('/admin')
  return <LoginForm noUsers={!hasAnyUser()} />
}
