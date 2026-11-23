<?php
$id = (int) ($_GET['id'] ?? 0);
$msg = null;
if ($id) {
    $st = db()->prepare('SELECT * FROM messages WHERE id = ?');
    $st->execute([$id]);
    $msg = $st->fetch();
    if ($msg && !$msg['is_read']) {
        db()->prepare('UPDATE messages SET is_read = 1 WHERE id = ?')->execute([$id]);
    }
}
$list = db()->query("SELECT m.*, (SELECT r.body FROM message_replies r WHERE r.message_id = m.id ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS last_body,
    (SELECT r.direction FROM message_replies r WHERE r.message_id = m.id ORDER BY r.created_at DESC, r.id DESC LIMIT 1) AS last_dir
    FROM messages m ORDER BY COALESCE(m.last_at, m.created_at) DESC, m.id DESC LIMIT 300")->fetchAll();
$replies = [];
if ($msg) {
    $st = db()->prepare('SELECT * FROM message_replies WHERE message_id = ? ORDER BY created_at, id');
    $st->execute([$msg['id']]);
    $replies = $st->fetchAll();
}
$canMail = smtp_configured();
$syncOn = mail_sync_enabled();
$syncErr = (string) setting('_mail_sync_err');
$syncOk = (int) setting('_mail_sync_ok');
?>
<div class="page-head">
  <p class="muted">رسائل نموذج «تواصل معي»<?= $syncOn ? ' + إيميلات العملاء وردودك من الإيميل' : '' ?></p>
  <div class="page-actions">
    <?php if ($syncOn): ?>
      <span class="sync-status <?= $syncErr ? 'err' : '' ?>" id="syncStatus" data-sync="<?= e(admin_url('?p=messages')) ?>" data-csrf="<?= e(csrf_token()) ?>">
        <?= icon('refresh') ?><span><?= $syncErr ? 'تعذّرت المزامنة' : ($syncOk ? 'متزامن مع الإيميل — ' . e(time_ago(date('Y-m-d H:i:s', $syncOk))) : 'جاري المزامنة مع الإيميل…') ?></span>
      </span>
      <button class="btn btn-ghost" type="button" id="syncNow"><?= icon('refresh') ?>مزامنة الآن</button>
    <?php endif; ?>
  <?php if ($list): ?>
    <div class="search"><?= icon('search') ?><input type="search" placeholder="بحث في الرسائل…" data-list-search="#msgList"></div>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="_do" value="read_all"><button class="btn btn-ghost"><?= icon('check') ?>تعليم الكل كمقروء</button></form>
  <?php endif; ?>
  </div>
</div>
<?php if ($syncOn && $syncErr): ?>
  <div class="alert alert-warn">ما قدرنا نجيب الإيميلات: <?= e($syncErr) ?> — تأكد من <a href="<?= admin_url('?p=settings&g=mail') ?>">إعدادات البريد</a>.</div>
<?php endif; ?>

<?php if (!$list): ?>
  <div class="card empty">
    <span class="empty-ic"><?= icon('inbox') ?></span>
    <h3>صندوق الرسائل فاضي</h3>
    <p class="muted">أول ما أحد يرسلك من الموقع، رسالته بتظهر هنا<?= setting('notify_email') === '1' || setting('notify_email') === 1 ? ' وبيوصلك إيميل' : '' ?>.</p>
  </div>
<?php else: ?>
<div class="inbox <?= $msg ? 'has-open' : '' ?>">
  <div class="card inbox-list" id="msgList">
    <?php foreach ($list as $m): ?>
      <a class="inbox-item <?= $m['is_read'] || ($msg && $msg['id'] == $m['id']) ? '' : 'unread' ?> <?= $msg && $msg['id'] == $m['id'] ? 'active' : '' ?>" href="<?= admin_url('?p=messages&id=' . $m['id']) ?>">
        <span class="avatar-sm"><?= e(mb_substr($m['name'], 0, 1)) ?></span>
        <span class="inbox-body">
          <span class="inbox-top"><strong><?= e($m['name']) ?></strong><time><?= e(time_ago($m['last_at'] ?: $m['created_at'])) ?></time></span>
          <?php if ($m['subject']): ?><span class="inbox-subj"><?= e($m['subject']) ?></span><?php endif; ?>
          <small><?= $m['last_body'] !== null ? ($m['last_dir'] === 'out' ? '<b class="you">أنت:</b> ' : '') . e(excerpt($m['last_body'], 80)) : e(excerpt($m['message'], 80)) ?></small>
        </span>
      </a>
    <?php endforeach; ?>
  </div>
  <div class="card inbox-view">
    <?php if (!$msg): ?>
      <div class="empty"><span class="empty-ic"><?= icon('mail') ?></span><p class="muted">اختر رسالة لعرضها</p></div>
    <?php else: ?>
      <a class="back only-mobile" href="<?= admin_url('?p=messages') ?>"><?= icon('arrow-right') ?> الرسائل</a>
      <div class="msg-head">
        <span class="avatar-lg"><?= e(mb_substr($msg['name'], 0, 1)) ?></span>
        <div>
          <h2><?= e($msg['name']) ?></h2>
          <p class="muted"><?= e(ar_date($msg['created_at'])) ?> — <?= e(date('H:i', strtotime($msg['created_at']))) ?></p>
        </div>
      </div>
      <dl class="msg-meta">
        <?php if ($msg['email']): ?><div><dt>البريد</dt><dd class="ltr"><a href="mailto:<?= e($msg['email']) ?>"><?= e($msg['email']) ?></a></dd></div><?php endif; ?>
        <?php if ($msg['phone']): ?><div><dt>الجوال</dt><dd class="ltr"><a href="tel:<?= e($msg['phone']) ?>"><?= e($msg['phone']) ?></a></dd></div><?php endif; ?>
        <?php if ($msg['subject']): ?><div><dt>الموضوع</dt><dd><?= e($msg['subject']) ?></dd></div><?php endif; ?>
      </dl>
      <div class="msg-text"><?php if (($msg['source'] ?? 'site') === 'email'): ?><span class="via">عبر الإيميل</span><?php endif; ?><?= nl2br(e($msg['message'])) ?></div>
      <?php foreach ($replies as $r): $in = ($r['direction'] ?? 'out') === 'in'; $viaMail = ($r['source'] ?? 'site') === 'email'; ?>
        <?php if ($in): ?>
          <div class="msg-text msg-in"><span class="reply-meta"><?= icon('mail') ?><?= e($msg['name']) ?> — <?= e(time_ago($r['created_at'])) ?><span class="via">عبر الإيميل</span></span><?= nl2br(e($r['body'])) ?></div>
        <?php else: ?>
          <div class="msg-reply"><span class="reply-meta"><?= icon('reply') ?>ردّك — <?= e(time_ago($r['created_at'])) ?><span class="via"><?= $viaMail ? 'من الإيميل' : 'من الموقع' ?></span></span><?= nl2br(e($r['body'])) ?></div>
        <?php endif; ?>
      <?php endforeach; ?>
      <?php if ($msg['email']): ?>
        <?php if ($canMail): ?>
          <form method="post" class="reply-form" data-dirty-check>
            <?= csrf_field() ?><input type="hidden" name="_do" value="reply"><input type="hidden" name="id" value="<?= $msg['id'] ?>">
            <label class="field-label" for="replyBody">ردّك (يوصل لـ <span class="ltr"><?= e($msg['email']) ?></span>)</label>
            <textarea id="replyBody" name="body" rows="5" required placeholder="اكتب ردك هنا…"></textarea>
            <button class="btn btn-primary" type="submit"><?= icon('send') ?>إرسال الرد</button>
          </form>
        <?php else: ?>
          <div class="alert alert-warn">عشان ترد من هنا مباشرة، كمّل <a href="<?= admin_url('?p=settings&g=mail') ?>">إعدادات البريد</a> مرة وحدة.</div>
        <?php endif; ?>
      <?php endif; ?>
      <div class="msg-actions">
        <?php if ($msg['phone'] && ($n = preg_replace('/\D/', '', $msg['phone']))): ?><a class="btn btn-ghost" href="https://wa.me/<?= e($n) ?>" target="_blank" rel="noopener"><?= icon('whatsapp') ?>واتساب</a><?php endif; ?>
        <form method="post" class="inline"><?= csrf_field() ?><input type="hidden" name="_do" value="unread"><input type="hidden" name="id" value="<?= $msg['id'] ?>"><button class="btn btn-ghost"><?= icon('eye-off') ?>غير مقروءة</button></form>
        <form method="post" class="inline" data-confirm="حذف الرسالة؟"><?= csrf_field() ?><input type="hidden" name="_do" value="delete"><input type="hidden" name="id" value="<?= $msg['id'] ?>"><button class="btn btn-danger-ghost"><?= icon('trash') ?>حذف</button></form>
      </div>
    <?php endif; ?>
  </div>
</div>
<?php endif; ?>
