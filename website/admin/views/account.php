<?php
$u = current_user();
$link = (is_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '') . admin_url();
?>
<div class="narrow-col">
  <div class="card secret-card">
    <div class="card-head"><h3><?= icon('key') ?> رابط لوحة التحكم السري</h3></div>
    <p class="muted">هذا الرابط الوحيد اللي يفتح لوحة التحكم. أي رابط ثاني (مثل <span class="ltr">/admin</span> أو <span class="ltr">/dashboard</span>) يطلع «الصفحة غير موجودة». احفظه في مكان آمن.</p>
    <div class="copy-line"><code class="ltr" id="adminLink"><?= e($link) ?></code><button class="btn btn-sm btn-ghost" type="button" data-copy-target="#adminLink"><?= icon('copy') ?><span>نسخ</span></button></div>
  </div>

  <form method="post" class="card form-card" autocomplete="off">
    <?= csrf_field() ?>
    <input type="hidden" name="_do" value="save">
    <div class="card-head"><h3><?= icon('user-cog') ?> بيانات الدخول</h3></div>
    <div class="fields single">
      <div class="field"><label class="field-label" for="a_user">اسم المستخدم</label><input id="a_user" name="username" value="<?= e($u['username']) ?>" dir="ltr" required autocomplete="username"></div>
      <div class="field"><label class="field-label" for="a_new">كلمة المرور الجديدة</label><input id="a_new" name="new" type="password" dir="ltr" autocomplete="new-password"><small class="hint">اتركها فاضية إذا ما تبغى تغيّرها — 8 أحرف على الأقل</small></div>
      <div class="field"><label class="field-label" for="a_conf">تأكيد كلمة المرور الجديدة</label><input id="a_conf" name="confirm" type="password" dir="ltr" autocomplete="new-password"></div>
    </div>

    <div class="card-head sub"><h3><?= icon('shield') ?> الأمان</h3></div>
    <div class="fields single">
      <div class="field"><label class="field-label" for="a_slug">الرابط السري</label>
        <div class="slug-input"><span class="ltr muted"><?= e(($_SERVER['HTTP_HOST'] ?? '') . BASE) ?></span><input id="a_slug" name="admin_slug" value="<?= e(admin_slug()) ?>" dir="ltr" required pattern="[a-z0-9][a-z0-9\-]{5,39}"></div>
        <small class="hint">حروف إنجليزية صغيرة وأرقام و - فقط. لو غيّرته، الرابط القديم يتوقف فوراً.</small>
      </div>
      <div class="field"><label class="field-label" for="a_mail">إيميلك (لرموز الدخول)</label><input id="a_mail" name="admin_email" type="email" value="<?= e(setting('admin_email')) ?>" dir="ltr" placeholder="you@example.com"></div>
      <div class="field">
        <label class="switch"><input type="checkbox" name="login_2fa" value="1" <?= (string) setting('login_2fa') === '1' ? 'checked' : '' ?>><span class="switch-ui"></span><span class="switch-label">التحقق بخطوتين: رمز على إيميلك مع كل تسجيل دخول</span></label>
        <small class="hint">يحتاج إعدادات البريد تكون مكتملة. حتى لو أحد عرف كلمة مرورك، ما يقدر يدخل بدون الرمز.</small>
      </div>
    </div>

    <div class="fields single confirm-pass">
      <div class="field"><label class="field-label" for="a_cur">كلمة المرور الحالية <b class="req">*</b></label><input id="a_cur" name="current" type="password" dir="ltr" required autocomplete="current-password"><small class="hint">مطلوبة لتأكيد أي تغيير</small></div>
    </div>
    <div class="form-foot"><button class="btn btn-primary"><?= icon('check') ?>حفظ</button></div>
  </form>

  <div class="card info-card">
    <h3><?= icon('lock') ?> الحماية المفعّلة</h3>
    <ul>
      <li>لوحة التحكم ما تفتح إلا من رابطك السري.</li>
      <li>بعد 6 محاولات دخول خاطئة يتوقف الدخول 15 دقيقة.</li>
      <li>كلمة المرور محفوظة مشفّرة، وكل نموذج محمي من الطلبات المزوّرة.</li>
      <li>فعّل SSL من Hostinger، وخذ نسخة احتياطية من <code>data</code> و<code>uploads</code> كل فترة.</li>
    </ul>
  </div>
</div>
