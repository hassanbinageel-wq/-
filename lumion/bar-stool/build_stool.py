"""Builds the woven-seat bar stool in Blender (bpy) and exports Lumion-ready files.

Units: metres, Z-up in Blender (FBX/OBJ exporters convert to Y-up).
Pivot: floor centre. Seat height 65 cm.
Run:  python3 build_stool.py   (needs the `bpy` module)
"""
import math
import os

import bpy
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "textures")

# ---------------- dimensions (m) ----------------
SEAT_A, SEAT_B = 0.200, 0.170      # half width (x), half depth (y) of the woven seat
SEAT_RC = 0.025                    # plan corner radius
Z_TOP, Z_BOT = 0.640, 0.600        # seat top rim / underside
RIM_R, BOT_R = 0.018, 0.008        # rounded rims where the cord wraps the rails
SAG = 0.010                        # dish of the seat

LEG_TOP = (0.190, 0.160)           # leg centre under the seat corner
LEG_FOOT = (0.225, 0.195)          # splayed foot centre
LEG_R_TOP, LEG_R_FOOT = 0.022, 0.018
LEG_H, CAP_H = 0.632, 0.013        # leg body height and dome cap

RUNG_R = 0.013
RUNG_Z_FB, RUNG_Z_LR = 0.225, 0.250  # front/back and side stretcher heights

APRON_T = 0.020

WOOD_TILE = 0.60                   # metres covered by one wood texture tile
RUSH_TILE = 0.096                  # 16 cords x 6 mm


