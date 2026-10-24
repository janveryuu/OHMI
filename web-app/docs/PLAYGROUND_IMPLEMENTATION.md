# OHMI Playground implementation ledger

Approved scope: the supplied Playground prompt plus final quality requirements. M0-M6 run continuously. Existing PWA and production data stay intact.

Architecture: reuse Next/React, semantic OHMI tokens, Lucide, approved Library soft-voxel assets and exact mascot. Native pointer events and terminal buttons operate a snapped 1000x640 workspace. Wires join named terminals. A pure deterministic engine evaluates one DC source, one red LED, series resistors and optional ideal switches. Branches, multiple supplies/LEDs, AC, Arduino, buzzer, potentiometer and breadboard connectivity are unsupported. Red LED model: 2 V forward drop, 20 mA ceiling; resistors rated 0.25 W; source 1.5-12 V. Results are educational estimates, never physical verification.

Alternatives: a general simulator adds unsupported scope/dependencies; decorative wires cannot meet correctness. Use a bounded series graph and explicit unsupported states.

Files: components/playground.tsx (workbench), lib/playground/{model,engine,missions,history}.ts (pure state/rules), app/playground/page.tsx (route), app/api/playground/route.ts (authenticated CRUD), additive ohmi_playground_projects table with owner RLS, tests/playground* (unit/browser). Navigation gets one new destination. Library links reuse existing route.

- [x] M0: source discovery and constraints. Base origin/codex/ohmi-web-app-pwa 426ab8a. Primary dirty extension checkout untouched. Existing backend and hosted RLS inspected. New isolated worktree codex/ohmi-playground.
- [x] M1: responsive shell, tray/canvas/inspector/helper, existing light/dark tokens. Verify typecheck/render.
- [x] M2: terminal model, snapping, place/move/select/delete, wiring, keyboard alternatives, pan/zoom, bounded undo/redo. Verify state and browser operations.
- [x] M3: deterministic graph validation with supported/unsupported/safety cases. Verify unit matrix and numeric limits.
- [x] M4: three missions, progressive hints, deterministic completion, switch on/off observations. Verify false success is rejected.
- [x] M5: private authenticated CRUD with optimistic revisions, account-change guards; structured contextual help through existing AI. Verify two-account allow/deny and reopen/edit/delete. No credentials or student contents in evidence.
- [x] M6: all unit/type/build gates; desktop/mobile/light/dark/axe; regression suite. Capture screenshots, fresh independent review, batch fixes and confirm. Record limitations/rollback and remote commit.

Production gate: owner says deploy when finished, but also explicitly requires approval before production deployment. Prepare the verified release first, then request that specific sensitive approval. Do not trigger deployment by pushing the production branch prematurely. Additive schema is authorized; no destructive changes or paid services.

Design: Operate mode, incumbent visual world. Variance 4 / motion 3 / density 5. Library assets carry visual interest; geometry and terminal labels communicate the electrical model. Existing Mobbin catalog provenance applies; detailed paid flows unavailable. Taste skill's landing-page-only rules do not govern this circuit editor. UI/UX search returned general flat tool guidance; incumbent tokens win. Impeccable reports old PRODUCT schema/design sidecar; unrelated repair deferred.

Final M6 result: functional/security/regression gates pass; the measured mobile LCP target remains unmet (4.1 s versus 2.5 s). See PLAYGROUND_VERIFICATION.md. No production frontend release has occurred.
