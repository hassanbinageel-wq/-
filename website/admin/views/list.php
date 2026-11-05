<?php
/** @var string $page */
/** @var array $def */
$rows = items($page, ['all' => true]);
$cols = $def['columns'];
$firstText = null;
foreach ($cols as $c) {
    if (in_array($def['fields'][$c]['type'], ['text'], true)) { $firstText = $c; break; }
}
$viewUrl = ['works' => 'work.php?id=', 'posts' => 'post.php?id=', 'timeline' => 'story.php#'][$page] ?? null;
?>
<div class="page-head">
  <div>
    <p class="muted"><?= e($def['desc']) ?> — <?= count($rows) ?> عنصر</p>
  </div>
  <div class="page-actions">
    <?php if ($rows): ?><div class="search"><?= icon('search') ?><input type="search" placeholder="بحث…" data-table-search="#tbl"></div><?php endif; ?>
    <a class="btn btn-primary" href="<?= url('admin/?p=' . $page . '&a=new') ?>"><?= icon('plus') ?>إضافة <?= e($def['singular']) ?></a>
  </div>
</div>

<?php if (!$rows): ?>
  <div class="card empty">
    <span class="empty-ic"><?= icon($def['icon']) ?></span>
    <h3>ما فيه <?= e($def['title']) ?> للحين</h3>
    <p class="muted">ابدأ بإضافة أول <?= e($def['singular']) ?> ويظهر مباشرة في موقعك.</p>
    <a class="btn btn-primary" href="<?= url('admin/?p=' . $page . '&a=new') ?>"><?= icon('plus') ?>إضافة <?= e($def['singular']) ?></a>
  </div>
<?php else: ?>
  <div class="card table-card">
    <table class="table" id="tbl">
      <thead><tr>
        <?php foreach ($cols as $c): ?><th class="col-<?= e($def['fields'][$c]['type']) ?>"><?= e(preg_replace('/\s*\(.*\)$/u', '', $def['fields'][$c]['label'])) ?></th><?php endforeach; ?>
        <?php if (isset($def['fields']['sort_order'])): ?><th class="col-number">الترتيب</th><?php endif; ?>
        <th class="col-actions"></th>
      </tr></thead>
      <tbody>
      <?php foreach ($rows as $r): ?>
        <tr>
          <?php foreach ($cols as $c): ?>
            <td class="col-<?= e($def['fields'][$c]['type']) ?>" data-label="<?= e($def['fields'][$c]['label']) ?>">
              <?php if ($c === $firstText): ?><a class="row-title" href="<?= url('admin/?p=' . $page . '&a=edit&id=' . $r['id']) ?>"><?= cell_value($c, $def['fields'][$c], $r) ?></a><?php else: ?><?= cell_value($c, $def['fields'][$c], $r) ?><?php endif; ?>
            </td>
          <?php endforeach; ?>
          <?php if (isset($def['fields']['sort_order'])): ?><td class="col-number muted"><?= (int) $r['sort_order'] ?></td><?php endif; ?>
          <td class="col-actions">
            <div class="row-actions">
              <?php if ($viewUrl && !empty($r['published'])): ?><a class="icon-btn sm" href="<?= url($viewUrl . $r['id']) ?>" target="_blank" title="عرض في الموقع"><?= icon('eye') ?></a><?php endif; ?>
              <a class="icon-btn sm" href="<?= url('admin/?p=' . $page . '&a=edit&id=' . $r['id']) ?>" title="تعديل"><?= icon('pencil') ?></a>
              <form method="post" class="inline"><?= csrf_field() ?><input type="hidden" name="_do" value="duplicate"><input type="hidden" name="id" value="<?= $r['id'] ?>"><button class="icon-btn sm" title="نسخ"><?= icon('copy') ?></button></form>
              <form method="post" class="inline" data-confirm="متأكد تبغى تحذف هذا العنصر؟ ما يمكن التراجع."><?= csrf_field() ?><input type="hidden" name="_do" value="delete"><input type="hidden" name="id" value="<?= $r['id'] ?>"><button class="icon-btn sm danger" title="حذف"><?= icon('trash') ?></button></form>
            </div>
            <form method="post" id="toggle-<?= $r['id'] ?>" hidden><?= csrf_field() ?><input type="hidden" name="_do" value="toggle"><input type="hidden" name="id" value="<?= $r['id'] ?>"></form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
<?php endif; ?>
