<?php
/**
 * Page sections. Each one is used twice:
 * on the homepage as a short preview (with a "view all" link), and on its own page in full.
 */

function tool_chip(array $t, string $class = 'tool-chip'): string
{
    $ic = $t['logo'] ? '<img src="' . e(media($t['logo'])) . '" alt="">' : icon($t['icon'] ?: 'sparkles');
    $tag = $t['url'] ? 'a' : 'span';
    $href = $t['url'] ? ' href="' . e($t['url']) . '" target="_blank" rel="noopener"' : '';
    return '<' . $tag . ' class="' . $class . '"' . $href . '>' . $ic . '<span>' . e($t['name']) . '</span></' . $tag . '>';
}

function sec_hero(): void
{
    $s = settings_all();
    $heroTools = array_values(array_filter(items('tools'), fn($t) => (int) $t['in_hero'] === 1));
    ?>
<section class="hero" id="top">
  <div class="hero-bg" aria-hidden="true">
    <?php if ($s['hero_bg']): ?><img class="hero-bg-img" src="<?= e(media($s['hero_bg'])) ?>" alt=""><?php endif; ?>
    <div class="hero-grid"></div>
    <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
  </div>
  <div class="container hero-inner">
    <div class="hero-text">
      <?php if ($s['hero_badge']): ?><span class="pill" data-anim><span class="dot"></span><?= e($s['hero_badge']) ?></span><?php endif; ?>
      <h1 data-anim style="--d:1"><?= highlight_title($s['hero_title'], $s['hero_highlight']) ?></h1>
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
</section>
    <?php
}

function sec_stats(): void
{
    $stats = items('stats');
    $tools = items('tools');
    if (!section_on('stats') || (!$stats && !$tools)) {
        return;
    }
    $n = count($stats);
    $cols = $n <= 6 ? max(1, $n) : ($n % 4 === 0 ? 4 : 3);
    ?>
<section class="section section-tight" id="stats" aria-label="الأرقام">
  <div class="container">
    <div class="stats-band reveal">
      <?php if ($stats): ?>
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
          <?php if (setting('tools_label')): ?><span class="tools-label"><?= e(setting('tools_label')) ?></span><?php endif; ?>
          <?php foreach ($tools as $t) echo tool_chip($t); ?>
        </div>
      <?php endif; ?>
    </div>
  </div>
</section>
    <?php
}

function sec_about(bool $preview = true): void
{
    if (!section_on('about')) {
        return;
    }
    $s = settings_all();
    $skills = items('skills');
    ?>
<section class="section" id="about">
  <div class="container about">
    <div class="about-media-wrap reveal">
      <div class="about-media">
        <?php if ($s['about_image']): ?><img src="<?= e(media($s['about_image'])) ?>" alt="<?= e($s['site_name']) ?>" loading="lazy"><?php else: ?><?= placeholder('user') ?><?php endif; ?>
      </div>
      <?php if ((string) $s['exp_on'] === '1' && $s['exp_num'] !== ''): ?>
        <div class="exp-badge"><strong dir="ltr" data-count="<?= e($s['exp_num']) ?>"><?= e($s['exp_num']) ?></strong><span><?= e($s['exp_label']) ?></span></div>
      <?php endif; ?>
    </div>
    <div class="about-body">
      <div class="section-head solo reveal">
        <div class="section-head-text">
          <span class="eyebrow"><?= e(setting('about_title')) ?></span>
          <h2><?= e($s['about_heading']) ?></h2>
        </div>
      </div>
      <div class="about-text reveal"><?= nl2p($s['about_text']) ?></div>
      <?php if ($skills): ?>
        <ul class="skills reveal">
          <?php foreach ($skills as $i => $sk): ?>
            <li style="--i:<?= $i ?>"><span class="skill-ic"><?= icon($sk['icon'] ?: 'check') ?></span><span><?= e($sk['title']) ?></span></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
      <div class="about-actions reveal">
        <?php if (items('timeline', ['limit' => 1])): ?><a class="btn btn-primary" href="<?= page_url('story') ?>"><?= e($s['story_btn'] ?: 'اقرأ القصة كاملة') ?><?= icon('arrow-left') ?></a><?php endif; ?>
        <?php if ($preview): ?><a class="btn btn-ghost" href="<?= page_url('about') ?>">المزيد عني</a><?php endif; ?>
        <?php if ($s['cv_url']): ?><a class="btn btn-ghost" href="<?= e($s['cv_url']) ?>" target="_blank" rel="noopener"><?= icon('download') ?>السيرة الذاتية</a><?php endif; ?>
      </div>
    </div>
  </div>
</section>
    <?php
}

