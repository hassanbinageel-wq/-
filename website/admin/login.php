<?php
/*
 * Dashboard sign-in (loaded by the router from the secret address).
 * First run (/setup): create the admin account.  Optional two-step sign-in: a code sent by email.
 */
require_once __DIR__ . '/../includes/bootstrap.php';
start_session();

if (is_logged_in()) {
    redirect(admin_url());
}

$pdo = db();
$hasUser = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
$error = '';
$notice = '';
$ip = ip_hash();

function finish_login(int $uid): void
{
    session_regenerate_id(true);
    unset($_SESSION['pending_2fa']);
    $_SESSION['uid'] = $uid;
    $_SESSION['last'] = time();
    redirect(admin_url());
}

function twofa_enabled(): bool
{
    return (string) setting('login_2fa') === '1' && setting('admin_email') !== '' && smtp_configured()
        && !file_exists(DATA_DIR . '/disable-2fa');
}

function send_login_code(int $uid): bool
{
    $code = (string) random_int(100000, 999999);
    $_SESSION['pending_2fa'] = ['uid' => $uid, 'hash' => hash_hmac('sha256', $code, app_secret()), 'exp' => time() + 600, 'tries' => 0, 'sent' => time()];
    $html = '<p>رمز الدخول للوحة التحكم:</p><p style="font-size:30px;font-weight:bold;letter-spacing:8px;direction:ltr;text-align:center;margin:18px 0">' . $code . '</p>'
        . '<p style="color:#64748b">صالح لمدة 10 دقائق. إذا ما حاولت تسجّل دخول، غيّر كلمة مرورك فوراً.</p>';
    [$ok] = send_mail((string) setting('admin_email'), 'رمز الدخول: ' . $code, mail_layout('تسجيل دخول للوحة التحكم', $html));
    return $ok;
}

