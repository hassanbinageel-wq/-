<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$s = settings_all();
site_head();

$titleHtml = e($s['hero_title']);
if ($s['hero_highlight'] !== '' && str_contains($s['hero_title'], $s['hero_highlight'])) {
    $titleHtml = str_replace(e($s['hero_highlight']), '<span class="grad">' . e($s['hero_highlight']) . '</span>', $titleHtml);
}
$tools = items('tools');
$heroTools = array_values(array_filter($tools, fn($t) => (int) $t['in_hero'] === 1));

function tool_chip(array $t, string $class = 'tool-chip'): string
{
    $ic = $t['logo'] ? '<img src="' . e(media($t['logo'])) . '" alt="">' : icon($t['icon'] ?: 'sparkles');
    $tag = $t['url'] ? 'a' : 'span';
    $href = $t['url'] ? ' href="' . e($t['url']) . '" target="_blank" rel="noopener"' : '';
    return '<' . $tag . ' class="' . $class . '"' . $href . '>' . $ic . '<span>' . e($t['name']) . '</span></' . $tag . '>';
}
?>

<!-- ============ HERO / BANNER ============ -->
<section class="hero" id="top">
  <div class="hero-bg" aria-hidden="true">
    <?php if ($s['hero_bg']): ?><img class="hero-bg-img" src="<?= e(media($s['hero_bg'])) ?>" alt=""><?php endif; ?>
    <div class="hero-grid"></div>
    <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
  </div>
  <div class="container hero-inner">
    <div class="hero-text">
      <?php if ($s['hero_badge']): ?><span class="pill" data-anim><span class="dot"></span><?= e($s['hero_badge']) ?></span><?php endif; ?>
      <h1 data-anim style="--d:1"><?= $titleHtml ?></h1>
      <?php if ($s['hero_subtitle']): ?><p class="lead" data-anim style="--d:2"><?= e($s['hero_subtitle']) ?></p><?php endif; ?>
      <div class="hero-cta" data-anim style="--d:3">
        <?php if ($s['hero_cta_text']): ?><a class="btn btn-primary btn-lg" href="<?= e(link_href($s['hero_cta_link'])) ?>"><?= e($s['hero_cta_text']) ?><?= icon('arrow-left') ?></a><?php endif; ?>
        <?php if ($s['hero_cta2_text']): ?><a class="btn btn-ghost btn-lg" href="<?= e(link_href($s['hero_cta2_link'])) ?>"><?= e($s['hero_cta2_text']) ?></a><?php endif; ?>
      </div>
      <?php if ($socials = social_links()): ?>
        <div class="hero-socials" data-anim style="--d:4">
          <?php foreach ($socials as $sl): ?><a href="<?= e($sl['url']) ?>" target="_blank" rel="noopener" aria-label="<?= e($sl['label']) ?>"><?= icon($sl['icon']) ?></a><?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
    <div class="hero-visual" data-anim style="--d:2">
      <div class="portrait">
        <div class="portrait-ring"></div>
        <?php if ($s['hero_image']): ?>
          <img src="<?= e(media($s['hero_image'])) ?>" alt="<?= e($s['site_name']) ?>">
        <?php else: ?>
          <div class="orb"><span></span><span></span><span></span><?= icon('sparkles', 'ic orb-ic') ?></div>
        <?php endif; ?>
      </div>
      <?php foreach (array_slice($heroTools, 0, 4) as $i => $t): ?>
        <?= tool_chip($t, 'float-chip fc' . ($i + 1)) ?>
      <?php endforeach; ?>
    </div>
  </div>
  <a class="scroll-hint" href="#<?= section_on('about') ? 'about' : 'works' ?>" aria-label="انزل للأسفل"><span></span></a>
</section>

