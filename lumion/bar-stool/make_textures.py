"""Procedural, seamless textures for the bar stool (wood + woven paper cord)."""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
rng = np.random.default_rng(7)


def periodic_noise(n, octaves, seed):
    """Tileable value noise built from random-phase integer-frequency sines."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    acc = np.zeros((n, n))
    for fx, fy, amp in octaves:
        for _ in range(4):
            kx = r.integers(-fx, fx + 1)
            ky = r.integers(1, fy + 1)
            ph = r.random() * 2 * np.pi
            acc += amp * np.sin(2 * np.pi * (kx * x + ky * y) + ph)
    return acc / max(1e-6, np.abs(acc).max())


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.dstack([-dx, dy, np.ones_like(h)])  # OpenGL (Y+) convention
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


def wood(n=2048):
    # grain runs along V (vertical in the image)
    y, x = np.mgrid[0:n, 0:n] / n
    warp = periodic_noise(n, [(2, 1, 1.0), (4, 2, 0.5)], 1) * 0.06
    rings = np.sin(2 * np.pi * (60 * (x + warp)) + 3 * periodic_noise(n, [(3, 2, 1)], 2))
    rings = (rings * 0.5 + 0.5) ** 3
    fine = periodic_noise(n, [(160, 2, 1.0), (300, 3, 0.6)], 3)
    blotch = periodic_noise(n, [(3, 2, 1.0)], 4)
    t = 0.30 * rings + 0.10 * fine + 0.15 * blotch + 0.2
    light = np.array([182, 104, 50]) / 255.0   # warm beech / light walnut
    dark = np.array([140, 74, 32]) / 255.0
    col = light[None, None] * (1 - t[..., None]) + dark[None, None] * t[..., None]
    col = np.clip(col, 0, 1) ** 1.0
    Image.fromarray((col * 255).astype(np.uint8)).save(os.path.join(OUT, "Wood_Albedo.jpg"), quality=94)
    normal_from_height(0.6 * rings + 0.4 * fine, 2.0).save(os.path.join(OUT, "Wood_Normal.png"))


def rush(n=1024, strands=16, twists=10):
    # strands run along V, repeated across U
    y, x = np.mgrid[0:n, 0:n] / n
    su = x * strands
    idx = np.floor(su).astype(int) % strands
    t = su - np.floor(su)                      # 0..1 across one strand
    prof = np.sqrt(np.clip(1 - (2 * t - 1) ** 2, 0, 1))  # round cord
    # twisted ply: diagonal grooves along the strand
    ph = (y * twists * strands / 2 + t * 0.9) % 1.0
    ply = 0.5 + 0.5 * np.cos(2 * np.pi * ph * 2)
    h = prof * (0.75 + 0.25 * ply)
    tone = rng.uniform(-0.06, 0.06, strands)[idx]
    fib = periodic_noise(n, [(200, 40, 1.0)], 9) * 0.04
    base = np.array([205, 150, 92]) / 255.0
    shade = (0.55 + 0.45 * h + tone + fib)[..., None]
    col = np.clip(base[None, None] * shade, 0, 1)
    Image.fromarray((col * 255).astype(np.uint8)).save(os.path.join(OUT, "Rush_Albedo.jpg"), quality=94)
    normal_from_height(h, 6.0).save(os.path.join(OUT, "Rush_Normal.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    wood()
    rush()
    print("textures written to", OUT)
