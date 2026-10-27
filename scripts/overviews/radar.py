"""Top-down radar picture of a Source map from its BSP (floors) and its
navigation mesh (where players can walk), with the calibration for gameWE.

usage: python3 -I radar.py <map.bsp> <map.nav or -> <out.png> <out.json> [<lower split>]
"""
import json
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, __import__("os").path.dirname(__file__))
from bsp import BLOCKS_PLAYER, CONTENTS_SLIME, CONTENTS_WATER, SURF_NODRAW, SURF_SKY, SURF_SKY2D, SURF_TRIGGER, Bsp  # noqa: E402

SIZE = 2048
REF = 1024


def read_nav(path):
    b = open(path, "rb").read()
    magic, version = struct.unpack_from("<II", b, 0)
    if magic != 0xFEEDFACE:
        raise ValueError("not a nav file")
    o = 8
    if version >= 10:
        o += 4  # subversion
    if version >= 4:
        o += 4  # bsp size
    if version >= 14:
        o += 1  # analyzed
    if version >= 5:
        (n,) = struct.unpack_from("<H", b, o)
        o += 2
        for _ in range(n):
            (ln,) = struct.unpack_from("<H", b, o)
            o += 2 + ln
        if version > 11:
            o += 1
    (count,) = struct.unpack_from("<I", b, o)
    o += 4
    areas = []
    custom = None
    for _ in range(count):
        o += 4  # id
        o += 1 if version <= 8 else (2 if version <= 12 else 4)
        nw = struct.unpack_from("<3f", b, o)
        se = struct.unpack_from("<3f", b, o + 12)
        nez, swz = struct.unpack_from("<2f", b, o + 24)
        o += 32
        areas.append((nw, se, nez, swz))
        for _d in range(4):
            (c,) = struct.unpack_from("<I", b, o)
            o += 4 + 4 * c
        c = b[o]
        o += 1 + c * (17 if version >= 2 else 12)
        if version < 15:
            c = b[o]
            o += 1 + 14 * c
        (c,) = struct.unpack_from("<I", b, o)
        o += 4
        for _e in range(c):
            o += 4 + 1 + 4 + 1
            sc = b[o]
            o += 1 + 5 * sc
        if version >= 5:
            o += 2
        for _d in range(2):
            (c,) = struct.unpack_from("<I", b, o)
            o += 4 + 4 * c
        if version >= 8:
            o += 8
        if version >= 11:
            o += 16
        if version >= 16:
            (c,) = struct.unpack_from("<I", b, o)
            o += 4 + 5 * c
            o += 4
        # Game-specific data may follow (CS:S: one byte); skip to where the
        # next area plausibly starts.
        if len(areas) < count:
            if custom is None:
                custom = _custom(b, o, version)
            o += custom
    return version, areas


def _plausible(b, o, version):
    att = 1 if version <= 8 else (2 if version <= 12 else 4)
    if o + 4 + att + 32 > len(b):
        return False
    aid = struct.unpack_from("<I", b, o)[0]
    c = struct.unpack_from("<8f", b, o + 4 + att)
    return 0 < aid < 10_000_000 and all(abs(v) < 65536 for v in c) and c[0] <= c[3] and c[1] <= c[4]


def _custom(b, o, version):
    for k in range(0, 16):
        if _plausible(b, o + k, version) and b[o + k + 3] == 0:
            return k
    raise ValueError("nav area layout not understood")


def nav_polys(areas):
    out = []
    for nw, se, nez, swz in areas:
        x0, y0, z0 = nw
        x1, y1, z1 = se
        out.append(np.array([[x0, y0, z0], [x1, y0, nez], [x1, y1, z1], [x0, y1, swz]]))
    return out


def floor_faces(bsp):
    m = bsp.models[0]
    polys = []
    for fi in range(m["ff"], m["ff"] + m["nf"]):
        f = bsp.faces[fi]
        ti = f["texinfo"]
        if ti < 0:
            continue
        flags = bsp.texinfo[ti]["flags"]
        if flags & (SURF_SKY | SURF_SKY2D | SURF_NODRAW | SURF_TRIGGER):
            continue
        name = bsp.texname(ti)
        if name.startswith("tools/") or "water" in name:
            continue
        if f["dispinfo"] >= 0:
            for t in bsp.disp_surface(fi):
                n = np.cross(t[1] - t[0], t[2] - t[0])
                ln = np.linalg.norm(n)
                if ln > 0 and abs(n[2]) / ln > 0.7:
                    polys.append(t)
            continue
        n = bsp.planes[f["plane"]]["n"] * (-1 if f["side"] else 1)
        if n[2] < 0.7:
            continue
        polys.append(bsp.face_polygon(fi).astype(np.float64))
    return polys


