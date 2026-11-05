<?php $u = current_user(); ?>
<div class="narrow-col">
  <form method="post" class="card form-card" autocomplete="off">
    <?= csrf_field() ?>
    <input type="hidden" name="_do" value="save">
    <div class="card-head"><h3><?= icon('user-cog') ?> بيانات الدخول</h3></div>
    <div class="fields single">
      <div class="field"><label class="field-label">اسم المستخدم</label><input name="username" value="<?= e($u['username']) ?>" dir="ltr" required autocomplete="username"></div>
      <div class="field"><label class="field-label">كلمة المرور الجديدة</label><input name="new" type="password" dir="ltr" autocomplete="new-password"><small class="hint">اتركها فاضية إذا ما تبغى تغيّرها — 8 أحرف على الأقل</small></div>
      <div class="field"><label class="field-label">تأكيد كلمة المرور الجديدة</label><input name="confirm" type="password" dir="ltr" autocomplete="new-password"></div>
      <div class="field"><label class="field-label">كلمة المرور الحالية <b class="req">*</b></label><input name="current" type="password" dir="ltr" required autocomplete="current-password"><small class="hint">مطلوبة لتأكيد أي تغيير</small></div>
    </div>
    <div class="form-foot"><button class="btn btn-primary"><?= icon('check') ?>حفظ</button></div>
  </form>

  <div class="card info-card">
    <h3><?= icon('lock') ?> نصائح أمان</h3>
    <ul>
      <li>استخدم كلمة مرور طويلة وما تستخدمها في مكان ثاني.</li>
      <li>فعّل شهادة SSL المجانية من Hostinger عشان يصير الموقع <span class="ltr">https</span>.</li>
      <li>خذ نسخة احتياطية من مجلد <code>data</code> و<code>uploads</code> كل فترة.</li>
    </ul>
  </div>
</div>
