<?php
current_page('store');
$s = settings_all();
$features = (string) $s['store_features_on'] === '1' ? items('store_features') : [];
$books = items('books');
site_head($s['books_title'], $s['store_intro']);
?>
<section class="store-hero">
  <div class="hero-bg" aria-hidden="true"><div class="hero-grid"></div><span class="blob b1"></span></div>
  <div class="container">
    <a class="back-link" href="<?= url() ?>" data-anim><?= icon('arrow-right') ?> العودة للرئيسية</a>
    <span class="eyebrow" data-anim style="--d:1"><?= e($s['store_eyebrow']) ?></span>
    <h1 data-anim style="--d:1"><?= highlight_title($s['store_title'], $s['store_highlight']) ?></h1>
    <?php if ($s['store_intro']): ?><p class="lead" data-anim style="--d:2"><?= e($s['store_intro']) ?></p><?php endif; ?>
    <?php if ($features): ?>
      <div class="feature-row" data-anim style="--d:3">
        <?php foreach ($features as $f): ?>
          <div class="feature-card">
            <?php if ($f['icon']): ?><span class="feature-ic"><?= icon($f['icon']) ?></span><?php endif; ?>
            <span><strong><?= e($f['title']) ?></strong><?php if ($f['description']): ?><small><?= e($f['description']) ?></small><?php endif; ?></span>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php if ($books): ?>
<section class="section">
  <div class="container"><?php product_grid($books); ?></div>
</section>
<?php else: ?>
<section class="section"><div class="container"><p class="muted center-text">المنتجات قريباً.</p></div></section>
<?php endif; ?>
<?php
sec_faq();
site_foot();
