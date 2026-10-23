# OHMI PWA backend integration: M1 audit and readiness

Date: 24 October 2026, Asia/Manila. Status: **M1 audit complete; M2 implementation awaits owner review.**

This report follows the owner's new backend-integration brief. Its proposed work supersedes the earlier frontend-only boundary only within the approved milestone. No application code, hosted configuration, schema, student data, credentials, AI provider or production deployment was changed during M1. The project instruction requires reviewing each phase before starting the next.

## Scope and evidence

- Repository fetched from GitHub. PWA baseline: `11f6bbfa3fa520da356e928b39465d8659b2bf48`, `codex/ohmi-web-app-pwa`. Landing: `5335d056bc4ac787dbe2bcf3b25fdd03a1c0f025`, `codex/ohmi-website`.
- Read existing Phase 4/5 reports, current implementation, migrations, existing Qwen evaluation plan and live Supabase metadata/function source. Earlier project-context M1-only wording is stale: hosted migration history includes Phase 5, while the AI function bundle is older.
- Inspected actual production at https://meetohmi.vercel.app/app/ using fresh desktop/tablet/mobile browser contexts. Only the sparkle attachment was available; the missing second attachment was not assumed inspected. Independently reproduced the reported More-panel clipping. Reproduce from `web-app` with `node tests/readiness-audit.mjs`; output goes to ignored `test-results/backend-readiness`. This diagnostic reports panel bounds rather than asserting that the known defect is fixed.
- Live SQL was limited to schema, policies, privileges, function definitions, storage configuration, publications and aggregate operational status. No student messages, documents, profiles or identifiers were retrieved.
- AI generation, authenticated writes, OAuth consent, account creation and two-account runtime tests were not performed. No model accuracy percentage is claimed.

## Readiness verdict

**Reuse the existing backend. Do not rebuild the schema or extension service.** The database supports most requested persistent data. The missing work is a web-specific client/auth adapter, server-side upload validation and UI integration, plus a separately verified AI release. Core persistence does not currently justify a new migration.

Four release blockers:

1. The PWA is still entirely local demo state, with no Supabase dependency or runtime configuration.
2. Deployed `ohmi-ai` v13 differs materially from the current repository: no Circuit Checker v2, Qwen transport, current tutor policy or application kill-switch check.
3. The exact web OAuth callback allowlist is unverified. Google is enabled, but the committed hosted-auth configuration still names an extension callback.
4. Upload metadata validation is not equivalent to trusted server-side content validation. The PWA must verify bytes and ownership before accepting/processing files.

## Existing infrastructure and reuse map

Supabase project: `vhmdgfydvoljzqztuxmu`, ACTIVE_HEALTHY, Postgres 17.11.0.003. All 13 local migration versions are recorded in hosted history, through `20261016170000_ohmi_phase5_circuit_check_artifacts`. Migration-history parity does not prove deployed function parity or complete schema equivalence.

| Requested feature | Verified existing resources | PWA work required |
| --- | --- | --- |
| Google sign-in, logout, sessions | Supabase Auth public settings confirm Google enabled; extension uses PKCE | Independent web session client and `/app/auth/callback/`; preserve extension callback |
| Profiles, language | `ohmi_profiles`: id, display_name, language | Load/update verified owner profile; map English/Filipino/Taglish values |
| Private assignments | `ohmi_assignments`, `ohmi_assignment_steps`, private `ohmi-assignments` bucket | Authenticated upload/finalize, content validation, signed previews/downloads and confirmed deletion |
| Durable conversations | `ohmi_conversations`, `ohmi_messages`, structured_result, owner-bound references | Real history, paging, creation/deletion, account-switch clearing and request state |
| Saved analyses/checks/tutorials | `ohmi_analyses`, artifact_kind, schema_version, fingerprints | Render stored validated artifacts; release compatible AI handler before claiming live v2 checks |
| Learning progress | `ohmi_tutorial_progress`, `ohmi_save_tutorial_progress` | Persist bounded completion/current step against a real tutorial; derive progress from saved records |
| Settings | Existing profile supports name/language; no appearance-preference column | Keep appearance/accessibility device-local initially; sync existing profile fields |
| Cross-session updates | Persistent tables; no OHMI tables in `supabase_realtime` publication | Refetch on focus, sign-in/refresh and successful mutation before adding Realtime infrastructure |

