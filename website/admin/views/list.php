<?php
/** @var string $page */
/** @var array $def */
$rows = items($page, ['all' => true]);
$cols = $def['columns'];
$firstText = null;
foreach ($cols as $c) {
    if (in_array($def['fields'][$c]['type'], ['text'], true)) { $firstText = $c; break; }
}
$viewUrl = ['works' => 'work/', 'posts' => 'post/', 'books' => 'product/'][$page] ?? null;
$canSort = isset($def['fields']['sort_order']) && !isset($def['order']) && count($rows) > 1;
?>
<div class="page-head">
  <div class="page-intro">
    <span class="intro-ic"><?= icon($def['icon']) ?></span>
    <div>
      <h2><?= e($def['title']) ?> <span class="count-pill"><?= count($rows) ?></span></h2>
      <p class="muted"><?= e($def['desc']) ?></p>
    <?php if ($canSort): ?><p class="sort-hint"><?= icon('grip') ?> اسحب من المقبض لترتيب العناصر — نفس الترتيب يظهر في الموقع</p><?php endif; ?>
    </div>
  </div>
  <div class="page-actions">
    <?php if ($rows): ?><div class="search"><?= icon('search') ?><input type="search" placeholder="بحث…" data-table-search="#tbl"></div><?php endif; ?>
    <a class="btn btn-primary" href="<?= admin_url('?p=' . $page . '&a=new') ?>"><?= icon('plus') ?>إضافة <?= e($def['singular']) ?></a>
  </div>
</div>

<?php if ($page === 'works'): ?>
  <form method="post" class="card btn-settings">
    <?= csrf_field() ?><input type="hidden" name="_do" value="work_button">
    <div class="bs-head"><span class="bs-ic"><?= icon('eye') ?></span><div><strong>زر «مشاهدة العمل»</strong><small>يظهر في نافذة العمل وصفحته — والإعدادات هنا تنطبق على كل الأعمال</small></div></div>
    <div class="bs-fields">
      <label class="bs-text"><span>نص الزر</span><input name="work_btn" value="<?= e(setting('work_btn') ?: 'مشاهدة العمل') ?>" maxlength="40"></label>
      <label class="switch"><input type="checkbox" name="work_btn_on" value="1" <?= on('work_btn_on') ? 'checked' : '' ?>><span class="switch-ui"></span><span class="switch-label">إظهار الزر</span></label>
      <button class="btn btn-primary btn-sm" type="submit"><?= icon('check') ?>حفظ</button>
    </div>
  </form>
<?php endif; ?>
<?php if (!$rows): ?>
  <div class="card empty">
    <span class="empty-ic"><?= icon($def['icon']) ?></span>
    <h3>ما فيه <?= e($def['title']) ?> للحين</h3>
    <p class="muted">ابدأ بإضافة أول <?= e($def['singular']) ?> ويظهر مباشرة في موقعك.</p>
    <a class="btn btn-primary" href="<?= admin_url('?p=' . $page . '&a=new') ?>"><?= icon('plus') ?>إضافة <?= e($def['singular']) ?></a>
  </div>
<?php else: ?>
  <div class="card table-card">
    <table class="table" id="tbl">
      <thead><tr>
        <?php if ($canSort): ?><th class="col-grip"></th><?php endif; ?>
        <?php foreach ($cols as $c): ?><th class="col-<?= e($def['fields'][$c]['type']) ?>"><?= e(preg_replace('/\s*\(.*\)$/u', '', $def['fields'][$c]['label'])) ?></th><?php endforeach; ?>
        <th class="col-actions"></th>
      </tr></thead>
      <tbody<?= $canSort ? ' data-sortable data-csrf="' . e(csrf_token()) . '"' : '' ?>>
      <?php foreach ($rows as $r): ?>
        <tr data-id="<?= (int) $r['id'] ?>">
          <?php if ($canSort): ?><td class="col-grip"><button type="button" class="grip" aria-label="اسحب للترتيب" title="اسحب للترتيب"><?= icon('grip') ?></button></td><?php endif; ?>
          <?php foreach ($cols as $c): ?>
            <td class="col-<?= e($def['fields'][$c]['type']) ?>" data-label="<?= e($def['fields'][$c]['label']) ?>">
              <?php if ($c === $firstText): ?><a class="row-title" href="<?= admin_url('?p=' . $page . '&a=edit&id=' . $r['id']) ?>"><?= cell_value($c, $def['fields'][$c], $r) ?></a><?php else: ?><?= cell_value($c, $def['fields'][$c], $r) ?><?php endif; ?>
            </td>
          <?php endforeach; ?>
          <td class="col-actions">
            <div class="row-actions">
              <?php if ($viewUrl && !empty($r['published'])): ?><a class="icon-btn sm" href="<?= url($viewUrl . $r['id']) ?>" target="_blank" title="عرض في الموقع"><?= icon('eye') ?></a><?php endif; ?>
              <a class="icon-btn sm" href="<?= admin_url('?p=' . $page . '&a=edit&id=' . $r['id']) ?>" title="تعديل"><?= icon('pencil') ?></a>
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
