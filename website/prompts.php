<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$prompts = items('prompts');
site_head(setting('prompts_title'), setting('prompts_subtitle'));
?>
<section class="section page-top">
  <div class="container">
    <div class="section-head">
      <span class="eyebrow" data-anim><?= icon('sparkles') ?>البرومبتات</span>
      <h1 data-anim style="--d:1"><?= e(setting('prompts_title')) ?></h1>
      <?php if (setting('prompts_subtitle')): ?><p data-anim style="--d:2"><?= e(setting('prompts_subtitle')) ?></p><?php endif; ?>
    </div>
    <div class="search-box reveal"><?= icon('search') ?><input type="search" id="promptSearch" placeholder="ابحث في البرومبتات…"></div>
    <?php filter_chips($prompts, 'promptsGrid'); ?>
    <div class="grid grid-3 masonry" id="promptsGrid"><?php foreach ($prompts as $i => $p) prompt_card($p, $i); ?></div>
    <?php if (!$prompts): ?><p class="center muted">لا توجد برومبتات بعد.</p><?php endif; ?>
  </div>
</section>
<?php site_foot();
