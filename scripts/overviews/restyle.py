"""Redraw a radar picture in gameWE's own style: the playable area as a
height-shaded surface with a white outline, without the source's grid,
labels, textures and colours. The calibration stays that of the source.

usage: python3 -I restyle.py <in.jpg|png> <out.png> [<threshold>]
"""
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SIZE = 2048


def restyle(src, out, threshold=45):
    im = Image.open(src).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    lum = np.where(a[..., 3] > 32, lum, 0)
    lum = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.MedianFilter(5))).astype(np.float32)
    mask = lum > threshold
    # thin lines and letters out, small holes closed, specks dropped
    mask = ndimage.binary_opening(mask, iterations=4)
    mask = ndimage.binary_closing(mask, iterations=3)
    lab, n = ndimage.label(mask)
    if n:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        mask = np.isin(lab, 1 + np.nonzero(sizes >= (SIZE / 40) ** 2)[0])
    holes = ndimage.binary_fill_holes(mask) & ~mask
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        mask |= np.isin(hl, 1 + np.nonzero(hs < (SIZE / 100) ** 2)[0])
    # shading: the source's brightness, smoothed, as height
    v = ndimage.gaussian_filter(lum, 6)
    inside = v[mask]
    lo, hi = (np.percentile(inside, 5), np.percentile(inside, 95)) if inside.size else (0, 1)
    t = np.clip((v - lo) / max(1.0, hi - lo), 0, 1)
    dark = np.array([38, 44, 60], dtype=np.float32)
    light = np.array([92, 102, 128], dtype=np.float32)
    rgb = dark + (light - dark) * t[..., None]
    img = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    img[..., :3] = rgb.astype(np.uint8)
    img[..., 3] = np.where(mask, 255, 0)
    edge = mask & ~ndimage.binary_erosion(mask, iterations=1)
    edge = ndimage.binary_dilation(edge, iterations=2)
    img[edge] = (235, 238, 245, 255)
    Image.fromarray(img, "RGBA").save(out, optimize=True)


if __name__ == "__main__":
    restyle(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 45)
