<?php
/**
 * Mailbox sync.
 * Reads the site's email account (the one in Settings > Mail) over IMAP, so that:
 *   - replies you write in Webmail / Outlook / your phone (the "Sent" folder) and
 *   - emails clients send you directly (the Inbox)
 * show up inside the matching conversation in Dashboard > Messages.
 * Conversations are matched by the client's email address. No external libraries.
 */

final class MiniImap
{
    /** @var resource */
    private $fp;
    private int $tag = 0;

    public function __construct(string $host, int $port, string $secure)
    {
        $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $host]]);
        $fp = @stream_socket_client($remote, $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) {
            throw new RuntimeException('تعذّر الاتصال بخادم الإيميل (' . $host . '): ' . $errstr);
        }
        $this->fp = $fp;
        stream_set_timeout($fp, 25);
        $greet = (string) fgets($fp);
        if (!str_starts_with($greet, '* OK') && !str_starts_with($greet, '* PREAUTH')) {
            throw new RuntimeException('خادم الإيميل ما رد بشكل صحيح');
        }
        if ($secure === 'tls') {
            $this->cmd('STARTTLS');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('فشل تفعيل التشفير مع خادم الإيميل');
            }
        }
    }

    /** One server response line, with any {n} literals read in full. */
    private function readLine(): string
    {
        $out = '';
        while (true) {
            $line = fgets($this->fp);
            if ($line === false) {
                throw new RuntimeException('انقطع الاتصال بخادم الإيميل');
            }
            $out .= $line;
            if (preg_match('/\{(\d+)\}\r\n$/', $line, $m)) {
                $n = (int) $m[1];
                $buf = '';
                while (strlen($buf) < $n) {
                    $chunk = fread($this->fp, min(65536, $n - strlen($buf)));
                    if ($chunk === false || $chunk === '') {
                        throw new RuntimeException('انقطع الاتصال بخادم الإيميل');
                    }
                    $buf .= $chunk;
                }
                $out .= $buf;
                continue;
            }
            return $out;
        }
    }

    /** Run a command and return its untagged response lines. */
    public function cmd(string $c): array
    {
        $t = 'A' . (++$this->tag);
        fwrite($this->fp, $t . ' ' . $c . "\r\n");
        $lines = [];
        while (true) {
            $l = $this->readLine();
            if (str_starts_with($l, $t . ' ')) {
                if (!preg_match('/^' . $t . ' OK/i', $l)) {
                    throw new RuntimeException(trim(substr($l, strlen($t) + 1)));
                }
                return $lines;
            }
            $lines[] = $l;
        }
    }

    public function login(string $user, string $pass): void
    {
        try {
            if (preg_match('/^[\x20-\x7e]*$/', $user . $pass)) {
                $this->cmd('LOGIN ' . self::q($user) . ' ' . self::q($pass));
            } else {
                $this->cmd('AUTHENTICATE PLAIN ' . base64_encode("\0" . $user . "\0" . $pass));
            }
        } catch (RuntimeException $e) {
            throw new RuntimeException('الإيميل أو كلمة المرور غير صحيحة (المزامنة)');
        }
    }

    public static function q(string $s): string
    {
        return '"' . addcslashes($s, "\"\\") . '"';
    }

    public function close(): void
    {
        @fwrite($this->fp, "Z LOGOUT\r\n");
        @fclose($this->fp);
    }
}

/* ---------------- email parsing ---------------- */

/** [headers (lower-case name => value), body] */
function mime_split(string $raw): array
{
    $raw = str_replace("\r\n", "\n", $raw);
    $p = strpos($raw, "\n\n");
    $head = $p === false ? $raw : substr($raw, 0, $p);
    $body = $p === false ? '' : substr($raw, $p + 2);
    $head = preg_replace("/\n[ \t]+/", ' ', $head);
    $h = [];
    foreach (explode("\n", $head) as $line) {
        if (preg_match('/^([A-Za-z0-9\-]+):\s*(.*)$/', $line, $m)) {
            $k = strtolower($m[1]);
            if (!isset($h[$k])) {
                $h[$k] = trim($m[2]);
            }
        }
    }
    return [$h, $body];
}

