import type { CurrencyConfig } from './money'
import type { HomeSectionType } from './constants'

// ===== إعدادات المتجر (تُحفظ في جدول settings) =====
export type StoreSettings = {
  currency: CurrencyConfig
  timezone: string
  whatsappCountryCode: string
  whatsappNumber: string
  phone: string
  email: string
  address: string
  workingHours: string
  mapUrl: string
  orderPrefix: string
  skuPrefix: string
  defaultCountry: string
  defaultPhoneCode: string
}

export type CheckoutSettings = {
  deliveryEnabled: boolean
  pickupEnabled: boolean
  pickupAddress: string
  pickupNotes: string
  reservationMinutes: number
  autoCancelAfterExpiryHours: number
  maxPendingPerPhone: number
  maxQtyPerLine: number
  ordersPerIpPer10Min: number
  notesMax: number
}

export type ShippingSettings = {
  freeShippingEnabled: boolean
  freeShippingThreshold: number // سنت
}

export type GiftSettings = {
  giftOrderEnabled: boolean
  giftWrapEnabled: boolean
  giftMessageEnabled: boolean
  giftMessageMax: number
  recipientEnabled: boolean
  hidePricesEnabled: boolean
}

export type PersonalizationSettings = {
  enabled: boolean
}

export type InventorySettings = {
  lowStockThreshold: number
  showLowStockToCustomers: boolean
}

export type MaintenanceSettings = {
  enabled: boolean
  title: string
  message: string
}

export type MessageTemplate = { key: string; title: string; body: string }

export type BackupSettings = {
  autoEnabled: boolean
  keep: number
  lastAutoAt: string | null
}

export type AllSettings = {
  store: StoreSettings
  checkout: CheckoutSettings
  shipping: ShippingSettings
  gifts: GiftSettings
  personalization: PersonalizationSettings
  inventory: InventorySettings
  maintenance: MaintenanceSettings
  messages: MessageTemplate[]
  backup: BackupSettings
}

// ===== المظهر (مسودة / منشور) =====
export type ThemeColors = {
  bg: string
  surface: string
  soft: string
  text: string
  muted: string
  primary: string
  onPrimary: string
  accent: string
  pink: string
  blue: string
  green: string
  yellow: string
  border: string
  sale: string
}

export type LinkItem = { label: string; href: string }

export type Banner = {
  id: string
  enabled: boolean
  title: string
  text: string
  buttonText: string
  link: string
  imageDesktopId: number | null
  imageMobileId: number | null
  align: 'start' | 'center' | 'end'
  tone: 'light' | 'dark'
  startsAt: string | null
  endsAt: string | null
}

export type HomeSection = {
  id: string
  type: HomeSectionType
  enabled: boolean
  title: string
  subtitle: string
  limit: number
  layout: 'carousel' | 'grid'
  buttonText: string
  buttonLink: string
  productIds: number[]
  tagGroupId: number | null
  banners: Banner[]
  body: string
  items: { icon: string; title: string; text: string }[]
  startsAt: string | null
  endsAt: string | null
}

export type Appearance = {
  brand: {
    name: string
    tagline: string
    logoId: number | null
    faviconId: number | null
  }
  theme: {
    preset: string
    colors: ThemeColors
    radius: number
    fontBody: string
    fontHeading: string
    customFontId: number | null
    customFontName: string
    baseSize: number
    decorations: boolean
  }
  announcement: {
    enabled: boolean
    items: LinkItem[]
    bg: string
    fg: string
    startsAt: string | null
    endsAt: string | null
  }
  header: { menu: LinkItem[] }
  home: { sections: HomeSection[] }
  productCard: {
    aspect: '1/1' | '4/5' | '3/4'
    fit: 'cover' | 'contain'
    hoverSecondImage: boolean
    quickView: boolean
    columnsMobile: 1 | 2
    columnsDesktop: 3 | 4 | 5
  }
  labels: Record<string, string>
  footer: {
    about: string
    columns: { title: string; links: LinkItem[] }[]
    social: { instagram: string; tiktok: string; snapchat: string; facebook: string; x: string }
    copyright: string
  }
}