function sec_services(bool $preview = true): void
{
    if (!section_on('services') || !($services = items('services'))) {
        return;
    }
    ?>
<section class="section" id="services">
  <div class="container">
    <?php if ($preview) section_head('services', '', page_url('services'), 'كل الخدمات'); ?>
    <div class="grid grid-<?= count($services) % 3 === 0 ? 3 : 4 ?>">
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
    <?php
}

function sec_works(bool $preview = true): void
{
    if (!section_on('works') || !($works = items('works', $preview ? ['limit' => 6] : []))) {
        return;
    }
    ?>
<section class="section" id="works">
  <div class="container">
    <?php if ($preview) section_head('works', '', page_url('works'), 'كل الأعمال'); ?>
    <?php type_tabs($works, 'worksGrid'); ?>
    <div class="grid grid-3 works-grid" id="worksGrid">
      <?php foreach ($works as $i => $w) work_card($w, $i); ?>
    </div>
    <p class="filter-empty" hidden>ما فيه أعمال من هذا النوع للحين.</p>
  </div>
</section>
    <?php
}

function sec_prompts(bool $preview = true): void
{
    if (!section_on('prompts') || !($prompts = items('prompts', $preview ? ['limit' => 3] : []))) {
        return;
    }
    ?>
<section class="section section-alt" id="prompts">
  <div class="container">
    <?php if ($preview): ?>
      <?php section_head('prompts', '', page_url('prompts'), 'كل البرومبتات'); ?>
    <?php else: ?>
      <div class="search-box reveal"><?= icon('search') ?><input type="search" id="promptSearch" placeholder="ابحث في البرومبتات…" aria-label="بحث"></div>
      <?php filter_chips($prompts, 'promptsGrid'); ?>
    <?php endif; ?>
    <div class="grid grid-3 masonry" id="promptsGrid">
      <?php foreach ($prompts as $i => $p) prompt_card($p, $i); ?>
    </div>
  </div>
</section>
    <?php
}

function product_grid(array $books): void
{
    $kinds = entities()['books']['fields']['kind']['options'];
    ?>
    <div class="grid grid-3 products">
      <?php foreach ($books as $i => $b):
          $buy = clean_url($b['buy_url']) ?: wa_link('مرحباً، أبغى أطلب: ' . $b['title']); ?>
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
    <?php
}

function sec_store_preview(): void
{
    if (!section_on('books') || !($books = items('books', ['limit' => 3]))) {
        return;
    }
    ?>
<section class="section" id="store">
  <div class="container">
    <?php section_head('books', '', page_url('store'), 'زيارة المتجر'); ?>
    <?php product_grid($books); ?>
  </div>
</section>
    <?php
}

function sec_faq(): void
{
    if ((string) setting('faq_on') !== '1' || !($faqs = items('faqs'))) {
        return;
    }
    ?>
<section class="section section-alt" id="faq">
  <div class="container narrow">
    <div class="section-head center-head reveal"><div class="section-head-text"><h2><?= e(setting('faq_title')) ?></h2></div></div>
    <div class="faq">
      <?php foreach ($faqs as $i => $f): ?>
        <details class="faq-item reveal" style="--i:<?= $i ?>"<?= $i === 0 ? ' open' : '' ?>>
          <summary><span><?= e($f['question']) ?></span><?= icon('chevron-down', 'ic faq-ic') ?></summary>
          <div class="faq-answer"><?= nl2p($f['answer']) ?></div>
        </details>
      <?php endforeach; ?>
    </div>
  </div>
</section>
    <?php
}

function sec_clients(): void
{
    if (!section_on('clients') || !($clients = items('clients'))) {
        return;
    }
    ?>
<section class="section section-alt" id="clients">
  <div class="container">
    <?php section_head('clients'); ?>
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
    <?php
}