class Builder:
    """Collects verts / faces with per-face UVs and material index."""

    def __init__(self):
        self.verts, self.faces = [], []

    def v(self, co):
        self.verts.append(tuple(co))
        return len(self.verts) - 1

    def f(self, idx, uvs, mat):
        self.faces.append((list(idx), list(uvs), mat))

    def to_object(self, name, materials):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        bv = [bm.verts.new(c) for c in self.verts]
        uvl = bm.loops.layers.uv.new("UVMap")
        for idx, uvs, mat in self.faces:
            if len(set(idx)) < 3:
                continue
            try:
                face = bm.faces.new([bv[i] for i in idx])
            except ValueError:
                continue
            face.material_index = mat
            for loop, uv in zip(face.loops, uvs):
                loop[uvl].uv = uv
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        for m in materials:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------- woven seat ----------------
def rounded_rect(a, b, r, n_x=14, n_y=12, n_arc=3):
    """CCW samples of a rounded rectangle, each segment tagged with its weave
    region (R, B, L, F). Corner arcs are split at 45 deg so the seams of the
    rush pattern run along mesh edges."""
    r = max(min(r, a - 1e-4, b - 1e-4), 0.0015)
    pts, reg = [], []

    def arc(cx, cy, a0, a1, tag):
        for i in range(n_arc):
            t = math.radians(lerp(a0, a1, i / n_arc))
            pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
            reg.append(tag)

    def line(p0, p1, n, tag):
        for i in range(n):
            pts.append((lerp(p0[0], p1[0], i / n), lerp(p0[1], p1[1], i / n)))
            reg.append(tag)

    line((a, -(b - r)), (a, b - r), n_y, "R")
    arc(a - r, b - r, 0, 45, "R")
    arc(a - r, b - r, 45, 90, "B")
    line((a - r, b), (-(a - r), b), n_x, "B")
    arc(-(a - r), b - r, 90, 135, "B")
    arc(-(a - r), b - r, 135, 180, "L")
    line((-a, b - r), (-a, -(b - r)), n_y, "L")
    arc(-(a - r), -(b - r), 180, 225, "L")
    arc(-(a - r), -(b - r), 225, 270, "F")
    line((-(a - r), -b), (a - r, -b), n_x, "F")
    arc(a - r, -(b - r), 270, 315, "F")
    arc(a - r, -(b - r), 315, 360, "R")
    return pts, reg


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def build_seat(B):
    o_in = SEAT_B - 0.004
    prof = []  # (offset from side wall, z, distance along cord from the top rim)
    n_top = 14
    for i in range(n_top + 1):
        o = lerp(o_in, RIM_R, i / n_top)
        prof.append((o, Z_TOP - SAG * smoothstep(RIM_R, o_in * 0.85, o), o))
    for i in range(1, 7):
        th = math.radians(90 * i / 6)
        prof.append((RIM_R - RIM_R * math.sin(th), Z_TOP - RIM_R + RIM_R * math.cos(th), -RIM_R * th))
    s_side = -RIM_R * math.pi / 2
    side_len = (Z_TOP - RIM_R) - (Z_BOT + BOT_R)
    prof.append((0.0, Z_BOT + BOT_R, s_side - side_len))
    s0 = s_side - side_len
    for i in range(1, 5):
        th = math.radians(90 * i / 4)
        prof.append((BOT_R - BOT_R * math.cos(th), Z_BOT + BOT_R - BOT_R * math.sin(th), s0 - BOT_R * th))
    s1 = s0 - BOT_R * math.pi / 2
    for i in range(1, 9):
        o = lerp(BOT_R, o_in, i / 8)
        prof.append((o, Z_BOT, s1 - (o - BOT_R)))

    rings, regs = [], None
    for o, z, s in prof:
        pts, reg = rounded_rect(SEAT_A - o, SEAT_B - o, SEAT_RC - o)
        regs = reg
        rings.append([(B.v((x, y, z)), x, y, s) for x, y in pts])
    n = len(regs)

    def uv(region, x, y, s):
        u = x if region in "FB" else y
        return (u / RUSH_TILE, s / RUSH_TILE)

    for k in range(len(rings) - 1):
        r0, r1 = rings[k], rings[k + 1]
        for j in range(n):
            jn = (j + 1) % n
            g = regs[j]
            q = [r0[j], r1[j], r1[jn], r0[jn]]
            B.f([p[0] for p in q], [uv(g, p[1], p[2], p[3]) for p in q], 1)

    # close the innermost top / bottom rings with fans
    for ring, z, s, flip in ((rings[0], prof[0][1], prof[0][2], False),
                             (rings[-1], prof[-1][1], prof[-1][2], True)):
        c = B.v((0.0, 0.0, z))
        for j in range(n):
            jn = (j + 1) % n
            g = regs[j]
            tri = [(c, 0.0, 0.0, s), ring[j], ring[jn]]
            if flip:
                tri.reverse()
            B.f([p[0] for p in tri], [uv(g, p[1], p[2], p[3]) for p in tri], 1)


