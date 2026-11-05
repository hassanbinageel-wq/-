<?php
/* Loaded by index.php (the router) */

current_page('about');
$s = settings_all();
$steps = items('timeline');
site_head($s['story_title'], $s['story_intro']);
$first = $steps ? $steps[0]['year'] : '';
$last = $steps ? end($steps)['year'] : '';
?>
<section class="section page-top story">
  <div class="container narrow">
    <a class="back-link" href="<?= page_url('about') ?>"><?= icon('arrow-right') ?> نبذة عني</a>
    <header class="story-head">
      <span class="eyebrow" data-anim><?= e($s['story_eyebrow']) ?></span>
      <h1 data-anim style="--d:1"><?= e($s['story_title']) ?></h1>
      <?php if ($s['story_intro']): ?><p class="lead" data-anim style="--d:2"><?= e($s['story_intro']) ?></p><?php endif; ?>
      <?php if ($first && $last && $first !== $last): ?>
        <div class="story-span" data-anim style="--d:3"><span dir="ltr"><?= e($first) ?></span><i></i><span><?= count($steps) ?> مراحل</span><i></i><span dir="ltr"><?= e($last) ?></span></div>
      <?php endif; ?>
    </header>

    <?php if ($steps): ?>
      <ol class="timeline" id="timeline">
        <li class="tl-track" aria-hidden="true"><span class="tl-progress"></span></li>
        <?php foreach ($steps as $i => $st):
            $isLast = $i === count($steps) - 1; ?>
          <li class="tl-item reveal<?= $st['highlight'] ? ' is-highlight' : '' ?>">
            <div class="tl-marker">
              <span class="tl-year" dir="ltr"><?= e($st['year']) ?></span>
            </div>
            <article class="tl-card">
              <div class="tl-card-head">
                <?php if ($st['icon']): ?><span class="tl-icon"><?= icon($st['icon']) ?></span><?php endif; ?>
                <div>
                  <span class="tl-step">المرحلة <?= str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) ?><?= $isLast ? ' · الآن' : '' ?></span>
                  <h2><?= e($st['title']) ?></h2>
                </div>
              </div>
              <?php if ($st['description']): ?><p><?= e($st['description']) ?></p><?php endif; ?>
              <?php if ($st['image']): ?><img class="tl-img" src="<?= e(media($st['image'])) ?>" alt="" loading="lazy"><?php endif; ?>
            </article>
          </li>
        <?php endforeach; ?>
      </ol>
    <?php else: ?>
      <p class="muted center">ما فيه مراحل للحين.</p>
    <?php endif; ?>

    <div class="story-cta reveal">
      <h3><?= e($s['story_cta']) ?></h3>
      <div class="hero-cta">
        <?php if (section_on('contact')): ?><a class="btn btn-primary" href="<?= page_url('contact') ?>">تواصل معي<?= icon('arrow-left') ?></a><?php endif; ?>
        <?php if (section_on('works')): ?><a class="btn btn-ghost" href="<?= page_url('works') ?>">شاهد أعمالي</a><?php endif; ?>
      </div>
    </div>
  </div>
</section>
<?php site_foot();
