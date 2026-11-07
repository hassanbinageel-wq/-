<?php
/**
 * Content definitions.
 * Every section in the dashboard is described here, and the database tables
 * and add/edit forms are built from these definitions automatically.
 * To add a new field to any section, add it here and it appears in the dashboard.
 */

/** Icons available in icon pickers in the dashboard */
function icon_choices(bool $withNone = false): array
{
    $list = [
        'sparkles' => 'إبداع / AI', 'image' => 'صور', 'image-plus' => 'توليد صور', 'video' => 'فيديو', 'film' => 'أفلام',
        'clapperboard' => 'إخراج', 'camera' => 'تصوير', 'wand' => 'سحر / تعديل', 'bot' => 'شات بوت', 'cpu' => 'ذكاء اصطناعي',
        'code' => 'برمجة', 'pen' => 'تصميم', 'layers' => 'طبقات', 'megaphone' => 'تسويق', 'mic' => 'صوت',
        'graduation' => 'تدريب', 'book' => 'كتاب', 'chart' => 'تحليلات', 'headset' => 'استشارات', 'users' => 'عملاء',
        'star' => 'تقييم', 'eye' => 'مشاهدات', 'clock' => 'وقت', 'trophy' => 'إنجاز', 'award' => 'جائزة',
        'rocket' => 'انطلاق', 'zap' => 'سرعة', 'heart' => 'حب', 'briefcase' => 'عمل', 'lightbulb' => 'فكرة',
        'target' => 'هدف', 'flag' => 'بداية', 'globe' => 'عالمي',
    ];
    return $withNone ? ['' => 'بدون أيقونة'] + $list : $list;
}

function service_icons(): array
{
    return icon_choices();
}

