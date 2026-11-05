<?php
/**
 * Content definitions.
 * Every section in the dashboard is described here, and the database tables
 * and add/edit forms are built from these definitions automatically.
 * To add a new field to any section, add it here and it appears in the dashboard.
 */

function service_icons(): array
{
    return [
        'sparkles'   => 'إبداع / AI',
        'image'      => 'صور',
        'video'      => 'فيديو',
        'bot'        => 'شات بوت',
        'cpu'        => 'ذكاء اصطناعي',
        'code'       => 'برمجة',
        'pen'        => 'تصميم',
        'megaphone'  => 'تسويق',
        'camera'     => 'تصوير',
        'graduation' => 'تدريب',
        'chart'      => 'تحليلات',
        'headset'    => 'استشارات',
    ];
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
                'video_url' => ['label' => 'رابط فيديو (YouTube / Vimeo)', 'type' => 'url'],
                'gallery'   => ['label' => 'معرض الصور', 'type' => 'gallery', 'full' => true],
                'link'      => ['label' => 'رابط المشروع الخارجي', 'type' => 'url'],
                'tools'     => ['label' => 'الأدوات المستخدمة', 'type' => 'text', 'hint' => 'افصل بينها بفاصلة: Midjourney, Runway, ChatGPT'],
                'featured'  => ['label' => 'عمل مميز', 'type' => 'bool'],
            ] + $common,
            'columns' => ['image', 'title', 'category', 'featured', 'published'],
        ],
        'partners' => [
            'title' => 'شركاء النجاح', 'singular' => 'شريك', 'icon' => 'landmark',
            'desc'  => 'الجهات والشركات اللي اشتغلت معها',
            'fields' => [
                'name'        => ['label' => 'اسم الشريك', 'type' => 'text', 'required' => true],
                'logo'        => ['label' => 'الشعار', 'type' => 'image', 'hint' => 'يفضّل PNG بخلفية شفافة'],
                'url'         => ['label' => 'الموقع', 'type' => 'url'],
                'description' => ['label' => 'نبذة', 'type' => 'textarea', 'full' => true],
            ] + $common,
            'columns' => ['logo', 'name', 'url', 'published'],
        ],
        'books' => [
            'title' => 'الكتب والمتجر', 'singular' => 'منتج', 'icon' => 'book',
            'desc'  => 'كتبك ودوراتك ومنتجاتك الرقمية',
            'fields' => [
                'title'       => ['label' => 'اسم المنتج', 'type' => 'text', 'required' => true],
                'kind'        => ['label' => 'النوع', 'type' => 'select', 'options' => [
                    'book' => 'كتاب', 'ebook' => 'كتاب إلكتروني', 'course' => 'دورة', 'product' => 'منتج رقمي', 'package' => 'باقة',
                ], 'default' => 'book'],
                'description' => ['label' => 'الوصف', 'type' => 'textarea', 'full' => true],
                'image'       => ['label' => 'صورة الغلاف', 'type' => 'image'],
                'price'       => ['label' => 'السعر', 'type' => 'text', 'hint' => 'مثال: 99 ر.س — أو اكتب «مجاني»'],
                'old_price'   => ['label' => 'السعر قبل الخصم', 'type' => 'text'],
                'buy_url'     => ['label' => 'رابط الشراء', 'type' => 'url', 'hint' => 'سلة / زد / Gumroad… اتركه فاضي ليصير الطلب عبر واتساب'],
                'button_text' => ['label' => 'نص الزر', 'type' => 'text', 'default' => 'اشترِ الآن'],
            ] + $common,
            'columns' => ['image', 'title', 'kind', 'price', 'published'],
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
                'image'       => ['label' => 'صورة النتيجة', 'type' => 'image'],
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
                'icon'        => ['label' => 'الأيقونة', 'type' => 'icon', 'options' => service_icons(), 'default' => 'sparkles'],
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
    return [
        'about'    => ['نبذة عني', 'من أنا', ''],
        'services' => ['الخدمات', 'خدماتي', 'حلول إبداعية مدعومة بالذكاء الاصطناعي'],
        'works'    => ['الأعمال', 'أعمالي', 'مختارات من مشاريعي في الذكاء الاصطناعي'],
        'prompts'  => ['البرومبتات', 'برومبتات جاهزة', 'انسخها وجرّبها بنفسك'],
        'books'    => ['المتجر', 'الكتب والمتجر', 'كتب ودورات ومنتجات رقمية'],
        'clients'  => ['العملاء', 'آراء العملاء', 'ماذا يقول من عمل معي'],
        'partners' => ['الشركاء', 'شركاء النجاح', ''],
        'blog'     => ['المدونة', 'من المدونة', 'أحدث المقالات والأفكار'],
        'contact'  => ['تواصل', 'تواصل معي', 'عندك فكرة أو مشروع؟ خلنا نتكلم'],
    ];
}

