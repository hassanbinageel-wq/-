<?php
require __DIR__ . '/analytics_lib.php';

$today = date('Y-m-d');
$stats = [
    ['زيارات اليوم', visits_count($today), 'eye', 'blue'],
    ['زوار آخر 30 يوم', visits_count(date('Y-m-d', strtotime('-29 days')), true), 'user', 'violet'],
    ['رسائل جديدة', unread_count(), 'inbox', 'green'],
    ['الأعمال المنشورة', (int) db()->query('SELECT COUNT(*) FROM works WHERE published = 1')->fetchColumn(), 'image', 'amber'],
];
$days = visits_by_day(14);
$latest = db()->query('SELECT * FROM messages ORDER BY id DESC LIMIT 5')->fetchAll();
$user = current_user();
$hour = (int) date('G');
$greet = $hour < 12 ? 'صباح الخير' : 'مساء الخير';
?>
<div class="welcome card">
  <div>
    <h2><?= $greet ?>، <?= e($user['username']) ?> 👋</h2>
    <p class="muted">من هنا تتحكم بكل شي في موقعك: البنر، الأعمال، المتجر، المدونة والإعدادات.</p>
  </div>
  <div class="welcome-actions">
    <a class="btn btn-primary" href="<?= admin_url('?p=works&a=new') ?>"><?= icon('plus') ?>أضف عمل</a>
    <a class="btn btn-ghost" href="<?= admin_url('?p=settings&g=hero') ?>"><?= icon('image') ?>عدّل البنر</a>
    <a class="btn btn-ghost" href="<?= url() ?>" target="_blank"><?= icon('external') ?>عرض الموقع</a>
  </div>
</div>

<div class="stat-grid">
  <?php foreach ($stats as [$label, $n, $ic, $tone]): ?>
    <div class="card stat-card tone-<?= $tone ?>">
      <span class="stat-ic"><?= icon($ic) ?></span>
      <div><strong><?= number_format($n) ?></strong><span><?= e($label) ?></span></div>
    </div>
  <?php endforeach; ?>
</div>

<div class="dash-grid">
  <div class="card">
    <div class="card-head"><h3>الزيارات — آخر 14 يوم</h3><a class="link" href="<?= admin_url('?p=analytics') ?>">التفاصيل <?= icon('arrow-left') ?></a></div>
    <?= bar_chart($days, 200) ?>
    <div class="legend"><span><i class="lg-v"></i>زيارات</span><span><i class="lg-u"></i>زوار</span></div>
  </div>
  <div class="card">
    <div class="card-head"><h3>أحدث الرسائل</h3><a class="link" href="<?= admin_url('?p=messages') ?>">الكل <?= icon('arrow-left') ?></a></div>
    <?php if (!$latest): ?>
      <p class="muted empty-sm">ما وصلتك رسائل للحين.</p>
    <?php else: ?>
      <ul class="msg-mini">
        <?php foreach ($latest as $m): ?>
          <li class="<?= $m['is_read'] ? '' : 'unread' ?>">
            <a href="<?= admin_url('?p=messages&id=' . $m['id']) ?>">
              <span class="avatar-sm"><?= e(mb_substr($m['name'], 0, 1)) ?></span>
              <span class="msg-mini-body"><strong><?= e($m['name']) ?></strong><small><?= e(excerpt($m['subject'] ?: $m['message'], 50)) ?></small></span>
              <time><?= e(time_ago($m['created_at'])) ?></time>
            </a>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </div>
</div>

<?php
$groups = []; $g = null;
foreach (admin_menu() as $k => $item) {
    if (is_string($item)) { $g = $item; continue; }
    if ($g && isset(entities()[$k]) && $g !== 'عام') $groups[$g][$k] = $item;
}
?>
<div class="content-groups">
  <?php foreach ($groups as $gname => $list): ?>
    <section class="card content-group">
      <h3 class="group-title"><?= e($gname) ?></h3>
      <div class="group-list">
        <?php foreach ($list as $k => [$label, $ic]):
            $total = (int) db()->query("SELECT COUNT(*) FROM $k")->fetchColumn(); ?>
          <div class="group-row">
            <a class="group-link" href="<?= admin_url('?p=' . $k) ?>"><span class="tile-ic"><?= icon($ic) ?></span><span><strong><?= e($label) ?></strong><small><?= $total ?> عنصر</small></span></a>
            <a class="icon-btn sm" href="<?= admin_url('?p=' . $k . '&a=new') ?>" title="إضافة"><?= icon('plus') ?></a>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endforeach; ?>
</div>