<?php $stats = items('stats');
if (section_on('stats') && ($stats || $tools)): ?>
<!-- ============ STATS & TOOLS ============ -->
<section class="section section-tight" id="stats" aria-label="الأرقام">
  <div class="container">
    <div class="stats-band reveal">
      <div class="starfield" aria-hidden="true"></div>
      <?php if ($stats): ?>
        <?php $n = count($stats); $cols = $n <= 6 ? $n : ($n % 4 === 0 ? 4 : 3); ?>
        <div class="stats-grid" style="--cols:<?= $cols ?>">
          <?php foreach ($stats as $i => $st): ?>
            <div class="stat" style="--i:<?= $i ?>">
              <?php if ($st['icon']): ?><span class="stat-icon"><?= icon($st['icon']) ?></span><?php endif; ?>
              <strong dir="ltr" data-count="<?= e($st['value']) ?>"><?= e($st['value']) ?></strong>
              <span><?= e($st['label']) ?></span>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <?php if ($tools): ?>
        <div class="tools-row">
          <?php if ($s['tools_label']): ?><span class="tools-label"><?= e($s['tools_label']) ?></span><?php endif; ?>
          <?php foreach ($tools as $t) echo tool_chip($t); ?>
        </div>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('about')): ?>
<!-- ============ ABOUT ============ -->
<section class="section" id="about">
  <div class="container about">
    <div class="about-media reveal">
      <?php if ($s['about_image']): ?><img src="<?= e(media($s['about_image'])) ?>" alt="<?= e($s['site_name']) ?>" loading="lazy"><?php else: ?><?= placeholder('user') ?><?php endif; ?>
    </div>
    <div class="about-body">
      <div class="section-head reveal">
        <div class="section-head-text">
          <span class="eyebrow"><?= e(setting('about_title')) ?></span>
          <h2><?= e($s['about_heading']) ?></h2>
        </div>
      </div>
      <div class="about-text reveal"><?= nl2p($s['about_text']) ?></div>
      <?php if ($skills = lines($s['about_skills'])): ?>
        <ul class="skills reveal"><?php foreach ($skills as $sk): ?><li><?= icon('check') ?><?= e($sk) ?></li><?php endforeach; ?></ul>
      <?php endif; ?>
      <div class="about-actions reveal">
        <?php if (items('timeline', ['limit' => 1])): ?><a class="btn btn-primary" href="<?= url('story.php') ?>"><?= e($s['story_btn'] ?: 'اقرأ القصة كاملة') ?><?= icon('arrow-left') ?></a><?php endif; ?>
        <?php if ($s['cv_url']): ?><a class="btn btn-ghost" href="<?= e($s['cv_url']) ?>" target="_blank" rel="noopener"><?= icon('download') ?>السيرة الذاتية</a><?php endif; ?>
      </div>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('services') && ($services = items('services'))): ?>
<!-- ============ SERVICES ============ -->
<section class="section" id="services">
  <div class="container">
    <?php section_head('services', 'headset'); ?>
    <div class="grid grid-4">
      <?php foreach ($services as $i => $sv): ?>
        <article class="card service-card reveal" style="--i:<?= $i ?>">
          <span class="service-icon"><?= icon($sv['icon'] ?: 'sparkles') ?></span>
          <h3><?= e($sv['title']) ?></h3>
          <p><?= e($sv['description']) ?></p>
          <?php if ($f = lines($sv['features'])): ?><ul class="mini-list"><?php foreach ($f as $x): ?><li><?= icon('check') ?><?= e($x) ?></li><?php endforeach; ?></ul><?php endif; ?>
          <?php if ($sv['price_from']): ?><div class="price-from">يبدأ من <strong><?= e($sv['price_from']) ?></strong></div><?php endif; ?>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('works') && ($works = items('works'))): ?>
<!-- ============ WORKS ============ -->
<section class="section" id="works">
  <div class="container">
    <?php section_head('works', 'image'); ?>
    <?php filter_chips($works, 'worksGrid'); ?>
    <div class="grid grid-3 works-grid" id="worksGrid">
      <?php foreach ($works as $i => $w) work_card($w, $i); ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('prompts') && ($prompts = items('prompts', ['limit' => 7]))): ?>
