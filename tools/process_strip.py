#!/usr/bin/env python3
"""Turn a sprite-sheet grid (e.g. AutoSprite output) into a game animation strip.

Usage:
  python3 -I tools/process_strip.py SHEET.png OUT.png --fw 256 --fh 256 [--frames N] [--height 200] [--alpha 40] [--flip]

Splits the sheet into fw x fh cells (row-major), drops empty cells, trims all
frames to their *common* bounding box (so the character doesn't jitter), scales
to --height, and writes a horizontal strip of equal-width frames. Also writes
OUT_preview.png (frames on a green background) for eyeballing.
"""
import argparse

import numpy as np
from PIL import Image, ImageOps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("out")
    ap.add_argument("--fw", type=int, required=True)
    ap.add_argument("--fh", type=int, required=True)
    ap.add_argument("--frames", type=int, default=0)
    ap.add_argument("--height", type=int, default=200)
    ap.add_argument("--alpha", type=int, default=40)
    ap.add_argument("--flip", action="store_true")
    args = ap.parse_args()

    sheet = Image.open(args.sheet).convert("RGBA")
    cols, rows = sheet.size[0] // args.fw, sheet.size[1] // args.fh
    frames = []
    for r in range(rows):
        for c in range(cols):
            f = sheet.crop((c * args.fw, r * args.fh, (c + 1) * args.fw, (r + 1) * args.fh))
            a = np.array(f)
            al = a[..., 3].astype(np.float32)
            al = np.clip((al - args.alpha) / max(1, 210 - args.alpha), 0, 1) * 255
            a[..., 3] = al.astype(np.uint8)
            f = Image.fromarray(a)
            if f.getbbox() is None:
                continue
            frames.append(f)
    if args.frames:
        frames = frames[: args.frames]
    if not frames:
        raise SystemExit("no frames found")

    boxes = [f.getbbox() for f in frames]
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    frames = [f.crop((x0, y0, x1, y1)) for f in frames]
    if args.flip:
        frames = [ImageOps.mirror(f) for f in frames]
    w, h = frames[0].size
    s = min(1.0, args.height / h)
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    frames = [f.resize((nw, nh), Image.LANCZOS) for f in frames]
    pad = 2
    fw = nw + pad * 2
    strip = Image.new("RGBA", (fw * len(frames), nh + pad * 2), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.alpha_composite(f, (i * fw + pad, pad))
    strip.save(args.out, optimize=True)
    prev = Image.new("RGBA", strip.size, (90, 140, 90, 255))
    prev.alpha_composite(strip)
    prev.save(args.out.replace(".png", "_preview.png"))
    print(f"{args.out}: {len(frames)} frames of {fw}x{nh + pad * 2}")


if __name__ == "__main__":
    main()