function entities(): array
{
    static $e = null;
    if ($e !== null) {
        return $e;
    }
    $common = [
        'published'  => ['label' => 'منشور (ظاهر في الموقع)', 'type' => 'bool', 'default' => 1],
        'sort_order' => ['label' => 'الترتيب', 'type' => 'number', 'default' => 0, 'hint' => 'الرقم الأصغر يظهر أولاً'],
    ];

    return $e = [
        'works' => [
            'title' => 'الأعمال', 'singular' => 'عمل', 'icon' => 'image',
            'desc'  => 'اعرض مشاريعك وأعمالك في الذكاء الاصطناعي',
            'fields' => [
                'title'     => ['label' => 'عنوان العمل', 'type' => 'text', 'required' => true],
                'category'  => ['label' => 'التصنيف', 'type' => 'text', 'hint' => 'مثال: صور AI، فيديو، أتمتة، إعلانات'],
                'summary'   => ['label' => 'وصف مختصر', 'type' => 'textarea', 'full' => true],
                'content'   => ['label' => 'تفاصيل العمل', 'type' => 'html', 'full' => true],
                'image'     => ['label' => 'صورة الغلاف', 'type' => 'image'],
                'video_file' => ['label' => 'ملف فيديو (يُعرض مباشرة في الموقع)', 'type' => 'video', 'hint' => 'MP4 يفضّل — يشتغل داخل موقعك بدون يوتيوب'],
                'video_url' => ['label' => 'أو رابط فيديو (YouTube / Vimeo)', 'type' => 'url'],
                'gallery'   => ['label' => 'معرض الصور', 'type' => 'gallery', 'full' => true],
                'link'      => ['label' => 'رابط زر «مشاهدة العمل»', 'type' => 'url', 'hint' => 'اتركه فاضي ليفتح صفحة العمل في موقعك'],
                'tools'     => ['label' => 'الأدوات المستخدمة', 'type' => 'text', 'hint' => 'افصل بينها بفاصلة: Midjourney, Runway — اتركه فاضي لإخفائها'],
                'featured'  => ['label' => 'عمل مميز', 'type' => 'bool'],
            ] + $common,
            'columns' => ['image', 'title', 'category', 'featured', 'published'],
        ],
        'timeline' => [
            'title' => 'قصتي', 'singular' => 'مرحلة', 'icon' => 'flag',
            'desc'  => 'مراحل رحلتك — تظهر في صفحة «القصة كاملة» مرتبة بالسنة',
            'order' => 'year ASC, sort_order ASC, id ASC',
            'fields' => [
                'year'        => ['label' => 'السنة', 'type' => 'text', 'required' => true, 'hint' => 'مثال: 2022'],
                'title'       => ['label' => 'عنوان المرحلة', 'type' => 'text', 'required' => true],
                'description' => ['label' => 'الوصف', 'type' => 'textarea', 'full' => true],
                'icon'        => ['label' => 'الأيقونة', 'type' => 'icon', 'options' => icon_choices(true), 'default' => ''],
                'image'       => ['label' => 'صورة (اختياري)', 'type' => 'image'],
                'highlight'   => ['label' => 'مرحلة مميزة (تظهر بلون بارز)', 'type' => 'bool'],
            ] + $common,
            'columns' => ['year', 'title', 'icon', 'published'],
        ],
        'stats' => [
            'title' => 'الأرقام', 'singular' => 'رقم', 'icon' => 'chart',
            'desc'  => 'أرقام الإنجازات اللي تظهر تحت البنر',
            'fields' => [
                'value' => ['label' => 'الرقم', 'type' => 'text', 'required' => true, 'hint' => 'مثال: 48+ أو +2M أو 4.9 أو 24h'],
                'label' => ['label' => 'الوصف', 'type' => 'text', 'required' => true, 'hint' => 'مثال: مشروع منجز'],
                'icon'  => ['label' => 'الأيقونة', 'type' => 'icon', 'options' => icon_choices(true), 'default' => ''],
            ] + $common,
            'columns' => ['icon', 'value', 'label', 'published'],
        ],
        'tools' => [
            'title' => 'الأدوات', 'singular' => 'أداة', 'icon' => 'wand',
            'desc'  => 'أدوات الذكاء الاصطناعي اللي تستخدمها',
            'fields' => [
                'name'    => ['label' => 'اسم الأداة', 'type' => 'text', 'required' => true],
                'icon'    => ['label' => 'الأيقونة', 'type' => 'icon', 'options' => icon_choices(), 'default' => 'sparkles'],
                'logo'    => ['label' => 'شعار الأداة (اختياري — يحل محل الأيقونة)', 'type' => 'image'],
                'url'     => ['label' => 'رابط الأداة', 'type' => 'url'],
                'in_hero' => ['label' => 'تظهر عائمة حول صورة البنر', 'type' => 'bool', 'default' => 1],
            ] + $common,
            'columns' => ['icon', 'name', 'in_hero', 'published'],
        ],
        'partners' => [
            'title' => 'شركاء النجاح', 'singular' => 'شريك', 'icon' => 'landmark',
            'desc'  => 'الجهات والشركات اللي اشتغلت معها',
            'fields' => [
                'name'        => ['label' => 'اسم الشريك', 'type' => 'text', 'required' => true],
                'logo'        => ['label' => 'الشعار', 'type' => 'image', 'hint' => 'PNG بخلفية شفافة'],
                'logo_dark'   => ['label' => 'شعار للوضع الداكن (اختياري)', 'type' => 'image', 'hint' => 'نسخة فاتحة من الشعار للخلفية الداكنة'],
                'scale'       => ['label' => 'حجم الشعار %', 'type' => 'number', 'default' => 100, 'min' => 50, 'max' => 160, 'hint' => '100 = الحجم الطبيعي. كبّر الشعار الصغير أو صغّر الكبير عشان تتناسق'],
                'url'         => ['label' => 'الموقع', 'type' => 'url'],
                'description' => ['label' => 'نبذة', 'type' => 'textarea', 'full' => true],
            ] + $common,
            'columns' => ['logo', 'name', 'url', 'published'],
        ],
        'books' => [
            'title' => 'المتجر', 'singular' => 'منتج', 'icon' => 'cart',
            'desc'  => 'كتبك ودوراتك ومنتجاتك الرقمية',
            'fields' => [
                'title'       => ['label' => 'اسم المنتج', 'type' => 'text', 'required' => true],
                'kind'        => ['label' => 'النوع', 'type' => 'select', 'options' => [
                    'book' => 'كتاب', 'ebook' => 'كتاب إلكتروني', 'course' => 'دورة', 'product' => 'منتج رقمي', 'package' => 'باقة',
                ], 'default' => 'book'],
                'description' => ['label' => 'وصف مختصر (يظهر في الكرت)', 'type' => 'textarea', 'full' => true],
                'details'     => ['label' => 'تفاصيل المنتج (صفحة المنتج)', 'type' => 'html', 'full' => true],
                'highlights'  => ['label' => 'وش بتحصل عليه؟ (سطر لكل نقطة)', 'type' => 'textarea', 'full' => true, 'hint' => 'مثال: 300 برومبت جاهز — شرح طريقة التعديل — تحديثات مجانية'],
                'specs'       => ['label' => 'معلومات سريعة (سطر لكل معلومة: العنوان: القيمة)', 'type' => 'textarea', 'full' => true, 'hint' => 'مثال: عدد الصفحات: 120 — الصيغة: PDF — المدة: 6 ساعات'],
                'image'       => ['label' => 'صورة الغلاف', 'type' => 'image'],
                'gallery'     => ['label' => 'صور إضافية (صفحات من الكتاب، لقطات من الكورس)', 'type' => 'gallery', 'full' => true],
                'video_url'   => ['label' => 'فيديو تعريفي (YouTube)', 'type' => 'url'],
                'price'       => ['label' => 'السعر', 'type' => 'text', 'hint' => 'مثال: 99 ر.س — أو اكتب «مجاني»'],
                'old_price'   => ['label' => 'السعر قبل الخصم', 'type' => 'text'],
                'buy_url'     => ['label' => 'رابط الشراء', 'type' => 'url', 'hint' => 'سلة / زد / Gumroad… اتركه فاضي ليصير الطلب عبر واتساب'],
                'button_text' => ['label' => 'نص الزر', 'type' => 'text', 'default' => 'اشترِ الآن'],
            ] + $common,
            'columns' => ['image', 'title', 'kind', 'price', 'published'],
        ],
        'store_features' => [
            'title' => 'مزايا المتجر', 'singular' => 'ميزة', 'icon' => 'award',
            'desc'  => 'الكروت اللي تظهر أعلى صفحة المتجر (مثل: تحميل فوري، دعم مباشر)',
            'fields' => [
                'title'       => ['label' => 'الميزة', 'type' => 'text', 'required' => true],
                'description' => ['label' => 'وصف قصير', 'type' => 'text'],
                'icon'        => ['label' => 'الأيقونة', 'type' => 'icon', 'options' => icon_choices(true), 'default' => ''],
            ] + $common,
            'columns' => ['icon', 'title', 'description', 'published'],
        ],
        'faqs' => [
            'title' => 'الأسئلة الشائعة', 'singular' => 'سؤال', 'icon' => 'help',
            'desc'  => 'الأسئلة والأجوبة في صفحة المتجر',
            'fields' => [
                'question' => ['label' => 'السؤال', 'type' => 'text', 'required' => true],
                'answer'   => ['label' => 'الجواب', 'type' => 'textarea', 'full' => true, 'required' => true],
            ] + $common,
            'columns' => ['question', 'published'],
        ],
        'clients' => [
            'title' => 'العملاء', 'singular' => 'عميل', 'icon' => 'user',
            'desc'  => 'آراء العملاء وتجاربهم معك',
            'fields' => [
                'name'        => ['label' => 'اسم العميل', 'type' => 'text', 'required' => true],
                'role'        => ['label' => 'المنصب / الجهة', 'type' => 'text'],
                'logo'        => ['label' => 'الصورة أو الشعار', 'type' => 'image'],
                'testimonial' => ['label' => 'رأي العميل', 'type' => 'textarea', 'full' => true],
                'rating'      => ['label' => 'التقييم (من 5)', 'type' => 'number', 'default' => 5, 'min' => 0, 'max' => 5],
            ] + $common,
            'columns' => ['logo', 'name', 'role', 'rating', 'published'],
        ],
        'prompts' => [
            'title' => 'البرومبتات', 'singular' => 'برومبت', 'icon' => 'sparkles',
            'desc'  => 'شارك أفضل البرومبتات مع زوارك',
            'fields' => [
                'title'       => ['label' => 'عنوان البرومبت', 'type' => 'text', 'required' => true],
                'category'    => ['label' => 'التصنيف', 'type' => 'text', 'hint' => 'مثال: تصوير منتجات، كتابة، فيديو'],
                'tool'        => ['label' => 'الأداة', 'type' => 'text', 'hint' => 'Midjourney / ChatGPT / Claude …'],
                'prompt'      => ['label' => 'نص البرومبت', 'type' => 'code', 'full' => true, 'required' => true],
                'description' => ['label' => 'شرح / طريقة الاستخدام', 'type' => 'textarea', 'full' => true],
                'image_before' => ['label' => 'صورة «قبل» (اختياري)', 'type' => 'image', 'hint' => 'الصورة الأصلية قبل البرومبت — إذا رفعتها يظهر للزائر شريط مقارنة يسحبه'],
                'image'       => ['label' => 'صورة النتيجة «بعد»', 'type' => 'image'],
            ] + $common,
            'columns' => ['image', 'title', 'tool', 'category', 'published'],
        ],
        'posts' => [
            'title' => 'المدونة', 'singular' => 'مقال', 'icon' => 'newspaper',
            'desc'  => 'مقالاتك وأفكارك',
            'order' => 'published_at DESC, id DESC',
            'fields' => [
                'title'        => ['label' => 'عنوان المقال', 'type' => 'text', 'required' => true],
                'category'     => ['label' => 'التصنيف', 'type' => 'text'],
                'excerpt'      => ['label' => 'مقدمة مختصرة', 'type' => 'textarea', 'full' => true],
                'content'      => ['label' => 'محتوى المقال', 'type' => 'html', 'full' => true],
                'cover'        => ['label' => 'صورة الغلاف', 'type' => 'image'],
                'published_at' => ['label' => 'تاريخ النشر', 'type' => 'date'],
                'published'    => $common['published'],
            ],
            'columns' => ['cover', 'title', 'category', 'published_at', 'published'],
        ],
        'services' => [
            'title' => 'الخدمات', 'singular' => 'خدمة', 'icon' => 'headset',
            'desc'  => 'الخدمات اللي تقدمها',
            'fields' => [
                'title'       => ['label' => 'اسم الخدمة', 'type' => 'text', 'required' => true],
                'icon'        => ['label' => 'الأيقونة', 'type' => 'icon', 'options' => icon_choices(), 'default' => 'sparkles'],
                'description' => ['label' => 'الوصف', 'type' => 'textarea', 'full' => true],
                'features'    => ['label' => 'المزايا (سطر لكل ميزة)', 'type' => 'textarea', 'full' => true],
                'price_from'  => ['label' => 'السعر يبدأ من', 'type' => 'text', 'hint' => 'اختياري'],
            ] + $common,
            'columns' => ['icon', 'title', 'price_from', 'published'],
        ],
    ];
}

