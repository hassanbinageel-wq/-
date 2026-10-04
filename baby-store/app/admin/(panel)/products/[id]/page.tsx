import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/server/auth'
import { productToInput } from '@/lib/server/products'
import { editorRefs } from '@/lib/server/admin/editor-refs'
import { ProductEditor } from '@/components/admin/ProductEditor'

export const metadata = { title: 'تعديل المنتج' }

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('products')
  const p = await productToInput(Number((await params).id))
  if (!p) notFound()
  return <ProductEditor key={p.id ?? 0} initial={p} refs={await editorRefs(p)} isNew={false} />
}
