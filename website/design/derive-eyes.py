"""Derive masked eye layers from approved art; never change the original PNG.

Run from the repository root with Pillow. This is an asset-authoring tool,
not a production dependency. Each pupil retains its original pixels; masks
keep motion inside the original eye silhouette. Neutral gaze uses the PNG.
"""
from pathlib import Path
from hashlib import sha256
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[1] / "dist" / "assets"
source = Image.open(root / "ohmi.png").convert("RGBA")
assert sha256((root / "ohmi.png").read_bytes()).hexdigest() == "815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382"

for name, region in [("left", (430, 438, 530, 582)), ("right", (720, 438, 824, 582))]:
    dark = [(x, y) for y in range(region[1], region[3])
            for x in range(region[0], region[2]) if max(source.getpixel((x, y))[:3]) < 160]
    box = (min(x for x, y in dark), min(y for x, y in dark),
           max(x for x, y in dark) + 1, max(y for x, y in dark) + 1)
    # Include the source's antialiased fringe so moving pupils leave no stationary ghost edge.
    box = (box[0]-2, box[1]-2, box[2]+2, box[3]+2)
    pupil = source.crop(box)
    mask = Image.new("RGBA", pupil.size)
    face = Image.new("RGBA", pupil.size)
    for y in range(box[1], box[3]):
        row = [x for x, py in dark if py == y]
        if row:
            for x in range(min(row), max(row)+1):
                mask.putpixel((x-box[0],y-box[1]), (255,255,255,255))
        # Sample untouched cream screen beside each source row, not a flat paint color.
        a, b = source.getpixel((box[0] - 5, y)), source.getpixel((box[2] + 5, y))
        for x in range(box[0], box[2]):
            local = (x - box[0], y - box[1])
            t = (x - box[0] + 5) / (box[2] - box[0] + 10)
            face.putpixel(local, tuple(round(a[c] * (1-t) + b[c] * t) for c in range(3)) + (255,))
    mask = mask.filter(ImageFilter.MaxFilter(5))
    face.putalpha(mask.getchannel("A"))
    pupil.putalpha(mask.getchannel("A"))
    assert Image.composite(pupil, source.crop(box), mask.getchannel("A")).convert("RGB").tobytes() == source.crop(box).convert("RGB").tobytes()
    for kind, image in [("pupil", pupil), ("mask", mask), ("face", face)]:
        image.save(root / f"eye-{name}-{kind}.png", optimize=True)
    print(name, "source box", box, "CSS %", [round(v / 1254 * 100, 8) for v in (box[0], box[1], box[2]-box[0], box[3]-box[1])])
