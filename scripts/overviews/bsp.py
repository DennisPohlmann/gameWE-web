"""Minimal reader for Source (VBSP v19-21) map files: what a top-down radar needs."""
import lzma
import struct

import numpy as np

CONTENTS_SOLID = 0x1
CONTENTS_WINDOW = 0x2
CONTENTS_SLIME = 0x10
CONTENTS_WATER = 0x20
CONTENTS_GRATE = 0x8
CONTENTS_MOVEABLE = 0x4000
CONTENTS_PLAYERCLIP = 0x10000
CONTENTS_LADDER = 0x20000000
BLOCKS_PLAYER = CONTENTS_SOLID | CONTENTS_WINDOW | CONTENTS_GRATE | CONTENTS_PLAYERCLIP | CONTENTS_MOVEABLE

SURF_SKY2D = 0x2
SURF_SKY = 0x4
SURF_TRIGGER = 0x40
SURF_NODRAW = 0x80
SURF_SKIP = 0x200
SURF_HINT = 0x100


def _lzma(data):
    if data[:4] != b"LZMA":
        return data
    actual, _packed = struct.unpack_from("<II", data, 4)
    props = data[12:17]
    d = props[0]
    lc, lp, pb = d % 9, (d // 9) % 5, d // 45
    dict_size = struct.unpack_from("<I", props, 1)[0]
    dec = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[{"id": lzma.FILTER_LZMA1, "lc": lc, "lp": lp, "pb": pb, "dict_size": dict_size}])
    return dec.decompress(data[17:], actual)[:actual]


