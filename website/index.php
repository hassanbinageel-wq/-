<?php
/*
 * Front controller: every address goes through here.
 *   /            homepage           /works, /store, /about …   section pages
 *   /work/12     a work             /post/3                    an article
 *   /send        contact form       /<secret>/                 dashboard (secret address)
 */

// Local development server only: serve real static files directly
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . urldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
    if (is_file($file) && !preg_match('~/(data|includes|pages|admin/views)/|\.(php|sqlite|ini|log)$|/\.~', $file)) {
        return false;
    }
}

require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';
require __DIR__ . '/includes/sections.php';

$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if (str_starts_with($path, BASE)) {
    $path = substr($path, strlen(BASE));
}
$path = trim(preg_replace('~/index\.php$~', '', $path), '/');
$parts = $path === '' ? [] : explode('/', $path);
$first = $parts[0] ?? '';

function not_found(): void
{
    http_response_code(404);
    require __DIR__ . '/pages/404.php';
    exit;
}

/* ---------- Dashboard (secret address only) ---------- */
$hasUser = (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
if ($first === 'setup' && !$hasUser) {
    header('X-Robots-Tag: noindex, nofollow');
    require __DIR__ . '/admin/login.php';
    exit;
}
if ($first !== '' && hash_equals(admin_slug(), $first) && $hasUser) {
    header('X-Robots-Tag: noindex, nofollow');
    $sub = $parts[1] ?? '';
    $files = ['' => 'index.php', 'login' => 'login.php', 'logout' => 'logout.php'];
    if (count($parts) > 2 || !isset($files[$sub])) {
        not_found();
    }
    require __DIR__ . '/admin/' . $files[$sub];
    exit;
}

/* ---------- Coming soon: visitors see a holding page while you fill in the site ---------- */
if ((string) setting('maintenance') === '1' && !is_logged_in()) {
    http_response_code(503);
    header('Retry-After: 86400');
    require __DIR__ . '/pages/soon.php';
    exit;
}

/* ---------- Public site ---------- */
$routes = [
    ''         => ['home', null],
    'about'    => ['about', 'about'],
    'story'    => ['story', 'about'],
    'services' => ['services', 'services'],
    'works'    => ['works', 'works'],
    'prompts'  => ['prompts', 'prompts'],
    'store'    => ['store', 'books'],
    'blog'     => ['blog', 'blog'],
    'contact'  => ['contact', 'contact'],
    'partners' => ['partners', 'partners'],
];
// Old addresses keep working
$aliases = ['blog.php' => 'blog', 'prompts.php' => 'prompts', 'story.php' => 'story'];
if (isset($aliases[$first]) && count($parts) === 1) {
    header('Location: ' . page_url($aliases[$first]), true, 301);
    exit;
}

if (count($parts) <= 1 && isset($routes[$first])) {
    [$page, $section] = $routes[$first];
    if ($section !== null && !section_on($section)) {
        not_found();
    }
    require __DIR__ . '/pages/' . $page . '.php';
    exit;
}

if (count($parts) === 2 && in_array($first, ['work', 'post', 'product'], true) && ctype_digit($parts[1])) {
    if ($first === 'product' && !section_on('books')) {
        not_found();
    }
    $_GET['id'] = (int) $parts[1];
    require __DIR__ . '/pages/' . $first . '.php';
    exit;
}
if (count($parts) === 1 && in_array($first, ['work.php', 'post.php'], true) && !empty($_GET['id'])) {
    header('Location: ' . ($first === 'work.php' ? work_url((int) $_GET['id']) : post_url((int) $_GET['id'])), true, 301);
    exit;
}

if ($path === 'send') {
    require __DIR__ . '/pages/send.php';
    exit;
}

not_found();
