<?php
current_page('404');
site_head('الصفحة غير موجودة');
?>
<section class="section page-top not-found">
  <div class="container narrow center-text">
    <span class="nf-code" data-anim dir="ltr">404</span>
    <h1 data-anim style="--d:1">الصفحة غير موجودة</h1>
    <p class="lead" data-anim style="--d:2">الرابط اللي فتحته غير صحيح أو انحذف.</p>
    <div class="hero-cta" data-anim style="--d:3"><a class="btn btn-primary" href="<?= url() ?>">الصفحة الرئيسية<?= icon('arrow-left') ?></a></div>
  </div>
</section>
<?php site_foot();
