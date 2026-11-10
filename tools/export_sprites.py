#!/usr/bin/env python3
"""Export sliced parts as named, resized game sprites.

Usage:
  python3 -I tools/export_sprites.py SRC_DIR DEST_DIR part_00=hero_down:192 part_01=hero_up:192 ...

Each mapping is  <part name>=<sprite name>:<target height px>[:flip]
The sprite is trimmed, resized (Lanczos) to the target height (never upscaled),
padded with a 2px transparent border, and written as DEST_DIR/<sprite name>.png.
"""
import os
import sys

from PIL import Image, ImageOps


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    src, dest = argv[0], argv[1]
    os.makedirs(dest, exist_ok=True)
    for spec in argv[2:]:
        part, rest = spec.split("=", 1)
        bits = rest.split(":")
        name, h = bits[0], int(bits[1])
        flip = len(bits) > 2 and bits[2] == "flip"
        im = Image.open(os.path.join(src, part + ".png")).convert("RGBA")
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        if flip:
            im = ImageOps.mirror(im)
        if im.size[1] > h:
            w = max(1, round(im.size[0] * h / im.size[1]))
            im = im.resize((w, h), Image.LANCZOS)
        out = Image.new("RGBA", (im.size[0] + 4, im.size[1] + 4), (0, 0, 0, 0))
        out.alpha_composite(im, (2, 2))
        path = os.path.join(dest, name + ".png")
        out.save(path, optimize=True)
        print(f"{name}: {out.size[0]}x{out.size[1]} -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