function mime_hdr(string $v): string
{
    if (!str_contains($v, '=?')) {
        return $v;
    }
    $d = @iconv_mime_decode($v, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
    return $d !== false ? $d : mb_decode_mimeheader($v);
}

function mime_param(string $header, string $name): string
{
    if (preg_match('/(?:^|;)\s*' . preg_quote($name, '/') . '\s*=\s*(?:"([^"]*)"|([^;\s]+))/i', $header, $m)) {
        return $m[1] !== '' ? $m[1] : ($m[2] ?? '');
    }
    return '';
}

function to_utf8(string $s, string $charset): string
{
    $cs = strtolower(trim($charset));
    if ($cs !== '' && !in_array($cs, ['utf-8', 'utf8', 'us-ascii', 'ascii'], true)) {
        try {
            $s = mb_convert_encoding($s, 'UTF-8', $cs);
        } catch (Throwable $e) {
            $c = @iconv($cs, 'UTF-8//IGNORE', $s);
            if ($c !== false) {
                $s = $c;
            }
        }
    }
    return mb_scrub($s, 'UTF-8');
}

/** Find the first text/plain and text/html parts. Returns ['plain' => ?, 'html' => ?]. */
function mime_texts(array $h, string $body, int $depth = 0): array
{
    $out = ['plain' => null, 'html' => null];
    $ctype = strtolower(trim(explode(';', $h['content-type'] ?? 'text/plain')[0]));
    if ($depth > 6) {
        return $out;
    }
    if (str_starts_with($ctype, 'multipart/')) {
        $b = mime_param($h['content-type'] ?? '', 'boundary');
        if ($b === '') {
            return $out;
        }
        $parts = explode("\n--" . $b, "\n" . $body);
        array_shift($parts); // preamble
        foreach ($parts as $part) {
            if (str_starts_with($part, '--')) {
                break; // closing boundary
            }
            [$ph, $pb] = mime_split(ltrim($part, "\n"));
            if (!isset($ph['content-type'])) {
                $ph['content-type'] = 'text/plain';
            }
            $sub = mime_texts($ph, $pb, $depth + 1);
            $out['plain'] ??= $sub['plain'];
            $out['html'] ??= $sub['html'];
        }
        return $out;
    }
    if (stripos($h['content-disposition'] ?? '', 'attachment') !== false) {
        return $out;
    }
    if ($ctype !== 'text/plain' && $ctype !== 'text/html') {
        return $out;
    }
    $enc = strtolower(trim($h['content-transfer-encoding'] ?? ''));
    if ($enc === 'base64') {
        $body = base64_decode(preg_replace('/[^A-Za-z0-9+\/=]/', '', $body)) ?: '';
    } elseif ($enc === 'quoted-printable') {
        $body = quoted_printable_decode($body);
    }
    $body = to_utf8($body, mime_param($h['content-type'] ?? '', 'charset'));
    $out[$ctype === 'text/html' ? 'html' : 'plain'] = $body;
    return $out;
}

function html_to_text(string $html): string
{
    $html = preg_replace('~<(head|style|script)\b.*?</\1>~is', '', $html);
    // drop quoted history (Webmail, Gmail, Outlook)
    for ($i = 0; $i < 8 && preg_match('~<blockquote\b~i', $html); $i++) {
        $html = preg_replace('~<blockquote\b(?:(?!<blockquote\b).)*?</blockquote>~is', '', $html);
    }
    $html = preg_replace('~<div[^>]+(gmail_quote|divRplyFwdMsg|moz-cite-prefix|yahoo_quoted)[^>]*>.*$~is', '', $html);
    $html = preg_replace('~<br\s*/?>~i', "\n", $html);
    $html = preg_replace('~</(p|div|li|tr|h\d)>~i', "\n", $html);
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = str_replace("\xC2\xA0", ' ', $text);
    return $text;
}

/** Keep only what the person wrote: cut quoted history and signatures. */
function strip_quoted(string $text): string
{
    $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $text));
    $keep = [];
    $n = count($lines);
    for ($i = 0; $i < $n; $i++) {
        $l = rtrim($lines[$i]);
        $t = trim($l);
        $two = $t . ' ' . trim($lines[$i + 1] ?? '');
        if (preg_match('/^On\s.+wrote:$/i', $t) || preg_match('/^On\s.+wrote:$/i', $two)
            || preg_match('/^في\s.+(كتب|كتبت)[^:]*:$/u', $t) || preg_match('/^في\s.+(كتب|كتبت)[^:]*:$/u', $two)
            || preg_match('/^-{2,}\s*(Original Message|Forwarded message|الرسالة الأصلية|رسالة معاد توجيهها)/iu', $t)
            || preg_match('/^_{8,}$/', $t)
            || $t === '--'
            || (preg_match('/^(From|من)\s*:\s*\S/u', $t) && preg_match('/^(Sent|Date|To|تاريخ الإرسال|التاريخ|إلى|أُرسلت)\s*:/u', trim($lines[$i + 1] ?? '')))
        ) {
            break;
        }
        if (str_starts_with($t, '>')) {
            continue;
        }
        $keep[] = $l;
    }
    $out = trim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $keep)));
    return mb_substr($out, 0, 8000);
}