function partner_logo(array $p): string
{
    if (!$p['logo']) {
        return '<span class="partner-name">' . e($p['name']) . '</span>';
    }
    $out = '<img class="pl-light' . ($p['logo_dark'] ? '' : ' pl-only') . '" src="' . e(media($p['logo'])) . '" alt="' . e($p['name']) . '" loading="lazy">';
    if ($p['logo_dark']) {
        $out .= '<img class="pl-dark" src="' . e(media($p['logo_dark'])) . '" alt="' . e($p['name']) . '" loading="lazy">';
    }
    return $out;
}

/** Two rows of logos moving in opposite directions */
function sec_partners(): void
{
    if (!section_on('partners') || !($partners = items('partners'))) {
        return;
    }
    $rows = count($partners) >= 6 ? array_chunk($partners, (int) ceil(count($partners) / 2)) : [$partners];
    ?>
<section class="section" id="partners">
  <div class="container">
    <div class="section-head center-head reveal">
      <div class="section-head-text">
        <span class="eyebrow"><?= e(home_sections()['partners'][0]) ?></span>
        <h2><?= e(setting('partners_title')) ?></h2>
        <?php if (setting('partners_subtitle')): ?><p><?= e(setting('partners_subtitle')) ?></p><?php endif; ?>
      </div>
    </div>
  </div>
  <div class="logo-rows reveal" aria-label="شركاء النجاح">
    <?php foreach ($rows as $r => $row):
        $loop = $row;
        while (count($loop) < 8) $loop = array_merge($loop, $row); ?>
      <div class="marquee<?= $r % 2 ? ' reverse' : '' ?>">
        <div class="marquee-track">
          <?php for ($k = 0; $k < 2; $k++): ?>
            <div class="marquee-group"<?= $k ? ' aria-hidden="true"' : '' ?>>
              <?php foreach ($loop as $p): ?>
                <span class="logo-item<?= $p['logo'] && !$p['logo_dark'] ? ' needs-tile' : '' ?>" title="<?= e($p['name']) ?>"><?= partner_logo($p) ?></span>
              <?php endforeach; ?>
            </div>
          <?php endfor; ?>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
  <div class="center reveal"><a class="btn btn-outline" href="<?= page_url('partners') ?>"><?= e(setting('partners_btn') ?: 'معرفة المزيد') ?><?= icon('arrow-left') ?></a></div>
</section>
    <?php
}

function sec_blog(bool $preview = true): void
{
    if (!section_on('blog') || !($posts = items('posts', $preview ? ['limit' => 3] : []))) {
        return;
    }
    ?>
<section class="section" id="blog">
  <div class="container">
    <?php if ($preview): ?>
      <?php section_head('blog', '', page_url('blog'), 'كل المقالات'); ?>
    <?php else: ?>
      <?php filter_chips($posts, 'postsGrid'); ?>
    <?php endif; ?>
    <div class="grid grid-3" id="postsGrid">
      <?php foreach ($posts as $i => $p) { echo '<div class="cell" data-cat="' . e($p['category']) . '">'; post_card($p, $i); echo '</div>'; } ?>
    </div>
  </div>
</section>
    <?php
}

