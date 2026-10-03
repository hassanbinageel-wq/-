import sys, subprocess, math
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

D = '/tmp/claude-0/-home-user--/b21c35ab-11fc-5687-84c6-464755d7bd1d/scratchpad/n/'
SRC = D + 'src.mp4'
OUT = sys.argv[1] if len(sys.argv) > 1 else D + 'out.mp4'
T_START = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
T_END = float(sys.argv[3]) if len(sys.argv) > 3 else 70.18
W, H, FPS = 1920, 1080, 25
BAR = 100
LIME = np.array([60, 240, 185], np.float32) / 255.0   # BGR of neon lime (#B9F03C)
CUTS = [0, 1.94, 3.5, 5.42, 7.04, 9.96, 18.1, 20.38, 24.18, 26.06, 27.82, 29.4, 31.5,
        38.7, 40.26, 41.8, 43.1, 44.58, 46.7, 48.56, 50.32, 52.12, 53.84, 56.02, 59.74,
        61.8, 63.52, 66.1, 70.19]
END_CARD = 66.1

# ---------- line effects: (t0, dur, kind, params, behind_people) ----------
EFFECTS = [
    (0.35, 1.5, 'sweep', [(-0.05, 0.62), (0.30, 0.50), (0.62, 0.74), (1.05, 0.55)], False),
    (7.35, 1.5, 'sweep', [(-0.05, 0.80), (0.45, 0.62), (0.75, 0.72), (1.05, 0.50)], True),
    (10.5, 2.0, 'ring', dict(cx=0.56, cy=0.60, rx=0.21, ry=0.06, turns=1.6, rise=0.10), True),
    (24.3, 1.5, 'sweep', [(1.05, 0.55), (0.70, 0.70), (0.40, 0.62), (-0.05, 0.80)], True),
    (48.75, 1.4, 'sweep', [(-0.05, 0.30), (0.35, 0.40), (0.70, 0.62), (1.05, 0.75)], False),
    (56.35, 1.6, 'sweep', [(-0.05, 0.72), (0.35, 0.58), (0.70, 0.68), (1.05, 0.48)], True),
    (61.95, 1.4, 'sweep', [(1.05, 0.42), (0.65, 0.55), (0.30, 0.45), (-0.05, 0.60)], True),
]

def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

def catmull(pts, n=500):
    p = np.array(pts, np.float32)
    p = np.vstack([p[0] * 2 - p[1], p, p[-1] * 2 - p[-2]])
    out = []
    seg = len(p) - 3
    for i in range(seg):
        p0, p1, p2, p3 = p[i:i + 4]
        for s in np.linspace(0, 1, n // seg, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * s ** 3))
    out.append(p[-2])
    return np.array(out)

HW, HH = W // 2, H // 2  # draw at half-res, then upscale

def draw_poly(layer, pts, width):
    n = len(pts)
    if n < 2:
        return
    for i in range(n - 1):
        u = i / (n - 1)
        taper = math.sin(math.pi * u) ** 0.6
        th = max(1, int(round(width * (0.25 + 0.75 * taper))))
        a = (int(pts[i][0] * HW), int(pts[i][1] * HH))
        b = (int(pts[i + 1][0] * HW), int(pts[i + 1][1] * HH))
        cv2.line(layer, a, b, 1.0, th, cv2.LINE_AA)

def glow(core_pts_list):
    core = np.zeros((HH, HW), np.float32)
    g1 = np.zeros((HH, HW), np.float32)
    for pts in core_pts_list:
        draw_poly(core, pts, 3)
        draw_poly(g1, pts, 9)
    g1 = cv2.GaussianBlur(g1, (0, 0), 6)
    g2 = cv2.GaussianBlur(g1, (0, 0), 22)
    col = (g1[..., None] * 1.3 + g2[..., None] * 1.6) * LIME + core[..., None] * (LIME * 0.4 + 0.6)
    return cv2.resize(col, (W, H), interpolation=cv2.INTER_LINEAR)

def effect_layers(t):
    """returns (behind_layer, front_layer) float32 HxWx3 or None"""
    behind, front = [], []
    for t0, dur, kind, prm, bh in EFFECTS:
        if not (t0 <= t <= t0 + dur):
            continue
        x = (t - t0) / dur
        head, tail = ease(x / 0.72), ease((x - 0.28) / 0.72)
        if kind == 'sweep':
            path = catmull(prm)
            i0, i1 = int(tail * (len(path) - 1)), int(head * (len(path) - 1))
            seg = path[i0:i1 + 1]
            (behind if bh else front).append(seg)
        else:
            th = np.linspace(tail, head, 300) * prm['turns'] * 2 * math.pi + math.pi
            xs = prm['cx'] + prm['rx'] * np.cos(th)
            ys = prm['cy'] + prm['ry'] * np.sin(th) - prm['rise'] * th / (prm['turns'] * 2 * math.pi)
            frontmask = np.sin(th) > 0
            pts = np.stack([xs, ys], 1)
            # split into contiguous runs
            start = 0
            for i in range(1, len(pts) + 1):
                if i == len(pts) or frontmask[i] != frontmask[start]:
                    run = pts[max(0, start - 1):i]
                    (front if frontmask[start] else behind).append(run)
                    start = i
    b = glow(behind) if behind else None
    f = glow(front) if front else None
    return b, f

# ---------- person segmentation ----------
seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=mpt.BaseOptions(model_asset_path=D + 'seg.tflite'),
    running_mode=vision.RunningMode.IMAGE, output_confidence_masks=True))
