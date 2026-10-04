import { requirePage } from '@/lib/server/auth'
import { getSetting } from '@/lib/server/settings'
import { TEMPLATE_VARIABLES } from '@/lib/server/orders'
import { MessagesEditor } from '@/components/admin/MessagesEditor'

export const metadata = { title: 'رسائل واتساب' }

export default async function MessagesPage() {
  await requirePage('owner')
  return <MessagesEditor initial={await getSetting('messages')} variables={TEMPLATE_VARIABLES} />
}
