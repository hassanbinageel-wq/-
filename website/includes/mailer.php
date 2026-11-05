<?php
/**
 * Minimal SMTP mailer (no external libraries).
 * Works with Hostinger email: smtp.hostinger.com, port 465 (SSL) or 587 (TLS).
 */

function smtp_configured(): bool
{
    return setting('smtp_host') !== '' && setting('smtp_user') !== '' && setting('smtp_pass') !== '';
}

function mail_layout(string $title, string $bodyHtml): string
{
    $site = e(setting('site_name'));
    $accent = safe_color(setting('accent_color'), '#3b82f6');
    return '<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f4f6fb;font-family:Tahoma,Arial,sans-serif;color:#0f172a">'
        . '<div style="max-width:560px;margin:0 auto;padding:28px 16px">'
        . '<div style="background:#fff;border:1px solid #e5e9f2;border-radius:16px;overflow:hidden">'
        . '<div style="padding:18px 24px;border-bottom:1px solid #eef1f7;font-weight:bold;font-size:16px">' . $site . '</div>'
        . '<div style="padding:24px;line-height:1.9;font-size:15px">'
        . '<h2 style="margin:0 0 12px;font-size:18px;color:' . $accent . '">' . e($title) . '</h2>' . $bodyHtml . '</div></div>'
        . '<p style="text-align:center;color:#8a94a8;font-size:12px;margin-top:16px">' . $site . '</p>'
        . '</div></body></html>';
}

function mail_header_text(string $s): string
{
    return '=?UTF-8?B?' . base64_encode(str_replace(["\r", "\n"], ' ', $s)) . '?=';
}

/**
 * Send an email. Returns [true, ''] on success or [false, 'reason'].
 */
function send_mail(string $to, string $subject, string $html, ?string $replyTo = null): array
{
    $to = trim(str_replace(["\r", "\n"], '', $to));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return [false, 'عنوان البريد غير صالح'];
    }
    $host = preg_replace('/^www\./', '', preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
    $from = smtp_configured() ? (string) setting('smtp_user') : 'no-reply@' . $host;
    $fromName = (string) (setting('mail_from_name') ?: setting('site_name'));
    $replyTo = $replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL) ? $replyTo : null;

    $headers = [
        'Date: ' . date('r'),
        'From: ' . mail_header_text($fromName) . ' <' . $from . '>',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (explode('@', $from)[1] ?? $host) . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    if ($replyTo) {
        $headers[] = 'Reply-To: ' . $replyTo;
    }
    $body = chunk_split(base64_encode($html), 76, "\r\n");

    if (!smtp_configured()) {
        $ok = function_exists('mail') && @mail($to, mail_header_text($subject), $body, implode("\r\n", $headers));
        return [$ok, $ok ? '' : 'إعدادات البريد غير مكتملة (الإعدادات ← البريد والرسائل)'];
    }

    try {
        smtp_send($from, $to, array_merge(['To: <' . $to . '>', 'Subject: ' . mail_header_text($subject)], $headers), $body);
        return [true, ''];
    } catch (Throwable $e) {
        error_log('smtp: ' . $e->getMessage());
        return [false, $e->getMessage()];
    }
}

function smtp_send(string $from, string $to, array $headers, string $body): void
{
    $host = (string) setting('smtp_host');
    $port = (int) setting('smtp_port') ?: 465;
    $secure = (string) setting('smtp_secure');
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $host]]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        throw new RuntimeException('تعذّر الاتصال بخادم البريد: ' . $errstr);
    }
    stream_set_timeout($fp, 20);
    $read = function () use ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $cmd = function (?string $c, array $expect) use ($fp, $read): string {
        if ($c !== null) {
            fwrite($fp, $c . "\r\n");
        }
        $r = $read();
        if (!in_array((int) substr($r, 0, 3), $expect, true)) {
            throw new RuntimeException('رد خادم البريد: ' . trim($r ?: 'لا يوجد رد'));
        }
        return $r;
    };
    $ehlo = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost') ?: 'localhost';
    try {
        $cmd(null, [220]);
        $cmd('EHLO ' . $ehlo, [250]);
        if ($secure === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('فشل تفعيل TLS');
            }
            $cmd('EHLO ' . $ehlo, [250]);
        }
        $cmd('AUTH LOGIN', [334]);
        $cmd(base64_encode((string) setting('smtp_user')), [334]);
        try {
            $cmd(base64_encode((string) setting('smtp_pass')), [235]);
        } catch (RuntimeException $e) {
            throw new RuntimeException('الإيميل أو كلمة المرور غير صحيحة');
        }
        $cmd('MAIL FROM:<' . $from . '>', [250]);
        $cmd('RCPT TO:<' . $to . '>', [250, 251]);
        $cmd('DATA', [354]);
        fwrite($fp, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n");
        $cmd(null, [250]);
        @fwrite($fp, "QUIT\r\n");
    } finally {
        fclose($fp);
    }
}