/** Homepage sections whose visibility, title and subtitle can be controlled */
function home_sections(): array
{
    // key => [menu label, title, subtitle, own page slug]
    return [
        'stats'    => ['الأرقام والأدوات', '', '', null],
        'about'    => ['نبذة عني', 'من أنا', '', 'about'],
        'services' => ['الخدمات', 'خدماتي', 'حلول إبداعية مدعومة بالذكاء الاصطناعي', 'services'],
        'works'    => ['الأعمال', 'أعمالي', 'مختارات من مشاريعي في الذكاء الاصطناعي', 'works'],
        'prompts'  => ['البرومبتات', 'برومبتات جاهزة', 'انسخها وجرّبها بنفسك', 'prompts'],
        'books'    => ['المتجر', 'المتجر', 'كتب ودورات ومنتجات رقمية', 'store'],
        'clients'  => ['العملاء', 'آراء العملاء', 'ماذا يقول من عمل معي', null],
        'partners' => ['شركاء النجاح', 'جهات أعتز بالعمل على مشاريعها', '', 'partners'],
        'blog'     => ['المدونة', 'من المدونة', 'أحدث المقالات والأفكار', 'blog'],
        'contact'  => ['تواصل', 'تواصل معي', 'عندك فكرة أو مشروع؟ خلنا نتكلم', 'contact'],
    ];
}

