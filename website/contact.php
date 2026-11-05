<?php
require __DIR__ . '/includes/bootstrap.php';

$ajax = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function respond(bool $ok, string $msg, bool $ajax): void
{
    if ($ajax) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 422);
        echo json_encode(['ok' => $ok, 'message' => $msg], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($ok) {
        redirect(url('?sent=1#contact'));
    }
    http_response_code(422);
    echo '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;direction:rtl;padding:40px">' . e($msg) . ' — <a href="' . e(url('#contact')) . '">رجوع</a>';
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    redirect(url('#contact'));
}

// Spam protection: hidden field + minimum fill time
if (!empty($_POST['website']) || (time() - (int) ($_POST['ts'] ?? 0)) < 3) {
    respond(true, 'تم الإرسال', $ajax);
}

$name = trim(mb_substr((string) ($_POST['name'] ?? ''), 0, 100));
$email = trim(mb_substr((string) ($_POST['email'] ?? ''), 0, 150));
$phone = trim(mb_substr((string) ($_POST['phone'] ?? ''), 0, 30));
$subject = trim(mb_substr((string) ($_POST['subject'] ?? ''), 0, 150));
$message = trim(mb_substr((string) ($_POST['message'] ?? ''), 0, 5000));

if ($name === '' || $message === '') {
    respond(false, 'فضلاً اكتب اسمك ورسالتك.', $ajax);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'البريد الإلكتروني غير صحيح.', $ajax);
}

$ip = ip_hash();
$st = db()->prepare('SELECT COUNT(*) FROM messages WHERE ip_hash = ? AND created_at > ?');
$st->execute([$ip, date('Y-m-d H:i:s', time() - 3600)]);
if ((int) $st->fetchColumn() >= 5) {
    respond(false, 'أرسلت رسائل كثيرة، حاول بعد شوي.', $ajax);
}

db()->prepare('INSERT INTO messages (name, email, phone, subject, message, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$name, $email, $phone, $subject, $message, $ip, date('Y-m-d H:i:s')]);

$to = setting('contact_email');
if ((string) setting('notify_email') === '1' && $to && function_exists('mail')) {
    $host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    $host = preg_replace('/^www\./', '', $host);
    $body = "رسالة جديدة من موقعك:\n\nالاسم: $name\nالبريد: $email\nالجوال: $phone\nالموضوع: $subject\n\n$message\n";
    $headers = "From: no-reply@$host\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    if ($email !== '') {
        $headers .= 'Reply-To: ' . str_replace(["\r", "\n"], '', $email) . "\r\n";
    }
    @mail($to, '=?UTF-8?B?' . base64_encode('رسالة جديدة: ' . ($subject ?: $name)) . '?=', $body, $headers);
}

respond(true, 'تم إرسال رسالتك بنجاح، بتواصل معك قريباً ✨', $ajax);
