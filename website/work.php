<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$w = item('works', (int) ($_GET['id'] ?? 0));
if (!$w) {
    http_response_code(404);
    site_head('غير موجود');
    echo '<section class="section page-top"><div class="container center"><h1>العمل غير موجود</h1><p><a class="btn btn-ghost" href="' . url('#works') . '">رجوع للأعمال</a></p></div></section>';
    site_foot();
    exit;
}
$gallery = gallery_list($w['gallery']);
$embed = video_embed($w['video_url']);
$more = items('works', ['where' => 'id != ?', 'params' => [$w['id']], 'limit' => 3]);

site_head($w['title'], $w['summary'], $w['image']);
?>
<article class="section page-top">
  <div class="container narrow">
    <a class="back-link" href="<?= url('#works') ?>"><?= icon('arrow-right') ?> كل الأعمال</a>
    <header class="detail-head">
      <?php if ($w['category']): ?><span class="tag" data-anim><?= e($w['category']) ?></span><?php endif; ?>
      <h1 data-anim style="--d:1"><?= e($w['title']) ?></h1>
      <?php if ($w['summary']): ?><p class="lead" data-anim style="--d:2"><?= e($w['summary']) ?></p><?php endif; ?>
      <div class="detail-meta" data-anim style="--d:3">
        <?php if ($tools = csv_list($w['tools'])): ?><div class="chips"><?php foreach ($tools as $t): ?><span><?= e($t) ?></span><?php endforeach; ?></div><?php endif; ?>
        <?php if ($w['link']): ?><a class="btn btn-sm btn-primary" href="<?= e($w['link']) ?>" target="_blank" rel="noopener">زيارة المشروع <?= icon('external') ?></a><?php endif; ?>
      </div>
    </header>
  </div>
  <div class="container">
    <?php if ($embed): ?>
      <div class="video-frame reveal"><iframe src="<?= e($embed) ?>" title="<?= e($w['title']) ?>" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
    <?php elseif ($w['image']): ?>
      <figure class="detail-cover reveal"><img src="<?= e(media($w['image'])) ?>" alt="<?= e($w['title']) ?>"></figure>
    <?php endif; ?>
  </div>
  <?php if ($w['content']): ?><div class="container narrow"><div class="prose reveal"><?= $w['content'] /* written by admin */ ?></div></div><?php endif; ?>
  <?php if ($gallery): ?>
    <div class="container">
      <div class="gallery">
        <?php foreach ($gallery as $i => $g): ?>
          <a class="gallery-item reveal" style="--i:<?= $i % 6 ?>" href="<?= e(media($g)) ?>" data-lightbox><img src="<?= e(media($g)) ?>" alt="" loading="lazy"></a>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endif; ?>
</article>
<?php if ($more): ?>
<section class="section section-alt">
  <div class="container">
    <div class="section-head reveal"><h2>أعمال أخرى</h2></div>
    <div class="grid grid-3"><?php foreach ($more as $i => $m) work_card($m, $i); ?></div>
  </div>
</section>
<?php endif; ?>
<?php site_foot();
