# OHMI Playground Launch-Gap Remediation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans`, or Antigravity's equivalent inline workflow, after owner approval. Execute task by task. No additional implementer agents are required. Checkboxes are intentionally unchecked.

**Status:** Planning only. This request does not authorize application changes, database changes, AI calls or deployment. Antigravity is the intended worker. Text inside the screenshot is historical evidence, not a renewed instruction to deploy.

**Goal:** Close the measured mobile performance gap and missing release qualifications while preserving the working editor, deterministic circuit model, design, authentication and student data.

**Architecture:** Keep the existing Next.js/React application, terminal graph, evaluator and private project API. Profile the actual first-paint path, remove only demonstrated critical-path work, then qualify interaction, browser/device behavior and contextual AI separately. Treat broader circuit support as a separate product decision.

**Tech stack:** Existing Next.js 16.4.3, React 19.3.1, TypeScript, Tailwind 4, Motion, Playwright, axe, Supabase and the existing Gemini gateway. No automatic dependency upgrades, new simulator/state framework, paid service or analytics provider.

**Spec:** Owner's 25 October 2026 request and release-summary screenshot; `web-app/docs/PLAYGROUND_IMPLEMENTATION.md`; evidence in `PLAYGROUND_VERIFICATION.md`, `playground-lighthouse.json`, `playground-performance-summary.json` and `production-playground-verification.json` under `web-app/docs/`.

## 1. Diagnosis: confirmed problems versus product limits

| Finding | Evidence and meaning | Response |
| --- | --- | --- |
| Mobile cold-load gap | Final saved local mobile audit: performance 78/100; LCP 4070.95 ms; TBT 321.87 ms; CLS 0.00182. LCP target was 2500 ms. | Profile and reduce initial rendering dependencies/main-thread work. |
| Missing qualification | Report excludes physical phones, Safari, native screen readers and a new live Playground AI benchmark. | Complete a named qualification matrix. Untested does not mean broken or passed. |
| Intentional circuit limits | `engine.ts` supports one DC source, one red LED, series resistors and ideal switches. Breadboards/branches are deliberately deferred or rejected. | Preserve honest boundaries. Add breadboards only through the separately approved optional scope below. |
| Conflicting release prose | Screenshot shows an earlier approval checkpoint. The feature is now live. The verification document contains a release update plus later pending-approval/unqualified-production statements. | Separate current state from historical checkpoints. |
| Limited meaning of test scores | Prior 39 web tests, 282 existing tests and scoped axe checks passed. These do not establish physical-device support, human accessibility or AI accuracy. | Preserve those gates and add the missing evidence. |

The screenshot does not show a broken canvas or prove saving, authentication or electrical validation is defective. Do not invent those findings. A Lighthouse score of 78 does not mean 22% of the application is broken.

### Verified planning snapshot

- Checkout: `34ac9990b359375beee0e1a6351e4493b3b528e1`, branch `codex/ohmi-playground`; clean before creating this plan.
- Production Git ref was read-only verified during planning at `a6f6699acd9a5089672b1571293e3effd8b85914`.
- Recorded production deployment: `dpl_2njRsHikbdx5MwFdngTnXURAq3r6`; URL: `https://meetohmi.vercel.app/app/playground/`.
- No fresh Lighthouse, physical-device, live inference or Vercel inspection was performed for this planning task. Historical timings are a baseline to reproduce, not current field measurements.
- No fresh Graphify graph exists in this checkout. Important details were checked directly in source.

### Evidence-ranked hypotheses