function settings_schema(): array
{
    $sections = [];
    foreach (home_sections() as $k => [$nav, $title, $sub]) {
        $sections['show_' . $k] = ['label' => 'إظهار قسم «' . $nav . '»', 'type' => 'bool', 'default' => 1];
        if ($title === '') {
            continue;
        }
        $sections[$k . '_title'] = ['label' => 'عنوان قسم «' . $nav . '»', 'type' => 'text', 'default' => $title];
        $sections[$k . '_subtitle'] = ['label' => 'وصف قسم «' . $nav . '»', 'type' => 'text', 'default' => $sub];
    }

    return [
        'general' => ['title' => 'عام', 'icon' => 'globe', 'fields' => [
            'maintenance'      => ['label' => 'وضع «قريباً»: الموقع مخفي عن الزوار (أنت تشوفه كامل)', 'type' => 'bool', 'default' => 1, 'full' => true, 'hint' => 'خله مفعّل لين تخلص تعبئة البيانات، بعدين طفّه عشان ينشر الموقع للجميع'],
            'soon_title'       => ['label' => 'عنوان صفحة «قريباً»', 'type' => 'text', 'default' => 'الموقع الجديد قريباً ✨'],
            'soon_text'        => ['label' => 'نص صفحة «قريباً»', 'type' => 'text', 'default' => 'نجهّز لكم تجربة جديدة كلياً — تابعوني لين الإطلاق.'],
            'site_name'        => ['label' => 'اسم الموقع', 'type' => 'text', 'default' => 'حسن'],
            'site_tagline'     => ['label' => 'الوصف المختصر', 'type' => 'text', 'default' => 'صانع محتوى ومبدع في الذكاء الاصطناعي'],
            'brand_photo'      => ['label' => 'صورتك (أعلى الموقع)', 'type' => 'image', 'hint' => 'صورة مربعة تظهر في دائرة جنب اسمك'],
            'brand_title'      => ['label' => 'صفتك تحت الاسم', 'type' => 'text', 'default' => 'AI', 'hint' => 'مثال: AI Creator أو صانع محتوى'],
            'logo'             => ['label' => 'شعار بدل الصورة والاسم (اختياري)', 'type' => 'image', 'hint' => 'إذا رفعته يظهر مكان الصورة والاسم'],
            'favicon'          => ['label' => 'أيقونة المتصفح (Favicon)', 'type' => 'image', 'hint' => 'PNG مربعة 512×512'],
            'meta_description' => ['label' => 'وصف الموقع لمحركات البحث', 'type' => 'textarea', 'full' => true, 'default' => 'الموقع الرسمي — أعمال ومشاريع في الذكاء الاصطناعي، برومبتات، كتب ودورات.'],
            'og_image'         => ['label' => 'صورة المشاركة (عند إرسال الرابط)', 'type' => 'image', 'hint' => '1200×630'],
            'footer_text'      => ['label' => 'نص الفوتر', 'type' => 'text', 'default' => 'جميع الحقوق محفوظة'],
        ]],
        'hero' => ['title' => 'البنر الرئيسي', 'icon' => 'image', 'fields' => [
            'badge_status'    => ['label' => 'حالة الشارة فوق العنوان', 'type' => 'select', 'options' => [
                'available' => '🟢 متاح لمشاريع جديدة', 'limited' => '🟡 متاح لعدد محدود', 'busy' => '🔴 مشغول حالياً',
                'partners' => '🔵 مفتوح للتعاون والشراكات', 'custom' => '⚪ نص ولون مخصص', 'hidden' => 'إخفاء الشارة',
            ], 'default' => 'available'],
            'hero_badge'      => ['label' => 'نص الشارة (اختياري)', 'type' => 'text', 'default' => '', 'hint' => 'اتركه فاضي ليظهر النص الافتراضي للحالة'],
            'badge_color'     => ['label' => 'لون النقطة (للحالة المخصصة)', 'type' => 'color', 'default' => '#22c55e'],
            'hero_title'      => ['label' => 'العنوان الرئيسي', 'type' => 'text', 'default' => 'أحوّل أفكارك إلى أعمال مذهلة بالذكاء الاصطناعي'],
            'hero_highlight'  => ['label' => 'كلمة مميزة بلون متدرج', 'type' => 'text', 'default' => 'بالذكاء الاصطناعي', 'hint' => 'لازم تكون موجودة داخل العنوان'],
            'hero_subtitle'   => ['label' => 'النص التعريفي', 'type' => 'textarea', 'full' => true, 'default' => 'صناعة محتوى، صور وفيديوهات، أتمتة، واستشارات — بأحدث أدوات الذكاء الاصطناعي وبلمسة إبداعية.'],
            'hero_cta_text'   => ['label' => 'نص الزر الأساسي', 'type' => 'text', 'default' => 'شاهد أعمالي'],
            'hero_cta_link'   => ['label' => 'رابط الزر الأساسي', 'type' => 'url', 'default' => '/works'],
            'hero_cta2_text'  => ['label' => 'نص الزر الثانوي', 'type' => 'text', 'default' => 'تواصل معي'],
            'hero_cta2_link'  => ['label' => 'رابط الزر الثانوي', 'type' => 'url', 'default' => '/contact'],
            'hero_image'      => ['label' => 'صورتك / صورة البنر', 'type' => 'image', 'hint' => 'يفضّل صورة عمودية أو مربعة'],
            'hero_img_size'   => ['label' => 'حجم صورة البنر', 'type' => 'select', 'options' => [
                '320' => 'صغير', '390' => 'متوسط', '450' => 'كبير', '520' => 'كبير جداً',
            ], 'default' => '390'],
            'hero_img_shape'  => ['label' => 'شكل صورة البنر', 'type' => 'select', 'options' => [
                'portrait' => 'عمودي (4:5)', 'tall' => 'طولي (3:4)', 'square' => 'مربع', 'circle' => 'دائرة', 'arch' => 'قوس من فوق', 'landscape' => 'أفقي (4:3)',
            ], 'default' => 'portrait'],
            'hero_ring'       => ['label' => 'إطار متحرك حول الصورة', 'type' => 'bool', 'default' => 1],
            'hero_bg'         => ['label' => 'خلفية البنر (اختياري)', 'type' => 'image'],
            'announce_on'     => ['label' => 'إظهار شريط الإعلان أعلى الموقع', 'type' => 'bool', 'default' => 0],
            'announce_text'   => ['label' => 'نص شريط الإعلان', 'type' => 'text', 'default' => '🎉 كتابي الجديد متوفر الآن'],
            'announce_link'   => ['label' => 'رابط شريط الإعلان', 'type' => 'url', 'default' => '/store'],
        ]],
        'about' => ['title' => 'نبذة عني', 'icon' => 'user', 'fields' => [
            'about_heading' => ['label' => 'العنوان', 'type' => 'text', 'default' => 'مرحباً، أنا حسن 👋'],
            'about_text'    => ['label' => 'النبذة', 'type' => 'textarea', 'full' => true, 'default' => "مبدع ومختص في توظيف الذكاء الاصطناعي لصناعة المحتوى والصور والفيديو.\nأساعد الأفراد والشركات يستفيدون من أدوات AI بطريقة عملية تختصر الوقت وتضاعف النتائج."],
            'about_image'   => ['label' => 'الصورة', 'type' => 'image'],
            'exp_on'        => ['label' => 'إظهار بوكس سنوات الخبرة جنب الصورة', 'type' => 'bool', 'default' => 1],
            'exp_num'       => ['label' => 'رقم الخبرة', 'type' => 'text', 'default' => '+5'],
            'exp_label'     => ['label' => 'نص الخبرة', 'type' => 'text', 'default' => 'سنوات خبرة'],
            'cv_url'        => ['label' => 'رابط السيرة الذاتية (اختياري)', 'type' => 'url'],
        ]],
        // Managed from Dashboard > Works (not shown as a settings tab)
        'works_opts' => ['title' => 'الأعمال', 'icon' => 'image', 'hidden' => true, 'fields' => [
            'work_btn'    => ['label' => 'نص الزر', 'type' => 'text', 'default' => 'مشاهدة العمل'],
            'work_btn_on' => ['label' => 'إظهار زر «مشاهدة العمل» في كل الأعمال', 'type' => 'bool', 'default' => 1],
        ]],
        'partners' => ['title' => 'شركاء النجاح', 'icon' => 'landmark', 'fields' => [
            'partners_btn'   => ['label' => 'نص الزر تحت الشعارات', 'type' => 'text', 'default' => 'معرفة المزيد'],
            'partners_speed' => ['label' => 'سرعة حركة الشعارات', 'type' => 'select', 'options' => [
                '90' => 'بطيئة جداً', '60' => 'بطيئة', '40' => 'متوسطة', '25' => 'سريعة', '0' => 'ثابتة (بدون حركة)',
            ], 'default' => '60'],
            'partners_size'  => ['label' => 'حجم الشعارات', 'type' => 'select', 'options' => ['48' => 'صغير', '60' => 'متوسط', '74' => 'كبير'], 'default' => '60'],
        ]],
        'store' => ['title' => 'صفحة المتجر', 'icon' => 'cart', 'fields' => [
            'store_eyebrow'   => ['label' => 'العنوان الصغير', 'type' => 'text', 'default' => 'المتجر'],
            'store_title'     => ['label' => 'العنوان الرئيسي', 'type' => 'text', 'default' => 'خبرتي في يدك'],
            'store_highlight' => ['label' => 'كلمة ملوّنة في العنوان', 'type' => 'text', 'default' => 'يدك'],
            'store_intro'     => ['label' => 'النص التعريفي', 'type' => 'textarea', 'full' => true, 'default' => 'كتاب إلكتروني وكورس تدريبي يساعدانك على اختصار الوقت وتطوير مهاراتك وتحقيق نتائج أفضل في صناعة الصور والفيديوهات بالذكاء الاصطناعي.'],
            'store_features_on' => ['label' => 'إظهار كروت المزايا', 'type' => 'bool', 'default' => 1],
            'faq_on'          => ['label' => 'إظهار الأسئلة الشائعة', 'type' => 'bool', 'default' => 1],
            'faq_title'       => ['label' => 'عنوان الأسئلة الشائعة', 'type' => 'text', 'default' => 'الأسئلة الشائعة'],
        ]],
        'story' => ['title' => 'صفحة القصة', 'icon' => 'flag', 'fields' => [
            'story_btn'      => ['label' => 'نص زر القصة (في نبذة عني)', 'type' => 'text', 'default' => 'اقرأ القصة كاملة'],
            'story_eyebrow'  => ['label' => 'العنوان الصغير', 'type' => 'text', 'default' => 'القصة'],
            'story_title'    => ['label' => 'عنوان الصفحة', 'type' => 'text', 'default' => 'كيف وصلت لهنا'],
            'story_intro'    => ['label' => 'مقدمة القصة', 'type' => 'textarea', 'full' => true, 'default' => 'رحلة بدأت بالكاميرا وانتهت بالذكاء الاصطناعي — وكل مرحلة فيها علمتني شي جديد.'],
            'story_cta'      => ['label' => 'نص الدعوة في آخر الصفحة', 'type' => 'text', 'default' => 'جاهز نبدأ مشروعك القادم؟'],
        ]],
        'contact' => ['title' => 'التواصل', 'icon' => 'contact', 'fields' => [
            'contact_email'    => ['label' => 'البريد الإلكتروني', 'type' => 'email', 'default' => 'hello@hsnpmt.com'],
            'show_email'       => ['label' => 'إظهار البريد', 'type' => 'bool', 'default' => 1],
            'whatsapp'         => ['label' => 'رقم واتساب (بالصيغة الدولية)', 'type' => 'text', 'hint' => 'مثال: 966500000000'],
            'show_whatsapp'    => ['label' => 'إظهار واتساب', 'type' => 'bool', 'default' => 1],
            'wa_message'       => ['label' => 'رسالة واتساب الجاهزة', 'type' => 'textarea', 'full' => true,
                'default' => "السلام عليكم حسن 👋\nجيتك من موقعك hsnpmt.com\nوأبغى أستفسر عن: ",
                'hint' => 'تنكتب تلقائياً للزائر لما يضغط واتساب — عشان تعرف إنه جاك من الموقع. اكتب {page} لاسم الصفحة اللي كان فيها'],
            'contact_phone'    => ['label' => 'رقم الجوال', 'type' => 'text'],
            'show_phone'       => ['label' => 'إظهار الجوال', 'type' => 'bool', 'default' => 1],
            'location'         => ['label' => 'الموقع / المدينة', 'type' => 'text', 'default' => 'السعودية'],
            'show_location'    => ['label' => 'إظهار الموقع', 'type' => 'bool', 'default' => 1],
            'wa_float'         => ['label' => 'زر واتساب العائم أسفل الشاشة', 'type' => 'bool', 'default' => 1],
            'show_form'        => ['label' => 'إظهار نموذج المراسلة', 'type' => 'bool', 'default' => 1],
        ]],
        'social' => ['title' => 'السوشال ميديا', 'icon' => 'globe', 'pairs' => true, 'fields' => [
            'social_x' => ['label' => 'X (تويتر)', 'type' => 'url'],
            'social_x_on' => ['label' => 'إظهار X (تويتر)', 'type' => 'bool', 'default' => 1],
            'social_instagram' => ['label' => 'إنستقرام', 'type' => 'url'],
            'social_instagram_on' => ['label' => 'إظهار إنستقرام', 'type' => 'bool', 'default' => 1],
            'social_tiktok' => ['label' => 'تيك توك', 'type' => 'url'],
            'social_tiktok_on' => ['label' => 'إظهار تيك توك', 'type' => 'bool', 'default' => 1],
            'social_snapchat' => ['label' => 'سناب شات', 'type' => 'url'],
            'social_snapchat_on' => ['label' => 'إظهار سناب شات', 'type' => 'bool', 'default' => 1],
            'social_youtube' => ['label' => 'يوتيوب', 'type' => 'url'],
            'social_youtube_on' => ['label' => 'إظهار يوتيوب', 'type' => 'bool', 'default' => 1],
            'social_facebook' => ['label' => 'فيسبوك', 'type' => 'url'],
            'social_facebook_on' => ['label' => 'إظهار فيسبوك', 'type' => 'bool', 'default' => 1],
            'social_linkedin' => ['label' => 'لينكدإن', 'type' => 'url'],
            'social_linkedin_on' => ['label' => 'إظهار لينكدإن', 'type' => 'bool', 'default' => 1],
            'social_threads' => ['label' => 'ثريدز', 'type' => 'url'],
            'social_threads_on' => ['label' => 'إظهار ثريدز', 'type' => 'bool', 'default' => 1],
            'social_behance' => ['label' => 'Behance', 'type' => 'url'],
            'social_behance_on' => ['label' => 'إظهار Behance', 'type' => 'bool', 'default' => 1],
            'social_telegram' => ['label' => 'تيليجرام', 'type' => 'url'],
            'social_telegram_on' => ['label' => 'إظهار تيليجرام', 'type' => 'bool', 'default' => 1],
            'social_github' => ['label' => 'GitHub', 'type' => 'url'],
            'social_github_on' => ['label' => 'إظهار GitHub', 'type' => 'bool', 'default' => 1],
        ]],
        'mail' => ['title' => 'البريد والرسائل', 'icon' => 'mail', 'fields' => [
            'smtp_user'     => ['label' => 'إيميل الإرسال', 'type' => 'email', 'hint' => 'إيميل على دومينك من Hostinger، مثل hello@hsnpmt.com'],
            'smtp_pass'     => ['label' => 'كلمة مرور الإيميل', 'type' => 'password', 'hint' => 'تنحفظ في قاعدة بياناتك فقط ولا تظهر مرة ثانية'],
            'smtp_host'     => ['label' => 'خادم SMTP', 'type' => 'text', 'default' => 'smtp.hostinger.com'],
            'smtp_port'     => ['label' => 'المنفذ', 'type' => 'number', 'default' => 465],
            'smtp_secure'   => ['label' => 'التشفير', 'type' => 'select', 'options' => ['ssl' => 'SSL (465)', 'tls' => 'TLS (587)', 'none' => 'بدون'], 'default' => 'ssl'],
            'mail_from_name'=> ['label' => 'اسم المرسل', 'type' => 'text', 'default' => 'حسن'],
            'verify_contact'=> ['label' => 'تأكيد إيميل الزائر برمز قبل إرسال رسالته', 'type' => 'bool', 'default' => 1],
            'notify_email'  => ['label' => 'أرسل لي إيميل عند وصول رسالة جديدة', 'type' => 'bool', 'default' => 1],
        ]],
        'appearance' => ['title' => 'المظهر', 'icon' => 'pen', 'fields' => [
            'accent_color'  => ['label' => 'اللون الأساسي', 'type' => 'color', 'default' => '#3b82f6'],
            'accent2_color' => ['label' => 'اللون الثانوي (للتدرّج)', 'type' => 'color', 'default' => '#8b5cf6'],
            'motion'        => ['label' => 'تفعيل الحركة (الموشن)', 'type' => 'bool', 'default' => 1],
            'dark_ends'     => ['label' => 'البنر والفوتر بالكحلي الداكن (والباقي فاتح)', 'type' => 'bool', 'default' => 1],
        ]],
        'sections' => ['title' => 'إظهار وإخفاء الأقسام', 'icon' => 'layout-grid', 'fields' => $sections],
    ];
}
