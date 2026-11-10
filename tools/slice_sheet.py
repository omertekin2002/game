#!/usr/bin/env python3
"""Slice a transparent-background asset sheet into individual sprites.

Usage:
  python3 -I tools/slice_sheet.py SHEET.png OUT_DIR [--alpha 40] [--down 4] [--grow 3] [--min 2000]

Finds connected blobs in the alpha channel (on a downsampled mask so that
small gaps, e.g. a leaf floating next to a head, still merge), crops each blob
from the full-resolution sheet, cleans the faint AI "glow" halo, trims, and
writes OUT_DIR/part_XX.png plus OUT_DIR/_contact.png (numbered preview).
Parts are ordered row-by-row (top to bottom, then left to right).
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw


def clean_alpha(rgba, lo, hi=210):
    a = rgba[..., 3].astype(np.float32)
    a = np.clip((a - lo) / max(1.0, hi - lo), 0.0, 1.0) * 255.0
    out = rgba.copy()
    out[..., 3] = a.astype(np.uint8)
    return out


def label(mask):
    """4-connected component labelling (union-find, pure numpy/python)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    parent = [0]

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    nxt = 1
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if not row[x]:
                continue
            up = labels[y - 1, x] if y > 0 else 0
            left = labels[y, x - 1] if x > 0 else 0
            if up and left:
                ru, rl = find(up), find(left)
                labels[y, x] = min(ru, rl)
                if ru != rl:
                    parent[max(ru, rl)] = min(ru, rl)
            elif up or left:
                labels[y, x] = up or left
            else:
                parent.append(nxt)
                labels[y, x] = nxt
                nxt += 1
    lut = np.array([find(i) for i in range(len(parent))], dtype=np.int32)
    return lut[labels]


def dilate(mask, r):
    out = mask.copy()
    for _ in range(r):
        m = out.copy()
        m[1:, :] |= out[:-1, :]
        m[:-1, :] |= out[1:, :]
        m[:, 1:] |= out[:, :-1]
        m[:, :-1] |= out[:, 1:]
        out = m
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("out")
    ap.add_argument("--alpha", type=int, default=40, help="alpha below this becomes 0")
    ap.add_argument("--down", type=int, default=4)
    ap.add_argument("--grow", type=int, default=3)
    ap.add_argument("--min", type=int, default=2500, help="min blob area in full-res px")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    rgba = np.array(Image.open(args.sheet).convert("RGBA"))
    rgba = clean_alpha(rgba, args.alpha)
    full = rgba[..., 3] > 8

    d = args.down
    H, W = full.shape
    h, w = H // d, W // d
    small = full[: h * d, : w * d].reshape(h, d, w, d).any(axis=(1, 3))
    small = dilate(small, args.grow)
    lab = label(small)

    boxes = []
    for lid in np.unique(lab):
        if lid == 0:
            continue
        ys, xs = np.nonzero(lab == lid)
        y0, y1, x0, x1 = ys.min() * d, (ys.max() + 1) * d, xs.min() * d, (xs.max() + 1) * d
        region = full[y0:y1, x0:x1]
        if region.sum() < args.min:
            continue
        # restrict to pixels belonging to this blob only
        blob = np.kron((lab[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1] == lid), np.ones((d, d), bool))
        blob = blob[: y1 - y0, : x1 - x0]
        boxes.append((y0, y1, x0, x1, blob))

    # sort into rows: group by vertical centre
    boxes.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in boxes:
        cy = (b[0] + b[1]) / 2
        if cur and abs(cy - np.mean([(c[0] + c[1]) / 2 for c in cur])) > (b[1] - b[0]) * 0.5:
            rows.append(cur)
            cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[2])]

    previews = []
    for i, (y0, y1, x0, x1, blob) in enumerate(ordered):
        crop = rgba[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(blob, crop[..., 3], 0)
        im = Image.fromarray(crop)
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        path = os.path.join(args.out, f"part_{i:02d}.png")
        im.save(path)
        previews.append(im)
        print(f"part_{i:02d}: {im.size[0]}x{im.size[1]} at x={x0} y={y0}")

    # contact sheet
    if previews:
        th = 220
        tiles = []
        for im in previews:
            s = th / im.size[1]
            tiles.append(im.resize((max(1, int(im.size[0] * s)), th), Image.LANCZOS))
        cw = sum(t.size[0] + 20 for t in tiles) + 20
        cols_w = min(cw, 2400)
        # wrap
        x = y = 20
        pos = []
        rowh = th + 50
        for t in tiles:
            if x + t.size[0] > cols_w - 20 and x > 20:
                x = 20
                y += rowh
            pos.append((x, y))
            x += t.size[0] + 20
        sheet = Image.new("RGBA", (cols_w, y + rowh), (90, 140, 90, 255))
        dr = ImageDraw.Draw(sheet)
        for i, (t, p) in enumerate(zip(tiles, pos)):
            sheet.alpha_composite(t, (p[0], p[1] + 30))
            dr.text((p[0], p[1] + 5), str(i), fill=(255, 255, 255, 255))
        sheet.save(os.path.join(args.out, "_contact.png"))


if __name__ == "__main__":
    sys.exit(main())