$pending = $_SESSION['pending_2fa'] ?? null;
if ($pending && $pending['exp'] < time()) {
    unset($_SESSION['pending_2fa']);
    $pending = null;
    $error = 'انتهت صلاحية الرمز، سجّل دخولك مرة ثانية.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $pdo->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - 900]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ?');
    $st->execute([$ip]);
    $blocked = (int) $st->fetchColumn() >= 6;
    $act = (string) ($_POST['act'] ?? 'login');

    if ($blocked) {
        $error = 'محاولات كثيرة. انتظر 15 دقيقة ثم حاول مرة ثانية.';
    } elseif ($act === 'cancel') {
        unset($_SESSION['pending_2fa']);
        $pending = null;
    } elseif ($pending && $act === 'resend') {
        if (time() - $pending['sent'] < 60) {
            $error = 'انتظر دقيقة قبل طلب رمز جديد.';
        } else {
            $notice = send_login_code($pending['uid']) ? 'أرسلنا رمز جديد لإيميلك.' : '';
            $error = $notice ? '' : 'تعذّر إرسال الرمز.';
            $pending = $_SESSION['pending_2fa'];
        }
    } elseif ($pending && $act === 'code') {
        $code = preg_replace('/\D/', '', (string) ($_POST['code'] ?? ''));
        if (hash_equals($pending['hash'], hash_hmac('sha256', $code, app_secret()))) {
            $pdo->prepare('DELETE FROM login_attempts WHERE ip = ?')->execute([$ip]);
            finish_login((int) $pending['uid']);
        }
        $pdo->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([$ip, time()]);
        $_SESSION['pending_2fa']['tries']++;
        if ($_SESSION['pending_2fa']['tries'] >= 5) {
            unset($_SESSION['pending_2fa']);
            $pending = null;
            $error = 'محاولات كثيرة، سجّل دخولك مرة ثانية.';
        } else {
            $error = 'الرمز غير صحيح.';
        }
    } elseif (!$hasUser) {
        // First run: create the admin account
        $username = trim((string) ($_POST['username'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if (!preg_match('/^[\w.\-@]{3,40}$/u', $username)) {
            $error = 'اسم المستخدم لازم يكون 3 أحرف أو أكثر (حروف إنجليزية/أرقام).';
        } elseif (mb_strlen($password) < 8) {
            $error = 'كلمة المرور لازم تكون 8 أحرف على الأقل.';
        } elseif ($password !== (string) ($_POST['password_confirm'] ?? '')) {
            $error = 'كلمتا المرور غير متطابقتين.';
        } else {
            $pdo->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
                ->execute([$username, password_hash($password, PASSWORD_DEFAULT), date('Y-m-d H:i:s')]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) $pdo->lastInsertId();
            $_SESSION['last'] = time();
            flash('تم إنشاء حسابك ✨ احفظ رابط لوحة التحكم السري الظاهر هنا — هو الطريقة الوحيدة للدخول.');
            redirect(admin_url('?p=account'));
        }
    } else {
        $username = trim((string) ($_POST['username'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $st = $pdo->prepare('SELECT * FROM users WHERE username = ?');
        $st->execute([$username]);
        $u = $st->fetch();
        if ($u && password_verify($password, $u['password_hash'])) {
            if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
                $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
            }
            if (!twofa_enabled()) {
                $pdo->prepare('DELETE FROM login_attempts WHERE ip = ?')->execute([$ip]);
                finish_login((int) $u['id']);
            }
            if (send_login_code((int) $u['id'])) {
                $pending = $_SESSION['pending_2fa'];
            } else {
                unset($_SESSION['pending_2fa']);
                $error = 'تعذّر إرسال رمز الدخول لإيميلك. تأكد من إعدادات البريد (راجع ملف README لطريقة الإيقاف المؤقت).';
            }
        } else {
            $pdo->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([$ip, time()]);
            usleep(400000);
            $error = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
        }
    }
}
$site = setting('site_name');
$mode = !$hasUser ? 'setup' : ($pending ? 'code' : 'login');
$titles = ['setup' => 'إنشاء حساب المدير', 'login' => 'لوحة التحكم', 'code' => 'رمز التحقق'];
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($titles[$mode]) ?> — <?= e($site) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('admin/assets/admin.css') ?>">
</head>
<body class="auth-body">
  <div class="auth-glow"></div>
  <form class="auth-card" method="post" action="<?= e($mode === 'setup' ? url('setup') : admin_url('login')) ?>" autocomplete="on">
    <?= csrf_field() ?>
    <div class="auth-logo"><?= icon($mode === 'code' ? 'mail' : 'lock') ?></div>
    <h1><?= e($titles[$mode]) ?></h1>
    <p class="muted"><?php
      if ($mode === 'setup') echo 'هذي أول مرة — أنشئ اسم مستخدم وكلمة مرور قوية. بعدها بيظهر لك رابط لوحة التحكم السري.';
      elseif ($mode === 'code') echo 'أرسلنا رمز من 6 أرقام لإيميلك. اكتبه هنا لإكمال الدخول.';
      else echo 'سجّل دخولك لإدارة موقعك';
    ?></p>
    <?php if ($error): ?><div class="alert alert-err"><?= e($error) ?></div><?php endif; ?>
    <?php if ($notice): ?><div class="alert alert-ok"><?= e($notice) ?></div><?php endif; ?>

    <?php if ($mode === 'code'): ?>
      <input type="hidden" name="act" value="code">
      <input class="code-box" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="••••••" autofocus required aria-label="رمز التحقق">
      <button class="btn btn-primary btn-block" type="submit">تأكيد الدخول</button>
      <div class="auth-links">
        <button class="link-btn" type="submit" name="act" value="resend" formnovalidate>إعادة إرسال الرمز</button>
        <button class="link-btn" type="submit" name="act" value="cancel" formnovalidate>رجوع</button>
      </div>
    <?php else: ?>
      <label class="field"><span>اسم المستخدم</span><input name="username" required autofocus dir="ltr" autocomplete="username" value="<?= e($_POST['username'] ?? '') ?>"></label>
      <label class="field"><span>كلمة المرور</span><input name="password" type="password" required dir="ltr" autocomplete="<?= $mode === 'login' ? 'current-password' : 'new-password' ?>"></label>
      <?php if ($mode === 'setup'): ?>
        <label class="field"><span>تأكيد كلمة المرور</span><input name="password_confirm" type="password" required dir="ltr" autocomplete="new-password"></label>
      <?php endif; ?>
      <button class="btn btn-primary btn-block" type="submit"><?= $mode === 'login' ? 'دخول' : 'إنشاء الحساب والدخول' ?></button>
    <?php endif; ?>
    <a class="auth-back" href="<?= url() ?>"><?= icon('arrow-right') ?> رجوع للموقع</a>
  </form>
</body>
</html>
