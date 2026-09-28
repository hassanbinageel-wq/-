import sys, subprocess, math
import numpy as np, cv2, pymupdf
from multiprocessing import Pool

W, H, FPS, DUR = 3840, 2160, 24, 11.5
NF = int(DUR * FPS)
OUT = sys.argv[1] if len(sys.argv) > 1 else "video_noaudio.mp4"
SCALE_DIV = int(sys.argv[2]) if len(sys.argv) > 2 else 1   # 2 = quick 1080p preview
W //= SCALE_DIV; H //= SCALE_DIV

# ---------------------------------------------------------------- logo assets
LW, LH = 3400, 2134           # logo space (300 dpi render)
S_BASE = 0.60 / SCALE_DIV    # logo space -> frame px
MS = 0.62 / SCALE_DIV         # prescale of masks

def load():
    p = pymupdf.open("logo.pdf")[0]
    pix = p.get_pixmap(dpi=300, alpha=False)
    a = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, 3).astype(np.float32)
    alpha = np.clip(1 - a[..., 1] / 255, 0, 1)
    red = np.zeros_like(alpha); red[60:560, 2130:2440] = alpha[60:560, 2130:2440]
    blk = alpha - red
    return alpha, red, blk

ALPHA, RED, BLK = load()
EL = {}   # name -> dict(crop, x0, y0 (logo space), color)

def add(name, mask, x0, y0, x1, y1, color):
    c = mask[y0:y1, x0:x1]
    c = cv2.resize(c, (max(1, round((x1 - x0) * MS)), max(1, round((y1 - y0) * MS))), interpolation=cv2.INTER_AREA)
    EL[name] = dict(crop=c, x0=x0, y0=y0, w=x1 - x0, h=y1 - y0, color=color)

# monogram modules
add("sq", BLK, 1088, 60, 1292, 268, "w")
add("colL", BLK, 1088, 546, 1292, 742, "w")
add("bar", BLK, 1088, 350, 2052, 546, "w")
add("colRt", BLK, 1566, 60, 1768, 350, "w")
add("colRb", BLK, 1566, 546, 1768, 742, "w")
add("ftop", BLK, 1768, 60, 2052, 268, "w")
add("red", RED, 2130, 60, 2440, 560, "r")
add("tm", BLK, 1036, 0, 1118, 42, "w")

# letters via connected components
lab_n, lab, st, _ = cv2.connectedComponentsWithStats((BLK > 0.5).astype(np.uint8), 8)
def letters(y0, y1):
    boxes = [s for s in st[1:] if y0 <= s[1] < y1 and s[4] > 1000]
    boxes = sorted([[s[0], s[1], s[0] + s[2], s[1] + s[3]] for s in boxes])
    merged = []
    for b in boxes:   # merge i-dots with stems
        if merged and b[0] < merged[-1][2] - 5:
            m = merged[-1]; merged[-1] = [min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3])]
        else:
            merged.append(b)
    return merged
L1 = letters(1000, 1600)
L2 = letters(1650, 2140)
for i, b in enumerate(L1):
    add(f"a{i}", BLK, max(0, b[0] - 6), b[1] - 6, min(LW, b[2] + 6), b[3] + 6, "w")
for i, b in enumerate(L2):
    add(f"b{i}", BLK, b[0] - 6, b[1] - 6, b[2] + 6, b[3] + 6, "w")

LINE_Y = 905                     # horizon line (logo space)
RED_C = (2285, 308)

# ---------------------------------------------------------------- easing
def clamp(x): return max(0.0, min(1.0, x))
def seg(t, a, b): return clamp((t - a) / (b - a))
def e_out_expo(x): return 1 - 2 ** (-10 * x) if x < 1 else 1.0
def e_out_cubic(x): return 1 - (1 - x) ** 3
def e_inout(x): return x * x * (3 - 2 * x)
def e_out_back(x, s=1.9): x -= 1; return 1 + x * x * ((s + 1) * x + s)

def cam(t):
    k = e_inout(seg(t, 0, DUR))
    return 0.93 + 0.08 * k

def to_frame(x, y, t):
    S = S_BASE * cam(t)
    return (x - LW / 2) * S + W / 2, (y - LH / 2 - 20) * S + H / 2