SPAWNS = ("info_player_", "info_player_teamspawn", "info_player_deathmatch", "info_player_start")


# Highest drop the walk takes: deeper falls kill (or lead off the map).
MAX_DROP = 400


def hurt_boxes(bsp):
    """Bounds of the trigger_hurt brushes (pits, the sea, the map's edge)."""
    out = []
    for e in bsp.entities:
        m = e.get("model", "")
        if e.get("classname") == "trigger_hurt" and m.startswith("*") and m[1:].isdigit() and int(m[1:]) < len(bsp.models):
            mm = bsp.models[int(m[1:])]
            o = np.zeros(3)
            if "origin" in e:
                try:
                    o = np.array([float(v) for v in e["origin"].split()])
                except ValueError:
                    pass
            out.append((mm["mins"] + o, mm["maxs"] + o))
    return out


# Brush entities that always stand in the way (invisible walls and the like).
WALLS = ("func_brush", "func_wall", "func_wall_toggle")


def wall_models(bsp):
    """(head node, origin) of the solid wall entities."""
    out = []
    for e in bsp.entities:
        m = e.get("model", "")
        if e.get("classname") not in WALLS or not (m.startswith("*") and m[1:].isdigit() and int(m[1:]) < len(bsp.models)):
            continue
        if e.get("Solidity") == "1" or e.get("StartDisabled") == "1":
            continue
        o = np.zeros(3)
        if "origin" in e:
            try:
                o = np.array([float(v) for v in e["origin"].split()])
            except ValueError:
                pass
        out.append((int(bsp.models[int(m[1:])]["head"]), o))
    return out


def blocked(bsp, walls, pts):
    """Points inside the world's or a wall entity's solid brushes."""
    b = (bsp.contents(pts) & BLOCKS_PLAYER) != 0
    for head, o in walls:
        b |= (bsp.contents(pts - o, head) & BLOCKS_PLAYER) != 0
    return b