Storage accepts PDF, PNG and JPEG, with a 10 MiB bucket limit and public access disabled. AI evidence has smaller bounds in current source: PDF 2 MiB/eight pages, image 4 MiB/four megapixels; v2 image aggregate bounds apply. Show separate upload and analysis limits. Do not promise every stored 10 MiB file can be analyzed.

### Ownership and privileges

- All nine public OHMI tables have RLS enabled. User-data policies use verified `auth.uid()` ownership; UPDATE policies include USING and WITH CHECK.
- Authenticated grants are deliberately narrow. Column-level UPDATE exists for profile name/language, assignment status and step completion; absent table-wide UPDATE is intentional.
- Storage policies bind paths to an owned assignment, require pending state for INSERT and allow owner SELECT/DELETE. No general upsert policy exists; keep unique object paths rather than adding replacement rights.
- AI accounting/completion functions are SECURITY INVOKER and service-role-only. Tutorial progress RPC also permits authenticated execution with its existing ownership checks. Never move privileged completion into browser code.
- Advisor INFO for `ohmi_ai_provider_backoffs` having no policies is consistent with intentional client deny-all access. Do not add permissive policies to silence it.
- Advisor WARN: leaked-password protection is disabled. No setting changed; Google sign-in remains the requested initial auth surface.
- Definition review is not two-account runtime proof. Re-run isolation with authorized disposable accounts during integration.

### Upload trust boundary

`src/backend/service.ts` is extension-specific: WXT browser messaging/storage, Chrome identity and account-state guards. Its file completion checks object size/MIME metadata. `validateFile` receives signature bytes supplied by the client; those are not trusted server evidence. The bucket's MIME allowlist also does not prove decoded content.

For the PWA, use a bounded authenticated server upload/finalization path, verifying the user and actual bytes, reusing existing image/PDF validators where compatible. Preserve unique owner-scoped paths and pending/ready recovery. A ready row alone must not mean content was verified. Validate legacy stored evidence before passing it to AI or treating its MIME as trusted. Any proposed global policy/trigger change must be reviewed separately because the extension shares this storage flow.

## AI deployment and intelligence findings

Live function: `ohmi-ai`, ACTIVE, version 13, JWT gateway verification enabled; deployed source has six files. It calls Gemini `gemini-3.5-flash-lite` using non-streaming generateContent. Current repository uses `index.ts` plus `handler.ts`, shared tutor policy, circuit-v2 validation and Qwen transport. Do not deploy the repository bundle blindly.

Verified gaps in live v13:

- No schemaVersion-2 circuit handler, current tutor-policy version or Qwen adapter.
- No `OHMI_AI_ENABLED` application check. A later release must not assume a configured kill switch protects this older bundle.
- Non-streaming JSON responses. Preserve truthful pending/cancel/error states; do not imitate provider streaming with a timer.
- Completion RPC result is not checked before returning `ok: true`; the current-source release must prove persistence before success.

Unauthenticated production POST returns 401; OPTIONS from the official origin returns 200 with POST/OPTIONS CORS support. Existing aggregate accounting shows past completed Gemini chats. Neither result proves the model/key/quota works now.

Qwen remains a candidate, not an approved live fallback. Existing `docs/OHMI_QWEN_EVALUATION_PLAN.md` already requires free-only quota/expiry, endpoint/account approval and a bounded evaluation. No live evaluation ledger was present. The source adapter allows `qwen3.8-flash`/`qwen3.8-max`, while live completion SQL accepts the older `qwen/qwen3.8-27b` identifier. That mismatch blocks a safe switch and would require reviewed compatibility changes. Do not activate Qwen, Max, dual calls, retries or a fallback chain.

Existing safeguards to reuse include deterministic circuit calculations, Arduino heuristics, image/PDF bounds and citations, strict tutorial/circuit schemas, evidence-based uncertainty, multilingual tutor instructions, idempotent requests, canonical history positions and atomic accounting. The current handler loads at most 12 prior messages for an explicit history watermark. Verify how a newly sent question and its evidence bind to that snapshot; never trust arbitrary browser history as authoritative.

The PWA's tiny `RichText` renderer was designed for trusted presets. Live content needs the existing project's maintained Markdown/math approach with unsafe HTML disabled, safe links and bounded output, while preserving approved typography.

