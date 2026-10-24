# OHMI Circuit Library: official Soft Voxel collection

Status: all three samples are owner-approved as the official visual direction. The collection now contains 20 illustrations integrated into a local Circuit Library. Generated 24 October 2026 with built-in image_gen. Production release still requires owner approval.

See [integration scope](INTEGRATION.md), [collection prompts and per-image provenance](collection.json), and [verification and screenshots](VERIFICATION.md). The original three approved PNGs below remain unchanged.

## Shared illustration system

Use all three owner-supplied references together: the resistor supplies silhouette and material clarity, the breadboard supplies isometric structure and repeated detail, and the Uno supplies recognizable board layout. Preserve OHMI's existing mascot, teal identity, PWA layout and functionality.

- One isolated component in 4:3 landscape framing, long axis running lower-left to upper-right.
- Orthographic isometric camera, approximately 30-degree elevation; no dramatic perspective.
- Warm cream background with mint ambient cast, upper-left soft key light, diffuse mint-gray contact shadows.
- Matte, faceted forms, small bevels, restrained stepped edges and clean repeated details. No noise, faces, scenic props or decorative text.
- Match apparent object occupancy, not real-world scale between a resistor and a board. Normalize bounds during eventual card integration.
- Keep color meaningful: resistor value bands, breadboard rail stripes, turquoise PCB, graphite packages and silver connectors.

## Review samples

### Resistor

![Resistor](samples/resistor.webp)

Two leads, tan axial body and red/red/brown/gold bands representing 220 ohms with 5% tolerance.

### Breadboard

![Breadboard](samples/breadboard.webp)

Empty breadboard with center channel, terminal fields and paired power-rail socket rows. The refinement adds the missing second rail row on each edge. Do not infer electrical connectivity from the render.

### Arduino Uno

![Arduino Uno](samples/arduino-uno.webp)

Turquoise board, USB Type-B socket, barrel power jack, DIP microcontroller, edge sockets and recognizable support components. The refinement removes an extra mounting hole and requests consistent pin counts. Artistic detail remains unsuitable for teaching exact pin positions or counts.

## Review and verification

The three candidates share the same prompt contract and all three reference inputs. Inspected generation outputs for framing, background, light, subject recognition and unwanted decorations. Breadboard and Uno received one focused correction pass. Exact socket and pin counts are not certified. These are recognition illustrations, not pinout diagrams or evidence of electrical safety.

Original PNG masters preserve generation provenance. WebP review copies are 1200 x 900; PNG masters are 1448 x 1086. Full generation prompts and refinement prompts are in [manifest.json](manifest.json). References are owner-supplied; no third-party asset was downloaded or copied from a reference site.

The initial sample checkpoint changed no runtime source. The subsequent authorized rollout adds only the Library, its navigation entry, content, diagrams and artwork. Backend, mascot, other feature source, worker cache policy and production configuration remain unchanged. Verification now includes image checks, typecheck, build and local browser tests.

## Approval boundary and handoff

The owner approved all three specific samples and authorized remaining illustrations plus Library integration. All 20 starter entries now have artwork, sourced recognition guidance, reference links and direct detail URLs. This is a starter collection, not verified coverage of the entire current Tinkercad catalog.

The rollout reuses all three approved renders as references for every new illustration. Local electrical diagrams show only reviewed schematic/topology relationships; exact wiring and package-specific pinouts link to separate trusted references. Future additions must keep the same contract, reference masters and per-image checks. Do not deploy without explicit owner approval.
