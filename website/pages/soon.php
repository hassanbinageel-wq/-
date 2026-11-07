<?php
/* Coming-soon page shown to visitors while "coming soon" mode is on */
$s = settings_all();
$photo = $s['brand_photo'] ?: $s['hero_image'];
$wa = on('show_whatsapp') ? wa_contact_link() : '';
$accent = safe_color($s['accent_color'], '#3b82f6');
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title><?= e($s['site_name']) ?> — <?= e($s['soon_title']) ?></title>
<?php if ($s['favicon']): ?><link rel="icon" href="<?= e(media($s['favicon'])) ?>"><?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root { --accent: <?= $accent ?>; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { font-family: "IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif; color: #eef2fb; display: grid; place-items: center; padding: 24px 16px; overflow: hidden; text-align: center;
  background: radial-gradient(900px 500px at 80% -10%, #1a2c5c, transparent 60%), radial-gradient(700px 500px at 0% 100%, rgba(124, 58, 237, .28), transparent 60%), #0a1430; }
body::before { content: ""; position: fixed; inset: 0; opacity: .55; pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,.6) 1px, transparent 1.2px), radial-gradient(rgba(255,255,255,.45) .7px, transparent 1px); background-size: 110px 110px, 61px 61px; background-position: 0 0, 30px 40px; }
.wrap { position: relative; max-width: 560px; display: grid; justify-items: center; gap: 18px; animation: rise .9s cubic-bezier(.2,.7,.2,1); }
.photo { width: 118px; height: 118px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(96,165,250,.6); box-shadow: 0 0 0 8px rgba(59,130,246,.12), 0 20px 50px -10px rgba(59,130,246,.5); }
.mark { width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; font-size: 2.4rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), #8b5cf6); }
.name { font-weight: 700; font-size: 1.1rem; } .name small { display: block; color: #60a5fa; font-size: .85rem; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: .35em 1em; border-radius: 999px; border: 1px solid rgba(96,165,250,.4); background: rgba(37,99,235,.14); color: #cfe0ff; font-size: .88rem; }
.pill i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
h1 { margin: 0; font-size: clamp(1.9rem, 6vw, 2.8rem); line-height: 1.3; }
p { margin: 0; color: #a3b1cc; font-size: 1.05rem; line-height: 1.9; }
.links { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 6px; }
.links a { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; color: #cbd5e1; border: 1px solid rgba(148,163,184,.25); background: rgba(255,255,255,.04); transition: .3s; }
.links a:hover { color: #fff; border-color: var(--accent); transform: translateY(-3px); }
.links .ic { width: 20px; height: 20px; }
.wa { display: inline-flex; align-items: center; gap: 8px; padding: .8em 1.5em; border-radius: 999px; background: #22c55e; color: #fff; font-weight: 700; text-decoration: none; box-shadow: 0 14px 30px -12px rgba(34,197,94,.8); }
.wa .ic { width: 20px; height: 20px; }
@keyframes rise { from { opacity: 0; transform: translateY(16px); } }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.6); } 70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); } 100% { box-shadow: none; } }
@media (prefers-reduced-motion: reduce) { .wrap, .pill i { animation: none; } }
</style>
</head>
<body>
  <main class="wrap">
    <?php if ($photo): ?><img class="photo" src="<?= e(media($photo)) ?>" alt=""><?php else: ?><span class="mark"><?= e(mb_substr($s['site_name'], 0, 1)) ?></span><?php endif; ?>
    <div class="name"><?= e($s['site_name']) ?><?php if ($s['brand_title']): ?><small><?= e($s['brand_title']) ?></small><?php endif; ?></div>
    <span class="pill"><i></i>قيد التجهيز</span>
    <h1><?= e($s['soon_title']) ?></h1>
    <?php if ($s['soon_text']): ?><p><?= e($s['soon_text']) ?></p><?php endif; ?>
    <?php if ($wa): ?><a class="wa" href="<?= e($wa) ?>" target="_blank" rel="noopener"><?= icon('whatsapp') ?>تواصل معي على واتساب</a><?php endif; ?>
    <?php if ($socials = social_links()): ?>
      <div class="links"><?php foreach ($socials as $sl): ?><a href="<?= e($sl['url']) ?>" target="_blank" rel="noopener" aria-label="<?= e($sl['label']) ?>"><?= icon($sl['icon']) ?></a><?php endforeach; ?></div>
    <?php endif; ?>
  </main>
</body>
</html>