# ---------------- turned wood parts ----------------
def build_leg(B, sx, sy, seg=24):
    def centre(z):
        t = z / LEG_H
        return (sx * lerp(LEG_FOOT[0], LEG_TOP[0], t), sy * lerp(LEG_FOOT[1], LEG_TOP[1], t))

    def radius(z):
        return lerp(LEG_R_FOOT, LEG_R_TOP, z / LEG_H)

    rings = []  # (z, r)
    rings.append((0.0, radius(0) - 0.003))
    rings.append((0.003, radius(0)))
    for i in range(1, 9):
        z = lerp(0.003, LEG_H, i / 8)
        rings.append((z, radius(z)))
    for i in range(1, 6):
        ph = math.radians(90 * i / 6)
        rings.append((LEG_H + CAP_H * math.sin(ph), radius(LEG_H) * math.cos(ph)))
    circ = 2 * math.pi * LEG_R_TOP

    grid = []
    for z, r in rings:
        cx, cy = centre(min(z, LEG_H))
        grid.append([B.v((cx + r * math.cos(2 * math.pi * j / seg),
                          cy + r * math.sin(2 * math.pi * j / seg), z)) for j in range(seg)])
    ox = 0.13 * (sx + 2) + 0.07 * (sy + 2)  # shift texture per leg
    for k in range(len(grid) - 1):
        for j in range(seg):
            jn = (j + 1) % seg
            u0, u1 = circ * j / seg, circ * (j + 1) / seg
            v0, v1 = rings[k][0], rings[k + 1][0]
            B.f([grid[k][j], grid[k][jn], grid[k + 1][jn], grid[k + 1][j]],
                [((u0 + ox) / WOOD_TILE, v0 / WOOD_TILE), ((u1 + ox) / WOOD_TILE, v0 / WOOD_TILE),
                 ((u1 + ox) / WOOD_TILE, v1 / WOOD_TILE), ((u0 + ox) / WOOD_TILE, v1 / WOOD_TILE)], 0)
    for ring, z, top in ((grid[0], 0.0, False), (grid[-1], rings[-1][0], True)):
        cx, cy = centre(min(z, LEG_H))
        c = B.v((cx, cy, LEG_H + CAP_H if top else z))
        for j in range(seg):
            jn = (j + 1) % seg
            a0, a1 = 2 * math.pi * j / seg, 2 * math.pi * jn / seg
            uvs = [(0.5 * 0.05, 0.5 * 0.05),
                   ((0.5 + 0.5 * math.cos(a0)) * 0.05, (0.5 + 0.5 * math.sin(a0)) * 0.05),
                   ((0.5 + 0.5 * math.cos(a1)) * 0.05, (0.5 + 0.5 * math.sin(a1)) * 0.05)]
            B.f([c, ring[j], ring[jn]], uvs, 0)
    return centre


def build_rung(B, p0, p1, seg=16):
    ax = [p1[i] - p0[i] for i in range(3)]
    L = math.sqrt(sum(a * a for a in ax))
    d = [a / L for a in ax]
    up = (0, 0, 1)
    e1 = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
    n1 = math.sqrt(sum(a * a for a in e1))
    e1 = [a / n1 for a in e1]
    e2 = (d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0])
    circ = 2 * math.pi * RUNG_R
    ends = []
    for p in (p0, p1):
        ends.append([B.v([p[i] + RUNG_R * (math.cos(2 * math.pi * j / seg) * e1[i] +
                                            math.sin(2 * math.pi * j / seg) * e2[i]) for i in range(3)])
                     for j in range(seg)])
    for j in range(seg):
        jn = (j + 1) % seg
        u0, u1 = circ * j / seg / WOOD_TILE, circ * (j + 1) / seg / WOOD_TILE
        B.f([ends[0][j], ends[0][jn], ends[1][jn], ends[1][j]],
            [(u0, 0.2), (u1, 0.2), (u1, 0.2 + L / WOOD_TILE), (u0, 0.2 + L / WOOD_TILE)], 0)
    for ring in ends:  # caps are buried inside the legs
        B.f(ring, [(0.0, 0.0)] * seg, 0)


