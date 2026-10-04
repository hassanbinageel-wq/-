import { requirePage } from '@/lib/server/auth'
import { editorRefs } from '@/lib/server/admin/editor-refs'
import { ProductEditor } from '@/components/admin/ProductEditor'
import type { ProductInput } from '@/lib/server/products'

export const metadata = { title: 'منتج جديد' }

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requirePage('products')
  const t = (await searchParams).type
  const type: ProductInput['type'] = t === 'bundle' ? 'bundle' : t === 'variable' ? 'variable' : 'simple'
  const initial: ProductInput = {
    type, name: '', status: 'draft', price: 0, trackStock: type !== 'bundle', stock: 0, manualAvailability: 'in_stock',
    options: type === 'variable' ? [{ name: 'المقاس', kind: 'size', values: [] }] : [], variants: [], images: [], tagIds: [], setContents: [],
    relatedIds: [], complementaryIds: [], bundleItems: [], giftWrapEligible: true, personalization: null, salePrice: null,
  }
  return <ProductEditor initial={initial} refs={await editorRefs(null)} isNew />
}
