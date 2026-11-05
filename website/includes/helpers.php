<?php

/* ---------- Output ---------- */

function e($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function url(string $path = ''): string
{
    return BASE . ltrim($path, '/');
}

function asset(string $path): string
{
    $file = ROOT . '/' . ltrim($path, '/');
    $v = is_file($file) ? filemtime($file) : 1;
    return url($path) . '?v=' . $v;
}

/** Public URL of an uploaded file */
function media(?string $path): string
{
    if (!$path) {
        return '';
    }
    if (preg_match('~^https?://~i', $path)) {
        return $path;
    }
    return url($path);
}

/** Make links safe: reject javascript: and similar; add https:// when missing */
function clean_url(?string $u): string
{
    $u = trim((string) $u);
    if ($u === '') {
        return '';
    }
    if (preg_match('~^(https?://|mailto:|tel:|/|#|\?)~i', $u)) {
        return $u;
    }
    if (preg_match('~^[a-z][a-z0-9+.\-]*:~i', $u)) {
        return '';
    }
    return 'https://' . $u;
}

/** Internal links like #works always point to the homepage */
function link_href(?string $u): string
{
    $u = clean_url($u);
    if ($u !== '' && $u[0] === '#') {
        return url($u);
    }
    return $u;
}

function is_external(string $u): bool
{
    return (bool) preg_match('~^https?://~i', $u) && !str_contains($u, $_SERVER['HTTP_HOST'] ?? '#');
}

function lines(?string $text): array
{
    return array_values(array_filter(array_map('trim', preg_split('/\r?\n/', (string) $text)), 'strlen'));
}

function csv_list(?string $text): array
{
    return array_values(array_filter(array_map('trim', preg_split('/[,،]/u', (string) $text)), 'strlen'));
}

function nl2p(?string $text): string
{
    $out = '';
    foreach (lines($text) as $l) {
        $out .= '<p>' . e($l) . '</p>';
    }
    return $out;
}

function excerpt(?string $text, int $len = 140): string
{
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $text)));
    return mb_strlen($t) > $len ? mb_substr($t, 0, $len) . '…' : $t;
}

function ar_date(?string $d): string
{
    if (!$d || !($t = strtotime($d))) {
        return '';
    }
    $m = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return date('j', $t) . ' ' . $m[(int) date('n', $t) - 1] . ' ' . date('Y', $t);
}

function time_ago(?string $d): string
{
    if (!$d || !($t = strtotime($d))) {
        return '';
    }
    $diff = time() - $t;
    if ($diff < 60) return 'الآن';
    if ($diff < 3600) return 'قبل ' . floor($diff / 60) . ' دقيقة';
    if ($diff < 86400) return 'قبل ' . floor($diff / 3600) . ' ساعة';
    if ($diff < 86400 * 7) return 'قبل ' . floor($diff / 86400) . ' يوم';
    return ar_date($d);
}

function video_embed(?string $u): ?string
{
    $u = (string) $u;
    if (preg_match('~(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})~', $u, $m)) {
        return 'https://www.youtube-nocookie.com/embed/' . $m[1];
    }
    if (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $u, $m)) {
        return 'https://player.vimeo.com/video/' . $m[1];
    }
    return null;
}

function wa_link(string $text = ''): string
{
    $n = preg_replace('/\D/', '', (string) setting('whatsapp'));
    if (!$n) {
        return '';
    }
    return 'https://wa.me/' . $n . ($text !== '' ? '?text=' . rawurlencode($text) : '');
}

function safe_color(?string $c, string $fallback): string
{
    return preg_match('/^#[0-9a-f]{3}([0-9a-f]{3})?$/i', (string) $c) ? $c : $fallback;
}

/* ---------- Settings ---------- */

function settings_defaults(): array
{
    static $d = null;
    if ($d === null) {
        $d = [];
        foreach (settings_schema() as $g) {
            foreach ($g['fields'] as $k => $f) {
                $d[$k] = $f['default'] ?? '';
            }
        }
    }
    return $d;
}

function settings_all(bool $refresh = false): array
{
    static $s = null;
    if ($s === null || $refresh) {
        $s = settings_defaults();
        foreach (db()->query('SELECT name, value FROM settings') as $r) {
            $s[$r['name']] = $r['value'];
        }
    }
    return $s;
}

function setting(string $k, $default = '')
{
    $s = settings_all();
    return $s[$k] ?? $default;
}

function save_settings(array $kv): void
{
    $st = db()->prepare('INSERT OR REPLACE INTO settings(name, value) VALUES (?, ?)');
    foreach ($kv as $k => $v) {
        $st->execute([$k, (string) $v]);
    }
    settings_all(true);
}

function section_on(string $k): bool
{
    return (string) setting('show_' . $k) === '1';
}

