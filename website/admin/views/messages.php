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
$list = db()->query('SELECT * FROM messages ORDER BY id DESC LIMIT 300')->fetchAll();
?>
<div class="page-head">
  <p class="muted">الرسائل اللي توصلك من نموذج «تواصل معي» في الموقع</p>
  <?php if ($list): ?>
  <div class="page-actions">
    <div class="search"><?= icon('search') ?><input type="search" placeholder="بحث في الرسائل…" data-list-search="#msgList"></div>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="_do" value="read_all"><button class="btn btn-ghost"><?= icon('check') ?>تعليم الكل كمقروء</button></form>
  </div>
  <?php endif; ?>
</div>

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
      <a class="inbox-item <?= $m['is_read'] || ($msg && $msg['id'] == $m['id']) ? '' : 'unread' ?> <?= $msg && $msg['id'] == $m['id'] ? 'active' : '' ?>" href="<?= url('admin/?p=messages&id=' . $m['id']) ?>">
        <span class="avatar-sm"><?= e(mb_substr($m['name'], 0, 1)) ?></span>
        <span class="inbox-body">
          <span class="inbox-top"><strong><?= e($m['name']) ?></strong><time><?= e(time_ago($m['created_at'])) ?></time></span>
          <?php if ($m['subject']): ?><span class="inbox-subj"><?= e($m['subject']) ?></span><?php endif; ?>
          <small><?= e(excerpt($m['message'], 80)) ?></small>
        </span>
      </a>
    <?php endforeach; ?>
  </div>
  <div class="card inbox-view">
    <?php if (!$msg): ?>
      <div class="empty"><span class="empty-ic"><?= icon('mail') ?></span><p class="muted">اختر رسالة لعرضها</p></div>
    <?php else: ?>
      <a class="back only-mobile" href="<?= url('admin/?p=messages') ?>"><?= icon('arrow-right') ?> الرسائل</a>
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
      <div class="msg-text"><?= nl2br(e($msg['message'])) ?></div>
      <div class="msg-actions">
        <?php if ($msg['email']): ?><a class="btn btn-primary" href="mailto:<?= e($msg['email']) ?>?subject=<?= rawurlencode('رد: ' . ($msg['subject'] ?: 'رسالتك')) ?>"><?= icon('mail') ?>رد بالإيميل</a><?php endif; ?>
        <?php if ($msg['phone'] && ($n = preg_replace('/\D/', '', $msg['phone']))): ?><a class="btn btn-ghost" href="https://wa.me/<?= e($n) ?>" target="_blank" rel="noopener"><?= icon('whatsapp') ?>واتساب</a><?php endif; ?>
        <form method="post" class="inline"><?= csrf_field() ?><input type="hidden" name="_do" value="unread"><input type="hidden" name="id" value="<?= $msg['id'] ?>"><button class="btn btn-ghost"><?= icon('eye-off') ?>غير مقروءة</button></form>
        <form method="post" class="inline" data-confirm="حذف الرسالة؟"><?= csrf_field() ?><input type="hidden" name="_do" value="delete"><input type="hidden" name="id" value="<?= $msg['id'] ?>"><button class="btn btn-danger-ghost"><?= icon('trash') ?>حذف</button></form>
      </div>
    <?php endif; ?>
  </div>
</div>
<?php endif; ?>
