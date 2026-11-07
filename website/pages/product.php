<?php
/* Product page (book, course, digital product) — loaded by the router */

current_page('store');
$b = item('books', (int) ($_GET['id'] ?? 0));
if (!$b) {
    http_response_code(404);
    require __DIR__ . '/404.php';
    exit;
}
$kinds = entities()['books']['fields']['kind']['options'];
$buy = clean_url($b['buy_url']);
$ask = wa_link('مرحباً، عندي سؤال عن: ' . $b['title']);
$buyHref = $buy ?: (wa_link('مرحباً، أبغى أطلب: ' . $b['title']) ?: page_url('contact'));
$images = array_values(array_filter(array_merge([$b['image']], gallery_list($b['gallery']))));
$specs = [];
foreach (lines($b['specs']) as $line) {
    $parts = preg_split('/\s*[:：]\s*/u', $line, 2);
    $specs[] = count($parts) === 2 ? $parts : ['', $line];
}
$save = '';
if ($b['old_price'] && preg_match('/[\d.]+/', $b['price'], $m1) && preg_match('/[\d.]+/', $b['old_price'], $m2) && (float) $m2[0] > (float) $m1[0]) {
    $save = 'وفّر ' . round((1 - (float) $m1[0] / (float) $m2[0]) * 100) . '%';
}
$embed = video_embed($b['video_url']);
$more = items('books', ['where' => 'id != ?', 'params' => [$b['id']], 'limit' => 3]);
site_head($b['title'], $b['description'], $b['image']);
?>
<section class="section page-top">
  <div class="container">
    <a class="back-link" href="<?= page_url('store') ?>" data-anim><?= icon('arrow-right') ?> المتجر</a>
    <div class="product">
      <div class="product-media" data-anim style="--d:1">
        <div class="product-cover">
          <?php if ($images): ?><img id="productMain" src="<?= e(media($images[0])) ?>" alt="<?= e($b['title']) ?>"><?php else: ?><?= placeholder('book', $b['title']) ?><?php endif; ?>
        </div>
        <?php if (count($images) > 1): ?>
          <div class="product-thumbs" role="list">
            <?php foreach ($images as $i => $img): ?>
              <button type="button" class="<?= $i === 0 ? 'on' : '' ?>" data-src="<?= e(media($img)) ?>" aria-label="صورة <?= $i + 1 ?>"><img src="<?= e(media($img)) ?>" alt="" loading="lazy"></button>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <div class="product-info">
        <span class="tag" data-anim><?= e($kinds[$b['kind']] ?? '') ?></span>
        <h1 data-anim style="--d:1"><?= e($b['title']) ?></h1>
        <?php if ($b['description']): ?><p class="lead" data-anim style="--d:2"><?= e($b['description']) ?></p><?php endif; ?>
        <div class="product-price" data-anim style="--d:2">
          <?php if ($b['price']): ?><strong><?= e($b['price']) ?></strong><?php endif; ?>
          <?php if ($b['old_price']): ?><del><?= e($b['old_price']) ?></del><?php endif; ?>
          <?php if ($save): ?><span class="save"><?= e($save) ?></span><?php endif; ?>
        </div>
        <div class="product-actions" data-anim style="--d:3">
          <?php if ($buyHref): ?><a class="btn btn-primary btn-lg" href="<?= e($buyHref) ?>" target="_blank" rel="noopener"><?= icon('cart') ?><?= e($b['button_text'] ?: 'اشترِ الآن') ?></a><?php endif; ?>
          <?php if ($ask && on('show_whatsapp')): ?><a class="btn btn-ghost btn-lg" href="<?= e($ask) ?>" target="_blank" rel="noopener"><?= icon('whatsapp') ?>اسأل قبل الشراء</a><?php endif; ?>
        </div>
        <div class="trust" data-anim style="--d:3">
          <?php foreach (array_slice(items('store_features'), 0, 3) as $f): ?><span><?= icon($f['icon'] ?: 'check') ?><?= e($f['title']) ?></span><?php endforeach; ?>
        </div>
        <?php if ($specs): ?>
          <div class="specs reveal">
            <?php foreach ($specs as [$k, $v]): ?><div class="spec"><?php if ($k !== ''): ?><small><?= e($k) ?></small><?php endif; ?><strong><?= e($v) ?></strong></div><?php endforeach; ?>
          </div>
        <?php endif; ?>
        <?php if ($hl = lines($b['highlights'])): ?>
          <div class="highlights reveal">
            <h2>وش بتحصل عليه؟</h2>
            <ul><?php foreach ($hl as $h): ?><li><?= icon('check') ?><span><?= e($h) ?></span></li><?php endforeach; ?></ul>
          </div>
        <?php endif; ?>
      </div>
    </div>

    <?php if ($embed || trim(strip_tags((string) $b['details'])) !== '' || str_contains((string) $b['details'], '<img')): ?>
      <div class="product-details narrow-inner">
        <?php if ($embed): ?><div class="video-frame reveal"><iframe src="<?= e($embed) ?>" title="<?= e($b['title']) ?>" allowfullscreen loading="lazy"></iframe></div><?php endif; ?>
        <?php if ($b['details']): ?><div class="prose post-prose"><?= $b['details'] /* written by admin */ ?></div><?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php sec_faq(); ?>
<?php if ($more): ?>
<section class="section">
  <div class="container">
    <div class="section-head solo reveal"><div class="section-head-text"><h2>منتجات أخرى</h2></div></div>
    <?php product_grid($more); ?>
  </div>
</section>
<?php endif; ?>
<?php site_foot();
