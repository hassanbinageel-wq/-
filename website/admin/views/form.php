<?php
/** @var string $page */
/** @var array $def */
/** @var array|null $row */
$side = ['image', 'video', 'bool', 'number', 'select', 'date'];
$main = $aside = [];
foreach ($def['fields'] as $k => $f) {
    if (in_array($f['type'], $side, true) && empty($f['full'])) $aside[$k] = $f; else $main[$k] = $f;
}
$viewUrl = ['works' => 'work/', 'posts' => 'post/', 'books' => 'product/'][$page] ?? null;
?>
<form method="post" enctype="multipart/form-data" class="edit-form" data-dirty-check>
  <?= csrf_field() ?>
  <input type="hidden" name="_do" value="save">
  <input type="hidden" name="id" value="<?= (int) ($row['id'] ?? 0) ?>">

  <div class="page-head">
    <a class="back" href="<?= admin_url('?p=' . $page) ?>"><?= icon('arrow-right') ?> <?= e($def['title']) ?></a>
    <div class="page-actions">
      <?php if ($row && $viewUrl && !empty($row['published'])): ?><a class="btn btn-ghost" href="<?= url($viewUrl . $row['id']) ?>" target="_blank"><?= icon('eye') ?>معاينة</a><?php endif; ?>
      <button class="btn btn-ghost" type="submit" name="_stay" value="1">حفظ ومتابعة التعديل</button>
      <button class="btn btn-primary" type="submit"><?= icon('check') ?>حفظ</button>
    </div>
  </div>

  <div class="form-layout">
    <div class="card form-card">
      <div class="fields">
        <?php foreach ($main as $k => $f) render_field($k, $f, $row[$k] ?? null); ?>
      </div>
    </div>
    <aside class="card form-card form-aside">
      <div class="fields single">
        <?php foreach ($aside as $k => $f) render_field($k, $f, $row[$k] ?? null); ?>
      </div>
      <?php if ($row): ?>
        <p class="meta-note">أُنشئ: <?= e(ar_date($row['created_at'])) ?><br>آخر تعديل: <?= e(time_ago($row['updated_at'])) ?></p>
      <?php endif; ?>
    </aside>
  </div>
</form>
<?php if ($row): ?>
  <form method="post" class="danger-zone" data-confirm="متأكد تبغى تحذف هذا العنصر نهائياً؟">
    <?= csrf_field() ?><input type="hidden" name="_do" value="delete"><input type="hidden" name="id" value="<?= (int) $row['id'] ?>">
    <button class="btn btn-danger-ghost"><?= icon('trash') ?>حذف <?= e($def['singular']) ?></button>
  </form>
<?php endif; ?>
