# Electronics workspace capability matrix

M4 local verification. The original Playground remains default; `/app/playground/electronics/` is experimental. These are software capabilities, not hardware certification.

| Capability | Available path and proof | Limits |
|---|---|---|
| Full component catalog | All 791 native entries / 349 types; native catalog plus searchable DOM picker with exact preset properties | Some items have pinouts only, not a numerical model; inspector names the native simulation model |
| Breadboard/schematic/PCB | Native linked views, explicit host view controls and measured active state | Technical canvas retains native rendering; PCB manufacture requires suitable board/routing/DRC work |
| Add, move and wire | Native canvas plus keyboard/touch DOM forms; connections in all three views | Native bridge budgets: 200 parts/800 wires; dynamic pin presets validated; no inference from pictures |
| Inspector | Native inspector plus DOM labels/property presets and coordinate entry | Advanced native layers, geometry and custom component work still use native UI |
| Arduino code | Native interpreter/editor plus DOM sketch field for Arduino types and existing code-bearing parts | Subset interpreter, not full MCU emulation, avr-gcc, external-library compatibility or hardware upload |
| Undo/redo | Same native history for DOM/native changes; existing import/open checkpoints retained | Unsaved work still needs private capture or download; cloud snapshots are explicit |
| Zoom and focused phone work | DOM zoom in/out/fit; explicit Focus canvas layout with return action and preserved runtime | Fit is explicit when resizing a previously zoomed design; no claim of physical-device gesture qualification |
| Simulation feedback | Actual native Run/Stop/view state; M3 historical four-second sample table | No blanket correctness badge; four seconds cannot establish arbitrary behavior or all hazards |
| Routing/DRC/layers | Original native menus remain available and unchanged | Native raster controls are not fully DOM/screen-reader equivalents |
| Exports | `.dez` and exact Arduino `.ino` through host; native SVG/BOM/netlist/SPICE/Gerber verified in regression | Gerber requires a PCB board; not an assertion of manufacturing readiness. Browser hardware/CLI/GitHub features differ from desktop |
| Private persistence | Account-bound API/RLS/revisions, native replacement identity and non-destructive legacy copies | Requires separately approved M2 migration rollout. Browser tests use synthetic Auth/PostgREST; real SQL tested independently |
| AI draft builder | One fixed strict-schema Groq 120B request, explicit action, request recovery, safe scratch compile | Mock-qualified only. Automatic scope: one Uno/battery, 1–8 LEDs with dedicated resistors, optional switch/breadboard; no repair loop/fallback |
| Accessibility | Labeled 44px DOM controls, keyboard forms, focused-dialog return, unsaved-edit guard, scoped axe, 16px phone fields and reduced motion | No whole-native-editor assistive-technology certification, physical touch or Safari verification |
| Themes/PWA | Existing light default/charcoal tokens, persistent switch, unchanged public-only worker | Engine is lazy-loaded on experimental route, not an offline-installed simulator guarantee |
| Student/backend safety | Existing auth/RLS/CSRF/account epochs and save provenance preserved; no credentials in iframe | Hosted deployment and live provider/free-tier qualification remain separate gates |

No catalog, simulator, routing, code interpreter or exporter module was replaced in React. The DOM tools call bounded existing native MCP operations over the same private MessageChannel. No native path/network tools were enabled.