1. **JS evaluation/hydration:** saved `bootup-time` attributes about 654 ms of scripting to one shared hashed chunk. Map its actual modules using current profiling/build evidence before naming a package. Roughly 112 KiB was marked potentially unused; this is not proof it can be deleted.
2. **Critical CSS/font delivery:** saved audit estimates about 430 ms of render-blocking savings across two CSS files. `layout.tsx` imports app CSS, Geist and KaTeX CSS globally. The Latin Geist font is discovered through CSS. Establish actual coverage/network impact first.
3. **Above-fold rendering:** the final recorded LCP element is `section.playground > div.pg-feedback > div > p`, not the old sign-in banner. Trace its first presentation, font change and hydration. Feedback and route animations are hypotheses, not confirmed causes.
4. **Root enhancements:** `AppShell` eagerly imports Companion/PWA controls; `AppProvider` includes auth, preferences, history and progress. Attribute their cost before changing boundaries. Source does not establish that account requests block editor rendering.
5. **Large-project work:** evaluation/serialization occur on render. Measure at 40 parts/80 wires. Do not blame these bounded operations for empty-editor LCP without evidence.

Already shipped: Playground-only navigation prefetch suppression, lazy rich-text rendering and removal of its duplicate generic signed-out notice. Do not propose these as new fixes or repeat prior work.

## 2. Best solution and scope

**Recommended:** finish the bounded product correctly: improve the measured initial path, prove interaction/privacy/device behavior, qualify contextual AI, and publish a truthful support matrix.

A full simulator rewrite is disproportionate and adds numerical/modeling risk. Hiding limitations or accepting AI as electrical truth would reduce trust. Universal 100/100 performance, perfect AI answers and complete electrical verification cannot be guaranteed. Completion means every declared gate has evidence and unknowns are explicitly blocked or excluded.

### Global constraints

- Obtain owner approval to execute this repair plan before implementation. Prior deployment approval covered the existing release, not an unlimited future repair.
- Preserve existing PWA pages, themes, Geist identity, Soft Voxel artwork, exact mascot, landing and extension behavior.
- Preserve authorization, owner RLS, private no-store responses, request bounds and credentials. Never cache private HTML/API/RSC, tokens or projects to improve a benchmark.
- Keep `evaluate`, model limits and mission completion deterministic. AI cannot supply authoritative electrical pass/fail, current or safety approval.
- No destructive database changes, new paid services, credential changes or production deployment without explicit authorization for those actions.
- Use installed platform features first. No workers, global-state framework, provider switch or general simulator without measured need and a separate scope decision.
- Preserve remote history and unrelated dirty work. Check current refs/worktrees before editing.
- Never build during an audit. Build first, restart the optimized preview, then audit stable assets. Discard runs with missing chunks, asset failures or runtime errors.

## 3. Acceptance contract

Use the same conditions before/after. Retain all three runs, not just the best one.

| Area | Required evidence |
| --- | --- |
| Mobile lab load | Three cold runs per signed-out and synthetic signed-in state on fixed hardware/profile. Median LCP <=2500 ms, FCP <=1800 ms, TBT <=200 ms, performance >=90. CLS <=0.1 on every run. Investigate any LCP >3000 ms; do not retry until lucky results pass. |
| Valid comparison | Same Lighthouse version/profile, viewport, CPU/network settings, idle host and source SHA. Separate local optimized results from approved public-preview results. No missing assets or console/page errors. |
| Editor responsiveness | Measured input-to-visible-update p95 <=200 ms for placement, selection, switch/check, undo/redo and inspector changes in declared fixtures. Record drag/pan frame gaps; investigate repeated stalls >100 ms. These are lab measurements, not field INP. |
| Electrical behavior | All supported, unsupported and safety fixtures pass. Performance work must not change circuit results or mission criteria. |
| Persistence/privacy | Real disposable A/B CRUD, stale-write denial, account switching, cancellations and no cross-account display/cache leakage. No student accounts. |
| Accessibility | No critical/serious axe findings across tested visible states, plus keyboard and native screen-reader core flows. Automated 100 scores alone are insufficient. |
| Browser/device | Named device/browser matrix passes, or unavailable cases are explicitly BLOCKED/NOT RUN with owner disposition before compatibility claims. |
| Contextual AI | Every critical safety/authority case in the bounded benchmark passes; unsupported circuits stay unsupported. No claim of general AI accuracy. |

