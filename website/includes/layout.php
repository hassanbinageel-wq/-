<?php

function placeholder(string $iconName = 'sparkles', string $label = ''): string
{
    return '<div class="ph">' . icon($iconName, 'ic ph-ic') . ($label !== '' ? '<span>' . e($label) . '</span>' : '') . '</div>';
}

/** Menu items: each section opens its own page */
function nav_items(): array
{
    $items = [];
    foreach (['about', 'services', 'works', 'prompts', 'books', 'blog'] as $k) {
        if (section_on($k)) {
            $sec = home_sections()[$k];
            $items[$sec[3]] = $sec[0];
        }
    }
    return $items;
}

function current_page(?string $set = null): string
{
    static $page = 'home';
    if ($set !== null) {
        $page = $set;
    }
    return $page;
}

function site_head(string $title = '', string $desc = '', string $image = '', string $bodyClass = ''): void
{
    record_visit();
    $s = settings_all();
    $full = $title !== '' ? $title . ' | ' . $s['site_name'] : $s['site_name'] . ' — ' . $s['site_tagline'];
    $desc = $desc !== '' ? $desc : $s['meta_description'];
    $img = media($image ?: $s['og_image'] ?: $s['hero_image']);
    $scheme = is_https() ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($img && $img[0] === '/') {
        $img = $scheme . $host . $img;
    }
    $accent = safe_color($s['accent_color'], '#3b82f6');
    $accent2 = safe_color($s['accent2_color'], '#8b5cf6');
    $theme = 'light'; // the site is light only
    ?>
<!doctype html>
<html lang="ar" dir="rtl" data-theme="<?= $theme ?>" class="<?= $s['motion'] === '1' || $s['motion'] === 1 ? 'motion' : '' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($full) ?></title>
<meta name="description" content="<?= e(excerpt($desc, 200)) ?>">
<meta property="og:type" content="website">
<meta property="og:title" content="<?= e($full) ?>">
<meta property="og:description" content="<?= e(excerpt($desc, 200)) ?>">
<?php if ($img): ?><meta property="og:image" content="<?= e($img) ?>">
<meta name="twitter:card" content="summary_large_image"><?php endif; ?>
<meta name="theme-color" content="<?= $theme === 'light' ? '#f6f8fc' : '#070b16' ?>">
<?php if ($s['favicon']): ?><link rel="icon" href="<?= e(media($s['favicon'])) ?>"><?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('assets/css/site.css') ?>">
<style>:root{--accent:<?= $accent ?>;--accent2:<?= $accent2 ?>}</style>
<script>document.documentElement.classList.add('js')</script>
</head>
<body class="<?= e($bodyClass) ?>">
<?php if ((string) $s['announce_on'] === '1' && $s['announce_text']): ?>
<a class="announce" href="<?= e(link_href($s['announce_link']) ?: '#') ?>"><span><?= e($s['announce_text']) ?></span><?= icon('arrow-left', 'ic') ?></a>
<?php endif; ?>
<header class="site-header" id="siteHeader">
  <div class="container header-inner">
    <a class="brand" href="<?= url() ?>">
      <?= brand_html() ?>
    </a>
    <nav class="nav" id="nav" aria-label="القائمة">
      <a href="<?= url() ?>" class="<?= current_page() === 'home' ? 'active' : '' ?>"<?= current_page() === 'home' ? ' aria-current="page"' : '' ?>>الرئيسية</a>
      <?php foreach (nav_items() as $slug => $label): ?>
        <a href="<?= page_url($slug) ?>" class="<?= current_page() === $slug ? 'active' : '' ?>"<?= current_page() === $slug ? ' aria-current="page"' : '' ?>><?= e($label) ?></a>
      <?php endforeach; ?>
      <?php if (section_on('contact')): ?><a class="btn btn-sm btn-primary nav-cta" href="<?= page_url('contact') ?>">تواصل معي</a><?php endif; ?>
    </nav>
    <div class="header-tools">
      <button class="icon-toggle menu-btn" id="menuBtn" aria-label="فتح القائمة" aria-expanded="false"><?= icon('menu') ?></button>
    </div>
  </div>
</header>
<main>
<?php
}

