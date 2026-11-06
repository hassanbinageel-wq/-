<?php

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $file = DATA_DIR . '/site.sqlite';
    $isNew = !file_exists($file);
    $pdo = new PDO('sqlite:' . $file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    $created = migrate($pdo);
    if ($isNew) {
        seed($pdo);
    } elseif ($created) {
        seed($pdo, $created); // new sections added after install get sample content
    }
    return $pdo;
}

function col_type(array $f): string
{
    return in_array($f['type'], ['bool', 'number'], true) ? 'INTEGER' : 'TEXT';
}

/** Create/update tables from the definitions (only runs when the definitions change) */
function migrate(PDO $pdo): array
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT)');
    $sig = md5(json_encode(array_map(fn($e) => array_map(fn($f) => $f['type'], $e['fields']), entities())) . 'v2');
    $cur = $pdo->query("SELECT value FROM settings WHERE name = '_schema'")->fetchColumn();
    if ($cur === $sig) {
        return [];
    }
    $created = [];

    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, email TEXT, phone TEXT, subject TEXT, message TEXT,
        is_read INTEGER DEFAULT 0, ip_hash TEXT, created_at TEXT
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT, referrer TEXT, device TEXT, visitor TEXT, created_at TEXT
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS visits_created ON visits(created_at)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT, at INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE,
        name TEXT, email TEXT, phone TEXT, subject TEXT, message TEXT,
        code_hash TEXT, attempts INTEGER DEFAULT 0, ip_hash TEXT, sent_at INTEGER, expires_at INTEGER
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS message_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER, body TEXT, created_at TEXT
    )');

    foreach (entities() as $table => $def) {
        $exists = $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = " . $pdo->quote($table))->fetchColumn();
        if (!$exists) {
            $created[] = $table;
        }
        $pdo->exec("CREATE TABLE IF NOT EXISTS $table (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, updated_at TEXT)");
        $existing = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(), 'name');
        foreach ($def['fields'] as $name => $f) {
            if (!in_array($name, $existing, true)) {
                $type = col_type($f);
                $default = $type === 'INTEGER' ? (int) ($f['default'] ?? 0) : $pdo->quote((string) ($f['default'] ?? ''));
                $pdo->exec("ALTER TABLE $table ADD COLUMN $name $type DEFAULT $default");
            }
        }
    }
    $st = $pdo->prepare('INSERT OR REPLACE INTO settings(name, value) VALUES (?, ?)');
    $st->execute(['_schema', $sig]);
    $secret = $pdo->query("SELECT value FROM settings WHERE name = '_secret'")->fetchColumn();
    if (!$secret) {
        $st->execute(['_secret', bin2hex(random_bytes(32))]);
    }
    // Secret dashboard address (changeable from the dashboard: Account)
    if (!$pdo->query("SELECT value FROM settings WHERE name = 'admin_slug'")->fetchColumn()) {
        $st->execute(['admin_slug', 'panel-' . bin2hex(random_bytes(4))]);
    }
    return $created;
}