/* ---------- Content ---------- */

function items(string $table, array $opt = []): array
{
    $ents = entities();
    if (!isset($ents[$table])) {
        return [];
    }
    $w = [];
    $p = [];
    if (empty($opt['all']) && isset($ents[$table]['fields']['published'])) {
        $w[] = 'published = 1';
    }
    if (!empty($opt['where'])) {
        $w[] = $opt['where'];
        $p = $opt['params'] ?? [];
    }
    $sql = "SELECT * FROM $table" . ($w ? ' WHERE ' . implode(' AND ', $w) : '');
    $sql .= ' ORDER BY ' . ($ents[$table]['order'] ?? 'sort_order ASC, id DESC');
    if (!empty($opt['limit'])) {
        $sql .= ' LIMIT ' . (int) $opt['limit'];
    }
    $st = db()->prepare($sql);
    $st->execute($p);
    return $st->fetchAll();
}

function item(string $table, int $id, bool $all = false): ?array
{
    if (!isset(entities()[$table])) {
        return null;
    }
    $sql = "SELECT * FROM $table WHERE id = ?" . (!$all && isset(entities()[$table]['fields']['published']) ? ' AND published = 1' : '');
    $st = db()->prepare($sql);
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function gallery_list(?string $json): array
{
    $a = json_decode((string) $json, true);
    return is_array($a) ? array_values(array_filter($a, 'is_string')) : [];
}

/* ---------- Session / auth ---------- */

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0, 'path' => BASE, 'httponly' => true, 'samesite' => 'Lax', 'secure' => is_https(),
    ]);
    session_start();
}

function is_logged_in(): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        if (empty($_COOKIE[SESSION_NAME])) {
            return false;
        }
        start_session();
    }
    if (empty($_SESSION['uid'])) {
        return false;
    }
    if (time() - ($_SESSION['last'] ?? 0) > 60 * 60 * 12) {
        $_SESSION = [];
        return false;
    }
    $_SESSION['last'] = time();
    return true;
}

function current_user(): ?array
{
    if (!is_logged_in()) {
        return null;
    }
    $st = db()->prepare('SELECT id, username FROM users WHERE id = ?');
    $st->execute([$_SESSION['uid']]);
    return $st->fetch() ?: null;
}

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function check_csrf(): void
{
    start_session();
    $t = $_POST['_csrf'] ?? '';
    if (!is_string($t) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $t)) {
        http_response_code(419);
        exit('انتهت صلاحية الصفحة، ارجع وحدّثها ثم حاول مرة ثانية.');
    }
}

function flash(?string $msg = null, string $type = 'ok')
{
    start_session();
    if ($msg !== null) {
        $_SESSION['flash'] = ['msg' => $msg, 'type' => $type];
        return null;
    }
    $f = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $f;
}

function redirect(string $to): void
{
    header('Location: ' . $to);
    exit;
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function app_secret(): string
{
    return (string) setting('_secret', 'x');
}

function ip_hash(): string
{
    return substr(hash('sha256', client_ip() . '|' . app_secret()), 0, 32);
}

/* ---------- Analytics ---------- */

function record_visit(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        return;
    }
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '' || preg_match('~bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python|headless|lighthouse|scan~i', $ua)) {
        return;
    }
    if (is_logged_in()) {
        return; // don't count your own visits
    }
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';
    if (str_starts_with($path, BASE)) {
        $path = '/' . substr($path, strlen(BASE));
    }
    $path = preg_replace('~/index\.php$~', '/', $path);
    parse_str((string) parse_url($uri, PHP_URL_QUERY), $q);
    if (!empty($q['id'])) {
        $path .= '?id=' . (int) $q['id'];
    }
    $refHost = (string) (parse_url((string) ($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_HOST) ?: '');
    if ($refHost === ($_SERVER['HTTP_HOST'] ?? '')) {
        $refHost = '';
    }
    $refHost = preg_replace('/^www\./', '', $refHost);
    $device = preg_match('~iPad|Tablet~i', $ua) ? 'tablet' : (preg_match('~Mobile|Android|iPhone~i', $ua) ? 'mobile' : 'desktop');
    $visitor = substr(hash('sha256', client_ip() . '|' . $ua . '|' . date('Y-m-d') . '|' . app_secret()), 0, 24);
    try {
        $st = db()->prepare('INSERT INTO visits (path, referrer, device, visitor, created_at) VALUES (?, ?, ?, ?, ?)');
        $st->execute([mb_substr($path, 0, 200), mb_substr($refHost, 0, 120), $device, $visitor, date('Y-m-d H:i:s')]);
        if (random_int(1, 200) === 1) { // light cleanup: keep the last 18 months
            db()->exec("DELETE FROM visits WHERE created_at < '" . date('Y-m-d', strtotime('-18 months')) . "'");
        }
    } catch (Throwable $e) {
        error_log('visit: ' . $e->getMessage());
    }
}