# ---------------------------------------------------------------- element states
PIECES = [("sq", 0, -1300), ("colL", 0, 1300), ("bar", -2000, 0),
          ("colRt", 0, -1500), ("colRb", 0, 1500), ("ftop", 1600, 0)]

def state(name, t):
    """returns (dx, dy, scale, opacity) in logo space"""
    if name == "red":
        k = seg(t, 1.45, 2.15)
        if k <= 0: return 0, 0, 1, 0
        return 0, 0, 0.35 + 0.65 * e_out_back(k), clamp(k * 4)
    for i, (n, ox, oy) in enumerate(PIECES):
        if n == name:
            st0 = 2.05 + i * 0.13
            k = seg(t, st0, st0 + 0.75)
            if k <= 0: return 0, 0, 1, 0
            e = e_out_expo(k)
            return ox * (1 - e), oy * (1 - e), 1, clamp(k * 5)
    if name[0] == "a":
        i = int(name[1:])
        st0 = 3.25 + i * 0.055
        k = seg(t, st0, st0 + 0.9)
        if k <= 0: return 0, 0, 1, 0
        e = e_out_expo(k)
        return 0, -620 * (1 - e), 1, 1
    if name[0] == "b":
        i = int(name[1:]); n = len(L2)
        k = seg(t, 4.35 + i * 0.045, 5.75)
        e = e_out_cubic(k)
        el = EL[name]; cx = el["x0"] + el["w"] / 2
        return (cx - LW / 2) * 0.45 * (1 - e), 50 * (1 - e), 1, e_inout(k)
    if name == "tm":
        return 0, 0, 1, e_inout(seg(t, 5.4, 6.2))
    return 0, 0, 1, 1

MOVERS = set(n for n, _, _ in PIECES) | {f"a{i}" for i in range(len(L1))} | {"red"}

def place(acc, name, t, clip_y=None, samples=1):
    el = EL[name]; crop = el["crop"]; ch, cw = crop.shape
    tmp = None; roi = None
    for s in range(samples):
        ts = t - (0.5 / FPS) * (s / max(1, samples - 1)) if samples > 1 else t
        dx, dy, sc, op = state(name, ts)
        if op <= 0.001: continue
        cx = el["x0"] + el["w"] / 2; cy = el["y0"] + el["h"] / 2
        # logo-space top-left after element scale
        lx = cx + (el["x0"] - cx) * sc + dx; ly = cy + (el["y0"] - cy) * sc + dy
        fx, fy = to_frame(lx, ly, ts)
        a = S_BASE * cam(ts) * sc / MS
        if roi is None:
            # generous roi covering all samples: compute from first + last sample
            dx2, dy2, _, _ = state(name, t - 0.5 / FPS) if samples > 1 else (dx, dy, 0, 0)
            fx2, fy2 = to_frame(cx + (el["x0"] - cx) * sc + dx2, cy + (el["y0"] - cy) * sc + dy2, t)
            x0 = int(math.floor(min(fx, fx2))) - 2; y0 = int(math.floor(min(fy, fy2))) - 2
            x1 = int(math.ceil(max(fx, fx2) + cw * a)) + 2; y1 = int(math.ceil(max(fy, fy2) + ch * a)) + 2
            X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
            if X1 <= X0 or Y1 <= Y0: return
            roi = (X0, Y0, X1, Y1); tmp = np.zeros((Y1 - Y0, X1 - X0), np.float32)
        X0, Y0, X1, Y1 = roi
        M = np.float32([[a, 0, fx - X0], [0, a, fy - Y0]])
        tmp += cv2.warpAffine(crop, M, (X1 - X0, Y1 - Y0), flags=cv2.INTER_LINEAR) * op
    if tmp is None: return
    tmp /= samples
    X0, Y0, X1, Y1 = roi
    if clip_y is not None:
        cy = int(round(clip_y)) - Y0
        if cy > 0: tmp[:min(cy, tmp.shape[0])] = 0
        # soft edge
    np.maximum(acc[Y0:Y1, X0:X1], tmp, out=acc[Y0:Y1, X0:X1])

# ---------------------------------------------------------------- static fields
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rr = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
BG = (0.045 * np.exp(-rr ** 2 * 1.3))[..., None] * np.float32([0.85, 0.9, 1.05])
VIGN = (1 - 0.55 * np.clip(rr - 0.35, 0, 1) ** 1.5)[..., None].astype(np.float32)
del rr

