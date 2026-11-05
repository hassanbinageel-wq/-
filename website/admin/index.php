<?php
define('IN_ADMIN', true);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/views/fields.php';
require __DIR__ . '/views/layout.php';

start_session();
if (!is_logged_in()) {
    redirect(url('admin/login.php'));
}
header('Cache-Control: no-store');

$page = (string) ($_GET['p'] ?? 'dashboard');
$action = (string) ($_GET['a'] ?? '');
$ents = entities();
$self = fn(array $q = []) => url('admin/') . ($q ? '?' . http_build_query($q) : '');

/* ================= POST actions ================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $do = (string) ($_POST['_do'] ?? '');
    try {
        if (isset($ents[$page])) {
            $def = $ents[$page];
            $id = (int) ($_POST['id'] ?? 0);
            if ($do === 'save') {
                $old = $id ? (item($page, $id, true) ?? []) : [];
                $data = collect_fields($def['fields'], $old);
                $data['updated_at'] = date('Y-m-d H:i:s');
                if ($id && $old) {
                    $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($data)));
                    db()->prepare("UPDATE $page SET $sets WHERE id = ?")->execute([...array_values($data), $id]);
                } else {
                    $data['created_at'] = $data['updated_at'];
                    $cols = array_keys($data);
                    db()->prepare("INSERT INTO $page (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')')->execute(array_values($data));
                    $id = (int) db()->lastInsertId();
                }
                flash('تم الحفظ بنجاح ✓');
                redirect(isset($_POST['_stay']) ? $self(['p' => $page, 'a' => 'edit', 'id' => $id]) : $self(['p' => $page]));
            }
            if ($do === 'delete' && $id) {
                db()->prepare("DELETE FROM $page WHERE id = ?")->execute([$id]);
                flash('تم الحذف');
                redirect($self(['p' => $page]));
            }
            if ($do === 'toggle' && $id && isset($def['fields']['published'])) {
                db()->prepare("UPDATE $page SET published = 1 - published WHERE id = ?")->execute([$id]);
                flash('تم تحديث الحالة');
                redirect($self(['p' => $page]));
            }
            if ($do === 'duplicate' && $id && ($row = item($page, $id, true))) {
                unset($row['id']);
                $first = array_key_first($def['fields']);
                $row[$first] .= ' (نسخة)';
                if (isset($row['published'])) $row['published'] = 0;
                $row['created_at'] = $row['updated_at'] = date('Y-m-d H:i:s');
                $cols = array_keys($row);
                db()->prepare("INSERT INTO $page (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')')->execute(array_values($row));
                flash('تم إنشاء نسخة (مخفية) — عدّلها ثم انشرها');
                redirect($self(['p' => $page]));
            }
        }

        if ($page === 'settings' && $do === 'save') {
            $schema = settings_schema();
            $g = (string) ($_POST['group'] ?? '');
            if (isset($schema[$g])) {
                save_settings(collect_fields($schema[$g]['fields'], settings_all()));
                flash('تم حفظ الإعدادات ✓');
            }
            redirect($self(['p' => 'settings', 'g' => $g]));
        }

        if ($page === 'messages') {
            $id = (int) ($_POST['id'] ?? 0);
            if ($do === 'delete' && $id) {
                db()->prepare('DELETE FROM messages WHERE id = ?')->execute([$id]);
                flash('تم حذف الرسالة');
            } elseif ($do === 'unread' && $id) {
                db()->prepare('UPDATE messages SET is_read = 0 WHERE id = ?')->execute([$id]);
                flash('تم تعليمها كغير مقروءة');
            } elseif ($do === 'read_all') {
                db()->exec('UPDATE messages SET is_read = 1');
                flash('تم تعليم الكل كمقروء');
            }
            redirect($self(['p' => 'messages']));
        }

        if ($page === 'analytics' && $do === 'reset') {
            db()->exec('DELETE FROM visits');
            flash('تم تصفير الإحصائيات');
            redirect($self(['p' => 'analytics']));
        }

        if ($page === 'account' && $do === 'save') {
            $u = current_user();
            $st = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
            $st->execute([$u['id']]);
            if (!password_verify((string) ($_POST['current'] ?? ''), (string) $st->fetchColumn())) {
                throw new RuntimeException('كلمة المرور الحالية غير صحيحة.');
            }
            $username = trim((string) ($_POST['username'] ?? ''));
            if (!preg_match('/^[\w.\-@]{3,40}$/u', $username)) {
                throw new RuntimeException('اسم المستخدم غير صالح.');
            }
            db()->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$username, $u['id']]);
            $new = (string) ($_POST['new'] ?? '');
            if ($new !== '') {
                if (mb_strlen($new) < 8) {
                    throw new RuntimeException('كلمة المرور الجديدة لازم تكون 8 أحرف على الأقل.');
                }
                if ($new !== (string) ($_POST['confirm'] ?? '')) {
                    throw new RuntimeException('كلمتا المرور غير متطابقتين.');
                }
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
                session_regenerate_id(true);
            }
            flash('تم تحديث الحساب ✓');
            redirect($self(['p' => 'account']));
        }
    } catch (RuntimeException $ex) {
        flash($ex->getMessage(), 'err');
        $back = $_SERVER['HTTP_REFERER'] ?? $self(['p' => $page]);
        redirect($back);
    } catch (Throwable $ex) {
        error_log('admin: ' . $ex->getMessage());
        flash('صار خطأ غير متوقع: ' . $ex->getMessage(), 'err');
        redirect($self(['p' => $page]));
    }
    redirect($self(['p' => $page]));
}

/* ================= Pages ================= */
if ($page === 'messages' && !empty($_GET['id'])) {
    db()->prepare('UPDATE messages SET is_read = 1 WHERE id = ?')->execute([(int) $_GET['id']]);
}
if (isset($ents[$page])) {
    $def = $ents[$page];
    if ($action === 'new' || $action === 'edit') {
        $row = $action === 'edit' ? item($page, (int) ($_GET['id'] ?? 0), true) : null;
        if ($action === 'edit' && !$row) {
            flash('العنصر غير موجود', 'err');
            redirect($self(['p' => $page]));
        }
        admin_start(($row ? 'تعديل ' : 'إضافة ') . $def['singular'], $page);
        require __DIR__ . '/views/form.php';
    } else {
        admin_start($def['title'], $page);
        require __DIR__ . '/views/list.php';
    }
} elseif (in_array($page, ['dashboard', 'analytics', 'messages', 'settings', 'account'], true)) {
    $titles = ['dashboard' => 'الرئيسية', 'analytics' => 'التحليلات', 'messages' => 'التواصل', 'settings' => 'الإعدادات', 'account' => 'الحساب'];
    admin_start($titles[$page], $page);
    require __DIR__ . '/views/' . $page . '.php';
} else {
    http_response_code(404);
    admin_start('غير موجود', '');
    echo '<div class="card empty"><p>الصفحة غير موجودة.</p></div>';
}
admin_end();
