<?php
declare(strict_types=1);

define('ROOT', dirname(__DIR__));
define('DATA_DIR', ROOT . '/data');
define('UPLOAD_DIR', ROOT . '/uploads');
define('SESSION_NAME', 'hsn_admin');

date_default_timezone_set('Asia/Riyadh');
mb_internal_encoding('UTF-8');

if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0755, true);
}
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', DATA_DIR . '/error.log');

// Base URL (works whether the site sits at the domain root or in a sub-folder)
(function () {
    $base = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    if (defined('IN_ADMIN')) {
        $base = str_replace('\\', '/', dirname($base));
    }
    define('BASE', rtrim($base, '/') . '/');
})();

if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('X-Frame-Options: SAMEORIGIN');
}

require __DIR__ . '/icons.php';
require __DIR__ . '/schema.php';
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/mailer.php';
