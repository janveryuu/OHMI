# Playground upgrade: file-level implementation plan

Status: **M0 and approved M1 complete locally; see M1.md for evidence. M2 not approved.** This plan covers the owner's attached major Playground/AI-builder brief. It does not authorize push, deployment, hosted migrations, provider changes or paid work. Existing `AGENTS.md` requires reviewing each phase with the owner before starting the next. The current brief separately prohibits push/deployment/production-infrastructure changes without owner approval.

## Design and architecture decision

Reading this as: an electronics workspace for students, with OHMI's restrained Apple-inspired language and an Operate-first interface. Preserve Geist, existing Radix/Lucide controls, light default, charcoal dark mode, mint accents and the exact canonical mascot. Working dials: design variance 4, motion 3, density 6. This is a preserve-and-expand product interface, not a marketing-page redesign. Design Taste's dense-tool exclusion applies; do not import its hero or feature-grid rules into a circuit editor.

Use an OHMI React shell around a locally hosted, pinned designElectronics WASM editor. Keep upstream simulation, catalog, wiring, three views, code interpreter and exporters. Native Theme/presentation changes are narrow and maintained as an explicit patch. No new application framework, desktop proxy, remote MCP service, general-purpose code execution service or paid infrastructure.

```text
Ask OHMI explicit Build action
    authenticated same-origin build API
    server-owned Groq 120B planner, one bounded request
    strict circuit-spec + catalog/pin/electrical validation
    new draft; no overwrite of active/saved student work
    capability-scoped browser MessageChannel
    existing upstream McpSession on the live C++ document
    same engine for observations, undo, .dez snapshots and exports
    private owner-scoped save with revision conflict handling
```

## M1: pinned engine and browser contract, local only

**Files**

- `third_party/design-electronics/`: pin source commit, MIT/font/dependency notices, a small OHMI browser-bridge/presentation patch, and a lock manifest. Preserve upstream module boundaries. Do not vendor downloaded binaries as though they were a source build.
- `scripts/build-design-electronics.ps1`: workspace-local Emscripten 5.0.7/CMake/SDL build from pinned commits; record compiler/dependency versions and output hashes. No machine-wide install or production configuration edits.
- `web-app/public/vendor/design-electronics/`: built `.wasm`, `.js`, font data, controlled loader and license notices. Versioned assets; lazy load on the new route only.
- Native patch in `src/web.cpp`, `src/ui.h`/presentation code and `CMakeLists.txt`: expose bounded document/tool/simulation/theme calls through `McpSession(&doc)` and existing undo hooks. Keep `sim.cpp`, `arduino.cpp`, routing and exporters unchanged unless a demonstrated upstream defect forces a separately reviewed fix.
- `web-app/src/lib/playground/bridge.ts`: versioned MessageChannel protocol, bounded payloads, request IDs, deadlines, duplicate rejection, nonce and frame/source binding. No arbitrary tool, path, URL or shell dispatch.
- `web-app/src/app/playground/electronics/page.tsx`, `web-app/src/components/electronics-workspace.tsx`: isolated experimental route, clear engine-ready/error/retry states, safe fallback link, minimal accessible controls. Current `/playground/` remains the default.
- `web-app/next.config.ts`: narrowly scoped static WASM MIME/cache/CORS/CSP headers. Do not introduce global COOP/COEP that could break OAuth.

**Isolation**

Start with a sandboxed engine iframe (`allow-scripts allow-downloads`, no same-origin, popup or top-navigation capability). Public vendor resources need the specific CORS policy required by an opaque-origin frame. Bind initialization to the exact frame instance and per-load capability, then transfer a MessagePort; do not trust `event.origin === "null"` as authentication. The frame receives only the current explicit document, never cookies, provider keys or Supabase tokens. Its loader permits only its pinned local resources, with no arbitrary `#src=` fetch. Use the same channel in tests to prove unrelated frames cannot mutate a document.

**Gate**

Rebuild from the pinned source; explain and resolve the current published-WASM self-test abort with a diagnostic build. Full native tests and a platform-appropriate browser test entry must have truthful, separate outcomes. Prove catalog retention/version, add/move/wire/edit code, undo/redo, all three views, snapshot/import and browser-supported exports. Capture an observable timeline for A/B using the same simulator instance during each run. This gate is local, deterministic and requires no AI or hosted writes.

## M2: non-destructive persistence and legacy compatibility

**Files**

- `web-app/src/lib/playground/electronics-document.ts`: strict bounded `.dez` envelope/version/type/pin/reference/number validation; reject truncation, duplicate IDs, dangling wires, excessive geometry and invalid code sizes. Keep custom-part support explicit and bounded; no silent catalog filtering.
- `web-app/src/lib/playground/legacy-conversion.ts`: verified mapping from `evidence/legacy-part-map.json`, units/layout conversion, source provenance and untouched legacy metadata. Convert to new IDs/copies only.
- New additive migration created through `supabase migration new`: `ohmi_electronics_projects` with owner, revision, bounded document, engine version and optional legacy source ID/revision. Separate table avoids weakening or confusing the existing 64-KiB schema/client. Proposed initial document budget 1 MiB, to be confirmed by M1 measurements; show an explicit limit error rather than dropping parts.
- `web-app/src/app/api/playground/projects/route.ts` and existing database type definitions: authenticated owner-scoped CRUD, same-origin checks, bounded streaming input, no-store responses and optimistic revision conflicts. Reuse existing API error helpers and account epoch patterns.
- `web-app/src/lib/playground/use-electronics-project.ts`: clear private state and destroy/recreate the engine on logout/account change; discard stale async responses; no cross-account browser autosave restore.
- `supabase/tests/electronics_projects_rls.sql` and focused compatibility/API tests.