// ===== بيانات المنتج للواجهة =====
export type OptionKind = 'size' | 'color' | 'other'
export type ProductOption = { name: string; kind: OptionKind; values: { value: string; color?: string }[] }

export type Personalization = {
  enabled: boolean
  label: string
  placeholder: string
  maxLength: number
  fee: number // سنت لكل قطعة
  extraDays: number
  required: boolean
  help: string
}

export type ImageRef = { id: number; url: string; srcset: string; w: number | null; h: number | null; alt: string; optionValue: string | null }

export type ProductCard = {
  id: number
  slug: string
  sku: string
  name: string
  type: 'simple' | 'variable' | 'bundle'
  price: number
  compareAt: number | null
  priceFrom: boolean
  images: ImageRef[]
  available: boolean
  lowStock: number | null
  colors: { value: string; color?: string }[]
  isNew: boolean
  isDemo: boolean
  categoryName: string | null
}

export type VariantPublic = {
  id: number
  sku: string
  options: (string | null)[]
  price: number
  compareAt: number | null
  available: number // الكمية المتاحة (أو 9999 إذا لا يتتبع المخزون)
  active: boolean
}

export type BundleComponentPublic = {
  id: number // bundle_items.id
  productId: number
  name: string
  slug: string
  sku: string
  qty: number
  image: ImageRef | null
  options: ProductOption[]
  fixedVariantId: number | null
  variants: VariantPublic[]
  simpleAvailable: number
  type: 'simple' | 'variable'
  unitValue: number
}

export type ProductDetail = ProductCard & {
  shortDescription: string
  description: string
  options: ProductOption[]
  variants: VariantPublic[]
  simpleAvailable: number
  maxPerOrder: number
  lowThreshold: number | null
  material: string
  careInstructions: string
  sizeGuide: { id: number; name: string; intro: string; columns: string[]; rows: string[][]; notes: string; image: ImageRef | null } | null
  setContents: string[]
  piecesCount: number | null
  prepDaysMin: number | null
  prepDaysMax: number | null
  giftWrapEligible: boolean
  personalization: Personalization | null
  components: BundleComponentPublic[]
  bundleValue: number | null
  category: { id: number; name: string; slug: string } | null
  tags: { id: number; name: string; slug: string; group: string }[]
  seoTitle: string
  seoDescription: string
  status: 'draft' | 'published' | 'archived'
}

// ===== السلة =====
export type CartLineInput = {
  key: string
  productId: number
  variantId: number | null
  qty: number
  bundle: { itemId: number; variantId: number | null }[]
  personalization: string | null
}

export type CartLineSnapshot = CartLineInput & {
  name: string
  image: string | null
  unitPrice: number
  sku: string
  optionsText: string
  slug: string
}

export type QuoteLine = {
  key: string
  ok: boolean
  errors: string[]
  warnings: string[]
  productId: number
  variantId: number | null
  type: 'simple' | 'variable' | 'bundle'
  name: string
  slug: string
  sku: string
  image: string | null
  options: { name: string; value: string }[]
  components: { name: string; sku: string; qty: number; options: { name: string; value: string }[] }[]
  unitPrice: number
  compareAt: number | null
  qty: number
  maxQty: number
  lineTotal: number
  personalization: { label: string; text: string; feeUnit: number } | null
  personalizationTotal: number
  onSale: boolean
  giftWrapEligible: boolean
}

export type Quote = {
  lines: QuoteLine[]
  itemsCount: number
  subtotal: number
  discount: number
  coupon: { code: string; valid: boolean; message: string; discount: number } | null
  personalizationTotal: number
  wrapFee: number
  wrap: { id: number; name: string; price: number } | null
  shippingFee: number
  shipping: {
    method: 'delivery' | 'pickup' | null
    zone: { id: number; name: string; fee: number; eta: string | null } | null
    free: boolean
    freeEnabled: boolean
    freeThreshold: number
    freeRemaining: number | null
    freeAppliesToZone: boolean | null
  }
  total: number
  errors: string[]
  hasBlockingErrors: boolean
  prepDaysMin: number | null
  prepDaysMax: number | null
}