rng = np.random.default_rng(7)
NP = 170
P_POS = rng.random((NP, 2)) * [W, H]
P_VEL = (rng.random((NP, 2)) - 0.5) * [60, 30] / SCALE_DIV + [0, -12 / SCALE_DIV]
P_SIZE = (rng.random(NP) ** 3 * 16 + 2) / SCALE_DIV
P_BRI = rng.random(NP) * 0.10 + 0.02
P_PH = rng.random(NP) * 6.28

def particles(t):
    q = 4
    lay = np.zeros((H // q, W // q), np.float32)
    pos = (P_POS + P_VEL * t) % [W, H]
    fade = e_inout(seg(t, 0.2, 2.0))
    for i in range(NP):
        b = P_BRI[i] * (0.6 + 0.4 * math.sin(t * 1.3 + P_PH[i])) * fade
        r = max(1, int(round(P_SIZE[i] / q)))
        cv2.circle(lay, (int(pos[i, 0] / q * 16), int(pos[i, 1] / q * 16)), r * 16, b / (1 + 0.15 * r), -1, cv2.LINE_AA, 4)
    lay = cv2.GaussianBlur(lay, (0, 0), 1.2)
    return cv2.resize(lay, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * np.float32([1.0, 0.92, 0.85])

def streak(y, cx, width, inten, col, core=3.0, glow=40.0):
    """anamorphic horizontal light streak (small-res then upsampled)"""
    q = 4
    h, w = H // q, W // q
    ys = np.arange(h, dtype=np.float32)[:, None] * q; xs = np.arange(w, dtype=np.float32)[None, :] * q
    fx = np.exp(-((xs - cx) / max(1, width)) ** 2)
    fy = np.exp(-((ys - y) / (core / SCALE_DIV + 1)) ** 2) + 0.25 * np.exp(-((ys - y) / (glow / SCALE_DIV)) ** 2)
    f = (fx * fy * inten).astype(np.float32)
    f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LINEAR)
    return f[..., None] * np.float32(col)

def beam(t, inten):
    """volumetric projector beam emitted from the red cone to the right"""
    q = 4
    lay = np.zeros((H // q, W // q), np.float32)
    ax, ay = to_frame(2142, 225, t); bx, by = to_frame(2426, 71, t)
    cx_, cy_ = to_frame(2426, 545, t); dx_, dy_ = to_frame(2142, 400, t)
    far = W * 1.3
    k1 = (by - ay) / (bx - ax); k2 = (cy_ - dy_) / (cx_ - dx_)
    pts = np.float32([[bx, by], [far, by + k1 * (far - bx)], [far, cy_ + k2 * (far - cx_)], [cx_, cy_]]) / q
    cv2.fillPoly(lay, [pts.astype(np.int32)], 1.0, cv2.LINE_AA)
    xs = np.arange(W // q, dtype=np.float32)[None, :] * q
    fall = np.exp(-np.clip(xs - bx, 0, None) / (W * 0.18))
    ys = np.arange(H // q, dtype=np.float32)[:, None] * q
    rays = 0.75 + 0.25 * np.sin(np.arctan2(ys - (by + cy_) / 2, xs - bx + 1) * 60 + t * 3)
    lay = cv2.GaussianBlur(lay * fall * rays, (0, 0), 6) * inten
    return cv2.resize(lay, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * np.float32([1.0, 0.18, 0.12])

WHITE = np.float32([0.88, 0.87, 0.85]); REDC = np.float32([0.93, 0.02, 0.03])

def render(fi):
    t = fi / FPS
    img = BG.copy()
    img += particles(t)

    # red ambient glow behind cone after ignition
    ig = seg(t, 1.5, 1.7)
    if ig > 0:
        gx, gy = to_frame(*RED_C, t)
        glow_amt = ig * (0.10 + 0.35 * math.exp(-max(0, t - 1.65) / 0.5))
        d = ((xx - gx) ** 2 + (yy - gy) ** 2) / (W * 0.22) ** 2
        img += (glow_amt * np.exp(-d))[..., None] * np.float32([0.5, 0.02, 0.02])
        bi = ig * (0.08 + 0.55 * math.exp(-max(0, t - 1.65) / 0.45)) * (1 - e_inout(seg(t, 3.5, 6.5)))
        if bi > 0.003: img += beam(t, bi)

    # logo layers
    Aw = np.zeros((H, W), np.float32); Ar = np.zeros((H, W), np.float32)
    lx0, ly = to_frame(0, LINE_Y, t)
    place(Ar, "red", t, samples=3)
    for n, _, _ in PIECES: place(Aw, n, t, samples=6)
    for i in range(len(L1)): place(Aw, f"a{i}", t, clip_y=ly + 3 / SCALE_DIV, samples=5)
    for i in range(len(L2)): place(Aw, f"b{i}", t)
    place(Aw, "tm", t)

    # glint sweep
    g = seg(t, 6.0, 7.4)
    col_w = WHITE
    if 0 < g < 1:
        pos = -0.3 * W + e_inout(g) * 1.9 * W
        band = np.exp(-((xx + (yy - H / 2) * 0.55 - pos) / (W * 0.035)) ** 2)[..., None]
    else:
        band = 0
    A = np.maximum(Aw, Ar)[..., None]
    logo = Aw[..., None] * col_w + Ar[..., None] * REDC
    logo = logo + band * A * 0.9
    img = img * (1 - A) + logo

    # horizon line
    lk = seg(t, 0.35, 1.9)
    if lk > 0:
        fade = 1 - e_inout(seg(t, 4.0, 5.2))
        wid = e_out_expo(lk) * W * 0.62
        img += streak(ly, W / 2, wid, 1.6 * fade, [1.0, 0.93, 0.85], core=2.5, glow=26)
        # hot core flash as line appears
        img += streak(ly, W / 2, W * 0.12, 1.2 * math.exp(-((t - 0.6) / 0.35) ** 2), [1.0, 0.95, 0.9], core=5, glow=70)
    # ignition flare
    if ig > 0:
        gx, gy = to_frame(*RED_C, t)
        fl = math.exp(-max(0, t - 1.6) / 0.35) * ig
        img += streak(gy, gx, W * 0.9, 1.4 * fl, [1.0, 0.35, 0.3], core=4, glow=60)
        img += streak(gy, gx, W * 0.25, 1.2 * fl, [1.0, 0.8, 0.75], core=2, glow=20)
    # glint flare
    if 0 < g < 1:
        pass  # img += streak(H / 2, pos - 0 * W, W * 0.3, 0.35 * math.sin(g * math.pi), [0.9, 0.95, 1.0], core=2, glow=30)

    # bloom
    q = 4
    small = cv2.resize(img, (W // q, H // q), interpolation=cv2.INTER_AREA)
    br = np.clip(small - 0.55, 0, None)
    bl = cv2.GaussianBlur(br, (0, 0), 6 / SCALE_DIV) * 0.9 + cv2.GaussianBlur(br, (0, 0), 30 / SCALE_DIV) * 0.8
    bl += cv2.GaussianBlur(small, (0, 0), 50 / SCALE_DIV) * 0.10
    img += cv2.resize(bl, (W, H), interpolation=cv2.INTER_LINEAR)

    img *= VIGN
    # global fades
    img *= e_inout(seg(t, 0.0, 0.6)) * (1 - e_inout(seg(t, 10.2, 11.4)))
    # tone map (soft shoulder) + slight teal/orange grade
    img = 1 - np.exp(-img * 1.35)
    img = img ** np.float32([0.98, 1.0, 1.04])
    # film grain
    gr = np.random.default_rng(fi).standard_normal((H // 2, W // 2)).astype(np.float32) * 0.018
    img += cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes()

if __name__ == "__main__":
    frames = [int(a) for a in sys.argv[3].split(",")] if len(sys.argv) > 3 else None
    if frames:
        for f in frames:
            cv2.imwrite(f"f{f:04d}.png", cv2.cvtColor(np.frombuffer(render(f), np.uint8).reshape(H, W, 3), cv2.COLOR_RGB2BGR))
        sys.exit()
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow",
                           "-crf", "14", "-tune", "grain", "-pix_fmt", "yuv420p", "-profile:v", "high",
                           "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    with Pool(4) as pool:
        for i, fr in enumerate(pool.imap(render, range(NF), chunksize=1)):
            ff.stdin.write(fr)
            if i % 24 == 0: print(i, flush=True)
    ff.stdin.close(); ff.wait()