**Gate**

Local database rehearsal: anonymous denial, A/B isolation, insert/update ownership, stale save conflict, unchanged legacy row checksums, all four old component kinds/states, unsupported-data rejection, save/reopen/edit/export and rollback. Preserve legacy missions/hints/completion. Hosted migration requires separate owner approval; do not read or rewrite real student records for testing.

## M3: bounded AI-to-workspace workflow

**Files**

- `web-app/src/lib/playground/circuit-spec.ts`: versioned concise specification for part IDs, values, pin connections, placements and Arduino sketch. Use catalog-derived pin/type validation; model output never supplies executable JS, HTML, filesystem paths or SVG libraries.
- `supabase/functions/ohmi-ai/circuit-builder.ts`: reuse Groq transport/error/abort helpers with server-fixed `openai/gpt-oss-120b`. Keep this separate from `answerChat` so current fallback behavior is not silently inherited. Use one request per explicit action, finite output/body/deadline limits, 429 backoff feedback and existing idempotent ownership machinery. No autonomous repair loop or hidden provider fallback.
- `supabase/functions/ohmi-ai/contracts.ts`, `handler.ts` and web proxy validation: register the new structured operation without altering existing chat/media behavior. Reuse request ownership and replay protections; inspect existing SQL/RPC operation restrictions before any change.
- `web-app/src/app/api/playground/build/route.ts`: authenticated same-origin validation, limited catalog context, one bounded planner request, safe errors and recoverable request IDs. No credentials in the browser.
- `web-app/src/components/chat.tsx`, existing message/result contract and workspace shell: explicit Build action, immediate pending/cancel/error feedback, preserve unrelated drafts and hand off a new validated draft. Never overwrite the active project. No brittle phrase-only auto-execution of arbitrary chat text.
- Bridge application: validate fully, construct in a scratch document, run deterministic checks, atomically open the new editable draft and retain recovery/undo. Engine observations are separate from the model's narrative.
- `.ino` download from each board's exact full sketch; `.dez` and existing engine exporters retained. No Tinkercad verification claim.

**Budget gate**

Confirm the actual Groq account is on the free tier and identify organization limits before any live request. Confirmation-secret names alone are insufficient. Initially qualify the complete path with mocked provider responses and deterministic fixtures. Live qualification is bounded to the two synthetic acceptance cases only after the free-tier gate is satisfied. Optional Gemini visual analysis is deferred until its own free-tier/data-use gate is satisfied and the student explicitly requests it; planning does not depend on it. Do not restore unrelated quotas, change global provider routing or enable billing.

**Gate**

Tests A/B pass end to end in the **OHMI browser integration**, including planning response, deterministic rejection cases, new editable project, same-run time samples, sketch, save/reopen/edit/export. Also test truncated/malformed JSON, unsupported component/pin/library, excessive current/shorts, prompt injection, cancellation, timeout, duplicate replay, logout and two-account isolation. Native M0 evidence is not a substitute.

## M4: presentation, mobile and release review

- Refine only the OHMI shell and upstream native Theme/presentation patch. Preserve every supported simulator control; full engine catalog/search, three views, routing/DRC, code and export remain reachable. Do not hide unsupported behavior behind a success state.
- Desktop: compact toolbar, large canvas, parts/inspector with explicit panel controls and visible simulation state. Phone: canvas first, parts/inspector sheets, touch-safe actions and an accessible DOM alternative to drag-only placement/wiring. Keep keyboard navigation, visible labels, 44-pixel targets and zoom access. Inspect concrete editor/mobile references before finalizing this surface; do not claim inaccessible catalog screenshots were reviewed.
- Read Impeccable craft floor immediately before UI edits. Use one batched desktop/mobile/theme review and at most one confirmation round before its scoped finish reviewer/documenter. Existing product/design metadata drift is outside this upgrade unless separately authorized.
- Update `web-app/docs/PLAYGROUND_DESIGN.md`, the capability/limitation matrix, license notices, tests, final screenshots and deployment/rollback runbook. Run focused builds/typechecks, engine tests, browser checks and proportional regressions. Measure payload/loading honestly; don't reuse old Playground Lighthouse numbers for WASM.
- Review results with the owner before changing the default route or enabling production. Keep the old Playground reachable and all legacy records intact.

## Release and rollback

No push/deploy or production infrastructure changes before explicit owner approval. Validate the exact proposed release commit and engine artifact hashes. Hosted additive storage and the new Edge operation need their own approved rollout; compatibility remains safe when the new UI is disabled. Roll back by restoring the previous frontend/Edge revision and selecting the legacy route; retain additive tables/data so newly saved work is not destroyed. Export new `.dez` files before any optional later retirement. Never force-push, reset schema or delete legacy projects.

## Outstanding decisions for the phase review

1. Approve M1's local pinned-engine build and restricted browser bridge, keeping the legacy Playground default? This is the next phase; it does not approve hosted changes or live AI requests.
2. M2 recommends a separate additive private table because `.dez` and legacy documents have different semantics and size needs. Review its tested migration later, before hosted application.
3. Treat optional Gemini visuals as a later opt-in capability; the required Arduino builder must work through 120B alone and fail honestly when unavailable.