<!-- ============ PROMPTS ============ -->
<section class="section section-alt" id="prompts">
  <div class="container">
    <?php section_head('prompts', '', url('prompts.php'), 'كل البرومبتات'); ?>
    <div class="grid grid-3 masonry">
      <?php foreach (array_slice($prompts, 0, 6) as $i => $p) prompt_card($p, $i); ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('books') && ($books = items('books'))): ?>
<!-- ============ BOOKS & STORE ============ -->
<section class="section" id="books">
  <div class="container">
    <?php section_head('books', 'book'); ?>
    <div class="grid grid-3">
      <?php $kinds = entities()['books']['fields']['kind']['options'];
      foreach ($books as $i => $b):
          $buy = clean_url($b['buy_url']) ?: wa_link('مرحباً، أبغى أطلب: ' . $b['title']);
          ?>
        <article class="card book-card reveal" style="--i:<?= $i ?>">
          <div class="book-cover">
            <?php if ($b['image']): ?><img src="<?= e(media($b['image'])) ?>" alt="<?= e($b['title']) ?>" loading="lazy"><?php else: ?><?= placeholder('book', $b['title']) ?><?php endif; ?>
            <span class="tag tag-float"><?= e($kinds[$b['kind']] ?? '') ?></span>
          </div>
          <div class="book-body">
            <h3><?= e($b['title']) ?></h3>
            <?php if ($b['description']): ?><p><?= e($b['description']) ?></p><?php endif; ?>
            <div class="book-foot">
              <div class="price"><?php if ($b['price']): ?><strong><?= e($b['price']) ?></strong><?php endif; ?><?php if ($b['old_price']): ?><del><?= e($b['old_price']) ?></del><?php endif; ?></div>
              <?php if ($buy): ?><a class="btn btn-sm btn-primary" href="<?= e($buy) ?>" target="_blank" rel="noopener"><?= icon('cart') ?><?= e($b['button_text'] ?: 'اشترِ الآن') ?></a><?php endif; ?>
            </div>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('clients') && ($clients = items('clients'))): ?>
<!-- ============ CLIENTS ============ -->
<section class="section section-alt" id="clients">
  <div class="container">
    <?php section_head('clients', 'user'); ?>
    <div class="grid grid-3">
      <?php foreach ($clients as $i => $c): ?>
        <figure class="card testimonial reveal" style="--i:<?= $i ?>">
          <?= icon('quote', 'ic quote-ic') ?>
          <?php if ($c['rating'] > 0): ?><div class="stars" aria-label="<?= (int) $c['rating'] ?> من 5"><?php for ($r = 1; $r <= 5; $r++) echo '<span class="' . ($r <= $c['rating'] ? 'on' : '') . '">' . icon('star') . '</span>'; ?></div><?php endif; ?>
          <blockquote><?= e($c['testimonial']) ?></blockquote>
          <figcaption>
            <span class="avatar"><?php if ($c['logo']): ?><img src="<?= e(media($c['logo'])) ?>" alt="" loading="lazy"><?php else: ?><?= e(mb_substr($c['name'], 0, 1)) ?><?php endif; ?></span>
            <span><strong><?= e($c['name']) ?></strong><?php if ($c['role']): ?><small><?= e($c['role']) ?></small><?php endif; ?></span>
          </figcaption>
        </figure>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('partners') && ($partners = items('partners'))): ?>
