<?php

function placeholder(string $iconName = 'sparkles', string $label = ''): string
{
    return '<div class="ph">' . icon($iconName, 'ic ph-ic') . ($label !== '' ? '<span>' . e($label) . '</span>' : '') . '</div>';
}

function nav_items(): array
{
    $items = [];
    foreach (['about', 'services', 'works', 'prompts', 'books', 'blog'] as $k) {
        if (section_on($k)) {
            $items[$k] = home_sections()[$k][0];
        }
    }
    return $items;
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
    $themeDefault = in_array($s['theme'], ['light', 'dark', 'auto'], true) ? $s['theme'] : 'dark';
    $theme = $themeDefault === 'light' ? 'light' : 'dark';
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
<script>(function(){var d=document.documentElement,def=<?= json_encode($themeDefault) ?>,t=null;try{t=localStorage.getItem('hsn-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=def==='auto'?(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):def}d.setAttribute('data-theme',t);d.classList.add('js')})()</script>
</head>
<body class="<?= e($bodyClass) ?>">
<?php if ((string) $s['announce_on'] === '1' && $s['announce_text']): ?>
<a class="announce" href="<?= e(link_href($s['announce_link']) ?: '#') ?>"><span><?= e($s['announce_text']) ?></span><?= icon('arrow-left', 'ic') ?></a>
<?php endif; ?>
<header class="site-header" id="siteHeader">
  <div class="container header-inner">
    <a class="brand" href="<?= url() ?>">
      <?php if ($s['logo']): ?><img src="<?= e(media($s['logo'])) ?>" alt="<?= e($s['site_name']) ?>"><?php else: ?><span class="brand-mark"><?= e(mb_substr($s['site_name'], 0, 1)) ?></span><span class="brand-name"><?= e($s['site_name']) ?></span><?php endif; ?>
    </a>
    <nav class="nav" id="nav" aria-label="القائمة">
      <?php foreach (nav_items() as $k => $label): ?>
        <a href="<?= url('#' . $k) ?>" data-spy="<?= $k ?>"><?= e($label) ?></a>
      <?php endforeach; ?>
      <?php if (section_on('contact')): ?><a class="btn btn-sm btn-primary nav-cta" href="<?= url('#contact') ?>">تواصل معي</a><?php endif; ?>
    </nav>
    <div class="header-tools">
      <?php if ((string) $s['theme_toggle'] === '1'): ?>
        <button class="icon-toggle" id="themeBtn" type="button" aria-label="التبديل بين الوضع الفاتح والداكن" title="فاتح / داكن"><?= icon('sun', 'ic i-sun') ?><?= icon('moon', 'ic i-moon') ?></button>
      <?php endif; ?>
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
        <?php if ($s['logo']): ?><img src="<?= e(media($s['logo'])) ?>" alt="<?= e($s['site_name']) ?>"><?php else: ?><span class="brand-mark"><?= e(mb_substr($s['site_name'], 0, 1)) ?></span><span class="brand-name"><?= e($s['site_name']) ?></span><?php endif; ?>
      </a>
      <p><?= e($s['site_tagline']) ?></p>
    </div>
    <nav class="footer-nav">
      <?php foreach (nav_items() as $k => $label): ?><a href="<?= url('#' . $k) ?>"><?= e($label) ?></a><?php endforeach; ?>
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
<?php if ($wa = wa_link()): ?>
<a class="wa-float" href="<?= e($wa) ?>" target="_blank" rel="noopener" aria-label="واتساب"><?= icon('whatsapp') ?></a>
<?php endif; ?>
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
    <div class="section-head reveal">
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

function work_card(array $w, int $i = 0): void
{
    ?>
    <a class="card work-card reveal" style="--i:<?= $i % 6 ?>" href="<?= url('work.php?id=' . $w['id']) ?>" data-cat="<?= e($w['category']) ?>">
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

function prompt_card(array $p, int $i = 0): void
{
    ?>
    <article class="card prompt-card reveal" style="--i:<?= $i % 6 ?>" data-cat="<?= e($p['category']) ?>">
      <?php if ($p['image']): ?><div class="prompt-media"><img src="<?= e(media($p['image'])) ?>" alt="<?= e($p['title']) ?>" loading="lazy"></div><?php endif; ?>
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
    <a class="card post-card reveal" style="--i:<?= $i % 6 ?>" href="<?= url('post.php?id=' . $p['id']) ?>">
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