class Bsp:
    def __init__(self, path):
        raw = open(path, "rb").read()
        if raw[:4] != b"VBSP":
            raise ValueError("not a Source BSP")
        self.version = struct.unpack_from("<i", raw, 4)[0]
        if self.version not in (19, 20, 21):
            raise ValueError(f"BSP version {self.version}")
        self.lumps = []
        for i in range(64):
            ofs, ln, ver, cc = struct.unpack_from("<iii4s", raw, 8 + 16 * i)
            self.lumps.append(_lzma(raw[ofs : ofs + ln]))
        L = self.lumps
        self.planes = np.frombuffer(L[1], dtype=np.dtype([("n", "<f4", 3), ("d", "<f4"), ("t", "<i4")]))
        self.vertices = np.frombuffer(L[3], dtype="<f4").reshape(-1, 3)
        self.nodes = np.frombuffer(L[5], dtype=np.dtype([("plane", "<i4"), ("children", "<i4", 2), ("mins", "<i2", 3), ("maxs", "<i2", 3), ("ff", "<u2"), ("nf", "<u2"), ("area", "<i2"), ("pad", "<i2")]))
        self.texinfo = np.frombuffer(L[6], dtype=np.dtype([("tv", "<f4", 8), ("lv", "<f4", 8), ("flags", "<i4"), ("texdata", "<i4")]))
        self.faces = np.frombuffer(L[7], dtype=np.dtype([("plane", "<u2"), ("side", "u1"), ("onnode", "u1"), ("firstedge", "<i4"), ("numedges", "<i2"), ("texinfo", "<i2"), ("dispinfo", "<i2"), ("fog", "<i2"), ("styles", "u1", 4), ("lightofs", "<i4"), ("area", "<f4"), ("lmins", "<i4", 2), ("lsize", "<i4", 2), ("orig", "<i4"), ("nprims", "<u2"), ("fprim", "<u2"), ("smooth", "<u4")]))
        leaf_size = 56 if self.version == 19 else 32
        lraw = L[10]
        n = len(lraw) // leaf_size
        self.leaf_contents = np.array([struct.unpack_from("<i", lraw, i * leaf_size)[0] for i in range(n)], dtype=np.int64)
        self.edges = np.frombuffer(L[12], dtype="<u2").reshape(-1, 2)
        self.surfedges = np.frombuffer(L[13], dtype="<i4")
        self.models = np.frombuffer(L[14], dtype=np.dtype([("mins", "<f4", 3), ("maxs", "<f4", 3), ("origin", "<f4", 3), ("head", "<i4"), ("ff", "<i4"), ("nf", "<i4")]))
        self.texdata_name = np.frombuffer(L[2], dtype=np.dtype([("refl", "<f4", 3), ("name", "<i4"), ("w", "<i4"), ("h", "<i4"), ("vw", "<i4"), ("vh", "<i4")]))["name"]
        self.str_table = np.frombuffer(L[44], dtype="<i4")
        self.str_data = L[43]
        self.entities = parse_entities(L[0])
        # dispinfo: start position and power, with the vertices in lump 33
        self.dispinfo = L[26]
        self.dispverts = np.frombuffer(L[33], dtype=np.dtype([("vec", "<f4", 3), ("dist", "<f4"), ("alpha", "<f4")]))

    def texname(self, ti):
        td = self.texinfo[ti]["texdata"]
        if td < 0:
            return ""
        off = self.str_table[self.texdata_name[td]]
        end = self.str_data.index(b"\0", off)
        return self.str_data[off:end].decode("latin-1").lower()

    def face_polygon(self, fi):
        f = self.faces[fi]
        fe, ne = int(f["firstedge"]), int(f["numedges"])
        se = self.surfedges[fe : fe + ne]
        idx = np.where(se >= 0, self.edges[np.abs(se), 0], self.edges[np.abs(se), 1])
        return self.vertices[idx]

    def disp_surface(self, fi):
        """Triangles (n, 3, 3) of a displacement face."""
        f = self.faces[fi]
        di = int(f["dispinfo"])
        rec = 176
        start = struct.unpack_from("<3f", self.dispinfo, di * rec)
        first_vert = struct.unpack_from("<i", self.dispinfo, di * rec + 12)[0]
        power = struct.unpack_from("<i", self.dispinfo, di * rec + 20)[0]
        corners = self.face_polygon(fi)
        if len(corners) != 4:
            return np.zeros((0, 3, 3))
        # rotate so corner 0 is the start position
        k = int(np.argmin(np.linalg.norm(corners - np.array(start), axis=1)))
        c = np.roll(corners, -k, axis=0)
        n = (1 << power) + 1
        dv = self.dispverts[first_vert : first_vert + n * n]
        pts = np.zeros((n, n, 3))
        for i in range(n):
            t = i / (n - 1)
            a = c[0] + (c[1] - c[0]) * t
            b = c[3] + (c[2] - c[3]) * t
            for j in range(n):
                s = j / (n - 1)
                p = a + (b - a) * s
                v = dv[i * n + j] if i * n + j < len(dv) else None
                if v is not None:
                    p = p + v["vec"] * v["dist"]
                pts[j, i] = p
        tris = []
        for i in range(n - 1):
            for j in range(n - 1):
                tris.append([pts[i, j], pts[i + 1, j], pts[i + 1, j + 1]])
                tris.append([pts[i, j], pts[i + 1, j + 1], pts[i, j + 1]])
        return np.array(tris)

    def contents(self, pts, head=None):
        """Leaf contents at each point (n, 3), through the world BSP tree (or
        the tree of a brush model, from its head node)."""
        pts = np.asarray(pts, dtype=np.float64)
        node = np.full(len(pts), self.models[0]["head"] if head is None else head, dtype=np.int64)
        normals = self.planes["n"].astype(np.float64)
        dists = self.planes["d"].astype(np.float64)
        planes_of = self.nodes["plane"].astype(np.int64)
        children = self.nodes["children"].astype(np.int64)
        active = node >= 0
        while active.any():
            idx = np.nonzero(active)[0]
            nd = node[idx]
            pl = planes_of[nd]
            side = (np.einsum("ij,ij->i", pts[idx], normals[pl]) - dists[pl]) < 0
            node[idx] = children[nd, side.astype(np.int64)]
            active = node >= 0
        leaf = -node - 1
        return self.leaf_contents[leaf]


def parse_entities(raw):
    text = raw.split(b"\0", 1)[0].decode("latin-1")
    ents, cur = [], None
    i = 0
    import re

    for m in re.finditer(r'\{|\}|"((?:[^"\\]|\\.)*)"', text):
        tok = m.group(0)
        if tok == "{":
            cur, key = {}, None
        elif tok == "}":
            if cur is not None:
                ents.append(cur)
            cur = None
        elif cur is not None:
            s = m.group(1)
            if key is None:
                key = s
            else:
                cur.setdefault(key, s)
                key = None
    return ents