function site_foot(): void
{
    $s = settings_all();
    ?>
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <a class="brand" href="<?= url() ?>">
        <?= brand_html() ?>
      </a>
      <p><?= e($s['site_tagline']) ?></p>
    </div>
    <nav class="footer-nav">
      <?php foreach (nav_items() as $slug => $label): ?><a href="<?= page_url($slug) ?>"><?= e($label) ?></a><?php endforeach; ?>
      <?php if (section_on('contact')): ?><a href="<?= page_url('contact') ?>">تواصل</a><?php endif; ?>
    </nav>
    <div class="socials">
      <?php foreach (social_links() as $sl): ?>
        <a href="<?= e($sl['url']) ?>" target="_blank" rel="noopener" aria-label="<?= e($sl['label']) ?>"><?= icon($sl['icon']) ?></a>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© <?= date('Y') ?> <?= e($s['site_name']) ?> — <?= e($s['footer_text']) ?></span>
  </div>
</footer>
<?php if (on('wa_float') && on('show_whatsapp') && ($wa = wa_contact_link())): ?>
<a class="wa-float" href="<?= e($wa) ?>" target="_blank" rel="noopener" aria-label="واتساب"><?= icon('whatsapp') ?></a>
<?php endif; ?>
<div class="modal" id="workModal" hidden role="dialog" aria-modal="true" aria-labelledby="wmTitle">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-box">
    <button class="modal-close" type="button" data-close aria-label="إغلاق"><?= icon('x') ?></button>
    <div class="modal-media" id="wmMedia"></div>
    <div class="modal-body">
      <span class="tag" id="wmCat"></span>
      <h3 id="wmTitle"></h3>
      <p id="wmText"></p>
      <div class="chips" id="wmTools"></div>
      <a class="btn btn-primary" id="wmBtn" href="#"><span><?= e($s['work_btn'] ?: 'مشاهدة العمل') ?></span><?= icon('arrow-left') ?></a>
    </div>
  </div>
</div>
<script src="<?= asset('assets/js/site.js') ?>" defer></script>
</body>
</html>
<?php
}

function section_head(string $key, string $unused = '', string $link = '', string $linkText = ''): void
{
    $title = setting($key . '_title');
    $sub = setting($key . '_subtitle');
    ?>
    <div class="section-head <?= $link ? '' : 'solo' ?> reveal">
      <div class="section-head-text">
        <span class="eyebrow"><?= e(home_sections()[$key][0]) ?></span>
        <h2><?= e($title) ?></h2>
        <?php if ($sub): ?><p><?= e($sub) ?></p><?php endif; ?>
      </div>
      <?php if ($link): ?><a class="head-link" href="<?= e($link) ?>"><?= e($linkText) ?><?= icon('arrow-left') ?></a><?php endif; ?>
    </div>
    <?php
}

/** Work media: uploaded video (plays inside the site), image, or placeholder */
function work_media(array $w, bool $hoverPlay = true): string
{
    $out = '';
    if (!empty($w['video_file'])) {
        $out .= '<video src="' . e(media($w['video_file'])) . '#t=0.1"' . ($w['image'] ? ' poster="' . e(media($w['image'])) . '"' : '')
            . ' muted loop playsinline preload="metadata"' . ($hoverPlay ? ' data-hover-play' : '') . '></video>';
    } elseif ($w['image']) {
        $out .= '<img src="' . e(media($w['image'])) . '" alt="' . e($w['title']) . '" loading="lazy">';
    } else {
        $out .= placeholder($w['video_url'] ? 'play' : 'image');
    }
    if (!empty($w['video_file']) || $w['video_url']) {
        $out .= '<span class="play-badge">' . icon('play') . '</span>';
    }
    return $out;
}

function work_type(array $w): string
{
    return (!empty($w['video_file']) || !empty($w['video_url'])) ? 'video' : 'image';
}