def synth_nav(bsp, floors, cell=16.0):
    """Walkable cells without a navigation mesh: floor points with room for
    a player, reached from the spawn points by walking (steps up to 20
    units, jumps up to 44, drops up to MAX_DROP), not under water and not
    in a trigger_hurt. Returns squares like nav areas."""
    pts = []
    for poly in floors:
        # Newell's normal: faces often start with collinear vertices
        p0 = poly[0]
        nxt = np.roll(poly, -1, axis=0)
        n = np.array([np.sum((poly[:, 1] - nxt[:, 1]) * (poly[:, 2] + nxt[:, 2])), np.sum((poly[:, 2] - nxt[:, 2]) * (poly[:, 0] + nxt[:, 0])), np.sum((poly[:, 0] - nxt[:, 0]) * (poly[:, 1] + nxt[:, 1]))])
        if abs(n[2]) < 1e-6:
            continue
        x0, x1 = poly[:, 0].min(), poly[:, 0].max()
        y0, y1 = poly[:, 1].min(), poly[:, 1].max()
        xs = np.arange(np.floor(x0 / cell) * cell + cell / 2, x1, cell)
        ys = np.arange(np.floor(y0 / cell) * cell + cell / 2, y1, cell)
        if not len(xs) or not len(ys):
            continue
        gx, gy = np.meshgrid(xs, ys)
        gx, gy = gx.ravel(), gy.ravel()
        inside = np.ones(len(gx), dtype=bool)
        m = len(poly)
        # convex face (Source faces are convex): same side of every edge
        # (the turning direction from the normal, seen from above)
        sign = np.sign(n[2])
        for i in range(m):
            a, b = poly[i], poly[(i + 1) % m]
            c = (b[0] - a[0]) * (gy - a[1]) - (b[1] - a[1]) * (gx - a[0])
            inside &= c * sign >= -1e-6
        if not inside.any():
            continue
        gx, gy = gx[inside], gy[inside]
        gz = p0[2] - (n[0] * (gx - p0[0]) + n[1] * (gy - p0[1])) / n[2]
        pts.append(np.stack([gx, gy, gz], axis=1))
    if not pts:
        return []
    P = np.concatenate(pts)
    walls = wall_models(bsp)
    # room for a player: not in a wall at the feet, the waist and the head
    ok = np.ones(len(P), dtype=bool)
    for h in (8, 36, 64):
        ok &= ~blocked(bsp, walls, P + [0, 0, h])
    # not under water (sea, deep pools) and not in a trigger_hurt (death pits)
    ok &= (bsp.contents(P + [0, 0, 36]) & (CONTENTS_WATER | CONTENTS_SLIME)) == 0
    for lo, hi in hurt_boxes(bsp):
        ok &= ~np.all((P + [0, 0, 8] >= lo) & (P + [0, 0, 8] <= hi), axis=1)
    P = P[ok]
    # one point per cell and height (8 units)
    key = np.stack([np.floor(P[:, 0] / cell), np.floor(P[:, 1] / cell), np.round(P[:, 2] / 8)], axis=1).astype(np.int64)
    key, idx = np.unique(key, axis=0, return_index=True)
    P = P[idx]
    cols = {}
    for i, (cx, cy, _) in enumerate(key):
        cols.setdefault((int(cx), int(cy)), []).append(i)
    # wall between two neighbours: test the midpoint at waist height
    seeds = []
    for e in bsp.entities:
        if e.get("classname", "").startswith(SPAWNS) and "origin" in e:
            try:
                seeds.append(tuple(float(v) for v in e["origin"].split()))
            except ValueError:
                pass
    if not seeds:
        return []
    seen = np.zeros(len(P), dtype=bool)
    stack = []
    for sx, sy, sz in seeds:
        c = (int(np.floor(sx / cell)), int(np.floor(sy / cell)))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in cols.get((c[0] + dx, c[1] + dy), []):
                    if -80 < P[i, 2] - sz < 32 and not seen[i]:
                        seen[i] = True
                        stack.append(i)
    pending = {}
    while stack:
        nxt = []
        cand = []
        for i in stack:
            cx, cy = int(key[i, 0]), int(key[i, 1])
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                for j in cols.get((cx + dx, cy + dy), []):
                    if seen[j]:
                        continue
                    dz = P[j, 2] - P[i, 2]
                    if -MAX_DROP <= dz <= 44:
                        cand.append((i, j))
        if not cand:
            break
        a = np.array(cand)
        mid = (P[a[:, 0]] + P[a[:, 1]]) / 2
        top = np.maximum(P[a[:, 0], 2], P[a[:, 1], 2])
        q = np.stack([mid[:, 0], mid[:, 1], top + 40], axis=1)
        free = ~blocked(bsp, walls, q)
        for (i, j), f in zip(cand, free):
            if f and not seen[j]:
                seen[j] = True
                nxt.append(j)
        stack = nxt
    out = []
    h = cell / 2
    for x, y, z in P[seen]:
        out.append(np.array([[x - h, y + h, z], [x + h, y + h, z], [x + h, y - h, z], [x - h, y - h, z]]))
    return out


class Canvas:
    def __init__(self, minx, maxy, side):
        self.minx, self.maxy, self.side = minx, maxy, side
        self.k = SIZE / side
        self.z = np.full((SIZE, SIZE), -np.inf, dtype=np.float32)

    def px(self, p):
        return (p[:, 0] - self.minx) * self.k, (self.maxy - p[:, 1]) * self.k

    def fill(self, poly, z=None):
        x, y = self.px(poly)
        x0, y0 = int(max(0, np.floor(x.min()))), int(max(0, np.floor(y.min())))
        x1, y1 = int(min(SIZE - 1, np.ceil(x.max()))), int(min(SIZE - 1, np.ceil(y.max())))
        if x1 < x0 or y1 < y0:
            return
        m = Image.new("1", (x1 - x0 + 1, y1 - y0 + 1), 0)
        ImageDraw.Draw(m).polygon(list(zip(x - x0, y - y0)), fill=1, outline=1)
        mask = np.array(m, dtype=bool)
        zz = float(poly[:, 2].mean()) if z is None else z
        view = self.z[y0 : y1 + 1, x0 : x1 + 1]
        upd = mask & (view < zz)
        view[upd] = zz


def walkable_mask(canvas, navpolys):
    """Pixels covered by a nav area, with the area's height."""
    c = Canvas(canvas.minx, canvas.maxy, canvas.side)
    for p in sorted(navpolys, key=lambda p: p[:, 2].mean()):
        c.fill(p)
    return c.z