/** "Name <a@b.c>, x@y.z" => [[name, email], ...] */
function parse_addresses(string $v): array
{
    $out = [];
    foreach (preg_split('/,(?=(?:[^"]*"[^"]*")*[^"]*$)/', mime_hdr($v)) as $part) {
        $part = trim($part);
        if (preg_match('/^(.*)<([^>]+)>$/', $part, $m)) {
            $name = trim(trim($m[1]), "\"' ");
            $email = strtolower(trim($m[2]));
        } else {
            $name = '';
            $email = strtolower(trim($part, "<> "));
        }
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $out[] = [$name, $email];
        }
    }
    return $out;
}

function is_automated(array $h, string $from): bool
{
    $auto = strtolower($h['auto-submitted'] ?? 'no');
    $prec = strtolower($h['precedence'] ?? '');
    return ($auto !== '' && $auto !== 'no')
        || in_array($prec, ['bulk', 'list', 'junk'], true)
        || isset($h['list-unsubscribe']) || isset($h['list-id'])
        || preg_match('/^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|bounces?)[@+.\-]/i', $from);
}

/* ---------------- sync ---------------- */

function mail_sync_enabled(): bool
{
    return smtp_configured() && (string) setting('mail_sync') !== '0';
}

function imap_settings(): array
{
    $host = trim((string) setting('imap_host'));
    if ($host === '') {
        $host = preg_replace('/^smtp\./i', 'imap.', (string) setting('smtp_host')) ?: 'imap.hostinger.com';
    }
    $secure = (string) (setting('imap_secure') ?: 'ssl');
    $port = (int) setting('imap_port') ?: ($secure === 'ssl' ? 993 : 143);
    return [$host, $port, $secure];
}

/**
 * Pull new emails into the conversations.
 * $minGap: skip if the last sync was less than this many seconds ago (0 = always).
 * Returns ['new' => int, 'error' => string, 'skipped' => bool].
 */
