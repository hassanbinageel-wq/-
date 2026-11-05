<?php

function render_field(string $name, array $f, $value): void
{
    $type = $f['type'];
    $value = $value ?? ($f['default'] ?? '');
    $full = !empty($f['full']) || in_array($type, ['html', 'code', 'gallery'], true);
    $req = !empty($f['required']) ? ' required' : '';
    $id = 'f_' . $name;
    ?>
    <div class="field <?= $full ? 'full' : '' ?> field-<?= e($type) ?>">
      <?php if ($type === 'bool'): ?>
        <label class="switch">
          <input type="checkbox" name="<?= e($name) ?>" value="1" <?= (string) $value === '1' ? 'checked' : '' ?>>
          <span class="switch-ui"></span><span class="switch-label"><?= e($f['label']) ?></span>
        </label>
      <?php else: ?>
        <label class="field-label" for="<?= $id ?>"><?= e($f['label']) ?><?= $req ? ' <b class="req">*</b>' : '' ?></label>
        <?php switch ($type):
            case 'textarea': ?>
              <textarea id="<?= $id ?>" name="<?= e($name) ?>" rows="4"<?= $req ?>><?= e($value) ?></textarea>
            <?php break;
            case 'code': ?>
              <textarea id="<?= $id ?>" class="mono" name="<?= e($name) ?>" rows="6" dir="auto"<?= $req ?>><?= e($value) ?></textarea>
            <?php break;
            case 'html': ?>
              <div class="editor" data-editor>
                <div class="editor-bar">
                  <button type="button" data-wrap="h2" title="عنوان">H2</button>
                  <button type="button" data-wrap="h3" title="عنوان فرعي">H3</button>
                  <button type="button" data-wrap="p" title="فقرة">¶</button>
                  <button type="button" data-wrap="strong" title="عريض"><b>B</b></button>
                  <button type="button" data-wrap="em" title="مائل"><i>I</i></button>
                  <button type="button" data-wrap="blockquote" title="اقتباس">❝</button>
                  <button type="button" data-list title="قائمة">• —</button>
                  <button type="button" data-link title="رابط"><?= icon('link') ?></button>
                  <button type="button" data-img title="صورة برابط"><?= icon('image') ?></button>
                  <button type="button" data-preview title="معاينة"><?= icon('eye') ?></button>
                </div>
                <textarea id="<?= $id ?>" name="<?= e($name) ?>" rows="12" class="mono-light"><?= e($value) ?></textarea>
                <div class="editor-preview prose-admin" hidden></div>
              </div>
            <?php break;
            case 'select': ?>
              <select id="<?= $id ?>" name="<?= e($name) ?>">
                <?php foreach ($f['options'] as $k => $l): ?><option value="<?= e($k) ?>" <?= (string) $value === (string) $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?>
              </select>
            <?php break;
            case 'icon': ?>
              <div class="icon-picker">
                <?php foreach ($f['options'] as $k => $l): ?>
                  <label title="<?= e($l) ?>"><input type="radio" name="<?= e($name) ?>" value="<?= e($k) ?>" <?= (string) $value === (string) $k ? 'checked' : '' ?>><span><?= icon($k) ?></span></label>
                <?php endforeach; ?>
              </div>
            <?php break;
            case 'image': ?>
              <div class="upload" data-upload>
                <div class="upload-preview <?= $value ? 'has' : '' ?>">
                  <?php if ($value): ?><img src="<?= e(media($value)) ?>" alt=""><?php else: ?><?= icon('image') ?><?php endif; ?>
                </div>
                <div class="upload-actions">
                  <label class="btn btn-sm btn-ghost"><?= icon('upload') ?><span><?= $value ? 'تغيير الصورة' : 'اختر صورة' ?></span><input type="file" name="<?= e($name) ?>" accept="image/*" hidden></label>
                  <?php if ($value): ?><label class="check-sm"><input type="checkbox" name="<?= e($name) ?>__remove" value="1"> حذف الصورة</label><?php endif; ?>
                </div>
              </div>
            <?php break;
            case 'gallery':
                $imgs = gallery_list($value); ?>
              <div class="gallery-field" data-gallery>
                <div class="gallery-grid">
                  <?php foreach ($imgs as $g): ?>
                    <label class="g-item"><img src="<?= e(media($g)) ?>" alt=""><input type="checkbox" name="<?= e($name) ?>__remove[]" value="<?= e($g) ?>"><span class="g-del"><?= icon('trash') ?></span></label>
                  <?php endforeach; ?>
                  <label class="g-add"><?= icon('plus') ?><span>أضف صور</span><input type="file" name="<?= e($name) ?>[]" accept="image/*" multiple hidden></label>
                </div>
                <?php if ($imgs): ?><small class="hint">اضغط على أي صورة لتحديدها للحذف</small><?php endif; ?>
              </div>
            <?php break;
            case 'color': ?>
              <div class="color-field"><input type="color" id="<?= $id ?>" name="<?= e($name) ?>" value="<?= e($value) ?>"><code><?= e($value) ?></code></div>
            <?php break;
            case 'number': ?>
              <input id="<?= $id ?>" type="number" name="<?= e($name) ?>" value="<?= e($value) ?>" <?= isset($f['min']) ? 'min="' . $f['min'] . '"' : '' ?> <?= isset($f['max']) ? 'max="' . $f['max'] . '"' : '' ?>>
            <?php break;
            case 'date': ?>
              <input id="<?= $id ?>" type="date" name="<?= e($name) ?>" value="<?= e($value ?: date('Y-m-d')) ?>">
            <?php break;
            default:
                $inputType = ['url' => 'text', 'email' => 'email'][$type] ?? 'text'; ?>
              <input id="<?= $id ?>" type="<?= $inputType ?>" name="<?= e($name) ?>" value="<?= e($value) ?>"<?= $req ?> <?= in_array($type, ['url', 'email'], true) ? 'dir="ltr" placeholder="' . ($type === 'url' ? 'https://' : 'name@example.com') . '"' : '' ?>>
        <?php endswitch; ?>
      <?php endif; ?>
      <?php if (!empty($f['hint'])): ?><small class="hint"><?= e($f['hint']) ?></small><?php endif; ?>
    </div>
    <?php
}