prev_mask = None

def person_mask(bgr):
    global prev_mask
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    res = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    bg = res.confidence_masks[0].numpy_view()
    m = 1.0 - cv2.resize(bg, (W, H), interpolation=cv2.INTER_LINEAR)
    m = np.clip((m - 0.35) / 0.3, 0, 1)
    m = cv2.GaussianBlur(m, (0, 0), 2.5)
    if prev_mask is not None:
        m = 0.65 * m + 0.35 * prev_mask
    prev_mask = m
    return m

# ---------- graphics ----------
def font(size, weight='Bold'):
    f = ImageFont.truetype(D + 'Cairo.ttf', size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f

endcard = cv2.imread(D + 'f67.jpg')
eg = cv2.cvtColor(endcard, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
logos = np.clip((eg[315:560, 500:1370] - 0.08) / 0.8, 0, 1)
etext = np.clip((eg[620:735, 280:1640] - 0.08) / 0.8, 0, 1)
# small sponsor strip (top-left)
sh = 46
strip = cv2.resize(logos, (int(logos.shape[1] * sh / logos.shape[0]), sh), interpolation=cv2.INTER_AREA)

def rgba_text(lines, center=False):
    """lines: [(text, size, weight, rgb)] -> float BGR + alpha, right aligned"""
    img = Image.new('RGBA', (1600, 600), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 0
    for txt, size, wt, col in lines:
        f = font(size, wt)
        bb = d.textbbox((0, 0), txt, font=f)
        d.text(((1600 - (bb[2]-bb[0])) // 2 - bb[0] if center else 1600 - bb[2], y - bb[1]), txt, font=f, fill=col)
        y += bb[3] - bb[1] + int(size * 0.35)
    a = np.array(img).astype(np.float32) / 255
    bb = img.getbbox()
    a = a[bb[1]:bb[3], bb[0]:bb[2]]
    return a[..., [2, 1, 0]], a[..., 3]

brand_rgb, brand_a = rgba_text([('فن أخضر 2', 40, 'Bold', (185, 240, 60)),
                                ('GREEN ART 2', 17, 'SemiBold', (255, 255, 255))])
title_rgb, title_a = rgba_text([('فن أخضر 2', 150, 'Black', (185, 240, 60)),
                                ('حفل اختتام المشروع', 58, 'SemiBold', (255, 255, 255))], center=True)

def over(frame, rgb, a, x, y, op=1.0):
    h, w = a.shape[:2]
    roi = frame[y:y + h, x:x + w]
    al = (a * op)[..., None]
    roi[:] = roi * (1 - al) + rgb * al

def over_white(frame, a, x, y, op=1.0):
    over(frame, np.ones(a.shape + (3,), np.float32), a, x, y, op)

def shot_of(t):
    for i in range(len(CUTS) - 1):
        if CUTS[i] <= t < CUTS[i + 1]:
            return CUTS[i], CUTS[i + 1]
    return CUTS[-2], CUTS[-1]

def end_card(t):
    f = np.zeros((H, W, 3), np.float32)
    lt = t - END_CARD
    # logos: centre-out soft wipe
    lh, lw = logos.shape
    r = ease((lt - 0.15) / 0.9) * (lw / 2 + 80)
    xs = np.abs(np.arange(lw) - lw / 2)
    wipe = np.clip((r - xs) / 80, 0, 1)[None, :]
    over_white(f, logos * wipe, 500, 315)
    # lime underline drawing from centre
    p = ease((lt - 0.3) / 0.8)
    if p > 0:
        L = np.zeros((HH, HW), np.float32)
        cx, half = HW // 2, int(p * 330)
        cv2.line(L, (cx - half, 290), (cx + half, 290), 1.0, 2, cv2.LINE_AA)
        g = cv2.GaussianBlur(L, (0, 0), 7) * 3
        f += cv2.resize((L[..., None] + g[..., None]) * LIME, (W, H))
    # funding text fade + rise
    tp = ease((lt - 0.8) / 0.6)
    if tp > 0:
        over_white(f, etext, 280, 620 + int((1 - tp) * 20), tp)
    fade = 1 - ease((lt - (70.19 - END_CARD - 0.5)) / 0.5)
    return np.clip(f, 0, 1) * fade

def process(fr, t):
    if t >= END_CARD:
        return end_card(t)
    s0, s1 = shot_of(t)
    # slow push-in anchored on the subtitle line
    z = 1.0 + 0.045 * (t - s0) / max(s1 - s0, 0.1)
    ax, ay = 960, 925
    M = np.float32([[z, 0, ax - z * ax], [0, z, ay - z * ay]])
    fr = cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    # whip blur around cuts
    ds = [x for x, ok in ((t - s0, s0 > 0), (s1 - t, s1 != END_CARD)) if ok]
    d = min(ds) if ds else 1.0
    if d < 0.09:
        k = int(110 * (1 - d / 0.09)) | 1
        if k > 3:
            ker = np.zeros((1, k), np.float32); ker[:] = 1.0 / k
            fr = cv2.filter2D(fr, -1, ker)
            fr = np.clip(fr * (1 + 0.15 * (1 - d / 0.09)), 0, 255).astype(np.uint8)
    f = fr.astype(np.float32) / 255
    b, fl = effect_layers(t)
    if b is not None:
        m = person_mask(fr)
        b = b * (1 - m[..., None])
    for L in (b, fl):
        if L is not None:
            f = 1 - (1 - f) * (1 - np.clip(L, 0, 1))
    # opening title
    tt = t
    if tt < 3.6:
        op = ease((tt - 0.25) / 0.5) * (1 - ease((tt - 3.1) / 0.45))
        if op > 0:
            f *= (1 - 0.4 * op)
            th, tw = title_a.shape
            x0, y0 = (W - tw) // 2, (H - th) // 2 - 30 + int((1 - op) * 25)
            sh_a = cv2.GaussianBlur(title_a, (0, 0), 10)
            over(f, np.zeros(title_rgb.shape, np.float32), sh_a, x0 + 4, y0 + 8, op * 0.7)
            over(f, title_rgb, title_a, x0, y0, op)
    # persistent branding
    over_white(f, strip, 56, BAR + 26, 0.92)
    bh, bw = brand_a.shape
    over(f, brand_rgb, brand_a, W - 56 - bw, BAR + 20, 0.95)
    # letterbox
    f[:BAR] = 0; f[H - BAR:] = 0
    return f

grade = ("fps=25,scale=1920:1080,"
         "eq=contrast=1.05:saturation=1.12:brightness=0.015,"
         "colorbalance=rs=-0.03:bs=0.04:rh=0.04:gh=0.015:bh=-0.04,"
         "curves=all='0/0.03 0.5/0.5 1/0.98',vignette=PI/7")
dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(T_START), '-i', SRC, '-t', str(T_END - T_START),
                        '-vf', grade, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}',
                        '-r', str(FPS), '-i', '-', '-ss', str(T_START), '-t', str(T_END - T_START), '-i', SRC,
                        '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
                        '-shortest', OUT], stdin=subprocess.PIPE)
i = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    t = T_START + i / FPS
    fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
    out = process(fr, t)
    enc.stdin.write((np.clip(out, 0, 1) * 255).astype(np.uint8).tobytes())
    i += 1
    if i % 100 == 0:
        print('frame', i, f't={t:.1f}', flush=True)
enc.stdin.close(); enc.wait()
print('done', i)
