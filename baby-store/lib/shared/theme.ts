import type { Appearance, HomeSection, ThemeColors } from './types'

export const THEME_PRESETS: { key: string; name: string; colors: ThemeColors }[] = [
  {
    key: 'powder',
    name: 'وردي بودري',
    colors: {
      bg: '#FFF9F4', surface: '#FFFFFF', soft: '#FCEEF0', text: '#3A2E3F', muted: '#6B5E6E',
      primary: '#A84B70', onPrimary: '#FFFFFF', accent: '#7DB3D6',
      pink: '#F8DCE2', blue: '#DCEDF8', green: '#DDF0E4', yellow: '#FFF1CC', border: '#EEDFD8', sale: '#B23A48',
    },
  },
  {
    key: 'sky',
    name: 'أزرق سماوي',
    colors: {
      bg: '#F7FBFE', surface: '#FFFFFF', soft: '#E6F2FB', text: '#24384A', muted: '#55687A',
      primary: '#2F6E9E', onPrimary: '#FFFFFF', accent: '#F2B8C6',
      pink: '#FBE3E8', blue: '#D9EBF7', green: '#DFF1E7', yellow: '#FFF3CF', border: '#DCE8F1', sale: '#B33A4C',
    },
  },
  {
    key: 'mint',
    name: 'أخضر نعناعي',
    colors: {
      bg: '#F8FBF7', surface: '#FFFFFF', soft: '#E5F3EA', text: '#263A30', muted: '#56685D',
      primary: '#2F7556', onPrimary: '#FFFFFF', accent: '#F3C6A5',
      pink: '#FBE4E4', blue: '#DDEDF6', green: '#D8EEDF', yellow: '#FFF2CC', border: '#DDEBE1', sale: '#B23A48',
    },
  },
  {
    key: 'cream',
    name: 'كريمي دافئ',
    colors: {
      bg: '#FBF7F1', surface: '#FFFFFF', soft: '#F3EADF', text: '#3B342C', muted: '#665C52',
      primary: '#7A5C43', onPrimary: '#FFFFFF', accent: '#C9B79C',
      pink: '#F5E1DC', blue: '#DFE9EF', green: '#E3EDDF', yellow: '#FBF0D5', border: '#E8DDD0', sale: '#A63D40',
    },
  },
  {
    key: 'lilac',
    name: 'ليلكي ناعم',
    colors: {
      bg: '#FBF9FD', surface: '#FFFFFF', soft: '#EFE9F8', text: '#352D45', muted: '#635A72',
      primary: '#6B4E9B', onPrimary: '#FFFFFF', accent: '#F2C1D1',
      pink: '#F9E2EA', blue: '#DFEAF7', green: '#E1F0E6', yellow: '#FFF2D2', border: '#E6DFF0', sale: '#B03A55',
    },
  },
]

export const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  bg: 'خلفية الصفحة',
  surface: 'خلفية البطاقات',
  soft: 'خلفية ناعمة للأقسام',
  text: 'لون النص',
  muted: 'النص الثانوي',
  primary: 'لون الأزرار الرئيسي',
  onPrimary: 'نص الأزرار',
  accent: 'لون الزينة',
  pink: 'وردي فاتح',
  blue: 'سماوي فاتح',
  green: 'أخضر فاتح',
  yellow: 'أصفر فاتح',
  border: 'الحدود',
  sale: 'سعر التخفيض',
}

export const FONTS: { key: string; label: string; family: string }[] = [
  { key: 'custom', label: 'الخط المرفوع (مثل DIN Next LT Arabic)', family: 'StoreCustomFont' },
  { key: 'tajawal', label: 'تجوال Tajawal', family: 'Tajawal' },
  { key: 'almarai', label: 'المراعي Almarai', family: 'Almarai' },
  { key: 'ibm-plex', label: 'IBM Plex Sans Arabic', family: 'IBM Plex Sans Arabic' },
  { key: 'cairo', label: 'القاهرة Cairo', family: 'Cairo' },
  { key: 'system', label: 'خط النظام', family: 'system-ui' },
]