function settings_schema(): array
{
    $sections = [];
    foreach (home_sections() as $k => [$nav, $title, $sub]) {
        $sections['show_' . $k] = ['label' => 'إظهار قسم «' . $nav . '»', 'type' => 'bool', 'default' => 1];
        $sections[$k . '_title'] = ['label' => 'عنوان قسم «' . $nav . '»', 'type' => 'text', 'default' => $title];
        $sections[$k . '_subtitle'] = ['label' => 'وصف قسم «' . $nav . '»', 'type' => 'text', 'default' => $sub];
    }

    return [
        'general' => ['title' => 'عام', 'icon' => 'globe', 'fields' => [
            'site_name'        => ['label' => 'اسم الموقع', 'type' => 'text', 'default' => 'حسن'],
            'site_tagline'     => ['label' => 'الوصف المختصر', 'type' => 'text', 'default' => 'صانع محتوى ومبدع في الذكاء الاصطناعي'],
            'logo'             => ['label' => 'الشعار', 'type' => 'image', 'hint' => 'اتركه فاضي ليظهر اسم الموقع بدلاً منه'],
            'favicon'          => ['label' => 'أيقونة المتصفح (Favicon)', 'type' => 'image', 'hint' => 'PNG مربعة 512×512'],
            'meta_description' => ['label' => 'وصف الموقع لمحركات البحث', 'type' => 'textarea', 'full' => true, 'default' => 'الموقع الرسمي — أعمال ومشاريع في الذكاء الاصطناعي، برومبتات، كتب ودورات.'],
            'og_image'         => ['label' => 'صورة المشاركة (عند إرسال الرابط)', 'type' => 'image', 'hint' => '1200×630'],
            'footer_text'      => ['label' => 'نص الفوتر', 'type' => 'text', 'default' => 'جميع الحقوق محفوظة'],
        ]],
        'hero' => ['title' => 'البنر الرئيسي', 'icon' => 'image', 'fields' => [
            'hero_badge'      => ['label' => 'الشارة الصغيرة فوق العنوان', 'type' => 'text', 'default' => 'متاح لمشاريع جديدة'],
            'hero_title'      => ['label' => 'العنوان الرئيسي', 'type' => 'text', 'default' => 'أحوّل أفكارك إلى أعمال مذهلة بالذكاء الاصطناعي'],
            'hero_highlight'  => ['label' => 'كلمة مميزة بلون متدرج', 'type' => 'text', 'default' => 'بالذكاء الاصطناعي', 'hint' => 'لازم تكون موجودة داخل العنوان'],
            'hero_subtitle'   => ['label' => 'النص التعريفي', 'type' => 'textarea', 'full' => true, 'default' => 'صناعة محتوى، صور وفيديوهات، أتمتة، واستشارات — بأحدث أدوات الذكاء الاصطناعي وبلمسة إبداعية.'],
            'hero_cta_text'   => ['label' => 'نص الزر الأساسي', 'type' => 'text', 'default' => 'شاهد أعمالي'],
            'hero_cta_link'   => ['label' => 'رابط الزر الأساسي', 'type' => 'url', 'default' => '#works'],
            'hero_cta2_text'  => ['label' => 'نص الزر الثانوي', 'type' => 'text', 'default' => 'تواصل معي'],
            'hero_cta2_link'  => ['label' => 'رابط الزر الثانوي', 'type' => 'url', 'default' => '#contact'],
            'hero_image'      => ['label' => 'صورتك / صورة البنر', 'type' => 'image', 'hint' => 'يفضّل صورة عمودية أو مربعة'],
            'hero_bg'         => ['label' => 'خلفية البنر (اختياري)', 'type' => 'image'],
            'hero_tools'      => ['label' => 'الأدوات العائمة حول الصورة', 'type' => 'text', 'default' => 'Midjourney, ChatGPT, Runway, Claude', 'hint' => 'افصل بينها بفاصلة'],
            'announce_on'     => ['label' => 'إظهار شريط الإعلان أعلى الموقع', 'type' => 'bool', 'default' => 0],
            'announce_text'   => ['label' => 'نص شريط الإعلان', 'type' => 'text', 'default' => '🎉 كتابي الجديد متوفر الآن'],
            'announce_link'   => ['label' => 'رابط شريط الإعلان', 'type' => 'url', 'default' => '#books'],
        ]],
        'about' => ['title' => 'نبذة عني', 'icon' => 'user', 'fields' => [
            'about_heading' => ['label' => 'العنوان', 'type' => 'text', 'default' => 'مرحباً، أنا حسن 👋'],
            'about_text'    => ['label' => 'النبذة', 'type' => 'textarea', 'full' => true, 'default' => "مبدع ومختص في توظيف الذكاء الاصطناعي لصناعة المحتوى والصور والفيديو.\nأساعد الأفراد والشركات يستفيدون من أدوات AI بطريقة عملية تختصر الوقت وتضاعف النتائج."],
            'about_image'   => ['label' => 'الصورة', 'type' => 'image'],
            'about_skills'  => ['label' => 'المهارات (سطر لكل مهارة)', 'type' => 'textarea', 'full' => true, 'default' => "توليد الصور بالذكاء الاصطناعي\nصناعة الفيديو بالـ AI\nهندسة البرومبتات\nأتمتة الأعمال\nصناعة المحتوى"],
            'stat1_num'     => ['label' => 'إحصائية 1 — الرقم', 'type' => 'text', 'default' => '+150'],
            'stat1_label'   => ['label' => 'إحصائية 1 — الوصف', 'type' => 'text', 'default' => 'مشروع منجز'],
            'stat2_num'     => ['label' => 'إحصائية 2 — الرقم', 'type' => 'text', 'default' => '+60'],
            'stat2_label'   => ['label' => 'إحصائية 2 — الوصف', 'type' => 'text', 'default' => 'عميل سعيد'],
            'stat3_num'     => ['label' => 'إحصائية 3 — الرقم', 'type' => 'text', 'default' => '+3'],
            'stat3_label'   => ['label' => 'إحصائية 3 — الوصف', 'type' => 'text', 'default' => 'سنوات خبرة'],
            'stat4_num'     => ['label' => 'إحصائية 4 — الرقم', 'type' => 'text', 'default' => '+50K'],
            'stat4_label'   => ['label' => 'إحصائية 4 — الوصف', 'type' => 'text', 'default' => 'متابع'],
            'cv_url'        => ['label' => 'رابط السيرة الذاتية (اختياري)', 'type' => 'url'],
        ]],
        'contact' => ['title' => 'التواصل والسوشال', 'icon' => 'contact', 'fields' => [
            'contact_email'    => ['label' => 'البريد الإلكتروني', 'type' => 'email', 'default' => 'hello@hsnpmt.com'],
            'contact_phone'    => ['label' => 'رقم الجوال', 'type' => 'text'],
            'whatsapp'         => ['label' => 'رقم واتساب (بالصيغة الدولية)', 'type' => 'text', 'hint' => 'مثال: 966500000000'],
            'location'         => ['label' => 'الموقع / المدينة', 'type' => 'text', 'default' => 'السعودية'],
            'notify_email'     => ['label' => 'أرسل لي إيميل عند وصول رسالة جديدة', 'type' => 'bool', 'default' => 1],
            'social_x'         => ['label' => 'X (تويتر)', 'type' => 'url'],
            'social_instagram' => ['label' => 'إنستقرام', 'type' => 'url'],
            'social_tiktok'    => ['label' => 'تيك توك', 'type' => 'url'],
            'social_youtube'   => ['label' => 'يوتيوب', 'type' => 'url'],
            'social_linkedin'  => ['label' => 'لينكدإن', 'type' => 'url'],
            'social_snapchat'  => ['label' => 'سناب شات', 'type' => 'url'],
            'social_telegram'  => ['label' => 'تيليجرام', 'type' => 'url'],
            'social_github'    => ['label' => 'GitHub', 'type' => 'url'],
        ]],
        'appearance' => ['title' => 'المظهر', 'icon' => 'pen', 'fields' => [
            'theme'         => ['label' => 'الوضع', 'type' => 'select', 'options' => ['dark' => 'داكن', 'light' => 'فاتح'], 'default' => 'dark'],
            'accent_color'  => ['label' => 'اللون الأساسي', 'type' => 'color', 'default' => '#3b82f6'],
            'accent2_color' => ['label' => 'اللون الثانوي (للتدرّج)', 'type' => 'color', 'default' => '#8b5cf6'],
            'motion'        => ['label' => 'تفعيل الحركة (الموشن)', 'type' => 'bool', 'default' => 1],
        ]],
        'sections' => ['title' => 'أقسام الصفحة', 'icon' => 'layout-grid', 'fields' => $sections],
    ];
}
