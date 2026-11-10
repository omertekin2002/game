#!/usr/bin/env python3
"""Make a texture seamlessly tileable.

Usage:
  python3 -I tools/make_seamless.py IN.png OUT.png [--size 512] [--band 0.22]

Per axis: blend the image with a half-period rolled copy of itself, weighting
the rolled copy near the edges (where it is continuous across the wrap) and the
original in the middle (hiding the rolled copy's seam). Blending is
variance-preserving so the overlap zone doesn't look washed out.
"""
import argparse

import numpy as np
from PIL import Image


def weights(n, band):
    d = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n * band)
    t = np.clip(d, 0, 1)
    return t * t * (3 - 2 * t)  # smoothstep: 0 at the edges, 1 inside


def blend_axis(img, axis, band):
    n = img.shape[axis]
    rolled = np.roll(img, n // 2, axis=axis)
    w = weights(n, band)
    shape = [1, 1, 1]
    shape[axis] = n
    w = w.reshape(shape)
    mean = img.mean(axis=(0, 1), keepdims=True)
    a, b = img - mean, rolled - mean
    norm = np.sqrt(w * w + (1 - w) ** 2)
    return (a * w + b * (1 - w)) / norm + mean


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--band", type=float, default=0.22)
    args = ap.parse_args()

    im = Image.open(args.inp).convert("RGB")
    s = min(im.size)
    im = im.crop(((im.size[0] - s) // 2, (im.size[1] - s) // 2, (im.size[0] + s) // 2, (im.size[1] + s) // 2))
    im = im.resize((args.size, args.size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a = blend_axis(a, 1, args.band)
    a = blend_axis(a, 0, args.band)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(args.out, optimize=True)
    print(args.out)


if __name__ == "__main__":
    main()
