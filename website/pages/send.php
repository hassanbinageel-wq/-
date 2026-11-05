<?php
/*
 * Contact form endpoint (POST /send), loaded by the router.
 * With verification on: step "start" emails a 6-digit code, step "verify" checks it and saves the message.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(bool $ok, string $msg, array $extra = [], int $code = 200): void
{
    http_response_code($ok ? 200 : $code);
    echo json_encode(['ok' => $ok, 'message' => $msg] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !section_on('contact') || !on('show_form')) {
    reply(false, 'غير متاح', [], 405);
}

$pdo = db();
$ip = ip_hash();
$now = time();
$verify = (string) setting('verify_contact') === '1' && smtp_configured();
$step = (string) ($_POST['step'] ?? 'start');
$pdo->prepare('DELETE FROM pending_messages WHERE expires_at < ?')->execute([$now - 3600]);

function mask_email(string $email): string
{
    [$u, $d] = explode('@', $email) + ['', ''];
    return mb_substr($u, 0, 2) . str_repeat('•', max(1, min(6, mb_strlen($u) - 2))) . '@' . $d;
}

function send_code(array $p, string $code): array
{
    $html = '<p>مرحباً ' . e($p['name']) . '،</p><p>رمز تأكيد رسالتك:</p>'
        . '<p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:18px 0;direction:ltr;text-align:center">' . $code . '</p>'
        . '<p style="color:#64748b">الرمز صالح لمدة 15 دقيقة. إذا ما أرسلت رسالة من موقعنا تجاهل هذا الإيميل.</p>';
    return send_mail($p['email'], 'رمز التأكيد: ' . $code, mail_layout('تأكيد بريدك الإلكتروني', $html));
}

function save_message(array $m, string $ip): void
{
    db()->prepare('INSERT INTO messages (name, email, phone, subject, message, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$m['name'], $m['email'], $m['phone'], $m['subject'], $m['message'], $ip, date('Y-m-d H:i:s')]);
    $to = setting('contact_email');
    if ((string) setting('notify_email') === '1' && $to) {
        $rows = '';
        foreach (['الاسم' => $m['name'], 'البريد' => $m['email'], 'الجوال' => $m['phone'], 'الموضوع' => $m['subject']] as $k => $v) {
            if ($v !== '') $rows .= '<p style="margin:4px 0"><b>' . $k . ':</b> ' . e($v) . '</p>';
        }
        $html = $rows . '<div style="margin-top:14px;padding:14px;background:#f4f6fb;border-radius:10px">' . nl2br(e($m['message'])) . '</div>'
            . '<p style="color:#64748b;font-size:13px">ترد عليه من لوحة التحكم ← التواصل.</p>';
        send_mail($to, 'رسالة جديدة: ' . ($m['subject'] ?: $m['name']), mail_layout('رسالة جديدة من موقعك', $html), $m['email'] ?: null);
    }
}

/* ---------- Step 2: check the code ---------- */
if ($step === 'verify' || $step === 'resend') {
    $token = (string) ($_POST['token'] ?? '');
    $st = $pdo->prepare('SELECT * FROM pending_messages WHERE token = ?');
    $st->execute([$token]);
    $p = $st->fetch();
    if (!$p || $p['expires_at'] < $now) {
        reply(false, 'انتهت صلاحية الرمز، أرسل الرسالة مرة ثانية.', ['restart' => true], 410);
    }
    if ($step === 'resend') {
        if ($now - (int) $p['sent_at'] < 60) {
            reply(false, 'انتظر دقيقة قبل طلب رمز جديد.', [], 429);
        }
        $code = (string) random_int(100000, 999999);
        [$ok, $err] = send_code($p, $code);
        if (!$ok) reply(false, 'تعذّر إرسال الرمز، حاول بعد شوي.', [], 502);
        $pdo->prepare('UPDATE pending_messages SET code_hash = ?, attempts = 0, sent_at = ?, expires_at = ? WHERE id = ?')
            ->execute([hash_hmac('sha256', $code, app_secret()), $now, $now + 900, $p['id']]);
        reply(true, 'أرسلنا رمز جديد إلى إيميلك.');
    }
    if ((int) $p['attempts'] >= 5) {
        reply(false, 'محاولات كثيرة، أرسل الرسالة مرة ثانية.', ['restart' => true], 429);
    }
    $code = preg_replace('/\D/', '', (string) ($_POST['code'] ?? ''));
    if (!hash_equals($p['code_hash'], hash_hmac('sha256', $code, app_secret()))) {
        $pdo->prepare('UPDATE pending_messages SET attempts = attempts + 1 WHERE id = ?')->execute([$p['id']]);
        reply(false, 'الرمز غير صحيح، تأكد منه وحاول مرة ثانية.', [], 422);
    }
    $pdo->prepare('DELETE FROM pending_messages WHERE id = ?')->execute([$p['id']]);
    save_message($p, $ip);
    reply(true, 'وصلت رسالتك، شكراً لك ✨', ['done' => true]);
}

/* ---------- Step 1: validate and send the code ---------- */
if (!empty($_POST['website']) || ($now - (int) ($_POST['ts'] ?? 0)) < 3) {
    reply(true, 'وصلت رسالتك، شكراً لك ✨', ['done' => true]); // bot: pretend success
}

$m = [
    'name'    => trim(mb_substr((string) ($_POST['name'] ?? ''), 0, 100)),
    'email'   => trim(mb_substr((string) ($_POST['email'] ?? ''), 0, 150)),
    'phone'   => trim(mb_substr((string) ($_POST['phone'] ?? ''), 0, 30)),
    'subject' => trim(mb_substr((string) ($_POST['subject'] ?? ''), 0, 150)),
    'message' => trim(mb_substr((string) ($_POST['message'] ?? ''), 0, 5000)),
];
if ($m['name'] === '' || $m['message'] === '') {
    reply(false, 'فضلاً اكتب اسمك ورسالتك.', [], 422);
}
if ($verify && $m['email'] === '') {
    reply(false, 'فضلاً اكتب بريدك الإلكتروني عشان نرسل لك رمز التأكيد.', [], 422);
}
if ($m['email'] !== '' && !filter_var($m['email'], FILTER_VALIDATE_EMAIL)) {
    reply(false, 'البريد الإلكتروني غير صحيح.', [], 422);
}

$st = $pdo->prepare('SELECT (SELECT COUNT(*) FROM messages WHERE ip_hash = ? AND created_at > ?) + (SELECT COUNT(*) FROM pending_messages WHERE ip_hash = ? AND sent_at > ?)');
$st->execute([$ip, date('Y-m-d H:i:s', $now - 3600), $ip, $now - 3600]);
if ((int) $st->fetchColumn() >= 5) {
    reply(false, 'أرسلت رسائل كثيرة، حاول بعد شوي.', [], 429);
}

if (!$verify) {
    save_message($m, $ip);
    reply(true, 'وصلت رسالتك، شكراً لك ✨', ['done' => true]);
}

$code = (string) random_int(100000, 999999);
[$ok, $err] = send_code($m, $code);
if (!$ok) {
    reply(false, 'تعذّر إرسال رمز التأكيد لإيميلك، تأكد منه أو تواصل عبر واتساب.', [], 502);
}
$token = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO pending_messages (token, name, email, phone, subject, message, code_hash, ip_hash, sent_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$token, $m['name'], $m['email'], $m['phone'], $m['subject'], $m['message'], hash_hmac('sha256', $code, app_secret()), $ip, $now, $now + 900]);
reply(true, 'أرسلنا الرمز.', ['step' => 'verify', 'token' => $token, 'email' => mask_email($m['email'])]);