function mail_sync(int $minGap = 60): array
{
    $res = ['new' => 0, 'error' => '', 'skipped' => false];
    if (!mail_sync_enabled()) {
        $res['skipped'] = true;
        return $res;
    }
    if ($minGap > 0 && time() - (int) setting('_mail_sync_at') < $minGap) {
        $res['skipped'] = true;
        return $res;
    }
    $lock = @fopen(DATA_DIR . '/mailsync.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        $res['skipped'] = true;
        return $res;
    }
    save_settings(['_mail_sync_at' => (string) time()]);
    @set_time_limit(90);
    $imap = null;
    try {
        [$host, $port, $secure] = imap_settings();
        $imap = new MiniImap($host, $port, $secure);
        $own = strtolower(trim((string) setting('smtp_user')));
        $imap->login((string) setting('smtp_user'), (string) setting('smtp_pass'));

        // find the Sent folder
        $sent = null;
        $names = [];
        foreach ($imap->cmd('LIST "" "*"') as $l) {
            if (!preg_match('/^\* LIST \(([^)]*)\) (?:"(?:[^"\\\\]|\\\\.)*"|NIL) (.+?)\r?\n?$/s', $l, $m)) {
                continue;
            }
            $name = trim($m[2]);
            if (str_starts_with($name, '"')) {
                $name = stripcslashes(substr($name, 1, -1));
            }
            $names[] = $name;
            if (stripos($m[1], '\\Sent') !== false) {
                $sent = $name;
            }
        }
        if ($sent === null) {
            foreach ($names as $n) {
                if (preg_match('/^(INBOX[.\/])?(Sent|Sent Items|Sent Messages|Sent Mail)$/i', $n)) {
                    $sent = $n;
                    break;
                }
            }
        }

        $state = json_decode((string) setting('_mail_sync_state'), true) ?: [];
        $since = date('d-M-Y', strtotime('-60 days'));
        foreach (array_filter(['INBOX' => 'in', (string) $sent => 'out'], fn($v, $k) => $k !== '', ARRAY_FILTER_USE_BOTH) as $folder => $dir) {
            $validity = '';
            foreach ($imap->cmd('SELECT ' . MiniImap::q($folder)) as $l) {
                if (preg_match('/\[UIDVALIDITY (\d+)\]/i', $l, $m)) {
                    $validity = $m[1];
                }
            }
            $st = $state[$folder] ?? null;
            $fresh = !$st || ($st['v'] ?? '') !== $validity;
            $last = $fresh ? 0 : (int) $st['u'];
            $uids = [];
            foreach ($imap->cmd($fresh ? 'UID SEARCH SINCE ' . $since : 'UID SEARCH UID ' . ($last + 1) . ':*') as $l) {
                if (preg_match('/^\* SEARCH\s*(.*)$/i', trim($l), $m)) {
                    foreach (preg_split('/\s+/', trim($m[1])) as $u) {
                        if (ctype_digit($u) && (int) $u > $last) {
                            $uids[] = (int) $u;
                        }
                    }
                }
            }
            sort($uids);
            $uids = array_slice($uids, -200);
            foreach (array_chunk($uids, 20) as $chunk) {
                foreach ($imap->cmd('UID FETCH ' . implode(',', $chunk) . ' (UID BODY.PEEK[]<0.400000>)') as $l) {
                    if (!preg_match('/BODY\[\](?:<\d+>)? \{(\d+)\}\r\n/', $l, $m, PREG_OFFSET_CAPTURE)) {
                        continue;
                    }
                    $len = (int) $m[1][0];
                    $start = $m[0][1] + strlen($m[0][0]);
                    $raw = substr($l, $start, $len);
                    $meta = substr($l, 0, $m[0][1]) . substr($l, $start + $len);
                    $uid = preg_match('/UID (\d+)/', $meta, $um) ? (int) $um[1] : 0;
                    if (mail_sync_store($raw, $dir, $own)) {
                        $res['new']++;
                    }
                    $last = max($last, $uid);
                }
                $state[$folder] = ['v' => $validity, 'u' => $last];
                save_settings(['_mail_sync_state' => json_encode($state)]);
            }
            $state[$folder] = ['v' => $validity, 'u' => max($last, $uids ? max($uids) : 0)];
        }
        save_settings(['_mail_sync_state' => json_encode($state), '_mail_sync_err' => '', '_mail_sync_ok' => (string) time()]);
    } catch (Throwable $e) {
        error_log('mailsync: ' . $e->getMessage());
        $res['error'] = $e->getMessage();
        save_settings(['_mail_sync_err' => $res['error']]);
    } finally {
        $imap?->close();
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    return $res;
}

/** Store one email in the right conversation. Returns true if something new was added. */
function mail_sync_store(string $raw, string $dir, string $own): bool
{
    [$h, $body] = mime_split($raw);
    $msgid = trim($h['message-id'] ?? '', " <>\t");
    if ($msgid === '') {
        $msgid = 'h:' . sha1(($h['date'] ?? '') . ($h['from'] ?? '') . ($h['subject'] ?? '') . substr($body, 0, 2000));
    }
    $pdo = db();
    $st = $pdo->prepare('SELECT (SELECT COUNT(*) FROM message_replies WHERE msgid = ?) + (SELECT COUNT(*) FROM messages WHERE msgid = ?)');
    $st->execute([$msgid, $msgid]);
    if ((int) $st->fetchColumn() > 0) {
        return false;
    }
    $from = parse_addresses($h['from'] ?? '')[0] ?? ['', ''];
    $ts = strtotime($h['date'] ?? '') ?: time();
    $date = date('Y-m-d H:i:s', min($ts, time()));
    $subject = mb_substr(trim(preg_replace('/^((re|fwd?|رد|إعادة توجيه)\s*:\s*)+/iu', '', mime_hdr($h['subject'] ?? ''))), 0, 200);

    $find = $pdo->prepare('SELECT id FROM messages WHERE lower(email) = ? ORDER BY id DESC LIMIT 1');
    if ($dir === 'in') {
        if ($from[1] === '' || $from[1] === $own || is_automated($h, $from[1])) {
            return false;
        }
        $find->execute([$from[1]]);
        $thread = (int) $find->fetchColumn();
    } else {
        $thread = 0;
        foreach (array_merge(parse_addresses($h['to'] ?? ''), parse_addresses($h['cc'] ?? '')) as [, $addr]) {
            if ($addr === $own) {
                continue;
            }
            $find->execute([$addr]);
            if ($thread = (int) $find->fetchColumn()) {
                break;
            }
        }
        if (!$thread) {
            return false; // an email to someone who never contacted you through the site
        }
    }

    $t = mime_texts($h + ['content-type' => 'text/plain'], $body);
    $text = $t['plain'] !== null && trim($t['plain']) !== '' ? strip_quoted($t['plain']) : strip_quoted(html_to_text((string) $t['html']));
    if ($text === '') {
        $text = '(إيميل بدون نص — افتحه من صندوق بريدك)';
    }

    if ($dir === 'in' && !$thread) {
        $name = $from[0] !== '' ? mb_substr($from[0], 0, 80) : explode('@', $from[1])[0];
        $pdo->prepare('INSERT INTO messages (name, email, phone, subject, message, is_read, ip_hash, created_at, last_at, source, msgid) VALUES (?, ?, "", ?, ?, 0, "", ?, ?, "email", ?)')
            ->execute([$name, $from[1], $subject, $text, $date, $date, $msgid]);
        return true;
    }
    $pdo->prepare('INSERT INTO message_replies (message_id, body, created_at, direction, source, msgid) VALUES (?, ?, ?, ?, "email", ?)')
        ->execute([$thread, $text, $date, $dir, $msgid]);
    $pdo->prepare('UPDATE messages SET last_at = CASE WHEN last_at IS NULL OR last_at < ? THEN ? ELSE last_at END' . ($dir === 'in' ? ', is_read = 0' : '') . ' WHERE id = ?')
        ->execute([$date, $date, $thread]);
    return true;
}