export const DEFAULT_LABELS: Record<string, string> = {
  addToCart: 'أضف إلى السلة',
  outOfStock: 'غير متوفر حالياً',
  selectOptions: 'اختر الخيارات أولاً',
  checkout: 'إتمام الطلب',
  continueShopping: 'متابعة التسوق',
  viewAll: 'عرض الكل',
  askWhatsapp: 'اسأل عن المنتج عبر واتساب',
  emptyCart: 'سلتك فارغة… لنملأها بأشياء صغيرة لطيفة',
  emptyFavorites: 'لم تضف أي منتج إلى المفضلة بعد',
  searchPlaceholder: 'ابحث باسم المنتج أو رقمه…',
  sendWhatsappOrder: 'إرسال الطلب والسند عبر واتساب',
  placeOrder: 'تأكيد الطلب',
  newBadge: 'جديد',
  saleBadge: 'عرض',
  bundleBadge: 'باقة',
  quickView: 'نظرة سريعة',
}

export const LABEL_NAMES: Record<string, string> = {
  addToCart: 'زر الإضافة للسلة',
  outOfStock: 'نص عدم التوفر',
  selectOptions: 'تنبيه اختيار الخيارات',
  checkout: 'زر إتمام الطلب',
  continueShopping: 'زر متابعة التسوق',
  viewAll: 'زر عرض الكل',
  askWhatsapp: 'زر السؤال عبر واتساب',
  emptyCart: 'رسالة السلة الفارغة',
  emptyFavorites: 'رسالة المفضلة الفارغة',
  searchPlaceholder: 'نص مربع البحث',
  sendWhatsappOrder: 'زر إرسال الطلب عبر واتساب',
  placeOrder: 'زر تأكيد الطلب',
  newBadge: 'شارة المنتج الجديد',
  saleBadge: 'شارة العرض',
  bundleBadge: 'شارة الباقة',
  quickView: 'زر النظرة السريعة',
}

export function newSection(type: HomeSection['type'], partial: Partial<HomeSection> = {}): HomeSection {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type,
    enabled: true,
    title: '',
    subtitle: '',
    limit: 8,
    layout: 'carousel',
    buttonText: '',
    buttonLink: '',
    productIds: [],
    tagGroupId: null,
    banners: [],
    body: '',
    items: [],
    startsAt: null,
    endsAt: null,
    ...partial,
  }
}