### Evaluation status

Ran focused local regression tests:

```powershell
npx vitest run src/ai supabase/functions/ohmi-ai tests/qwen-evaluation.test.ts tests/qwen-smoke-runner.test.ts
```

Result: **155 tests passed across 12 files**. These cover calculations, Arduino checks, media/tutorial/circuit validators, tutor policy, provider mocks and Qwen harness behavior. They do not measure live-model accuracy.

M3 should reuse and extend existing fixtures/evaluators with verified calculations, Uno pin/code cases, ambiguous images, PDF page citations, contradictory assignments, prompt-injection evidence, conversation context and English/Filipino/Taglish. Report schema/evidence/correctness failures separately, with latency/tokens and explicit uncertainty. Block release on fabricated electrical verification or unsafe advice. A free approved-provider baseline and reviewer-scored outputs are required before any quality claim.

## UI audit: preserve the approved product

Design read: existing student learning PWA, calm teal/iOS language; Operate mode. Preserve current variance 5, motion 6 and density 4. Impeccable governs product UI; marketing-page layout rules do not justify changing this workspace. No new images or mascot variants are needed.

### Confirmed mobile cause

On actual production at 390x844, More has x=-195 and width=390; at 320x844, x=-160 and width=320. Half the sheet is outside the viewport. `document.scrollWidth` still equals viewport width, so the existing overflow-only assertion misses the defect.

`ui/dialog.tsx` supplies Tailwind's independent `translate: -50% -50%`. Mobile `.more-sheet` adds `transform: translateX(-50%)` while retaining left:50%. The two horizontal offsets compound. The inherited vertical translation also lifts the nominal bottom sheet above its intended bottom edge.

M4 should establish one positioning mechanism for the mobile sheet, reset inherited translation, constrain visual-viewport width/height, and account for safe areas and keyboard/scroll states. Keep Radix focus trapping, Escape/backdrop dismissal, accessible names and reduced-motion behavior. Add explicit rectangle containment assertions, not just document overflow checks. Evidence: [390px](pwa-backend-readiness/more-390.png), [320px](pwa-backend-readiness/more-320.png), [metrics](pwa-backend-readiness/ui.json).

### Other requested improvements

- New users currently follow OS theme: fresh dark-OS contexts render dark at 1440, 768, 390 and 320 pixels. `AppProvider` starts with `system` and applies preferences after hydration. M4 must default new users to light and apply saved theme before paint; keep existing explicit dark/system choices available.
- Sparkles occur in app-shell sidebar/footer, dashboard greeting/support, chat empty state and progress decoration. Settings also has an unused Sparkles import. Remove decorative glyphs without replacing the mascot or functional navigation/state icons.
- The current mobile bar has four primary links and More. M4 changes only that bar to the requested floating five-control Home / Ask OHMI / Assignments / Checker / + More dock. Keep desktop/tablet navigation. Include Guides, Progress, Settings and Profile access in More; avoid duplicate routes or invented features.
- Existing production evidence records light/dark axe checks with zero violations. Current Escape dismissal passes. These do not excuse clipped controls or qualify screen-reader/native-device behavior.
- Historical mobile Lighthouse: 90 performance, LCP3.6s; no new performance run in this audit. Do not report field CWV or a met 2.5s target.

Bounded UI audit score: accessibility 2/4, performance 2/4 (historical evidence), theming 2/4, responsive design 1/4, implementation integrity 3/4: **10/20**. This is scoped triage, not exhaustive certification. Identity is coherent; key mobile navigation and requested theme behavior need correction.

Detector ran once: one primary popular-font warning and 117 token-document advisories. Retain approved self-hosted Geist; popularity is not a defect for this brief. Report token-document drift without rewriting DESIGN.md as a side effect. Prioritize `$impeccable adapt` for sheet/dock bounds, `$impeccable harden` for real auth/data states and theme startup, then `$impeccable polish` after integration. No unrelated visual overhaul is recommended.

## Deployment and rollback

Official URLs remain https://meetohmi.vercel.app/ and https://meetohmi.vercel.app/app/. The landing project proxies slash-preserving and unslashed /app paths to the independently deployed Next.js project. Next basePath is /app; manifest and worker scope are /app/. Keep the worker public allowlist; never cache auth callbacks, credentials, private documents, API/RSC or AI content.

