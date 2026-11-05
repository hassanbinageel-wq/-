<?php
define('IN_ADMIN', true);
require __DIR__ . '/../includes/bootstrap.php';
start_session();

if (is_logged_in()) {
    redirect(url('admin/'));
}

$hasUser = (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $ip = ip_hash();
    $pdo = db();
    $pdo->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - 900]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ?');
    $st->execute([$ip]);
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if ((int) $st->fetchColumn() >= 6) {
        $error = 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة ثانية.';
    } elseif (!$hasUser) {
        // First run: create the admin account
        $confirm = (string) ($_POST['password_confirm'] ?? '');
        if (!preg_match('/^[\w.\-@]{3,40}$/u', $username)) {
            $error = 'اسم المستخدم لازم يكون 3 أحرف أو أكثر (حروف إنجليزية/أرقام).';
        } elseif (mb_strlen($password) < 8) {
            $error = 'كلمة المرور لازم تكون 8 أحرف على الأقل.';
        } elseif ($password !== $confirm) {
            $error = 'كلمتا المرور غير متطابقتين.';
        } else {
            $pdo->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
                ->execute([$username, password_hash($password, PASSWORD_DEFAULT), date('Y-m-d H:i:s')]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) $pdo->lastInsertId();
            $_SESSION['last'] = time();
            flash('أهلاً بك! تم إنشاء حسابك. ابدأ بتعديل الإعدادات ✨');
            redirect(url('admin/?p=settings'));
        }
    } else {
        $st = $pdo->prepare('SELECT * FROM users WHERE username = ?');
        $st->execute([$username]);
        $u = $st->fetch();
        if ($u && password_verify($password, $u['password_hash'])) {
            if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
                $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
            }
            $pdo->prepare('DELETE FROM login_attempts WHERE ip = ?')->execute([$ip]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) $u['id'];
            $_SESSION['last'] = time();
            redirect(url('admin/'));
        }
        $pdo->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([$ip, time()]);
        usleep(400000);
        $error = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    }
}
$site = setting('site_name');
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= $hasUser ? 'تسجيل الدخول' : 'إنشاء حساب المدير' ?> — <?= e($site) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('admin/assets/admin.css') ?>">
</head>
<body class="auth-body">
  <div class="auth-glow"></div>
  <form class="auth-card" method="post" autocomplete="on">
    <?= csrf_field() ?>
    <div class="auth-logo"><?= icon('lock') ?></div>
    <h1><?= $hasUser ? 'لوحة التحكم' : 'إنشاء حساب المدير' ?></h1>
    <p class="muted"><?= $hasUser ? 'سجّل دخولك لإدارة موقعك' : 'هذي أول مرة — أنشئ اسم مستخدم وكلمة مرور قوية للوحة التحكم' ?></p>
    <?php if ($error): ?><div class="alert alert-err"><?= e($error) ?></div><?php endif; ?>
    <label class="field"><span>اسم المستخدم</span><input name="username" required autofocus dir="ltr" autocomplete="username" value="<?= e($_POST['username'] ?? '') ?>"></label>
    <label class="field"><span>كلمة المرور</span><input name="password" type="password" required dir="ltr" autocomplete="<?= $hasUser ? 'current-password' : 'new-password' ?>"></label>
    <?php if (!$hasUser): ?>
      <label class="field"><span>تأكيد كلمة المرور</span><input name="password_confirm" type="password" required dir="ltr" autocomplete="new-password"></label>
    <?php endif; ?>
    <button class="btn btn-primary btn-block" type="submit"><?= $hasUser ? 'دخول' : 'إنشاء الحساب والدخول' ?></button>
    <a class="auth-back" href="<?= url() ?>"><?= icon('arrow-right') ?> رجوع للموقع</a>
  </form>
</body>
</html>