<!-- ============ PARTNERS ============ -->
<section class="section section-tight" id="partners">
  <div class="container">
    <?php section_head('partners', 'landmark'); ?>
  </div>
  <div class="marquee reveal" aria-label="شركاء النجاح">
    <div class="marquee-track">
      <?php for ($loop = 0; $loop < 2; $loop++): ?>
        <div class="marquee-group" <?= $loop ? 'aria-hidden="true"' : '' ?>>
          <?php foreach ($partners as $p):
              $tag = $p['url'] ? 'a' : 'div'; ?>
            <<?= $tag ?> class="partner" <?= $p['url'] ? 'href="' . e($p['url']) . '" target="_blank" rel="noopener"' : '' ?> title="<?= e($p['name']) ?>">
              <?php if ($p['logo']): ?><img src="<?= e(media($p['logo'])) ?>" alt="<?= e($p['name']) ?>" loading="lazy"><?php else: ?><span><?= e($p['name']) ?></span><?php endif; ?>
            </<?= $tag ?>>
          <?php endforeach; ?>
        </div>
      <?php endfor; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('blog') && ($posts = items('posts', ['limit' => 3]))): ?>
<!-- ============ BLOG ============ -->
<section class="section" id="blog">
  <div class="container">
    <?php section_head('blog', '', url('blog.php'), 'كل المقالات'); ?>
    <div class="grid grid-3">
      <?php foreach ($posts as $i => $p) post_card($p, $i); ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php if (section_on('contact')): ?>
<!-- ============ CONTACT ============ -->
<section class="section section-alt" id="contact">
  <div class="container">
    <?php section_head('contact', 'mail'); ?>
    <div class="contact">
      <div class="contact-info reveal">
        <?php if ($s['contact_email']): ?><a class="info-row" href="mailto:<?= e($s['contact_email']) ?>"><span class="info-ic"><?= icon('mail') ?></span><span><small>البريد الإلكتروني</small><strong dir="ltr"><?= e($s['contact_email']) ?></strong></span></a><?php endif; ?>
        <?php if ($wa = wa_link()): ?><a class="info-row" href="<?= e($wa) ?>" target="_blank" rel="noopener"><span class="info-ic"><?= icon('whatsapp') ?></span><span><small>واتساب</small><strong>راسلني مباشرة</strong></span></a><?php endif; ?>
        <?php if ($s['contact_phone']): ?><a class="info-row" href="tel:<?= e(preg_replace('/[^\d+]/', '', $s['contact_phone'])) ?>"><span class="info-ic"><?= icon('phone') ?></span><span><small>الجوال</small><strong dir="ltr"><?= e($s['contact_phone']) ?></strong></span></a><?php endif; ?>
        <?php if ($s['location']): ?><div class="info-row"><span class="info-ic"><?= icon('map-pin') ?></span><span><small>الموقع</small><strong><?= e($s['location']) ?></strong></span></div><?php endif; ?>
        <?php if ($socials): ?><div class="socials"><?php foreach ($socials as $sl): ?><a href="<?= e($sl['url']) ?>" target="_blank" rel="noopener" aria-label="<?= e($sl['label']) ?>"><?= icon($sl['icon']) ?></a><?php endforeach; ?></div><?php endif; ?>
      </div>
      <form class="card contact-form reveal" id="contactForm" method="post" action="<?= url('contact.php') ?>" novalidate>
        <div class="form-row">
          <label><span>الاسم *</span><input name="name" required maxlength="100" autocomplete="name"></label>
          <label><span>البريد الإلكتروني</span><input name="email" type="email" maxlength="150" autocomplete="email" dir="ltr"></label>
        </div>
        <div class="form-row">
          <label><span>الجوال</span><input name="phone" maxlength="30" autocomplete="tel" dir="ltr"></label>
          <label><span>الموضوع</span><input name="subject" maxlength="150"></label>
        </div>
        <label><span>رسالتك *</span><textarea name="message" rows="5" required maxlength="5000"></textarea></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <input type="hidden" name="ts" value="<?= time() ?>">
        <button class="btn btn-primary btn-lg" type="submit"><span>إرسال الرسالة</span><?= icon('send') ?></button>
        <p class="form-msg" role="status" aria-live="polite"><?= isset($_GET['sent']) ? 'تم إرسال رسالتك بنجاح، بتواصل معك قريباً ✨' : '' ?></p>
      </form>
    </div>
  </div>
</section>
<?php endif; ?>

<?php site_foot(); ?>
