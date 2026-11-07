<?php

require_once __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/views/fields.php';
require __DIR__ . '/views/layout.php';

start_session();
if (!is_logged_in()) {
    redirect(admin_url('login'));
}
header('Cache-Control: no-store');

$page = (string) ($_GET['p'] ?? 'dashboard');
$action = (string) ($_GET['a'] ?? '');
$ents = entities();
$self = fn(array $q = []) => admin_url() . ($q ? '?' . http_build_query($q) : '');

/* ================= POST actions ================= */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $do = (string) ($_POST['_do'] ?? '');
    if ($page === 'upload') { // image upload from the article editor
        header('Content-Type: application/json; charset=utf-8');
        try {
            $path = handle_upload($_FILES['file'] ?? null);
            echo json_encode(['ok' => (bool) $path, 'url' => media($path)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (Throwable $ex) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'message' => $ex->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
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
            if ($do === 'reorder' && isset($def['fields']['sort_order']) && !isset($def['order'])) {
                $ids = array_values(array_filter(array_map('intval', explode(',', (string) ($_POST['ids'] ?? '')))));
                $st = db()->prepare("UPDATE $page SET sort_order = ?, updated_at = updated_at WHERE id = ?");
                db()->beginTransaction();
                foreach ($ids as $i => $rid) {
                    $st->execute([$i + 1, $rid]);
                }
                db()->commit();
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['ok' => true, 'message' => 'تم حفظ الترتيب ✓'], JSON_UNESCAPED_UNICODE);
                exit;
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

        if ($do === 'publish_site') {
            save_settings(['maintenance' => '0']);
            flash('🎉 تم نشر الموقع! صار ظاهر لكل الزوار الحين.');
            redirect($self());
        }
        if ($do === 'hide_site') {
            save_settings(['maintenance' => '1']);
            flash('الموقع رجع مخفي عن الزوار (وضع «قريباً»).');
            redirect($self());
        }
        if ($do === 'clear_demo') {
            $chosen = array_values(array_intersect((array) ($_POST['tables'] ?? []), array_keys(entities())));
            foreach ($chosen as $t) {
                db()->exec("DELETE FROM $t");
            }
            if (!array_diff(array_keys(entities()), $chosen)) {
                save_settings(['_demo' => '0']);
            }
            flash($chosen ? 'تم حذف المحتوى التجريبي من ' . count($chosen) . ' قسم ✓ — ابدأ بإضافة محتواك' : 'ما اخترت أي قسم.', $chosen ? 'ok' : 'err');
            redirect($self());
        }
        if ($do === 'keep_demo') {
            save_settings(['_demo' => '0']);
            redirect($self());
        }

        if ($page === 'settings' && $do === 'test_mail') {
            $to = (string) (setting('admin_email') ?: setting('contact_email') ?: setting('smtp_user'));
            [$ok, $err] = send_mail($to, 'تجربة البريد', mail_layout('البريد يشتغل ✓', '<p>إذا وصلك هذا الإيميل، فإعدادات البريد في موقعك صحيحة.</p>'));
            flash($ok ? 'تم إرسال إيميل تجريبي إلى ' . $to . ' — شيك على بريدك ✓' : 'فشل الإرسال: ' . $err, $ok ? 'ok' : 'err');
            redirect($self(['p' => 'settings', 'g' => 'mail']));
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
            } elseif ($do === 'reply' && $id) {
                $st = db()->prepare('SELECT * FROM messages WHERE id = ?');
                $st->execute([$id]);
                $m = $st->fetch();
                $body = trim((string) ($_POST['body'] ?? ''));
                if (!$m || !$m['email']) {
                    throw new RuntimeException('ما فيه إيميل للمرسل عشان نرد عليه.');
                }
                if ($body === '') {
                    throw new RuntimeException('اكتب ردك أول.');
                }
                $html = '<p>مرحباً ' . e($m['name']) . '،</p>' . nl2p($body)
                    . '<div style="margin-top:22px;padding:12px 14px;border-inline-start:3px solid #cbd5e1;color:#64748b;font-size:13px">'
                    . '<b>رسالتك:</b><br>' . nl2br(e(excerpt($m['message'], 600))) . '</div>';
                [$ok, $err] = send_mail($m['email'], 'رد: ' . ($m['subject'] ?: 'رسالتك'), mail_layout('رد على رسالتك', $html), (string) setting('contact_email') ?: null);
                if (!$ok) {
                    throw new RuntimeException('ما انرسل الرد: ' . $err);
                }
                db()->prepare('INSERT INTO message_replies (message_id, body, created_at) VALUES (?, ?, ?)')->execute([$id, $body, date('Y-m-d H:i:s')]);
                flash('تم إرسال الرد إلى ' . $m['email'] . ' ✓');
                redirect($self(['p' => 'messages', 'id' => $id]));
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

            $adminEmail = trim((string) ($_POST['admin_email'] ?? ''));
            if ($adminEmail !== '' && !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                throw new RuntimeException('إيميل المدير غير صحيح.');
            }
            $twofa = isset($_POST['login_2fa']) ? '1' : '0';
            if ($twofa === '1' && ($adminEmail === '' || !smtp_configured())) {
                throw new RuntimeException('عشان تفعّل التحقق بخطوتين: اكتب إيميلك هنا، وكمّل إعدادات البريد (الإعدادات ← البريد والرسائل) وجرّبها.');
            }
            $slug = strtolower(trim((string) ($_POST['admin_slug'] ?? '')));
            $reserved = ['about', 'story', 'services', 'works', 'prompts', 'store', 'blog', 'contact', 'partners', 'work', 'post', 'send', 'setup', 'admin', 'dashboard', 'assets', 'uploads', 'data', 'includes', 'pages', 'panel'];
            if (!preg_match('/^[a-z0-9][a-z0-9-]{5,39}$/', $slug) || in_array($slug, $reserved, true)) {
                throw new RuntimeException('الرابط السري لازم يكون 6 أحرف أو أكثر (حروف إنجليزية صغيرة وأرقام و -) ومو كلمة معروفة مثل dashboard.');
            }
            $slugChanged = $slug !== admin_slug();
            save_settings(['admin_email' => $adminEmail, 'login_2fa' => $twofa, 'admin_slug' => $slug]);
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
            flash($slugChanged ? 'تم تغيير رابط لوحة التحكم — احفظ الرابط الجديد: ' . admin_url() : 'تم تحديث الحساب ✓');
            redirect(admin_url('?p=account'));
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