/* ---------- Uploads ---------- */

function normalize_files($f): array
{
    if (!$f || !isset($f['name'])) {
        return [];
    }
    if (!is_array($f['name'])) {
        return [$f];
    }
    $out = [];
    foreach ($f['name'] as $i => $n) {
        $out[] = ['name' => $n, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    }
    return $out;
}

/** Upload an image or video safely and return its relative path, or null when no file was sent */
function handle_upload(?array $file, string $kind = 'image'): ?string
{
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    $isVideo = $kind === 'video';
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE
            ? 'حجم الملف أكبر من المسموح في الاستضافة (' . ini_get('upload_max_filesize') . ').' : 'فشل رفع الملف، حاول مرة ثانية.');
    }
    $max = $isVideo ? 300 : 15;
    if ($file['size'] > $max * 1024 * 1024) {
        throw new RuntimeException('حجم الملف كبير جداً (الحد ' . $max . ' ميجا).');
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        throw new RuntimeException('ملف غير صالح.');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $types = $isVideo
        ? ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov', 'video/x-m4v' => 'm4v']
        : ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/avif' => 'avif', 'image/x-icon' => 'ico', 'image/vnd.microsoft.icon' => 'ico'];
    $ext = $types[$mime] ?? null;
    if (!$ext) {
        throw new RuntimeException($isVideo ? 'نوع الفيديو غير مدعوم. المسموح: MP4, WEBM, MOV.' : 'نوع الملف غير مدعوم. المسموح: JPG, PNG, WEBP, GIF, AVIF.');
    }
    $dir = 'uploads/' . date('Y/m');
    if (!is_dir(ROOT . '/' . $dir) && !mkdir(ROOT . '/' . $dir, 0755, true)) {
        throw new RuntimeException('تعذّر إنشاء مجلد الرفع، تأكد من صلاحيات مجلد uploads.');
    }
    $name = bin2hex(random_bytes(8)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], ROOT . '/' . $dir . '/' . $name)) {
        throw new RuntimeException('تعذّر حفظ الملف.');
    }
    return $dir . '/' . $name;
}

/** Read submitted form values according to the field definitions */
function collect_fields(array $fields, array $old = []): array
{
    $data = [];
    foreach ($fields as $name => $f) {
        switch ($f['type']) {
            case 'bool':
                $data[$name] = isset($_POST[$name]) ? 1 : 0;
                break;
            case 'number':
                $v = (int) ($_POST[$name] ?? 0);
                if (isset($f['min'])) $v = max($f['min'], $v);
                if (isset($f['max'])) $v = min($f['max'], $v);
                $data[$name] = $v;
                break;
            case 'image':
            case 'video':
                $cur = (string) ($old[$name] ?? '');
                if (!empty($_POST[$name . '__remove'])) {
                    $cur = '';
                }
                $up = handle_upload($_FILES[$name] ?? null, $f['type']);
                $data[$name] = $up ?: $cur;
                break;
            case 'gallery':
                $cur = gallery_list($old[$name] ?? '');
                $remove = (array) ($_POST[$name . '__remove'] ?? []);
                $cur = array_values(array_filter($cur, fn($p) => !in_array($p, $remove, true)));
                foreach (normalize_files($_FILES[$name] ?? null) as $file) {
                    if ($up = handle_upload($file)) {
                        $cur[] = $up;
                    }
                }
                $data[$name] = json_encode($cur, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                break;
            case 'url':
                $data[$name] = clean_url($_POST[$name] ?? '');
                break;
            case 'email':
                $v = trim((string) ($_POST[$name] ?? ''));
                if ($v !== '' && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
                    throw new RuntimeException('البريد الإلكتروني في «' . $f['label'] . '» غير صحيح.');
                }
                $data[$name] = $v;
                break;
            case 'color':
                $data[$name] = safe_color($_POST[$name] ?? '', (string) ($f['default'] ?? '#3b82f6'));
                break;
            case 'select':
            case 'icon':
                $v = (string) ($_POST[$name] ?? '');
                $data[$name] = array_key_exists($v, $f['options']) ? $v : (string) ($f['default'] ?? array_key_first($f['options']));
                break;
            case 'date':
                $v = (string) ($_POST[$name] ?? '');
                $data[$name] = preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : date('Y-m-d');
                break;
            default:
                $data[$name] = trim(str_replace("\r\n", "\n", (string) ($_POST[$name] ?? '')));
        }
        if (!empty($f['required']) && $data[$name] === '') {
            throw new RuntimeException('حقل «' . $f['label'] . '» مطلوب.');
        }
    }
    return $data;
}
