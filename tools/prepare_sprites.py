#!/usr/bin/env python3
"""Turn raw character art into a game-ready sprite sheet.

Takes generated walk-cycle art (one sheet, or a folder of frames), and for every frame:
  1. optionally removes a flat background (white or sampled from the corners),
  2. crops to the visible pixels,
  3. scales ALL frames by one shared factor so the character never changes size,
  4. pins the feet to one baseline and centres the body horizontally,
then writes:
  <out>.png            sheet, rows = down, left, right, up; columns = frames
  <out>-preview.gif    every direction looping side by side, for checking the cycle
  <out>-guides.png     4x zoom with baseline/centre guides, for checking alignment
and prints a report that flags size jumps, baseline/centre drift and loop seams.

Examples
  python3 tools/prepare_sprites.py raw/hero.png --cols 4 --rows 4 --out assets/sprites/hero-walk
  python3 tools/prepare_sprites.py raw/dog_frames/ --cols 4 --rows 4 --bg white --out assets/sprites/pet-walk
  python3 tools/prepare_sprites.py raw/hero.png --cols 4 --rows 4 --order down,up,left,right --out ...
  python3 tools/prepare_sprites.py raw/hero_3dirs.png --cols 4 --rows 3 --order down,right,up --mirror-left --out ...
Requires Pillow (pip install pillow).
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

GAME_ORDER = ["down", "left", "right", "up"]


def load_frames(src, cols, rows):
    p = Path(src)
    if p.is_dir():
        files = sorted(f for f in p.iterdir() if f.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg"))
        if len(files) != cols * rows:
            sys.exit(f"{src}: found {len(files)} frames, expected cols*rows = {cols * rows} (sorted by file name, row by row)")
        return [Image.open(f).convert("RGBA") for f in files]
    sheet = Image.open(p).convert("RGBA")
    fw, fh = sheet.width / cols, sheet.height / rows
    return [
        sheet.crop((round(c * fw), round(r * fh), round((c + 1) * fw), round((r + 1) * fh)))
        for r in range(rows)
        for c in range(cols)
    ]


def remove_bg(img, mode, tol):
    if mode == "none":
        return img
    px = img.load()
    w, h = img.size
    if mode == "white":
        key = (255, 255, 255)
    else:  # auto: most common corner colour
        corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
        key = max(set(c[:3] for c in corners), key=lambda c: sum(1 for k in corners if k[:3] == c))
    out = img.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = op[x, y]
            d = max(abs(r - key[0]), abs(g - key[1]), abs(b - key[2]))
            if d <= tol:
                op[x, y] = (r, g, b, 0)
            elif d <= tol * 2:  # soften the fringe instead of leaving a halo
                op[x, y] = (r, g, b, int(a * (d - tol) / tol))
    return out


def visible_box(img, thr=12):
    alpha = img.getchannel("A").point(lambda v: 255 if v > thr else 0)
    return alpha.getbbox()


def mass_center_x(img):
    a = img.getchannel("A")
    w, h = a.size
    data = a.load()
    tot = sx = 0
    for y in range(h):
        for x in range(w):
            v = data[x, y]
            if v > 12:
                tot += v
                sx += x * v
    return sx / tot if tot else w / 2


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", help="sheet image, or a folder of frame images")
    ap.add_argument("--cols", type=int, required=True, help="frames per direction")
    ap.add_argument("--rows", type=int, required=True, help="directions in the source")
    ap.add_argument("--order", default="down,left,right,up", help="direction of each source row, top to bottom")
    ap.add_argument("--mirror-left", action="store_true", help="build the left row by flipping the right row")
    ap.add_argument("--mirror-right", action="store_true", help="build the right row by flipping the left row")
    ap.add_argument("--size", type=int, default=96, help="output frame size in px (square)")
    ap.add_argument("--fill", type=float, default=0.86, help="tallest frame height as a fraction of the cell")
    ap.add_argument("--foot", type=int, default=6, help="px between the feet and the bottom of the cell")
    ap.add_argument("--anchor", choices=["mass", "bbox"], default="mass", help="horizontal centring method")
    ap.add_argument("--bg", choices=["none", "white", "auto"], default="none", help="background to remove")
    ap.add_argument("--tol", type=int, default=18, help="background colour tolerance")
    ap.add_argument("--fps", type=int, default=8, help="preview speed")
    ap.add_argument("--out", required=True, help="output path without extension")
    a = ap.parse_args()

    order = [d.strip() for d in a.order.split(",")]
    if len(order) != a.rows or any(d not in GAME_ORDER for d in order):
        sys.exit(f"--order needs {a.rows} names from {GAME_ORDER}")
    frames = [remove_bg(f, a.bg, a.tol) for f in load_frames(a.src, a.cols, a.rows)]
    rows = {d: frames[i * a.cols:(i + 1) * a.cols] for i, d in enumerate(order)}
    if a.mirror_left and "right" in rows:
        rows["left"] = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in rows["right"]]
    if a.mirror_right and "left" in rows:
        rows["right"] = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in rows["left"]]
    missing = [d for d in GAME_ORDER if d not in rows]
    if missing:
        print(f"note: no art for {missing}; those rows reuse 'down' so the game still shows something")
        for d in missing:
            rows[d] = rows.get("down") or next(iter(rows.values()))

    crops = {}
    for d in GAME_ORDER:
        crops[d] = []
        for f in rows[d]:
            box = visible_box(f)
            if not box:
                sys.exit(f"empty frame in direction {d}; check --cols/--rows or --bg")
            crops[d].append(f.crop(box))
    tallest = max(c.height for d in GAME_ORDER for c in crops[d])
    widest = max(c.width for d in GAME_ORDER for c in crops[d])
    S = a.size
    scale = min(S * a.fill / tallest, (S - 4) / widest)

    sheet = Image.new("RGBA", (S * a.cols, S * 4), (0, 0, 0, 0))
    report = {"scale": round(scale, 4), "source_tallest_px": tallest, "rows": {}}
    warnings = []
    for r, d in enumerate(GAME_ORDER):
        info = []
        for c, crop in enumerate(crops[d]):
            img = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
            cx = mass_center_x(img) if a.anchor == "mass" else img.width / 2
            x = round(S / 2 - cx)
            y = S - a.foot - img.height
            sheet.alpha_composite(img, (c * S + x, r * S + y))
            info.append({"h": img.height, "w": img.width, "center_offset": round(cx - img.width / 2, 1)})
        hs = [i["h"] for i in info]
        if max(hs) - min(hs) > 0.12 * max(hs):
            warnings.append(f"{d}: frame heights vary {min(hs)}-{max(hs)}px; the source frames may be drawn at different sizes")
        report["rows"][d] = info

    # Loop seam check: the last->first step should look like any other step in the cycle.
    for r, d in enumerate(GAME_ORDER):
        cells = [sheet.crop((c * S, r * S, (c + 1) * S, (r + 1) * S)) for c in range(a.cols)]
        if a.cols < 3:
            continue
        diffs = []
        for i in range(a.cols):
            j = (i + 1) % a.cols
            diff = ImageChops.difference(cells[i], cells[j])
            diffs.append(sum(ImageStat.Stat(diff).mean))
        steps, seam = diffs[:-1], diffs[-1]
        med = sorted(steps)[len(steps) // 2]
        report["rows"][d] = {"frames": report["rows"][d], "step_diff": [round(x, 1) for x in diffs]}
        if med and seam > med * 1.8:
            warnings.append(f"{d}: loop seam — last frame to first frame jumps {seam / med:.1f}x more than other steps")
        if med and min(steps) < med * 0.15:
            warnings.append(f"{d}: two neighbouring frames are nearly identical (duplicate frame?)")

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out.with_suffix(".png"))

    # Preview GIF: four directions side by side on a light ground.
    gif = []
    for c in range(a.cols):
        canvas = Image.new("RGBA", (S * 4, S), (235, 244, 225, 255))
        for r in range(4):
            canvas.alpha_composite(sheet.crop((c * S, r * S, (c + 1) * S, (r + 1) * S)), (r * S, 0))
        gif.append(canvas.convert("P", palette=Image.ADAPTIVE))
    gif[0].save(str(out) + "-preview.gif", save_all=True, append_images=gif[1:], duration=int(1000 / a.fps), loop=0, disposal=2)

    Z = 4
    guide = Image.new("RGBA", sheet.size, (245, 245, 240, 255))
    guide.alpha_composite(sheet)
    guide = guide.resize((sheet.width * Z, sheet.height * Z), Image.NEAREST)
    g = ImageDraw.Draw(guide)
    for r in range(4):
        base = (r * S + S - a.foot) * Z
        g.line([(0, base), (guide.width, base)], fill=(230, 80, 80, 255), width=2)
    for c in range(a.cols):
        x = (c * S + S // 2) * Z
        g.line([(x, 0), (x, guide.height)], fill=(80, 120, 230, 255), width=1)
        g.rectangle([c * S * Z, 0, (c + 1) * S * Z - 1, guide.height - 1], outline=(180, 180, 180, 255))
    guide.save(str(out) + "-guides.png")

    print(json.dumps({"sheet": str(out.with_suffix(".png")), "frame": S, "cols": a.cols, "warnings": warnings, **report}, ensure_ascii=False, indent=1))
    print("\nmanifest entry:")
    print(json.dumps({"file": str(out.with_suffix(".png")), "frameW": S, "frameH": S}, ensure_ascii=False))


if __name__ == "__main__":
    main()
