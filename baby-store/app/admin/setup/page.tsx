import { redirect } from 'next/navigation'
import { hasAnyUser } from '@/lib/server/auth'
import { SetupForm } from '@/components/admin/LoginForm'

export default async function SetupPage() {
  if (await hasAnyUser()) redirect('/admin/login')
  return <SetupForm enabled={(process.env.SETUP_TOKEN || '').length >= 12} />
}
