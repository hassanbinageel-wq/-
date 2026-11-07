<?php
/* Loaded by index.php (the router) */

current_page('blog');
$p = item('posts', (int) ($_GET['id'] ?? 0));
if (!$p) {
    http_response_code(404);
    site_head('غير موجود');
    echo '<section class="section page-top"><div class="container center"><h1>المقال غير موجود</h1><p><a class="btn btn-ghost" href="' . page_url('blog') . '">رجوع للمدونة</a></p></div></section>';
    site_foot();
    exit;
}
$more = items('posts', ['where' => 'id != ?', 'params' => [$p['id']], 'limit' => 3]);
site_head($p['title'], $p['excerpt'], $p['cover']);
$words = count(preg_split('/\s+/u', trim(strip_tags((string) $p['content'])), -1, PREG_SPLIT_NO_EMPTY));
$mins = max(1, (int) round($words / 200));
$st = settings_all();
?>
<div class="read-progress" aria-hidden="true"><span id="readBar"></span></div>
<article class="section page-top post-article" id="article">
  <div class="container narrow">
    <a class="back-link" href="<?= page_url('blog') ?>"><?= icon('arrow-right') ?> المدونة</a>
    <header class="detail-head">
      <div class="post-meta" data-anim><?php if ($p['category']): ?><span class="tag"><?= e($p['category']) ?></span><?php endif; ?><span><?= icon('calendar') ?><?= e(ar_date($p['published_at'])) ?></span><span><?= icon('clock') ?><?= $mins ?> <?= $mins <= 10 && $mins >= 3 ? 'دقائق' : 'دقيقة' ?> قراءة</span></div>
      <h1 data-anim style="--d:1"><?= e($p['title']) ?></h1>
      <?php if ($p['excerpt']): ?><p class="lead" data-anim style="--d:2"><?= e($p['excerpt']) ?></p><?php endif; ?>
    </header>
    <?php if ($p['cover']): ?><figure class="detail-cover reveal"><img src="<?= e(media($p['cover'])) ?>" alt="<?= e($p['title']) ?>"></figure><?php endif; ?>
    <div class="prose post-prose"><?= content_html($p['content']) /* written by admin */ ?></div>
    <aside class="author-box reveal">
      <?php if ($st['brand_photo']): ?><img src="<?= e(media($st['brand_photo'])) ?>" alt=""><?php else: ?><span class="avatar"><?= e(mb_substr($st['site_name'], 0, 1)) ?></span><?php endif; ?>
      <div>
        <strong><?= e($st['site_name']) ?><?php if ($st['brand_title']): ?> <span class="brand-title"><?= e($st['brand_title']) ?></span><?php endif; ?></strong>
        <p><?= e($st['site_tagline']) ?></p>
      </div>
      <?php if (section_on('contact')): ?><a class="btn btn-sm btn-primary" href="<?= page_url('contact') ?>">تواصل معي</a><?php endif; ?>
    </aside>
    <div class="share reveal">
      <span>شارك المقال:</span>
      <?php $link = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '') . post_url((int) $p['id']); ?>
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
