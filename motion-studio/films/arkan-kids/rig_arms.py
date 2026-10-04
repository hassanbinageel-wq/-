"""rig_arms.py — يفصل ذراعي الشخصية كطبقتين تدوران من الكتف، ويسدّ الجسم خلفهما بقماش الثوب وخط الحافة."""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
im = Image.open('assets/man_src.webp').convert('RGBA'); A = np.array(im)
X0, Y0, X1, Y1 = 354, 111, 987, 1888; BODY_START = 515
L_ARM = [(522,612),(470,645),(452,700),(430,870),(400,1000),(364,1135),(370,1185),(385,1305),(474,1305),(478,1180),(484,1150),(489,900),(485,715),(505,650)]
R_ARM = [(760,600),(872,630),(910,670),(935,790),(966,960),(978,1150),(962,1215),(945,1305),(846,1305),(842,1205),(858,1160),(842,985),(814,785),(792,700)]
TORSO_L = [(520,612),(485,715),(489,900),(479,1150),(466,1320)]
TORSO_R = [(800,612),(814,785),(842,985),(858,1160),(872,1320)]
def mask(poly):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).polygon(poly, fill=255); return np.array(m) > 0
th = Image.new('L', im.size, 0); ImageDraw.Draw(th).polygon(TORSO_L + TORSO_R[::-1], fill=255); torso = np.array(th) > 0
yy = np.arange(im.size[1])[:, None] * np.ones((1, im.size[0]), bool)
inner = ndimage.binary_erosion(torso, iterations=4)
collar = np.zeros_like(torso); collar[:640, 560:800] = True          # لا تلمس الياقة
R_, G_, B_ = [A[:, :, i].astype(int) for i in range(3)]
skin = (R_ > 180) & (R_ - B_ > 45) & (G_ > 120)
def mask_d(poly): return ndimage.binary_dilation(mask(poly), iterations=20)
def arm(poly):
    m = ndimage.binary_dilation(mask(poly), iterations=26) & (A[:, :, 3] > 0)
    m &= ~(inner & (yy < 1150)); m &= ~collar; m &= yy < 1308
    low = yy >= 1150                                                   # تحت الكُم: اليد فقط، بلا شريط الثوب
    m &= ~(low & ~(ndimage.binary_dilation(mask(poly), iterations=8) & ~torso))
    hand = ndimage.binary_dilation(skin & mask_d(poly), iterations=7)     # اليد كاملة مع حدّها، حتى لو دخلت حدود الجذع
    m |= hand & (yy >= 1180) & (A[:, :, 3] > 0); m &= ~((yy >= 1180) & ~hand)
    return m
mL, mR = arm(L_ARM), arm(R_ARM)
out = {}
for name, m, pivot in [('armL', mL, (500, 662)), ('armR', mR, (842, 672))]:
    arr = A.copy(); arr[~m, 3] = 0
    ys, xs = np.where(arr[:, :, 3] > 0); bx0, bx1, by0, by1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    Image.fromarray(arr[by0:by1, bx0:bx1]).save(f'assets/man_{name}.png')
    out[name] = dict(left=int(bx0 - X0), top=int(by0 - Y0), px=int(pivot[0] - bx0), py=int(pivot[1] - by0))
body = A.copy(); body[mL | mR, 3] = 0
body[ndimage.binary_dilation(mL | mR, iterations=8) & ~ndimage.binary_dilation(torso, iterations=3) & (yy >= 1150), 3] = 0   # بقايا حدود اليد
body[(mL | mR) & torso] = (255, 255, 255, 255)
b = Image.fromarray(body); d = ImageDraw.Draw(b)
d.line(TORSO_L[1:], fill=(20, 20, 20, 255), width=6, joint='curve'); d.line(TORSO_R[1:], fill=(20, 20, 20, 255), width=6, joint='curve')
Image.fromarray(np.array(b)[BODY_START:Y1, X0:X1]).save('assets/man_body.png')
print(out)