def build_apron(B, along_x, sign, inner_len, n=16):
    """Board under the seat with an arched lower edge."""
    z_top = Z_BOT + 0.004  # tucked into the seat underside, no coplanar faces
    off = (LEG_TOP[1] if along_x else LEG_TOP[0]) - 0.004
    tops, bots = [], []
    for side in (-1, 1):  # outer / inner face
        w = sign * (off + side * APRON_T / 2)
        t_row, b_row = [], []
        for i in range(n + 1):
            s = lerp(-inner_len, inner_len, i / n)
            depth = 0.038 + 0.026 * (s / inner_len) ** 2
            zb = Z_BOT - depth
            if along_x:
                t_row.append(B.v((s, w, z_top))); b_row.append(B.v((s, w, zb)))
            else:
                t_row.append(B.v((w, s, z_top))); b_row.append(B.v((w, s, zb)))
        tops.append(t_row); bots.append(b_row)

    def depth_at(i):
        s = lerp(-inner_len, inner_len, i / n)
        return Z_BOT - (0.038 + 0.026 * (s / inner_len) ** 2)

    def uvp(s, z):  # grain along the board
        return ((z + 0.31 * along_x) / WOOD_TILE, (s + 0.4) / WOOD_TILE)

    for i in range(n):
        s0, s1 = lerp(-inner_len, inner_len, i / n), lerp(-inner_len, inner_len, (i + 1) / n)
        for f in (0, 1):
            B.f([bots[f][i], bots[f][i + 1], tops[f][i + 1], tops[f][i]],
                [uvp(s0, depth_at(i)), uvp(s1, depth_at(i + 1)), uvp(s1, z_top), uvp(s0, z_top)], 0)
        B.f([bots[0][i], bots[1][i], bots[1][i + 1], bots[0][i + 1]],
            [uvp(s0, 0), uvp(s0, APRON_T), uvp(s1, APRON_T), uvp(s1, 0)], 0)
        B.f([tops[0][i], tops[0][i + 1], tops[1][i + 1], tops[1][i]],
            [uvp(s0, 0), uvp(s1, 0), uvp(s1, APRON_T), uvp(s0, APRON_T)], 0)
    for i in (0, n):
        B.f([tops[0][i], bots[0][i], bots[1][i], tops[1][i]],
            [uvp(0, 0), uvp(0, 0.05), uvp(0.02, 0.05), uvp(0.02, 0)], 0)


# ---------------- materials ----------------
def make_material(name, albedo, normal, rough, nstrength):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(TEX, albedo))
    nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    nimg = nt.nodes.new("ShaderNodeTexImage")
    nimg.image = bpy.data.images.load(os.path.join(TEX, normal))
    nimg.image.colorspace_settings.name = "Non-Color"
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = nstrength
    nt.links.new(nimg.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0

    wood = make_material("Stool_Wood", "Wood_Albedo.jpg", "Wood_Normal.png", 0.45, 0.4)
    rush = make_material("Stool_PaperCord", "Rush_Albedo.jpg", "Rush_Normal.png", 0.75, 1.0)

    B = Builder()
    build_seat(B)
    centres = {}
    for sx in (-1, 1):
        for sy in (-1, 1):
            centres[(sx, sy)] = build_leg(B, sx, sy)
    for sy in (-1, 1):  # front / back stretchers
        a, b = centres[(-1, sy)](RUNG_Z_FB), centres[(1, sy)](RUNG_Z_FB)
        build_rung(B, (a[0] + 0.008, a[1], RUNG_Z_FB), (b[0] - 0.008, b[1], RUNG_Z_FB))
    for sx in (-1, 1):  # side stretchers
        a, b = centres[(sx, -1)](RUNG_Z_LR), centres[(sx, 1)](RUNG_Z_LR)
        build_rung(B, (a[0], a[1] + 0.008, RUNG_Z_LR), (b[0], b[1] - 0.008, RUNG_Z_LR))
    for sgn in (-1, 1):
        build_apron(B, True, sgn, LEG_TOP[0])
        build_apron(B, False, sgn, LEG_TOP[1])

    ob = B.to_object("BarStool", [wood, rush])
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "BarStool.blend"))
    bpy.ops.export_scene.fbx(
        filepath=os.path.join(HERE, "BarStool.fbx"), use_selection=True,
        apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y",
        mesh_smooth_type="FACE", use_mesh_modifiers=True,
        path_mode="COPY", embed_textures=True)
    bpy.ops.wm.obj_export(
        filepath=os.path.join(HERE, "BarStool.obj"), export_selected_objects=True,
        forward_axis="NEGATIVE_Z", up_axis="Y", export_normals=True, export_uv=True,
        export_materials=True, path_mode="RELATIVE")

    me = ob.data
    xs = [v.co for v in me.vertices]
    print("verts", len(me.vertices), "faces", len(me.polygons))
    print("bbox x", min(c.x for c in xs), max(c.x for c in xs))
    print("bbox y", min(c.y for c in xs), max(c.y for c in xs))
    print("bbox z", min(c.z for c in xs), max(c.z for c in xs))


if __name__ == "__main__":
    main()