/** Display a value in a table cell */
function cell_value(string $name, array $f, array $row): string
{
    $v = $row[$name] ?? '';
    switch ($f['type']) {
        case 'image':
            return $v ? '<img class="thumb" src="' . e(media($v)) . '" alt="">' : '<span class="thumb thumb-empty">' . icon('image') . '</span>';
        case 'bool':
            if ($name === 'published') {
                return '<button class="status ' . ($v ? 'on' : 'off') . '" form="toggle-' . (int) $row['id'] . '" title="اضغط لتغيير الحالة">' . ($v ? 'منشور' : 'مخفي') . '</button>';
            }
            return $v ? '<span class="pill-yes">' . icon('star') . '</span>' : '<span class="muted">—</span>';
        case 'select':
            return e($f['options'][$v] ?? $v);
        case 'icon':
            return '<span class="cell-icon">' . icon($v ?: 'sparkles') . '</span>';
        case 'date':
            return e(ar_date($v));
        case 'url':
            return $v ? '<a href="' . e($v) . '" target="_blank" rel="noopener" class="muted ltr">' . e(preg_replace('~^https?://(www\.)?~', '', mb_strimwidth($v, 0, 40, '…'))) . '</a>' : '<span class="muted">—</span>';
        case 'number':
            if ($name === 'rating') {
                return str_repeat('★', (int) $v) . '<span class="muted">' . str_repeat('★', max(0, 5 - (int) $v)) . '</span>';
            }
            return e($v);
        default:
            return $v !== '' ? e(mb_strimwidth((string) $v, 0, 60, '…')) : '<span class="muted">—</span>';
    }
}
