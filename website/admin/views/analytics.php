<?php
require __DIR__ . '/analytics_lib.php';

// Period: today / this week / this month / last 7-30-90 days / custom from-to
$r = (string) ($_GET['r'] ?? '30');
$todayD = date('Y-m-d');
$valid = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) !== false;
switch ($r) {
    case 'today': $from = $to = $todayD; break;
    case 'week':  $from = date('Y-m-d', strtotime(date('w') === '0' ? 'today' : 'last sunday')); $to = $todayD; break; // week starts Sunday
    case 'month': $from = date('Y-m-01'); $to = $todayD; break;
    case '7': case '90': $from = date('Y-m-d', strtotime('-' . ((int) $r - 1) . ' days')); $to = $todayD; break;
    case 'custom':
        $from = $valid($_GET['from'] ?? null) ? $_GET['from'] : date('Y-m-d', strtotime('-29 days'));
        $to = $valid($_GET['to'] ?? null) ? $_GET['to'] : $todayD;
        if ($from > $to) [$from, $to] = [$to, $from];
        if ((strtotime($to) - strtotime($from)) / 86400 > 730) $from = date('Y-m-d', strtotime($to . ' -730 days'));
        break;
    default: $r = '30'; $from = date('Y-m-d', strtotime('-29 days')); $to = $todayD;
}
$toEnd = date('Y-m-d', strtotime($to . ' +1 day')); // exclusive upper bound
$len = (int) round((strtotime($toEnd) - strtotime($from)) / 86400);
$days = visits_by_day($from, $to);

$total = visits_count($from, $toEnd);
$unique = visits_count($from, $toEnd, true);
$today = visits_count($todayD, date('Y-m-d', strtotime('+1 day')));
$prev = visits_count(date('Y-m-d', strtotime($from . " -$len days")), $from);
$change = $prev ? round(($total - $prev) / $prev * 100) : null;

$q = function (string $col, int $limit = 8) use ($from, $toEnd) {
    $st = db()->prepare("SELECT $col k, COUNT(*) n FROM visits WHERE created_at >= ? AND created_at < ? AND $col != '' GROUP BY $col ORDER BY n DESC LIMIT $limit");
    $st->execute([$from, $toEnd]);
    return $st->fetchAll();
};
$pages = $q('path', 10);
$refs = $q('referrer', 8);
$devices = $q('device', 3);
$devTotal = max(1, array_sum(array_column($devices, 'n')));
$devLabels = ['desktop' => ['كمبيوتر', 'monitor'], 'mobile' => ['جوال', 'smartphone'], 'tablet' => ['تابلت', 'tablet']];
$st = db()->prepare('SELECT substr(created_at,12,2) h, COUNT(*) n FROM visits WHERE created_at >= ? AND created_at < ? GROUP BY h ORDER BY n DESC LIMIT 1');
$st->execute([$from, $toEnd]);
$peak = $st->fetch();
$fmt = fn($d) => date('j/n/Y', strtotime($d));
$periodLabel = $from === $to ? $fmt($from) : $fmt($from) . ' — ' . $fmt($to);
$ranges = ['today' => 'اليوم', 'week' => 'هذا الأسبوع', 'month' => 'هذا الشهر', '7' => '7 أيام', '30' => '30 يوم', '90' => '90 يوم'];
?>
<div class="page-head">
  <p class="muted">إحصائيات زيارات موقعك (زياراتك من أجهزتك ما تنحسب)</p>
  <div class="page-actions">
    <form method="post" class="reset-form" data-confirm="متأكد تبغى تصفّر كل أرقام الزيارات؟ ما تقدر ترجعها.">
      <?= csrf_field() ?><input type="hidden" name="_do" value="reset">
      <button class="btn btn-danger-ghost btn-sm" type="submit"><?= icon('trash') ?>تصفير الأرقام</button>
    </form>
  </div>
</div>

<div class="card range-bar">
  <div class="seg seg-wrap">
    <?php foreach ($ranges as $k => $l): ?>
      <a href="<?= admin_url('?p=analytics&r=' . $k) ?>" class="<?= (string) $k === $r ? 'active' : '' ?>"><?= $l ?></a>
    <?php endforeach; ?>
  </div>
  <form method="get" class="range-custom <?= $r === 'custom' ? 'on' : '' ?>" action="<?= e(admin_url()) ?>">
    <input type="hidden" name="p" value="analytics"><input type="hidden" name="r" value="custom">
    <label><span>من</span><input type="date" name="from" value="<?= e($from) ?>" max="<?= e($todayD) ?>"></label>
    <label><span>إلى</span><input type="date" name="to" value="<?= e($to) ?>" max="<?= e($todayD) ?>"></label>
    <button class="btn btn-sm <?= $r === 'custom' ? 'btn-primary' : 'btn-ghost' ?>" type="submit"><?= icon('calendar') ?>عرض</button>
  </form>
  <span class="range-label"><?= icon('calendar') ?><?= e($periodLabel) ?></span>
</div>

<?php $mine = is_owner_device(); ?>
<form method="post" class="card owner-device <?= $mine ? 'ok' : '' ?>">
  <?= csrf_field() ?><input type="hidden" name="_do" value="owner_device"><input type="hidden" name="on" value="<?= $mine ? '0' : '1' ?>">
  <span class="od-ic"><?= icon($mine ? 'check' : 'smartphone') ?></span>
  <div class="od-text">
    <strong><?= $mine ? 'زياراتك من هذا الجهاز ما تنحسب ✓' : 'زياراتك من هذا الجهاز تنحسب حالياً' ?></strong>
    <small>أي جهاز تسجّل منه دخول للوحة يتعرّف عليه تلقائياً لمدة سنتين — حتى لو سجّلت خروج. سجّل دخول مرة من جوالك وخلاص.</small>
  </div>
  <button class="btn btn-sm <?= $mine ? 'btn-ghost' : 'btn-primary' ?>" type="submit"><?= $mine ? 'احسب زياراتي' : 'لا تحسب زياراتي' ?></button>
</form>

<div class="stat-grid">
  <div class="card stat-card tone-blue"><span class="stat-ic"><?= icon('eye') ?></span><div><strong><?= number_format($total) ?></strong><span>زيارة<?php if ($change !== null): ?><em class="delta <?= $change >= 0 ? 'up' : 'down' ?>"><?= ($change >= 0 ? '+' : '') . $change ?>%</em><?php endif; ?></span></div></div>
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