export function defaultAppearance(): Appearance {
  return {
    brand: { name: 'غيمة', tagline: 'كل ما يحتاجه مولودك بلمسة ناعمة', logoId: null, faviconId: null },
    theme: {
      preset: 'powder',
      colors: { ...THEME_PRESETS[0].colors },
      radius: 18,
      fontBody: 'custom',
      fontHeading: 'custom',
      customFontId: null,
      customFontName: 'DIN Next LT Arabic',
      baseSize: 16,
      decorations: true,
    },
    announcement: {
      enabled: true,
      items: [
        { label: 'الدفع بالتحويل وإرسال السند عبر واتساب بخطوات بسيطة', href: '/pages/how-to-order' },
        { label: 'تغليف هدايا ورسالة إهداء عند الطلب', href: '/products?type=bundle' },
      ],
      bg: '#3A2E3F',
      fg: '#FFFFFF',
      startsAt: null,
      endsAt: null,
    },
    header: {
      menu: [
        { label: 'الرئيسية', href: '/' },
        { label: 'جميع المنتجات', href: '/products' },
        { label: 'باقات الهدايا', href: '/products?type=bundle' },
        { label: 'العروض', href: '/products?sale=1' },
        { label: 'تتبع طلبك', href: '/track' },
      ],
    },
    home: {
      sections: [
        newSection('rail', { id: 'rail', title: 'على الشماعة', subtitle: 'قطع ناعمة لأجمل البدايات', limit: 10, buttonText: 'تسوق كل المنتجات', buttonLink: '/products' }),
        newSection('hero', {
          id: 'hero',
          banners: [
            {
              id: 'b1', enabled: true, title: 'أهلاً بالصغير القادم', text: 'ملابس وأطقم وهدايا ناعمة لأجمل البدايات',
              buttonText: 'تسوق الآن', link: '/products', imageDesktopId: null, imageMobileId: null, align: 'start', tone: 'dark',
              startsAt: null, endsAt: null,
            },
            {
              id: 'b2', enabled: true, title: 'باقات هدايا جاهزة', text: 'اختر الباقة وأضف رسالة إهداء وتغليفاً أنيقاً',
              buttonText: 'شاهد الباقات', link: '/products?type=bundle', imageDesktopId: null, imageMobileId: null, align: 'start', tone: 'dark',
              startsAt: null, endsAt: null,
            },
          ],
        }),
        newSection('categories', { id: 'cats', title: 'تسوق حسب القسم', subtitle: 'كل ما يحتاجه المولود في مكان واحد', layout: 'grid' }),
        newSection('tag_group', { id: 'age', title: 'تسوق حسب العمر', layout: 'carousel' }),
        newSection('new', { id: 'new', title: 'وصل حديثاً', subtitle: 'أحدث ما أضفناه للمتجر', buttonText: 'عرض الكل', buttonLink: '/products?sort=newest' }),
        newSection('bundles', { id: 'bundles', title: 'باقات الهدايا', subtitle: 'هدايا مكتملة بسعر خاص', buttonText: 'كل الباقات', buttonLink: '/products?type=bundle' }),
        newSection('tag_group', { id: 'occasion', title: 'هدايا لكل مناسبة', layout: 'carousel' }),
        newSection('offers', { id: 'offers', title: 'عروض لطيفة', buttonText: 'كل العروض', buttonLink: '/products?sale=1' }),
        newSection('featured', { id: 'featured', title: 'اخترنا لك', subtitle: 'منتجات نحبها ونرشحها' }),
        newSection('features', {
          id: 'features',
          items: [
            { icon: 'gift', title: 'تغليف هدايا', text: 'مع رسالة إهداء عند الطلب' },
            { icon: 'whatsapp', title: 'تواصل مباشر', text: 'نؤكد طلبك عبر واتساب' },
            { icon: 'transfer', title: 'دفع بالتحويل', text: 'حوّل وأرسل السند بسهولة' },
            { icon: 'truck', title: 'توصيل للمدن', text: 'رسوم واضحة لكل منطقة' },
          ],
        }),
        newSection('recently_viewed', { id: 'recent', title: 'شاهدت مؤخراً' }),
      ],
    },
    productCard: { aspect: '4/5', fit: 'cover', hoverSecondImage: true, quickView: true, columnsMobile: 2, columnsDesktop: 4 },
    labels: { ...DEFAULT_LABELS },
    footer: {
      about: 'متجر متخصص في ملابس المواليد وأطقمهم وإكسسواراتهم وهداياهم، نختار كل قطعة بعناية لتليق بأجمل البدايات.',
      columns: [
        {
          title: 'تسوق',
          links: [
            { label: 'جميع المنتجات', href: '/products' },
            { label: 'باقات الهدايا', href: '/products?type=bundle' },
            { label: 'العروض', href: '/products?sale=1' },
            { label: 'المفضلة', href: '/favorites' },
          ],
        },
        {
          title: 'المساعدة',
          links: [
            { label: 'تتبع طلبك', href: '/track' },
            { label: 'طريقة الطلب والدفع', href: '/pages/how-to-order' },
            { label: 'الأسئلة الشائعة', href: '/faq' },
            { label: 'سياسة الشحن', href: '/pages/shipping' },
            { label: 'الاستبدال والاسترجاع', href: '/pages/returns' },
            { label: 'سياسة الخصوصية', href: '/pages/privacy' },
          ],
        },
        {
          title: 'عن المتجر',
          links: [
            { label: 'من نحن', href: '/pages/about' },
            { label: 'تواصل معنا', href: '/contact' },
          ],
        },
      ],
      social: { instagram: '', tiktok: '', snapchat: '', facebook: '', x: '' },
      copyright: 'جميع الحقوق محفوظة',
    },
  }
}

/** دمج بيانات مظهر محفوظة مع القيم الافتراضية (يحمي من الحقول الناقصة بعد التحديثات) */
export function normalizeAppearance(input: unknown): Appearance {
  const d = defaultAppearance()
  const a = (input && typeof input === 'object' ? input : {}) as Partial<Appearance>
  return {
    brand: { ...d.brand, ...(a.brand || {}) },
    theme: { ...d.theme, ...(a.theme || {}), colors: { ...d.theme.colors, ...(a.theme?.colors || {}) } },
    announcement: { ...d.announcement, ...(a.announcement || {}) },
    header: { ...d.header, ...(a.header || {}) },
    home: { sections: (a.home?.sections || d.home.sections).map((s) => ({ ...newSection(s.type), ...s })) },
    productCard: { ...d.productCard, ...(a.productCard || {}) },
    labels: { ...d.labels, ...(a.labels || {}) },
    footer: {
      ...d.footer,
      ...(a.footer || {}),
      social: { ...d.footer.social, ...(a.footer?.social || {}) },
    },
  }
}

function luminance(hex: string): number {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return 0
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/** نسبة التباين بين لونين حسب WCAG */
export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

export function isScheduledActive(startsAt: string | null | undefined, endsAt: string | null | undefined, now = new Date()): boolean {
  if (startsAt && new Date(startsAt) > now) return false
  if (endsAt && new Date(endsAt) < now) return false
  return true
}
