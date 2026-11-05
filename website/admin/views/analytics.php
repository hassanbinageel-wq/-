<?php
require __DIR__ . '/analytics_lib.php';

$range = (int) ($_GET['r'] ?? 30);
if (!in_array($range, [7, 30, 90], true)) $range = 30;
$since = date('Y-m-d', strtotime('-' . ($range - 1) . ' days'));
$days = visits_by_day($range);

$total = visits_count($since);
$unique = visits_count($since, true);
$today = visits_count(date('Y-m-d'));
$prevSince = date('Y-m-d', strtotime('-' . ($range * 2 - 1) . ' days'));
$st = db()->prepare('SELECT COUNT(*) FROM visits WHERE created_at >= ? AND created_at < ?');
$st->execute([$prevSince, $since]);
$prev = (int) $st->fetchColumn();
$change = $prev ? round(($total - $prev) / $prev * 100) : null;

$q = function (string $col, int $limit = 8) use ($since) {
    $st = db()->prepare("SELECT $col k, COUNT(*) n FROM visits WHERE created_at >= ? AND $col != '' GROUP BY $col ORDER BY n DESC LIMIT $limit");
    $st->execute([$since]);
    return $st->fetchAll();
};
$pages = $q('path', 10);
$refs = $q('referrer', 8);
$devices = $q('device', 3);
$devTotal = max(1, array_sum(array_column($devices, 'n')));
$devLabels = ['desktop' => ['كمبيوتر', 'monitor'], 'mobile' => ['جوال', 'smartphone'], 'tablet' => ['تابلت', 'tablet']];
$st = db()->prepare('SELECT substr(created_at,12,2) h, COUNT(*) n FROM visits WHERE created_at >= ? GROUP BY h ORDER BY n DESC LIMIT 1');
$st->execute([$since]);
$peak = $st->fetch();
?>
<div class="page-head">
  <p class="muted">إحصائيات زيارات موقعك (زياراتك أنت وأنت مسجّل دخول ما تنحسب)</p>
  <div class="page-actions">
    <div class="seg">
      <?php foreach ([7 => '7 أيام', 30 => '30 يوم', 90 => '90 يوم'] as $r => $l): ?>
        <a href="<?= admin_url('?p=analytics&r=' . $r) ?>" class="<?= $r === $range ? 'active' : '' ?>"><?= $l ?></a>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<div class="stat-grid">
  <div class="card stat-card tone-blue"><span class="stat-ic"><?= icon('eye') ?></span><div><strong><?= number_format($total) ?></strong><span>زيارة <?php if ($change !== null): ?><em class="delta <?= $change >= 0 ? 'up' : 'down' ?>"><?= ($change >= 0 ? '+' : '') . $change ?>%</em><?php endif; ?></span></div></div>
  <div class="card stat-card tone-violet"><span class="stat-ic"><?= icon('user') ?></span><div><strong><?= number_format($unique) ?></strong><span>زائر</span></div></div>
  <div class="card stat-card tone-green"><span class="stat-ic"><?= icon('calendar') ?></span><div><strong><?= number_format($today) ?></strong><span>زيارة اليوم</span></div></div>
  <div class="card stat-card tone-amber"><span class="stat-ic"><?= icon('chart') ?></span><div><strong><?= $peak ? e((int) $peak['h'] . ':00') : '—' ?></strong><span>ساعة الذروة</span></div></div>
</div>

<div class="card">
  <div class="card-head"><h3>الزيارات اليومية</h3><div class="legend"><span><i class="lg-v"></i>زيارات</span><span><i class="lg-u"></i>زوار</span></div></div>
  <?= bar_chart($days, 240) ?>
</div>

<div class="dash-grid three">
  <div class="card">
    <div class="card-head"><h3>أكثر الصفحات زيارة</h3></div>
    <?php if (!$pages): ?><p class="muted empty-sm">لا توجد بيانات بعد</p><?php else: $mx = $pages[0]['n']; ?>
      <ul class="bars"><?php foreach ($pages as $p): ?><li><span class="bar-fill" style="width:<?= round($p['n'] / $mx * 100) ?>%"></span><span class="bar-label"><?= e(page_label($p['k'])) ?></span><b><?= $p['n'] ?></b></li><?php endforeach; ?></ul>
    <?php endif; ?>
  </div>
  <div class="card">
    <div class="card-head"><h3>مصادر الزيارات</h3></div>
    <?php if (!$refs): ?><p class="muted empty-sm">كل الزيارات مباشرة للحين</p><?php else: $mx = $refs[0]['n']; ?>
      <ul class="bars"><?php foreach ($refs as $p): ?><li><span class="bar-fill" style="width:<?= round($p['n'] / $mx * 100) ?>%"></span><span class="bar-label ltr"><?= e($p['k']) ?></span><b><?= $p['n'] ?></b></li><?php endforeach; ?></ul>
    <?php endif; ?>
  </div>
  <div class="card">
    <div class="card-head"><h3>الأجهزة</h3></div>
    <?php if (!$devices): ?><p class="muted empty-sm">لا توجد بيانات بعد</p><?php else: ?>
      <ul class="devices"><?php foreach ($devices as $d): $pct = round($d['n'] / $devTotal * 100); [$l, $ic] = $devLabels[$d['k']] ?? [$d['k'], 'monitor']; ?>
        <li><span class="dev-ic"><?= icon($ic) ?></span><span class="dev-body"><span><?= e($l) ?><b><?= $pct ?>%</b></span><span class="track"><span style="width:<?= $pct ?>%"></span></span></span></li>
      <?php endforeach; ?></ul>
    <?php endif; ?>
  </div>
</div>

<form method="post" class="danger-zone" data-confirm="متأكد تبغى تحذف كل الإحصائيات؟">
  <?= csrf_field() ?><input type="hidden" name="_do" value="reset">
  <button class="btn btn-danger-ghost"><?= icon('trash') ?>تصفير الإحصائيات</button>
</form>
