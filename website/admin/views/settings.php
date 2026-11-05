<?php
$schema = settings_schema();
$g = (string) ($_GET['g'] ?? 'general');
if (!isset($schema[$g])) $g = 'general';
$vals = settings_all();
$group = $schema[$g];
?>
<div class="tabs">
  <?php foreach ($schema as $k => $grp): ?>
    <a href="<?= url('admin/?p=settings&g=' . $k) ?>" class="<?= $k === $g ? 'active' : '' ?>"><?= icon($grp['icon']) ?><?= e($grp['title']) ?></a>
  <?php endforeach; ?>
</div>

<form method="post" enctype="multipart/form-data" class="card form-card" data-dirty-check>
  <?= csrf_field() ?>
  <input type="hidden" name="_do" value="save">
  <input type="hidden" name="group" value="<?= e($g) ?>">
  <?php if ($g === 'sections'): ?>
    <p class="muted">تحكم بأقسام الصفحة الرئيسية: أظهر أو أخفِ أي قسم، وغيّر عنوانه ووصفه.</p>
    <div class="section-groups">
      <?php foreach (home_sections() as $k => [$nav]): ?>
        <fieldset class="section-group">
          <legend><?= e($nav) ?></legend>
          <div class="fields">
            <?php foreach (['show_' . $k, $k . '_title', $k . '_subtitle'] as $fk) render_field($fk, $group['fields'][$fk], $vals[$fk] ?? null); ?>
          </div>
        </fieldset>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
    <div class="fields">
      <?php foreach ($group['fields'] as $k => $f) render_field($k, $f, $vals[$k] ?? null); ?>
    </div>
  <?php endif; ?>
  <div class="form-foot">
    <button class="btn btn-primary" type="submit"><?= icon('check') ?>حفظ الإعدادات</button>
    <a class="btn btn-ghost" href="<?= url() ?>" target="_blank"><?= icon('external') ?>شوف التغييرات في الموقع</a>
  </div>
</form>