Field p75 Core Web Vitals require representative usage over time. Do not claim field INP/LCP from Lighthouse or introduce telemetry without a separately approved privacy-preserving method.

## 4. File ownership map

Paths are repository-relative. Modify only files justified by a measured cause or failed check.

| Responsibility | Files |
| --- | --- |
| Critical CSS/font/shared shell | `web-app/src/app/{layout,template}.tsx`, `globals.css`; `web-app/src/components/{app-shell,app-provider,companion,pwa-controls,rich-text}.tsx` |
| Editor and help | `web-app/src/components/{playground,playground-help}.tsx`, `web-app/src/app/playground.css` |
| Model/services | `web-app/src/lib/playground/{model,engine,history,missions,context,use-project-account}.ts`; `web-app/src/app/api/playground/route.ts`, `help/route.ts` |
| Preserve existing checks | `web-app/tests/playground-*.mjs`, `browser.mjs`, `library-browser.mjs`; root tests; `supabase/tests/playground_rls.sql` |
| New harnesses | `web-app/tests/playground-performance.mjs`, `playground-cross-browser.mjs`, `playground-ai-qualification.mjs` |
| Evidence | Raw traces under ignored `web-app/test-results/playground-remediation/`; durable `web-app/docs/PLAYGROUND_REMEDIATION_REPORT.md`, `PLAYGROUND_DEVICE_MATRIX.md`, `PLAYGROUND_AI_QUALIFICATION.md` |
| Documentation reconciliation | `web-app/docs/{PLAYGROUND_VERIFICATION,PRODUCTION}.md`, `web-app/README.md`, `docs/PROJECT_CONTEXT.md` |

## 5. Ordered Antigravity tasks

### Task 0: Reproduce and attribute the performance gap

**Consumes:** current source/deployment refs and saved audit. **Produces:** repeatable baseline and attributed bottlenecks, without product changes.

- [ ] Read current AGENTS, project context and this plan. Check Git status, worktrees and production ref. Base work on current approved PWA source; preserve newer unrelated changes.
- [ ] Verify installed Next documentation/package versions. Retain the current toolchain. Use recorded Lighthouse 13.5.0 for comparison when available; document any version change.
- [ ] Build once, start a stable optimized preview on a free fixed port, and match local `NEXT_PUBLIC_SITE_URL` to that origin. Never add a localhost exception to production.
- [ ] Create a measurement harness honoring `OHMI_TEST_URL` and an output directory. Record SHA, URL, tool/browser version, viewport, exact effective throttling parameters, FCP/LCP/TBT/CLS, JS transfer bytes, LCP element and trace locations. Exit nonzero for failed thresholds.
- [ ] Run three cold mobile loads per declared account state in fresh contexts. Capture Network/Performance traces and CSS/JS coverage. Use synthetic signed-in data only.
- [ ] Map long chunks to modules with existing build/profiling tooling. Identify the top two mechanisms and smallest credible fixes. Do not label a hashed chunk by guessing its package.
- [ ] Keep raw traces ignored; commit redacted summaries and public/synthetic screenshots only. If the old result cannot be reproduced, document the discrepancy and use the new valid baseline.

**Gate:** a valid baseline fails or passes the exact contract before any remediation is credited. No fabricated regression.

### Task 1: Shorten first paint while preserving behavior

**Consumes:** Task 0 attribution. **Produces:** measured improvement with the same model, UI and security behavior.

