<?php

function visits_by_day(int $days): array
{
    $from = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
    $st = db()->prepare("SELECT substr(created_at,1,10) d, COUNT(*) v, COUNT(DISTINCT visitor) u FROM visits WHERE created_at >= ? GROUP BY d");
    $st->execute([$from]);
    $map = [];
    foreach ($st as $r) $map[$r['d']] = $r;
    $out = [];
    for ($i = $days - 1; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $out[] = ['d' => $d, 'v' => (int) ($map[$d]['v'] ?? 0), 'u' => (int) ($map[$d]['u'] ?? 0)];
    }
    return $out;
}

function visits_count(string $since, bool $unique = false): int
{
    $st = db()->prepare('SELECT ' . ($unique ? 'COUNT(DISTINCT visitor || substr(created_at,1,10))' : 'COUNT(*)') . ' FROM visits WHERE created_at >= ?');
    $st->execute([$since]);
    return (int) $st->fetchColumn();
}

function page_label(string $path): string
{
    static $cache = [];
    if (isset($cache[$path])) return $cache[$path];
    $label = $path;
    if ($path === '/' || $path === '') $label = 'الصفحة الرئيسية';
    elseif (preg_match('~^/work(?:\.php\?id=|/)(\d+)~', $path, $m)) $label = 'عمل: ' . (item('works', (int) $m[1], true)['title'] ?? '#' . $m[1]);
    elseif (preg_match('~^/post(?:\.php\?id=|/)(\d+)~', $path, $m)) $label = 'مقال: ' . (item('posts', (int) $m[1], true)['title'] ?? '#' . $m[1]);
    else {
        $names = ['/about' => 'نبذة عني', '/story' => 'القصة', '/services' => 'الخدمات', '/works' => 'الأعمال', '/prompts' => 'البرومبتات',
            '/store' => 'المتجر', '/blog' => 'المدونة', '/contact' => 'تواصل', '/partners' => 'شركاء النجاح'];
        $label = $names[$path] ?? $path;
    }
    return $cache[$path] = $label;
}

/** SVG bar chart */
function bar_chart(array $data, int $height = 220): string
{
    $n = count($data);
    if (!$n) return '';
    $max = max(1, max(array_column($data, 'v')));
    $w = 1000;
    $gap = $n > 20 ? 4 : 10;
    $bw = ($w - $gap * ($n - 1)) / $n;
    $svg = '<svg class="chart" viewBox="0 0 ' . $w . ' ' . ($height + 28) . '" preserveAspectRatio="none" role="img" aria-label="الزيارات">';
    for ($g = 1; $g <= 3; $g++) {
        $y = $height - $height * $g / 4;
        $svg .= '<line x1="0" x2="' . $w . '" y1="' . $y . '" y2="' . $y . '" class="grid-line"/>';
    }
    foreach ($data as $i => $r) {
        // RTL: newest on the left
        $x = $w - ($i + 1) * $bw - $i * $gap;
        $h = $r['v'] ? max(4, $height * $r['v'] / $max) : 2;
        $uh = $r['u'] ? max(3, $height * $r['u'] / $max) : 0;
        $t = date('j/n', strtotime($r['d']));
        $svg .= '<g class="bar"><title>' . e($t . ' — ' . $r['v'] . ' زيارة، ' . $r['u'] . ' زائر') . '</title>';
        $svg .= '<rect x="' . round($x, 2) . '" y="' . round($height - $h, 2) . '" width="' . round($bw, 2) . '" height="' . round($h, 2) . '" rx="4" class="b-v"/>';
        if ($uh) $svg .= '<rect x="' . round($x + $bw * .2, 2) . '" y="' . round($height - $uh, 2) . '" width="' . round($bw * .6, 2) . '" height="' . round($uh, 2) . '" rx="3" class="b-u"/>';
        if ($n <= 14 || $i % ceil($n / 10) === 0 || $i === $n - 1) {
            $svg .= '<text x="' . round($x + $bw / 2, 2) . '" y="' . ($height + 20) . '" text-anchor="middle">' . $t . '</text>';
        }
        $svg .= '</g>';
    }
    return $svg . '</svg>';
}