def draw(canvas, floors, navpolys):
    navz = walkable_mask(canvas, navpolys) if navpolys else None
    # Floor faces near a walkable nav area (same height within a step):
    # keeps the floors and leaves roofs and the void out.
    for p in sorted(floors, key=lambda p: p[:, 2].mean()):
        if navz is not None:
            x, y = canvas.px(p)
            xi = np.clip(np.r_[x, x.mean()].astype(int), 0, SIZE - 1)
            yi = np.clip(np.r_[y, y.mean()].astype(int), 0, SIZE - 1)
            nz = navz[yi, xi]
            zf = np.r_[p[:, 2], p[:, 2].mean()]
            if not np.any(np.isfinite(nz) & (np.abs(nz - zf) < 40)):
                continue
        canvas.fill(p)
    z = canvas.z
    if navz is not None:
        from scipy import ndimage

        walk = np.isfinite(navz)
        # Nav areas keep about a player's half width from the walls; the
        # floor faces reach the walls. Faces count up to ~48 units from a
        # walkable area, nav areas fill what the faces left open.
        near = ndimage.binary_dilation(walk, iterations=max(1, int(48 * canvas.k)))
        z[~near] = -np.inf
        gap = ~np.isfinite(z) & walk
        z[gap] = navz[gap]
    valid = np.isfinite(z)
    from scipy import ndimage

    # Smooth outline: close small gaps, drop specks, fill holes' heights from
    # the nearest floor.
    r = max(1, int(round(12 * canvas.k)))
    smooth = ndimage.binary_opening(ndimage.binary_closing(valid, iterations=r), iterations=max(1, r // 2))
    lab, n = ndimage.label(smooth)
    if n > 1:
        sizes = ndimage.sum(smooth, lab, range(1, n + 1))
        smooth &= np.isin(lab, 1 + np.nonzero(sizes >= (64 * canvas.k) ** 2)[0])
    idx = ndimage.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    z = z[idx[0], idx[1]]
    z[~smooth] = -np.inf
    valid = np.isfinite(z)
    zs = z[valid]
    lo, hi = np.percentile(zs, 2), np.percentile(zs, 98)
    t = np.clip((z - lo) / max(1.0, hi - lo), 0, 1)
    dark = np.array([38, 44, 60], dtype=np.float32)
    light = np.array([92, 102, 128], dtype=np.float32)
    rgb = dark[None, None, :] + (light - dark)[None, None, :] * t[..., None]
    img = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    img[..., :3] = rgb.astype(np.uint8)
    img[..., 3] = np.where(valid, 255, 0)
    # Outline of the playable area and lines at height steps.
    zf = np.where(valid, z, -1e9)
    step = np.zeros_like(valid)
    for dy, dx in ((0, 1), (1, 0)):
        a = zf[: SIZE - dy, : SIZE - dx]
        b = zf[dy:, dx:]
        d = np.abs(a - b) > 40
        step[: SIZE - dy, : SIZE - dx] |= d
    edge = valid & ~np.array(Image.fromarray(valid.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3)), dtype=bool)
    edge = np.array(Image.fromarray(edge.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)), dtype=bool)
    inner = step & valid & ~edge
    img[inner, :3] = (img[inner, :3] * 0.4 + 255 * 0.6).astype(np.uint8)
    img[edge] = (235, 238, 245, 255)
    return Image.fromarray(img, "RGBA")


def render(bsp_path, nav_path, out_png, out_json, split=None):
    bsp = Bsp(bsp_path)
    floors = floor_faces(bsp)
    navpolys = None
    if nav_path != "-":
        try:
            navpolys = nav_polys(read_nav(nav_path)[1])
        except Exception as e:  # another game's nav version: walk it instead
            print(f"nav unreadable ({e}), walking the map", file=sys.stderr)
    if navpolys is None:
        navpolys = synth_nav(bsp, floors)
    ref = np.concatenate(navpolys) if navpolys else np.concatenate(floors)
    minx, maxx = ref[:, 0].min(), ref[:, 0].max()
    miny, maxy = ref[:, 1].min(), ref[:, 1].max()
    side = max(maxx - minx, maxy - miny) * 1.08
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    canvas = Canvas(cx - side / 2, cy + side / 2, side)

    draw(canvas, floors, navpolys).save(out_png, optimize=True)
    cal = {"pos_x": round(float(canvas.minx), 2), "pos_y": round(float(canvas.maxy), 2), "scale": round(float(side / REF), 5)}
    if split is not None:
        low = lambda p: p[:, 2].mean() <= split  # noqa: E731
        lower = Canvas(canvas.minx, canvas.maxy, side)
        draw(lower, [p for p in floors if low(p)], [p for p in navpolys if low(p)]).save(out_png.replace(".png", "_lower.png"), optimize=True)
        cal["lower_split"] = split
    cal["source"] = "generated by gameWE from the map file"
    json.dump(cal, open(out_json, "w"))
    open(out_json, "a").write("\n")
    return cal


if __name__ == "__main__":
    print(render(*sys.argv[1:5], split=float(sys.argv[5]) if len(sys.argv) > 5 else None))