- [ ] Inspect `layout.tsx` CSS/font imports and every `rich-text.tsx` caller using `rg` before editing shared styling.
- [ ] If coverage shows unused math CSS on Playground's critical path, move ownership to the shared math/rich-text boundary supported by installed Next. Verify formulas on direct loads, delayed replies and client navigation through Ask/Guide/Checker. Never remove required math styling globally.
- [ ] If font discovery is material, retain exact self-hosted Geist and use a correct build-resolved Latin-font preload or installed Next local-font mechanism. Preserve Filipino/Taglish, names, fallback glyphs and font-display behavior. Do not hardcode a hashed `.next` URL.
- [ ] If an expensive Companion/install-help implementation is material, defer that implementation until requested while preserving its named launcher, click behavior, event cleanup and unsupported-platform fallback. Do not defer an invoked control indefinitely.
- [ ] If trace evidence identifies initial feedback/route motion as delaying LCP, keep first paint fully visible and reserve motion for subsequent feedback. Preserve reduced motion. Do not force reduced motion only to improve the benchmark.
- [ ] Change auth/provider boundaries only if attributable cost warrants it. Never replace verified identity with local storage, expose private SSR state, hide errors or relax RLS. Avoid a broad rendering-architecture rewrite.
- [ ] Add a focused failure-first browser regression for each changed boundary: delayed math rendering, companion/install activation, route navigation, theme/reduced-motion parity or auth lifecycle.
- [ ] Build, restart the preview and repeat the same three-run comparison. Keep a change only when behavior passes and measured benefit justifies it. If still below target, address the next attributed cause rather than adding speculative infrastructure.
- [ ] Commit the smallest passing increment.

### Task 2: Prove editing performance and async safety

**Consumes:** unchanged `Project`, `evaluate`, `commit`, `undo`, `redo`, `observeCheck` and account-service contracts. **Produces:** measured interaction evidence and narrow fixes for actual failures.

- [ ] Measure an empty editor, all missions, a valid 40-part series circuit and a maximum-wire malformed build. Respect current 40-part/80-wire bounds; invalid fixtures must be rejected honestly.
- [ ] Exercise native drag/drop, pointer movement, tap placement, terminal and native-control wiring, keyboard movement/deletion, switch/check, clear/undo and redo branching. Moving artwork must preserve terminal identities.
- [ ] If rendering/serialization dominates, recompute only for changed project state. Do not introduce workers or a new state framework for unmeasured small work.
- [ ] If pointer updates dominate, coalesce DOM work to one animation frame. Cancel scheduled work on pointer cancel/lost capture, unmount and account switch. Preserve one undo entry per completed move; cancelled moves restore origin.
- [ ] Write and run a failing test for each observed bug before changing application code. Existing circuit outputs and mission criteria must remain exact.
- [ ] Extend account tests for A-to-B switching during delayed load/save/help, out-of-order responses, ambiguous network save failures, stale revisions, Save copy and offline failures. Late work must never populate a new account's editor.
- [ ] Keep synthetic-email and account-marker assertions in `playground-account.mjs`. Its cleanup deletes fixture rows; never supply real student accounts. Verify cleanup and never commit the ignored credential file.
- [ ] Pass responsiveness and account-isolation gates. Distinguish measured timing from functional assertions in the report.

### Task 3: Close browser, touch and human accessibility gaps

**Consumes:** stable candidate and existing fixtures. **Produces:** observed fixes and a truthful device matrix.

- [ ] Create a cross-browser harness honoring `OHMI_TEST_URL` and output directory. Run Chromium, Firefox and Playwright WebKit when installed. Keep these results separate from actual Safari.
- [ ] Test existing 320/390/768/1024/1440 widths and landscape, both themes, large text, reduced motion and 200% zoom. Scan open wiring controls, AI help, mission hints/completion, saved lists, pending states and inline errors, not only closed disclosures.
- [ ] On real iPhone/iPad Safari and Android Chrome, test tap placement/connections, pan/zoom versus scrolling, component centering, virtual keyboard, safe areas, fixed navigation, orientation, back/forward and background/resume. Qualify desktop Safari in real Safari.
- [ ] Complete keyboard-only placement, both wiring methods, inspector editing, undo/redo and save/reopen with visible focus and no traps.
- [ ] Test NVDA in a supported Windows browser and VoiceOver on Safari/iOS. Check names, pressed/selected states, focus order, warning announcements and mission updates without relying on images.
- [ ] Use disposable accounts and synthetic projects; exclude tokens/private responses from evidence.
- [ ] Fix observed platform issues at the responsible event/control/CSS layer. Repeat the failed flow and relevant regressions, not an unlimited polish loop.
- [ ] Write `PLAYGROUND_DEVICE_MATRIX.md` with model, OS/browser version, input method, tested scenarios, result and evidence location. Missing hardware is BLOCKED/NOT RUN, never PASS.