function work_card(array $w, int $i = 0): void
{
    $link = clean_url($w['link']);
    $data = [
        'title' => $w['title'], 'cat' => $w['category'], 'text' => $w['summary'],
        'tools' => csv_list($w['tools']),
        'img' => media($w['image']), 'video' => media($w['video_file']),
        'embed' => video_embed($w['video_url']) ?: '',
        'url' => $link ?: work_url((int) $w['id']), 'ext' => $link !== '' && is_external($link),
    ];
    ?>
    <a class="card work-card reveal" style="--i:<?= $i % 6 ?>" href="<?= e(work_url((int) $w['id'])) ?>" data-cat="<?= work_type($w) ?>" data-work="<?= e(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>">
      <div class="work-media">
        <?= work_media($w) ?>
        <?php if ($w['category']): ?><span class="tag tag-float"><?= e($w['category']) ?></span><?php endif; ?>
      </div>
      <div class="work-body">
        <h3><?= e($w['title']) ?></h3>
        <?php if ($w['summary']): ?><p><?= e(excerpt($w['summary'], 110)) ?></p><?php endif; ?>
        <?php if ($tools = csv_list($w['tools'])): ?>
          <div class="chips"><?php foreach (array_slice($tools, 0, 4) as $t): ?><span><?= e($t) ?></span><?php endforeach; ?></div>
        <?php endif; ?>
      </div>
    </a>
    <?php
}

/** Site identity: logo, or your photo + name + title */
function brand_html(): string
{
    $s = settings_all();
    if ($s['logo']) {
        return '<img class="brand-logo" src="' . e(media($s['logo'])) . '" alt="' . e($s['site_name']) . '">';
    }
    $avatar = $s['brand_photo']
        ? '<img class="brand-photo" src="' . e(media($s['brand_photo'])) . '" alt="">'
        : '<span class="brand-mark">' . e(mb_substr($s['site_name'], 0, 1)) . '</span>';
    return $avatar . '<span class="brand-text"><span class="brand-name">' . e($s['site_name']) . '</span>'
        . ($s['brand_title'] !== '' ? '<span class="brand-title" dir="auto">' . e($s['brand_title']) . '</span>' : '') . '</span>';
}

/** WhatsApp link with your ready-made message ({page} = the page the visitor was on) */
function wa_contact_link(): string
{
    $names = ['home' => 'الصفحة الرئيسية', 'about' => 'نبذة عني', 'services' => 'الخدمات', 'works' => 'الأعمال', 'prompts' => 'البرومبتات',
        'store' => 'المتجر', 'blog' => 'المدونة', 'contact' => 'تواصل', 'partners' => 'شركاء النجاح'];
    $text = str_replace('{page}', $names[current_page()] ?? '', (string) setting('wa_message'));
    return wa_link(trim($text) === '' ? '' : $text);
}

/** Hero status badge */
function hero_badge(): string
{
    $s = settings_all();
    $presets = [
        'available' => ['متاح لمشاريع جديدة', '#22c55e'],
        'limited'   => ['متاح لعدد محدود من المشاريع', '#f59e0b'],
        'busy'      => ['مشغول حالياً — الحجز للشهر القادم', '#ef4444'],
        'partners'  => ['مفتوح للتعاون والشراكات', '#3b82f6'],
        'custom'    => ['', safe_color($s['badge_color'], '#22c55e')],
    ];
    $status = $s['badge_status'] ?: 'available';
    if ($status === 'hidden' || !isset($presets[$status])) {
        return '';
    }
    [$text, $color] = $presets[$status];
    $text = trim((string) $s['hero_badge']) !== '' ? $s['hero_badge'] : $text;
    if ($text === '') {
        return '';
    }
    return '<span class="pill" data-anim><span class="dot" style="--dot:' . e($color) . '"></span>' . e($text) . '</span>';
}

/** Before/after comparison (drag to compare) */
function compare_media(string $before, string $after, string $alt): string
{
    return '<div class="compare" data-compare style="--pos:50%">'
        . '<img class="cmp-after" src="' . e(media($after)) . '" alt="' . e($alt) . ' — بعد" loading="lazy">'
        . '<div class="cmp-before"><img src="' . e(media($before)) . '" alt="' . e($alt) . ' — قبل" loading="lazy"></div>'
        . '<span class="cmp-label cmp-l-before">قبل</span><span class="cmp-label cmp-l-after">بعد</span>'
        . '<span class="cmp-handle" aria-hidden="true">' . icon('code') . '</span>'
        . '<input class="cmp-range" type="range" min="0" max="100" value="50" aria-label="اسحب للمقارنة بين قبل وبعد">'
        . '</div>';
}

