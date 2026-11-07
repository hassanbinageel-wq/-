<?php
$schema = settings_schema();
$g = (string) ($_GET['g'] ?? 'general');
if (!isset($schema[$g]) || !empty($schema[$g]['hidden'])) $g = 'general';
$vals = settings_all();
$group = $schema[$g];
?>
<div class="tabs">
  <?php foreach ($schema as $k => $grp): if (!empty($grp['hidden'])) continue; ?>
    <a href="<?= admin_url('?p=settings&g=' . $k) ?>" class="<?= $k === $g ? 'active' : '' ?>"><?= icon($grp['icon']) ?><?= e($grp['title']) ?></a>
  <?php endforeach; ?>
</div>

<form method="post" enctype="multipart/form-data" class="card form-card" data-dirty-check>
  <?= csrf_field() ?>
  <input type="hidden" name="_do" value="save">
  <input type="hidden" name="group" value="<?= e($g) ?>">
  <?php if ($g === 'sections'): ?>
    <p class="muted">أظهر أو أخفِ أي قسم من الموقع، وغيّر عنوانه ووصفه. القسم المخفي يختفي من الرئيسية والقائمة، وصفحته تصير «غير موجودة».</p>
    <div class="section-groups">
      <?php foreach (home_sections() as $k => [$nav]): ?>
        <fieldset class="section-group">
          <legend><?= e($nav) ?></legend>
          <div class="fields">
            <?php foreach (['show_' . $k, $k . '_title', $k . '_subtitle'] as $fk) if (isset($group['fields'][$fk])) render_field($fk, $group['fields'][$fk], $vals[$fk] ?? null); ?>
          </div>
        </fieldset>
      <?php endforeach; ?>
    </div>
  <?php elseif (!empty($group['pairs'])): ?>
    <p class="muted">حط رابط كل حساب، واستخدم المفتاح لإظهاره أو إخفائه من الموقع. الحساب اللي رابطه فاضي ما يظهر.</p>
    <div class="pair-list">
      <?php foreach ($group['fields'] as $k => $f): if (str_ends_with($k, '_on')) continue; ?>
        <div class="pair-row">
          <?php render_field($k, $f, $vals[$k] ?? null); ?>
          <?php render_field($k . '_on', $group['fields'][$k . '_on'], $vals[$k . '_on'] ?? null); ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
    <?php if ($g === 'mail'): ?>
      <div class="info-box">
        <strong><?= icon('mail') ?> كيف أجهز البريد؟</strong>
        <ol>
          <li>من hPanel ← <b>Emails</b> أنشئ إيميل على دومينك (مثل <span class="ltr">hello@hsnpmt.com</span>).</li>
          <li>اكتب الإيميل وكلمة مروره هنا واحفظ. الخادم والمنفذ جاهزين لـ Hostinger.</li>
          <li>اضغط «إرسال إيميل تجريبي» وتأكد إنه وصلك.</li>
        </ol>
        <span class="status-line <?= smtp_configured() ? 'ok' : '' ?>"><?= smtp_configured() ? 'البريد مُعدّ ✓' : 'البريد غير مُعدّ — تأكيد الرسائل والرد من اللوحة متوقفين' ?></span>
      </div>
    <?php endif; ?>
    <?php if ($g === 'contact'): ?><p class="muted">كل وسيلة لها مفتاح إظهار/إخفاء — المخفية ما تظهر في الموقع أبداً.</p><?php endif; ?>
    <div class="fields">
      <?php foreach ($group['fields'] as $k => $f) render_field($k, $f, $vals[$k] ?? null); ?>
    </div>
  <?php endif; ?>
  <div class="form-foot">
    <button class="btn btn-primary" type="submit"><?= icon('check') ?>حفظ الإعدادات</button>
    <?php if ($g === 'hero'): ?><button class="btn btn-ghost btn-preview" type="button" data-open-preview><?= icon('eye') ?>معاينة مباشرة</button><?php endif; ?>
    <?php if ($g === 'mail' && smtp_configured()): ?><button class="btn btn-ghost" type="submit" form="testMail"><?= icon('send') ?>إرسال إيميل تجريبي</button><?php endif; ?>
    <a class="btn btn-ghost" href="<?= url() ?>" target="_blank"><?= icon('external') ?>شوف التغييرات في الموقع</a>
  </div>
</form>
<?php if ($g === 'mail'): ?>
<form method="post" id="testMail" hidden><?= csrf_field() ?><input type="hidden" name="_do" value="test_mail"></form>
<?php endif; ?>
<?php if ($g === 'hero'): ?>
<button class="preview-fab" type="button" data-open-preview><?= icon('eye') ?><span>معاينة مباشرة</span></button>
<div class="live-preview" id="livePreview" hidden role="dialog" aria-modal="true" aria-label="معاينة البنر">
  <div class="lp-bar">
    <strong><?= icon('eye') ?> معاينة مباشرة <small>— التغييرات تظهر هنا فوراً، وما تنحفظ إلا لما تضغط «حفظ»</small></strong>
    <div class="lp-seg" role="group" aria-label="حجم الشاشة">
      <button type="button" data-device="desktop" class="on"><?= icon('monitor') ?>كمبيوتر</button>
      <button type="button" data-device="mobile"><?= icon('smartphone') ?>جوال</button>
    </div>
    <button class="icon-btn" type="button" data-close-preview aria-label="إغلاق"><?= icon('x') ?></button>
  </div>
  <div class="lp-stage" id="lpStage">
    <div class="lp-frame" id="lpFrame"><iframe id="lpIframe" title="معاينة الموقع" data-src="<?= e(url('?hero_preview=1')) ?>"></iframe></div>
  </div>
</div>
<?php endif; ?>