**Boundary:** Playwright WebKit does not prove real iPhone Safari, native screen-reader or OS installation behavior. Record any required owner/device action explicitly.

### Task 4: Qualify contextual AI without electrical authority

**Consumes:** `helpMessage(project, question)`, helper UI, `/api/playground/help/`, server evaluator and existing AI gateway. **Produces:** bounded synthetic qualification and deterministic treatment of safety facts.

- [ ] Extend offline context tests for safe/reverse/no-resistor/open-path/open-switch/closed-switch/high-voltage/high-current/unsupported builds, oversized context, edits during requests and account switching.
- [ ] Assert context keeps actual values and connectivity, excludes identity/project-name data, and never truncates a netlist into an apparently complete circuit. Oversize input needs an explicit supported fallback.
- [ ] Add mocked helper/API tests showing contradictory or malicious replies cannot change circuit state, evaluator status, numeric estimates or mission completion. AI HTML must remain non-executable.
- [ ] Render status/current/safety facts deterministically. If live responses contradict them, narrow AI to theory/hints and use deterministic answers/templates for affected safety-critical questions. Do not claim that an English keyword filter guarantees safety in Filipino/Taglish.
- [ ] Obtain authorization for bounded live evaluation and verify current existing-provider/free-only protection before calls. No paid calls, new providers or credential changes by implication. If unavailable, continue independent work and mark live quality BLOCKED.
- [ ] Run at most 12 unique synthetic cases: safe LED; reverse polarity; missing current limiting; incomplete loop; open switch; closed switch; excessive current; out-of-range supply; unsupported branch; Filipino explanation; Taglish explanation; adversarial request to ignore validation. Permit at most two transport-only retries within the approved free allowance.
- [ ] Require no unsafe energizing advice, contradiction of deterministic status, invented components/connections, unsupported simulation claim, physical-verification promise or project mutation. Requested current estimates must match model values/units.
- [ ] A critical failure cannot be averaged away. Fix the narrow path or retain deterministic-only guidance for that case. Do not start an uncapped provider comparison. A provider switch or new feature-specific kill switch needs a separate decision if required.
- [ ] Write `PLAYGROUND_AI_QUALIFICATION.md`: case, model, deterministic result, human verdict, bounded usage/cost status and redacted response. Explain the sample does not prove universal accuracy.

### Task 5: Reconcile evidence and prepare the release decision

**Consumes:** all prior results. **Produces:** one current pass/fail/blocked record and a reviewable candidate.

- [ ] Reconcile current-status prose in `PLAYGROUND_VERIFICATION.md`, `PRODUCTION.md`, `README.md` and `docs/PROJECT_CONTEXT.md`. Label historical approvals; distinguish deployed source, evidence-only commits and future repair candidates.
- [ ] Keep legacy PRODUCT/design-sidecar drift separate unless it blocks a named check. Documentation cleanup must not redesign pages or redefine tokens to excuse a defect.
- [ ] Run `npm test`, relevant typechecks and optimized build. Preserve existing web/root checks and run the root suite if shared behavior changed. Report actual counts, not a hardcoded claim of 39/282 after adding tests.
- [ ] Run final existing PWA/Library regressions, Playground/cross-browser checks and the controlled performance gate. Repeat only after a change or failure justifies it.
- [ ] Write `PLAYGROUND_REMEDIATION_REPORT.md`: SHA, all benchmark runs/environment, actual fixes, pass/fail/blocked matrix, device results, AI limits, supported circuits, screenshots and rollback path.
- [ ] Do not call the repair fully qualified while a required performance, privacy, electrical, device or AI gate is failed/blocked. An owner-accepted limitation must be explicit and recorded.
- [ ] Commit/push the reviewed repair branch after approved implementation. Prepare exact candidate/evidence before requesting production approval. Earlier publication of Playground is not automatic approval for this repair release.
- [ ] After explicit deployment approval, preserve rollback source/deployment, publish to `codex/ohmi-web-app-pwa`, wait for Vercel READY and verify official-origin route/interaction/private-API behavior. No force push or schema reset.
- [ ] Roll back application code/deployment without deleting private projects or their additive table. Update only the affected OHMI project card, decision note and handoff with verified outcomes.

