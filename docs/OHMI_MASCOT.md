# OHMI Mascot — Approved Visual Assets

## Status
User-approved **pixel-art mascot design**, authoritative for OHMI's Chrome extension UI. Approved here means the project's visual design has been selected by the project owner; it is not a statement about trademark registration, copyright clearance, or 3D mesh availability.

## Source files

- `assets/mascot/ohmi-pixel-front.png` — canonical standalone front-facing mascot for the floating companion, assistant panel, and introductory UI. Transparent RGBA PNG. Preserve this image and its proportions.
- `assets/mascot/ohmi-pixel-turnaround.png` — supporting reference sheet showing front, back, left side, right side, top, and bottom views. Transparent RGBA PNG. Use as consistency reference; do not use the whole sheet as the tiny floating mascot.

Do not treat these files as 3D mesh files or rigged animation assets; they are 2D pixel-art illustrations.

## Approved character identity

- Name: **OHMI** (not PIKO).
- A friendly, compact mint/turquoise electronics-themed robot in a distinctly pixel-art style.
- Cream face screen, black oval eyes, smiling mouth, pink cheeks.
- Two short antennae with round yellow tips; small teal arms and feet.
- Front chest: white **OHMI** lettering, circuit traces and gold pads, mini breadboard illustration with red/blue rail accents, resistor detail, green LED indicator, and teal dial.
- Left side: bold black **OHMI** marking as depicted in the turnaround reference.
- No colorful game-controller buttons or separate yellow quote/spark marks alongside the name.

## Rules for development

1. Use the exact approved PNG assets as the source of truth. Never generate a replacement mascot or reinterpret its appearance without explicit owner approval.
2. Maintain aspect ratio, transparent background and crisp pixel-art edges; avoid blur from inappropriate scaling. Use pixelated scaling where appropriate.
3. For the floating extension, display `ohmi-pixel-front.png`; never crop the face or antennae.
4. Use `ohmi-pixel-turnaround.png` only for design reference and later approved pose / animation planning.
5. Keep UI effects minimal, accessible and respectful of `prefers-reduced-motion`.
6. Derivative animations and expressions require owner review before being considered official assets.
7. The extension remains an independent educational companion; do not imply Autodesk endorsement.
