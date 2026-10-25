"""Key the owner's video without changing opaque mascot pixels; requires OpenCV/Pillow/numpy and ffmpeg."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image

source = Path(sys.argv[1])
output = Path(__file__).resolve().parents[2] / "public/animations/dashboard-ohmi.webm"
frames = []
capture = cv2.VideoCapture(str(source))
assert capture.get(cv2.CAP_PROP_FPS) == 24
while True:
    ok, bgr = capture.read()
    if not ok:
        break
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    red, green, blue = rgb.transpose(2, 0, 1)
    key = ((green > red * 1.5) & (green > blue * 1.7)).astype(np.uint8)
    _, regions = cv2.connectedComponents(key)
    background = regions == regions[0, 0]
    # Only the border-connected green is removed; green LEDs inside OHMI stay opaque.
    foreground = (~background).astype(np.uint8)
    interior = cv2.erode(foreground, np.ones((5, 5), np.uint8))
    _, nearest = cv2.distanceTransformWithLabels(1 - interior, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    colors = rgb[interior > 0]
    estimated = colors[nearest - 1]
    backdrop = np.median(rgb[:100, :100].reshape(-1, 3), axis=0)
    direction = estimated - backdrop
    alpha = np.clip(((rgb - backdrop) * direction).sum(2) / np.maximum((direction * direction).sum(2), 1), 0, 1)
    alpha[background] = 0
    alpha[interior > 0] = 1
    clean = np.clip((rgb - (1 - alpha[..., None]) * backdrop) / np.maximum(alpha[..., None], .01), 0, 255)
    clean[alpha == 0] = 0
    rgba = np.dstack((clean, alpha * 255)).astype(np.uint8)
    # Fixed motion envelope, centered on the resting pose, never a per-frame crop.
    frames.append(np.array(Image.fromarray(rgba[120:1020, 484:1384]).resize((600, 600), Image.Resampling.LANCZOS)))
capture.release()
assert len(frames) == 96
# Close the small source seam with four premultiplied-alpha frames, keeping four seconds.
first = frames[0].astype(np.float32) / 255
for index in range(92, 96):
    amount = (index - 91) / 4
    last = frames[index].astype(np.float32) / 255
    alpha = (1 - amount) * last[..., 3:] + amount * first[..., 3:]
    color = ((1 - amount) * last[..., :3] * last[..., 3:] + amount * first[..., :3] * first[..., 3:]) / np.maximum(alpha, .00001)
    frames[index] = (np.clip(np.concatenate((color, alpha), 2), 0, 1) * 255).astype(np.uint8)
with tempfile.TemporaryDirectory(prefix="ohmi-alpha-") as directory:
    for index, frame in enumerate(frames):
        Image.fromarray(frame).save(Path(directory) / f"{index:03d}.png")
    master = Path(directory) / "master.webm"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-framerate", "24", "-i", str(Path(directory) / "%03d.png"), "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "28", "-deadline", "good", "-cpu-used", "3", "-auto-alt-ref", "0", "-map_metadata", "-1", "-y", str(master)], check=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-c:v", "libvpx-vp9", "-i", str(master), "-vf", "scale=480:480", "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "34", "-deadline", "good", "-cpu-used", "3", "-auto-alt-ref", "0", "-map_metadata", "-1", "-y", str(output)], check=True)
print(json.dumps({"source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "output_sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "bytes": output.stat().st_size, "frames": len(frames), "seconds": 4, "size": [480, 480]}))
