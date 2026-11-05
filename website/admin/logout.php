<?php
define('IN_ADMIN', true);
require __DIR__ . '/../includes/bootstrap.php';
start_session();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    session_destroy();
}
redirect(url('admin/login.php'));