/** Sample content on first run — edit or delete it from the dashboard */
function seed(PDO $pdo, ?array $only = null): void
{
    $now = date('Y-m-d H:i:s');
    $rows = [
        'store_features' => [
            ['title' => 'تحميل فوري', 'description' => 'احصل على ملفاتك مباشرة بعد الشراء', 'icon' => 'download', 'sort_order' => 1],
            ['title' => 'دعم مباشر', 'description' => 'تواصل مباشر للأسئلة والاستفسارات', 'icon' => 'headset', 'sort_order' => 2],
        ],
        'faqs' => [
            ['question' => 'ما صيغة الملفات؟', 'answer' => 'الكتب بصيغة PDF عالية الجودة، والفيديوهات بصيغة MP4.', 'sort_order' => 1],
            ['question' => 'هل يمكنني طباعة الكتب؟', 'answer' => 'نعم! الكتب مرخّصة للاستخدام الشخصي ويمكن طباعتها.', 'sort_order' => 2],
            ['question' => 'كيف أحصل على الملفات بعد الشراء؟', 'answer' => 'ستحصل على المحتوى مباشرة بعد إتمام الدفع.', 'sort_order' => 3],
        ],
        'stats' => [
            ['value' => '48+', 'label' => 'مشروع منجز', 'sort_order' => 1],
            ['value' => '25+', 'label' => 'عميل راضٍ', 'sort_order' => 2],
            ['value' => '2', 'label' => 'منتجات تعليمية', 'sort_order' => 3],
            ['value' => '+2M', 'label' => 'مشاهدة', 'sort_order' => 4],
            ['value' => '4.9', 'label' => 'متوسط التقييم', 'sort_order' => 5],
            ['value' => '24h', 'label' => 'متوسط وقت الرد', 'sort_order' => 6],
        ],
        'tools' => [
            ['name' => 'Nano Banana', 'icon' => 'image-plus', 'in_hero' => 1, 'sort_order' => 1],
            ['name' => 'Seedance', 'icon' => 'film', 'in_hero' => 1, 'sort_order' => 2],
            ['name' => 'Kling', 'icon' => 'video', 'in_hero' => 1, 'sort_order' => 3],
        ],
        'timeline' => [
            ['year' => '2015', 'title' => 'بداية الرحلة', 'description' => 'بدأت كمصور تقليدي في تصوير البرامج التلفزيونية.', 'icon' => 'camera'],
            ['year' => '2019', 'title' => 'دخول عالم المونتاج', 'description' => 'تخصصت في تصوير الأفلام والإعلانات.', 'icon' => 'clapperboard'],
            ['year' => '2022', 'title' => 'اكتشاف AI', 'description' => 'بدأت تجربة إنشاء الصور واكتشفت إمكانيات الذكاء الاصطناعي في الإنتاج البصري.', 'icon' => 'sparkles'],
            ['year' => '2025', 'title' => 'التحول الكامل', 'description' => 'انتقلت للعمل بالكامل باستخدام AI مع الحفاظ على الجودة الاحترافية.', 'icon' => 'rocket'],
            ['year' => '2026', 'title' => 'خبير معتمد', 'description' => '+48 مشروع منجز، +25 عميل، وكورس عن الإخراج السينمائي بالـ AI وكتاب منشور في مجال تعديل الصور بالـ AI.', 'icon' => 'award', 'highlight' => 1],
        ],
        'services' => [
            ['title' => 'صناعة الصور بالذكاء الاصطناعي', 'icon' => 'image', 'description' => 'صور إعلانية وفنية احترافية لمنتجك أو علامتك التجارية باستخدام Midjourney وأدوات التوليد الحديثة.', 'features' => "صور منتجات\nهوية بصرية\nمحتوى سوشال ميديا", 'sort_order' => 1],
            ['title' => 'فيديو وإعلانات AI', 'icon' => 'video', 'description' => 'فيديوهات قصيرة وإعلانات سينمائية مولّدة بالذكاء الاصطناعي، من الفكرة حتى المونتاج.', 'features' => "ريلز وتيك توك\nإعلانات منتجات\nتعليق صوتي AI", 'sort_order' => 2],
            ['title' => 'أتمتة وشات بوت', 'icon' => 'bot', 'description' => 'أبني لك أنظمة ذكية تختصر وقتك: ردود آلية، مساعد ذكي، وربط الأدوات ببعض.', 'features' => "شات بوت لمتجرك\nأتمتة المهام المتكررة\nربط الأدوات", 'sort_order' => 3],
            ['title' => 'دورات واستشارات', 'icon' => 'graduation', 'description' => 'جلسات تدريبية واستشارات للأفراد والفرق لتعلّم استخدام أدوات AI بشكل عملي.', 'features' => "جلسات فردية\nورش عمل للشركات\nخطط تطبيق عملية", 'sort_order' => 4],
        ],
        'works' => [
            ['title' => 'حملة إعلانية لعلامة عطور', 'category' => 'صور AI', 'summary' => 'سلسلة صور إعلانية فاخرة مولّدة بالكامل بالذكاء الاصطناعي.', 'tools' => 'Midjourney, Photoshop', 'featured' => 1, 'sort_order' => 1],
            ['title' => 'فيلم قصير بالذكاء الاصطناعي', 'category' => 'فيديو', 'summary' => 'قصة قصيرة سينمائية مدتها دقيقتان، كل لقطة فيها مولّدة بـ AI.', 'tools' => 'Runway, Kling, ElevenLabs', 'sort_order' => 2],
            ['title' => 'مساعد ذكي لخدمة العملاء', 'category' => 'أتمتة', 'summary' => 'شات بوت يرد على العملاء على مدار الساعة ويحوّل الطلبات تلقائياً.', 'tools' => 'ChatGPT, Make', 'sort_order' => 3],
            ['title' => 'هوية بصرية لمقهى', 'category' => 'صور AI', 'summary' => 'تصميم هوية وصور منيو كاملة بمساعدة الذكاء الاصطناعي.', 'tools' => 'Midjourney, Illustrator', 'sort_order' => 4],
        ],
        'prompts' => [
            ['title' => 'تصوير منتج فاخر', 'category' => 'تصوير منتجات', 'tool' => 'Midjourney', 'prompt' => 'luxury perfume bottle on black marble, dramatic rim lighting, golden reflections, soft smoke, product photography, 85mm, ultra detailed --ar 4:5 --style raw', 'description' => 'غيّر اسم المنتج والخامة حسب منتجك.', 'sort_order' => 1],
            ['title' => 'كاتب محتوى سوشال ميديا', 'category' => 'كتابة', 'tool' => 'ChatGPT', 'prompt' => "تصرّف كخبير تسويق بالمحتوى. اكتب لي 5 أفكار منشورات لحساب [مجال الحساب] موجهة لـ [الجمهور]، لكل فكرة: عنوان جذاب، نص قصير، ودعوة لاتخاذ إجراء.", 'description' => 'استبدل ما بين الأقواس بمعلوماتك.', 'sort_order' => 2],
            ['title' => 'لقطة سينمائية', 'category' => 'فيديو', 'tool' => 'Runway', 'prompt' => 'slow cinematic dolly shot through a misty desert at golden hour, a lone figure in white thobe walking, volumetric light, film grain, 35mm anamorphic', 'description' => '', 'sort_order' => 3],
        ],
        'books' => [
            ['title' => 'دليل البرومبتات العربي', 'kind' => 'ebook', 'description' => 'أكثر من 300 برومبت جاهز مقسمة حسب الاستخدام، مع شرح طريقة التعديل عليها.', 'price' => '49 ر.س', 'old_price' => '79 ر.س', 'button_text' => 'اشترِ الآن', 'sort_order' => 1],
            ['title' => 'دورة صناعة الفيديو بالـ AI', 'kind' => 'course', 'description' => 'من الصفر إلى أول فيديو احترافي: الأدوات، البرومبتات، والمونتاج.', 'price' => '299 ر.س', 'button_text' => 'سجّل الآن', 'sort_order' => 2],
        ],
        'clients' => [
            ['name' => 'سارة العتيبي', 'role' => 'مؤسسة متجر إلكتروني', 'testimonial' => 'الصور اللي سوّاها لمنتجاتنا رفعت المبيعات بشكل واضح، وسرعة التسليم كانت ممتازة.', 'rating' => 5, 'sort_order' => 1],
            ['name' => 'محمد القحطاني', 'role' => 'مدير تسويق', 'testimonial' => 'تعامل احترافي وأفكار إبداعية خارج الصندوق. أنصح فيه بقوة.', 'rating' => 5, 'sort_order' => 2],
            ['name' => 'ريم الشهري', 'role' => 'صانعة محتوى', 'testimonial' => 'الدورة غيّرت طريقتي في صناعة المحتوى، صرت أنجز بنص الوقت.', 'rating' => 5, 'sort_order' => 3],
        ],
        'partners' => [
            ['name' => 'شريك 1', 'sort_order' => 1], ['name' => 'شريك 2', 'sort_order' => 2],
            ['name' => 'شريك 3', 'sort_order' => 3], ['name' => 'شريك 4', 'sort_order' => 4],
            ['name' => 'شريك 5', 'sort_order' => 5], ['name' => 'شريك 6', 'sort_order' => 6],
            ['name' => 'شريك 7', 'sort_order' => 7], ['name' => 'شريك 8', 'sort_order' => 8],
        ],
        'posts' => [
            ['title' => 'كيف تبدأ في عالم الذكاء الاصطناعي؟', 'category' => 'بداية', 'excerpt' => 'خارطة طريق بسيطة للمبتدئين: الأدوات اللي تحتاجها وأول خطوة تبدأ فيها.', 'content' => '<p>اكتب محتوى مقالك هنا من لوحة التحكم.</p>', 'published_at' => date('Y-m-d')],
            ['title' => 'أفضل 5 أدوات لصناعة الفيديو بالـ AI', 'category' => 'أدوات', 'excerpt' => 'مقارنة سريعة بين أشهر أدوات توليد الفيديو ومتى تستخدم كل وحدة.', 'content' => '<p>اكتب محتوى مقالك هنا من لوحة التحكم.</p>', 'published_at' => date('Y-m-d', strtotime('-3 days'))],
        ],
    ];
    foreach ($rows as $table => $list) {
        if ($only !== null && !in_array($table, $only, true)) {
            continue;
        }
        foreach ($list as $r) {
            $r['created_at'] = $now;
            $r['updated_at'] = $now;
            $cols = array_keys($r);
            $st = $pdo->prepare("INSERT INTO $table (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')');
            $st->execute(array_values($r));
        }
    }
}
