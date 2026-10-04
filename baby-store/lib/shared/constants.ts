export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'بانتظار التأكيد',
  confirmed: 'مؤكد',
  preparing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

export const PAYMENT_STATUSES = [
  'awaiting_transfer',
  'under_review',
  'partially_paid',
  'paid',
  'needs_review',
  'partially_refunded',
  'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_transfer: 'بانتظار التحويل',
  under_review: 'قيد المراجعة',
  partially_paid: 'مدفوع جزئياً',
  paid: 'مدفوع',
  needs_review: 'يحتاج مراجعة أو سند بديل',
  partially_refunded: 'مسترد جزئياً',
  refunded: 'مسترد بالكامل',
}

export const STOCK_STATE_LABELS: Record<string, string> = {
  reserved: 'محجوز مؤقتاً',
  committed: 'مخصوم للطلب',
  released: 'تم تحرير الحجز',
  none: 'لا يتطلب مخزوناً',
}

export const PERMISSIONS = ['owner', 'orders', 'products', 'payments'] as const
export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  owner: 'مالك المتجر (جميع الصلاحيات)',
  orders: 'موظف الطلبات (الطلبات والعملاء والتواصل)',
  products: 'موظف المنتجات (المنتجات والأقسام والمخزون)',
  payments: 'مراجع المدفوعات (التحويلات والسندات وتأكيد الدفع)',
}

export const FULFILLMENT_LABELS = { delivery: 'توصيل', pickup: 'استلام من المحل' } as const

export const MOVEMENT_REASON_LABELS: Record<string, string> = {
  initial: 'رصيد افتتاحي',
  manual: 'تعديل يدوي',
  import: 'استيراد CSV',
  order_reserve: 'حجز لطلب',
  order_release: 'تحرير حجز منتهي',
  order_cancel: 'إلغاء طلب',
  order_rereserve: 'إعادة حجز لطلب',
  return_restock: 'مرتجع أُعيد للمخزون',
  edit: 'تعديل من صفحة المنتج',
}

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  bank: 'حساب بنكي',
  wallet: 'محفظة إلكترونية',
  exchange: 'شركة صرافة / حوالات',
  other: 'أخرى',
}

export const HOME_SECTION_TYPES = {
  hero: 'البنرات الرئيسية',
  categories: 'أقسام المتجر',
  tag_group: 'تسوق حسب (العمر / المناسبة)',
  new: 'المنتجات الجديدة',
  featured: 'منتجات مميزة',
  offers: 'العروض',
  bundles: 'باقات الهدايا',
  promo: 'بانر ترويجي',
  features: 'مزايا المتجر',
  recently_viewed: 'شاهدت مؤخراً',
  text: 'نص حر',
} as const
export type HomeSectionType = keyof typeof HOME_SECTION_TYPES
