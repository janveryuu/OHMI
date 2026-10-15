# OHMI — Your Circuit Buddy

Phase 3, version **0.3.0**: Supabase accounts, private assignments, saved steps, and the approved pixel-art companion. Google sign-in is available. Email confirmation/password reset remain **pending custom SMTP**, as agreed. AI and circuit checking still use samples.

Phase 4 has been rolled back and will be redesigned from scratch with Antigravity. No live AI integration is included in this foundation. See the [rollback record](docs/PHASE_4_ROLLBACK.md) for backups, verification and retained live database resources. Phase 5 has not begun.

## Load or update

1. Use Node.js 22.12+ (verified with 24.16.0). Copy `.env.example` to ignored `.env` for a new checkout. See [Phase 3 setup](docs/PHASE_3_SETUP.md). Use only the project URL and publishable key.
2. Run `npm ci`, then `npm run build`.
3. In `chrome://extensions`, enable Developer mode and load `.output/chrome-mv3`. For the existing installation, click **Reload** and confirm **0.3.0**. Keep the original absolute build path to retain the registered extension ID.
4. Refresh your [Tinkercad Circuits](https://www.tinkercad.com) editor. Open OHMI → Settings → **Sign in to OHMI** → **Continue with Google**.

Authentication and real uploads use an extension-owned Account page. Passwords and upload authorization never enter Tinkercad. After source changes, rebuild, reload the extension, and refresh the editor. `npm run dev` is available.

## Phase 3 features

- Google sign-in/sign-out, display name, persistent session, and on-demand expired-session refresh.
- Private PDF/PNG/JPG uploads up to **10 MiB**, actual byte progress, 60-second signed retrieval links, confirmed deletion, and recoverable incomplete uploads.
- Student-written assignment steps and completion saved in Supabase. No AI generation.
- Account language synchronization. Appearance, animations, mascot placement/open state remain device-local.
- Existing confirmed email accounts can sign in. New email confirmation and reset actions remain gated until SMTP is ready.

Find real files in **Assignments**, above the sample analysis flow. **Upload assignment** opens Account. Sample upload areas do not analyze real files; use the private assignment controls to save documents.

## Preserved Phase 1/2 behavior

- Appears only on HTTPS `www.tinkercad.com/things/<design>/editel`, including query strings/trailing slashes. SPA navigation mounts/removes one companion.
- Exact approved front PNG; turnaround remains a reference asset.
- Shadow DOM isolation; host pointer/keyboard actions remain usable.
- Mouse/touch drag, arrow-key movement (Shift for one-pixel steps), viewport clamping, open/minimize, Escape, and focus return.
- Responsive panel with independent scrolling, fixed header/navigation, and accessible mascot placement.
- Home, Ask, Assignments, Guide, Check My Circuit, Settings; sample conversations/results/guide progress.
- Idle, hover, happy, and thinking motions respect the animation toggle and system reduced motion.

Permissions: `storage`, `identity`, Tinkercad, and the configured Supabase host. Chrome 116+. No screenshot capture, undocumented Tinkercad integration, AI credential, or Autodesk affiliation.

## Automated checks

```powershell
npm test
npm run typecheck
npm run build
npm run test:browser
```

Browser tests use temporary Chromium profiles and a **simulated** editor. Screenshots go to `docs/screenshots`. Install Chromium with `npx playwright install chromium` if needed, or set `OHMI_CHROMIUM_PATH` to an existing executable. No linter is configured.

With Docker Desktop:

```powershell
npx --yes supabase@2.120.0 start
node tests/backend.mjs
```

Local tests discover localhost credentials in memory and clean disposable users/files. Guarded live checks create temporary fixtures in existing OHMI; see [setup](docs/PHASE_3_SETUP.md) and [actual verification](docs/PHASE_3_VERIFICATION.md).

## Manual checks

1. Reload 0.3.0 and refresh Circuits. Check one mascot; none on dashboards or the 3D editor.
2. Sign in with Google, save a name, restart Chrome, and verify account/files return.
3. Upload PDF/PNG/JPG, open the file, save/check steps, and delete it. Another account must not see it.
4. Cancel Google login and retry. Check account switching in two open Account pages.
5. Place/wire components, edit code, and run/stop simulation with OHMI open. Host controls must remain usable.
6. Check keyboard navigation, reduced motion, language/theme, six sample sections, and actual Chrome zoom at 80%, 125%, and 200%.

## Limits

Email verification is **not disabled**. Keep `WXT_EMAIL_DELIVERY_READY=false` until custom SMTP and prepared OTP templates are verified. Rotate privileged keys previously exposed in chat; this implementation never used or committed them. Other machines need the original registered extension's public manifest key for stable identity.

Samples do not inspect or electrically verify circuits. Sample conversations/progress reset on reload; real assignment steps persist. Facial animation frames still need owner approval. Phase 4 has not started.

## References

- [Project context](docs/PROJECT_CONTEXT.md)
- [Approved mascot](docs/OHMI_MASCOT.md)
- [Design references](docs/DESIGN_REFERENCES.md)
- [Phase 1 verification](docs/PHASE_1_VERIFICATION.md)
- [Phase 2 design](docs/PHASE_2_DESIGN.md) and [verification](docs/PHASE_2_VERIFICATION.md)
- [Phase 3 design](docs/superpowers/specs/2026-10-12-phase-3-design.md) and [plan](docs/superpowers/plans/2026-10-12-phase-3.md)
- [Phase 3 setup](docs/PHASE_3_SETUP.md) and [verification](docs/PHASE_3_VERIFICATION.md)