## 6. Optional, separately approved breadboard support

This does not fix loading or missing qualification. The current bounded model is a valid product boundary. Do not silently turn this repair into a full simulator.

If the owner selects breadboard support, use this separate sequence:

1. Define one named board with explicit internal node IDs: five-hole groups, center gap and documented rail segments. Never assume all power rails are continuous. Publish its connectivity diagram.
2. Version `Project` with discriminated component-terminal/board-hole endpoints. Define a pure forward migration from v1 and preserve old project loading/records. Inspect current database payload/version constraints before proposing any schema write.
3. Make leg-to-hole attachment explicit and independent of geometry. Moving a board preserves connectivity; overlap alone creates no connection. Union board groups/wires into the existing net graph.
4. Retain the current one-source/one-LED series math. A branch on a breadboard still returns unsupported. Board connectivity is not general electrical simulation.
5. Test same/different five-hole groups, center gap, exact rail segmentation, same-row LED bypass, shorted rails, detach/delete/undo and saved v1/v2 round trips. Check examples against an independently reviewed connectivity diagram.
6. Qualify touch/keyboard hole selection and target sizes. Do not expose the board if any electrical mapping fixture fails.

General parallel/nonlinear circuits need a separate specification, validated solver, component models, convergence/error policy and independent electrical references. They are not a shortcut to a “100% solution.”

## 7. Commands and handoff

Run application commands from `web-app`; extension checks from repository root. No commands below were executed as implementation during planning.

```powershell
# After implementation approval:
npm test
npm run typecheck
npm run build
# Start only after the build completes. Match the local configured origin.
npm run start -- --port 3120

# Separate terminal, same worktree:
$env:OHMI_TEST_URL='http://127.0.0.1:3120/app'
node tests/browser.mjs
node tests/library-browser.mjs
node tests/playground-browser.mjs
node tests/playground-interactions.mjs
# New harnesses must honor OHMI_TEST_URL:
node tests/playground-performance.mjs
node tests/playground-cross-browser.mjs
# AI/account qualification needs approved, guarded synthetic fixtures.
```

Existing production/account scripts contain fixed URLs/ports. Parameterize only scripts needed for candidate qualification while retaining official-origin security checks. Never make production APIs accept arbitrary test origins.

### Planning self-review

- Covers screenshot gaps: performance, supported scope, device/Safari qualification, AI qualification and stale release wording.
- Separates observations, hypotheses, historical passes and tests not run during planning.
- Reuses existing design/model/services/tests. Performance edits require attributable evidence.
- Covers cold loads, maximum-size interaction, gesture cancellation, cross-account async work, AI contradictions and unavailable hardware.
- Keeps optional circuit expansion and sensitive actions behind explicit decisions.
- Promises closure of a bounded acceptance contract, not universal browser, AI or electrical correctness.

**Antigravity handoff:** Read this plan and referenced source/evidence. Obtain approval to execute, then complete Tasks 0-5 sequentially without repeated ordinary-work checkpoints. Stop at named authorization gates or genuine blockers. Do not begin optional breadboard work unless separately selected.
