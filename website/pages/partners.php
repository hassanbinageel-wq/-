<?php
current_page('partners');
$partners = items('partners');
site_head(setting('partners_title'));
page_header('partners');
?>
<section class="section section-flush">
  <div class="container">
    <div class="partner-grid<?= setting('partners_dark') === 'original' ? '' : ' dark-white' ?>">
      <?php foreach ($partners as $i => $p):
          $tag = $p['url'] ? 'a' : 'div'; ?>
        <<?= $tag ?> class="card partner-card reveal" style="--i:<?= $i % 8 ?>"<?= $p['url'] ? ' href="' . e($p['url']) . '" target="_blank" rel="noopener"' : '' ?>>
          <span class="partner-logo"><?= partner_logo($p) ?></span>
          <span class="partner-info">
            <strong><?= e($p['name']) ?></strong>
            <?php if ($p['description']): ?><small><?= e($p['description']) ?></small><?php endif; ?>
          </span>
          <?php if ($p['url']): ?><span class="partner-go"><?= icon('external') ?></span><?php endif; ?>
        </<?= $tag ?>>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php
cta_block();
site_foot();
