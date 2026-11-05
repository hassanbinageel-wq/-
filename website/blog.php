<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$posts = items('posts');
site_head(setting('blog_title'), setting('blog_subtitle'));
?>
<section class="section page-top">
  <div class="container">
    <div class="section-head">
      <span class="eyebrow" data-anim><?= icon('newspaper') ?>المدونة</span>
      <h1 data-anim style="--d:1"><?= e(setting('blog_title')) ?></h1>
      <?php if (setting('blog_subtitle')): ?><p data-anim style="--d:2"><?= e(setting('blog_subtitle')) ?></p><?php endif; ?>
    </div>
    <?php filter_chips($posts, 'postsGrid'); ?>
    <?php if ($posts): ?>
      <div class="grid grid-3" id="postsGrid"><?php foreach ($posts as $i => $p) { echo '<div data-cat="' . e($p['category']) . '" class="cell">'; post_card($p, $i); echo '</div>'; } ?></div>
    <?php else: ?>
      <p class="center muted">لا توجد مقالات بعد.</p>
    <?php endif; ?>
  </div>
</section>
<?php site_foot();