function sec_contact(bool $preview = true): void
{
    if (!section_on('contact')) {
        return;
    }
    $s = settings_all();
    $socials = social_links();
    $verify = (string) $s['verify_contact'] === '1' && smtp_configured();
    ?>
<section class="section section-alt" id="contact">
  <div class="container">
    <?php if ($preview) section_head('contact'); ?>
    <div class="contact<?= on('show_form') ? '' : ' no-form' ?>">
      <div class="contact-info reveal">
        <?php if (on('show_email') && $s['contact_email']): ?><a class="info-row" href="mailto:<?= e($s['contact_email']) ?>"><span class="info-ic"><?= icon('mail') ?></span><span><small>البريد الإلكتروني</small><strong dir="ltr"><?= e($s['contact_email']) ?></strong></span></a><?php endif; ?>
        <?php if (on('show_whatsapp') && ($wa = wa_link())): ?><a class="info-row" href="<?= e($wa) ?>" target="_blank" rel="noopener"><span class="info-ic"><?= icon('whatsapp') ?></span><span><small>واتساب</small><strong>راسلني مباشرة</strong></span></a><?php endif; ?>
        <?php if (on('show_phone') && $s['contact_phone']): ?><a class="info-row" href="tel:<?= e(preg_replace('/[^\d+]/', '', $s['contact_phone'])) ?>"><span class="info-ic"><?= icon('phone') ?></span><span><small>الجوال</small><strong dir="ltr"><?= e($s['contact_phone']) ?></strong></span></a><?php endif; ?>
        <?php if (on('show_location') && $s['location']): ?><div class="info-row"><span class="info-ic"><?= icon('map-pin') ?></span><span><small>الموقع</small><strong><?= e($s['location']) ?></strong></span></div><?php endif; ?>
        <?php if ($socials): ?><div class="socials"><?php foreach ($socials as $sl): ?><a href="<?= e($sl['url']) ?>" target="_blank" rel="noopener" aria-label="<?= e($sl['label']) ?>"><?= icon($sl['icon']) ?></a><?php endforeach; ?></div><?php endif; ?>
      </div>
      <?php if (on('show_form')): ?>
      <form class="card contact-form reveal" id="contactForm" method="post" action="<?= url('send') ?>" novalidate data-verify="<?= $verify ? '1' : '0' ?>">
        <div class="step step-form">
          <div class="form-row">
            <label><span>الاسم *</span><input name="name" required maxlength="100" autocomplete="name"></label>
            <label><span>البريد الإلكتروني<?= $verify ? ' *' : '' ?></span><input name="email" type="email" maxlength="150" autocomplete="email" dir="ltr"<?= $verify ? ' required' : '' ?>></label>
          </div>
          <div class="form-row">
            <label><span>الجوال</span><input name="phone" maxlength="30" autocomplete="tel" dir="ltr"></label>
            <label><span>الموضوع</span><input name="subject" maxlength="150"></label>
          </div>
          <label><span>رسالتك *</span><textarea name="message" rows="5" required maxlength="5000"></textarea></label>
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="ts" value="<?= time() ?>">
          <button class="btn btn-primary btn-lg" type="submit"><span><?= $verify ? 'متابعة' : 'إرسال الرسالة' ?></span><?= icon('send') ?></button>
          <?php if ($verify): ?><p class="form-note"><?= icon('shield') ?> بنرسل لك رمز تأكيد على إيميلك قبل إرسال الرسالة.</p><?php endif; ?>
        </div>
        <div class="step step-code" hidden>
          <span class="code-ic"><?= icon('mail') ?></span>
          <h3>تأكيد بريدك الإلكتروني</h3>
          <p class="muted">أرسلنا رمز من 6 أرقام إلى <b dir="ltr" class="code-email"></b>. اكتبه هنا لإكمال إرسال رسالتك.</p>
          <input class="code-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="••••••" aria-label="رمز التأكيد">
          <div class="code-actions">
            <button class="btn btn-primary" type="button" data-act="verify"><?= icon('check') ?><span>تأكيد وإرسال</span></button>
            <button class="btn btn-ghost" type="button" data-act="resend">إعادة إرسال الرمز</button>
            <button class="link-btn" type="button" data-act="back">تعديل الرسالة</button>
          </div>
        </div>
        <div class="step step-done" hidden>
          <span class="code-ic ok"><?= icon('check') ?></span>
          <h3>وصلت رسالتك ✨</h3>
          <p class="muted">شكراً لك، بتواصل معك قريباً.</p>
        </div>
        <p class="form-msg" role="status" aria-live="polite"></p>
      </form>
      <?php endif; ?>
    </div>
  </div>
</section>
    <?php
}

/** Closing call-to-action used on inner pages */
function cta_block(): void
{
    if (!section_on('contact')) {
        return;
    }
    ?>
<section class="section section-tight">
  <div class="container">
    <div class="cta-box reveal">
      <div>
        <h2><?= e(setting('story_cta') ?: 'جاهز نبدأ مشروعك القادم؟') ?></h2>
        <p class="muted"><?= e(setting('contact_subtitle')) ?></p>
      </div>
      <a class="btn btn-primary btn-lg" href="<?= page_url('contact') ?>">تواصل معي<?= icon('arrow-left') ?></a>
    </div>
  </div>
</section>
    <?php
}
