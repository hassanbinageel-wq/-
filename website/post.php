<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$p = item('posts', (int) ($_GET['id'] ?? 0));
if (!$p) {
    http_response_code(404);
    site_head('غير موجود');
    echo '<section class="section page-top"><div class="container center"><h1>المقال غير موجود</h1><p><a class="btn btn-ghost" href="' . url('blog.php') . '">رجوع للمدونة</a></p></div></section>';
    site_foot();
    exit;
}
$more = items('posts', ['where' => 'id != ?', 'params' => [$p['id']], 'limit' => 3]);
site_head($p['title'], $p['excerpt'], $p['cover']);
?>
<article class="section page-top">
  <div class="container narrow">
    <a class="back-link" href="<?= url('blog.php') ?>"><?= icon('arrow-right') ?> المدونة</a>
    <header class="detail-head">
      <div class="post-meta" data-anim><?php if ($p['category']): ?><span class="tag"><?= e($p['category']) ?></span><?php endif; ?><span><?= icon('calendar') ?><?= e(ar_date($p['published_at'])) ?></span></div>
      <h1 data-anim style="--d:1"><?= e($p['title']) ?></h1>
      <?php if ($p['excerpt']): ?><p class="lead" data-anim style="--d:2"><?= e($p['excerpt']) ?></p><?php endif; ?>
    </header>
    <?php if ($p['cover']): ?><figure class="detail-cover reveal"><img src="<?= e(media($p['cover'])) ?>" alt="<?= e($p['title']) ?>"></figure><?php endif; ?>
    <div class="prose reveal"><?= $p['content'] /* written by admin */ ?></div>
    <div class="share reveal">
      <span>شارك المقال:</span>
      <?php $link = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '') . url('post.php?id=' . $p['id']); ?>
      <a href="https://x.com/intent/post?text=<?= rawurlencode($p['title']) ?>&url=<?= rawurlencode($link) ?>" target="_blank" rel="noopener" aria-label="X"><?= icon('x-social') ?></a>
      <a href="https://wa.me/?text=<?= rawurlencode($p['title'] . ' ' . $link) ?>" target="_blank" rel="noopener" aria-label="واتساب"><?= icon('whatsapp') ?></a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=<?= rawurlencode($link) ?>" target="_blank" rel="noopener" aria-label="LinkedIn"><?= icon('linkedin') ?></a>
      <button type="button" data-copy="<?= e($link) ?>" aria-label="نسخ الرابط"><?= icon('link') ?></button>
    </div>
  </div>
</article>
<?php if ($more): ?>
<section class="section section-alt">
  <div class="container">
    <div class="section-head reveal"><h2>مقالات أخرى</h2></div>
    <div class="grid grid-3"><?php foreach ($more as $i => $m) post_card($m, $i); ?></div>
  </div>
</section>
<?php endif; ?>
<?php site_foot();