PWA project `ohmi-workspace`: root `web-app`, Git production branch `codex/ohmi-web-app-pwa`, existing production `dpl_Ft5m6Z8HejAxeKmnqNhR3NTLwhBQ`. It has zero application environment variables. Add only required public Supabase configuration after M2 review; server-side provider secrets remain in Supabase. Landing remains `meetohmi`, root `website`, independent branch/build. No production settings changed in M1.

Existing rollback tags/deployments remain intact. This audit is committed on a separate review branch `codex/pwa-backend-readiness`, which is excluded from both Vercel Git production allowlists. A future release needs an auth-aware rollback plan: preserve additive schema and data; roll back to a compatible client/handler, never restore an unsafe function solely because it was previously deployed.

## Milestone sequence and acceptance gates

### M1: complete

Read-only inventory, deployed/source drift, reusable services, ownership review, production layout reproduction and missing runtime prerequisites documented. No application changes.

### M2: authentication and persistent data, next for owner review

1. Add a pinned independent Supabase web client; use cookie-based SSR helpers if server routes require them. Keep WXT imports outside `web-app`; reuse pure contracts/validators through an app-root build-safe boundary.
2. Implement PKCE and the exact official callback `/app/auth/callback/`; verify/allowlist it while preserving the extension URL. Use an allowlisted official origin for callbacks and post-login destinations, not arbitrary forwarded hosts or next parameters. Verify proxy cookie forwarding, refresh and no-store responses.
3. Integrate profiles, private assignment operations, conversation/analysis reads and tutorial progress with existing tables and grants. Clear private state on logout/account switch and reject stale async completions. Keep unavailable AI actions truthful until M3.
4. Add server-side byte validation and cancel/retry/partial-upload recovery. Preserve existing data, object paths and RLS. Propose any necessary global database change separately before application.
5. Verify real Google login/logout/refresh with an authorized interactive test identity and two-account isolation with disposable accounts. Never reuse student data or fabricate Google identities. Keep device-only appearance preferences until synchronization has a demonstrated need.

### M3: approved live AI

Review handler/database compatibility, deploy a reviewed compatible release only after the required gate, retain Gemini selection and zero unauthorized paid calls. Qualify current model/free allowance, then run bounded real evaluations. Qwen remains blocked until its own documented approval, free-only protection and SQL/model compatibility pass. No fake streaming or simulated success.

### M4: scoped UI improvements

Default light startup without flash; remove decorative sparkles; fix mobile positioning; implement only the requested floating dock and More menu. Batch desktop/tablet/phone inspection and at most one confirmation pass. Test short/narrow/landscape viewports, keyboard/scroll/safe-area states, touch, focus and reduced motion.

### M5: final release

Run two-account privacy, real private PDF/image lifecycle, durable chat/tutorial/progress, honest AI failures and approved-provider evaluations, browser/accessibility/build checks, PWA privacy/install and actual official production routing. Publish screenshots/results and remaining limitations. Remove each demo label only when that feature passes its real acceptance test.

## Remaining unknowns and required review

- Exact hosted OAuth allowlist/site URL and successful web callback exchange. Public Google authorization initiation returned 302, but no consent/session exchange was performed, so callback acceptance is not proven.
- Approved disposable identities/interactive Google consent for end-to-end tests.
- Current server secret availability, live model reachability, free quota/billing protection and actual multimodal quality. No privileged credentials were retrieved or rotated.
- Whether optional cross-device appearance sync merits an additive migration. Core profile/history/assignments/progress already have resources.
- Physical phones, Safari, installed-app keyboard behavior and real PiP remain unqualified.

Production database changes, destructive operations, paid services and provider activation remain separate explicit approval gates. The owner should review this M1 report before M2 begins, as required by AGENTS.md.

## Current primary sources

- [Supabase changelog](https://supabase.com/changelog.md): fetched; relevant upcoming TLS/API changes reviewed. Modern browser/Node clients are the intended target; no platform migration was performed.
- [Next.js Supabase clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client): cookie-based server/client integration.
- [Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): exact production callback allowlisting.
- [Existing Qwen plan](OHMI_QWEN_EVALUATION_PLAN.md): qualification and production gates, not proof of current paid/free account status.
