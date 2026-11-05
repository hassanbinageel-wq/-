<?php

function admin_menu(): array
{
    $e = entities();
    return [
        'dashboard' => ['الرئيسية', 'layout-grid'],
        'works'     => [$e['works']['title'], $e['works']['icon']],
        'partners'  => [$e['partners']['title'], $e['partners']['icon']],
        'books'     => [$e['books']['title'], $e['books']['icon']],
        'clients'   => [$e['clients']['title'], $e['clients']['icon']],
        'prompts'   => [$e['prompts']['title'], $e['prompts']['icon']],
        'posts'     => [$e['posts']['title'], $e['posts']['icon']],
        'services'  => [$e['services']['title'], $e['services']['icon']],
        'analytics' => ['التحليلات', 'chart'],
        'messages'  => ['التواصل', 'contact'],
        'settings'  => ['الإعدادات', 'settings'],
        'account'   => ['الحساب', 'user-cog'],
    ];
}

function unread_count(): int
{
    static $n = null;
    return $n ??= (int) db()->query('SELECT COUNT(*) FROM messages WHERE is_read = 0')->fetchColumn();
}

function admin_start(string $title, string $active): void
{
    $user = current_user();
    $site = setting('site_name');
    $flash = flash();
    ?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> — لوحة التحكم</title>
<?php if (setting('favicon')): ?><link rel="icon" href="<?= e(media(setting('favicon'))) ?>"><?php endif; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('admin/assets/admin.css') ?>">
</head>
<body>
<div class="shell">
  <aside class="sidebar" id="sidebar">
    <a class="side-brand" href="<?= url('admin/') ?>">
      <span class="side-mark"><?= e(mb_substr($site, 0, 1)) ?></span>
      <span><strong><?= e($site) ?></strong><small>لوحة التحكم</small></span>
    </a>
    <nav class="side-nav">
      <?php foreach (admin_menu() as $k => [$label, $ic]): ?>
        <a href="<?= url('admin/') . ($k === 'dashboard' ? '' : '?p=' . $k) ?>" class="<?= $k === $active ? 'active' : '' ?>">
          <?= icon($ic) ?><span><?= e($label) ?></span>
          <?php if ($k === 'messages' && unread_count()): ?><em class="badge"><?= unread_count() ?></em><?php endif; ?>
        </a>
      <?php endforeach; ?>
    </nav>
    <div class="side-foot">
      <a href="<?= url() ?>" target="_blank"><?= icon('external') ?><span>عرض الموقع</span></a>
      <form method="post" action="<?= url('admin/logout.php') ?>"><?= csrf_field() ?><button type="submit"><?= icon('logout') ?><span>تسجيل الخروج</span></button></form>
    </div>
  </aside>
  <div class="side-backdrop" id="sideBackdrop"></div>
  <div class="main">
    <header class="topbar">
      <button class="icon-btn menu-toggle" id="menuToggle" aria-label="القائمة"><?= icon('menu') ?></button>
      <h1><?= e($title) ?></h1>
      <div class="topbar-end">
        <a class="icon-btn" href="<?= url('admin/?p=messages') ?>" aria-label="الرسائل"><?= icon('inbox') ?><?php if (unread_count()): ?><i class="dot-badge"></i><?php endif; ?></a>
        <a class="user-chip" href="<?= url('admin/?p=account') ?>"><span class="avatar-sm"><?= e(mb_strtoupper(mb_substr($user['username'] ?? 'A', 0, 1))) ?></span><span><?= e($user['username'] ?? '') ?></span></a>
      </div>
    </header>
    <main class="content">
      <?php if ($flash): ?><div class="alert alert-<?= $flash['type'] === 'err' ? 'err' : 'ok' ?>" data-autohide><?= e($flash['msg']) ?></div><?php endif; ?>
<?php
}

function admin_end(): void
{
    ?>
    </main>
  </div>
</div>
<script src="<?= asset('admin/assets/admin.js') ?>"></script>
</body>
</html>
<?php
}