function prompt_card(array $p, int $i = 0): void
{
    ?>
    <article class="card prompt-card reveal" style="--i:<?= $i % 6 ?>" data-cat="<?= e($p['category']) ?>">
      <?php if ($p['image'] && !empty($p['image_before'])): ?><div class="prompt-media is-compare"><?= compare_media($p['image_before'], $p['image'], $p['title']) ?></div>
      <?php elseif ($p['image']): ?><div class="prompt-media"><img src="<?= e(media($p['image'])) ?>" alt="<?= e($p['title']) ?>" loading="lazy"></div><?php endif; ?>
      <div class="prompt-body">
        <div class="prompt-meta">
          <?php if ($p['tool']): ?><span class="tag"><?= icon('sparkles') ?><?= e($p['tool']) ?></span><?php endif; ?>
          <?php if ($p['category']): ?><span class="muted-sm"><?= e($p['category']) ?></span><?php endif; ?>
        </div>
        <h3><?= e($p['title']) ?></h3>
        <pre class="prompt-text" dir="auto"><?= e($p['prompt']) ?></pre>
        <?php if ($p['description']): ?><p class="muted-sm"><?= e($p['description']) ?></p><?php endif; ?>
        <button class="btn btn-sm btn-ghost copy-btn" type="button" data-copy="<?= e($p['prompt']) ?>"><?= icon('copy') ?><span>نسخ البرومبت</span></button>
      </div>
    </article>
    <?php
}

function post_card(array $p, int $i = 0): void
{
    ?>
    <a class="card post-card reveal" style="--i:<?= $i % 6 ?>" href="<?= e(post_url((int) $p['id'])) ?>">
      <div class="post-media">
        <?php if ($p['cover']): ?><img src="<?= e(media($p['cover'])) ?>" alt="<?= e($p['title']) ?>" loading="lazy"><?php else: ?><?= placeholder('newspaper') ?><?php endif; ?>
      </div>
      <div class="post-body">
        <div class="post-meta"><?php if ($p['category']): ?><span class="tag"><?= e($p['category']) ?></span><?php endif; ?><span><?= e(ar_date($p['published_at'])) ?></span></div>
        <h3><?= e($p['title']) ?></h3>
        <p><?= e(excerpt($p['excerpt'] ?: $p['content'], 120)) ?></p>
        <span class="link-more">اقرأ المزيد <?= icon('arrow-left') ?></span>
      </div>
    </a>
    <?php
}

function filter_chips(array $list, string $target): void
{
    $cats = array_values(array_unique(array_filter(array_map(fn($x) => trim((string) $x['category']), $list))));
    if (count($cats) < 2) {
        return;
    }
    ?>
    <div class="filters reveal" data-filter="<?= e($target) ?>">
      <button class="active" data-f="*">الكل</button>
      <?php foreach ($cats as $c): ?><button data-f="<?= e($c) ?>"><?= e($c) ?></button><?php endforeach; ?>
    </div>
    <?php
}

/** Works filter: all / images / videos (decided automatically from each work) */
function type_tabs(array $works, string $target): void
{
    if (!$works) {
        return;
    }
    ?>
    <div class="filters seg-filters reveal" data-filter="<?= e($target) ?>">
      <button class="active" data-f="*"><?= icon('layout-grid') ?>الكل</button>
      <button data-f="image"><?= icon('image') ?>صور</button>
      <button data-f="video"><?= icon('play') ?>فيديو</button>
    </div>
    <?php
}

/** Page header for inner pages */
function page_header(string $key, string $titleOverride = '', string $subOverride = ''): void
{
    $sec = home_sections()[$key];
    $title = $titleOverride ?: setting($key . '_title');
    $sub = $subOverride ?: setting($key . '_subtitle');
    ?>
    <header class="page-header">
      <div class="container">
        <a class="back-link" href="<?= url() ?>" data-anim><?= icon('arrow-right') ?> الرئيسية</a>
        <span class="eyebrow" data-anim style="--d:1"><?= e($sec[0]) ?></span>
        <h1 data-anim style="--d:1"><?= e($title) ?></h1>
        <?php if ($sub): ?><p class="lead" data-anim style="--d:2"><?= e($sub) ?></p><?php endif; ?>
      </div>
    </header>
    <?php
}

function highlight_title(string $title, string $word): string
{
    $html = e($title);
    if ($word !== '' && str_contains($title, $word)) {
        $html = str_replace(e($word), '<span class="grad">' . e($word) . '</span>', $html);
    }
    return $html;
}
