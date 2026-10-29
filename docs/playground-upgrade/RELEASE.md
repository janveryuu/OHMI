# Electronics workspace release and rollback gate

This is a runbook, not deployment approval. M0–M4 were approved for local work only. Do not push, deploy, apply hosted migrations, enable inference or change the default route on that authority.

## Proposed order after explicit owner approval

1. Identify the reviewed release commit on `codex/playground-design-electronics`; confirm a clean tree, pinned artifact hashes and current verification reports. Preserve remote history. Reconcile any newer changes before merging; never force-push.
2. Confirm the existing Vercel PWA project/root/base path and production branch against `web-app/docs/PRODUCTION.md`. Those documents name `ohmi-workspace`, root `web-app`, branch `codex/ohmi-web-app-pwa`, `/app/` base path; verify live configuration when release is approved. Leave the landing project and Chrome extension unchanged.
3. Obtain separate hosted-migration approval. Inspect actual migration history first. Reconcile the additive `20261028181546_electronics_projects.sql` and `20261029093000_circuit_build_admission.sql` drafts with already applied history; do not replay all local SQL blindly. Preserve all student tables/rows and current provider policy. Use the owner's existing approved secret mechanism; never put keys in Git, browser code, logs or notes.
4. If the Edge release is approved, deploy the existing `ohmi-web` entry with its shared imports; confirm a real deployment bundle contains the shared specification/catalog modules. Deno source checks pass locally, but a deployed Edge bundle was not verified. Keep existing chat/media routes and global enable flags unchanged. Keep circuit-build gates false initially.
5. If frontend publication is approved, create a preview from the reviewed commit. Keep the old Playground default, the new workspace experimental and the builder off. Verify actual cookie origin/base path, private no-store responses, CSP/opaque iframe, WASM MIME/CORS, storage-unavailable fallback, owner save/reopen/export, themes and installed-PWA refresh on the preview. Never deploy synthetic fixture URLs/keys or `OHMI_LOCAL_TEST`.
6. Before any real AI qualification, verify actual Groq account tier, billing safeguards and organization limits with the owner. Confirmation flag names are not proof. Request explicit bounded live-test approval for the two synthetic A/B cases. No real student material, repair loop or fallback. Stop on provider errors/rate limits; record model and actual usage without secrets. Optional Gemini visuals remain deferred.
7. Review preview/live qualification evidence with the owner before production promotion, changing the default route or enabling build flags. Record the remote commit and Vercel deployment ID/READY status, then verify the official `/app/` URL and installed PWA. A push alone is not proof of a live release.

## Cache and rollback

The existing service worker caches only six public shell/mascot/icon resources. It does not cache vendor runtime, API, private navigation or query-bearing requests. No worker policy changed. Check actual production response cache headers and asset hashes before claiming an installed PWA is current.

Local rollback point before M4 is M3 commit `f655e1fcc70ce09420ea0242e64d320d189b3026`; before the full upgrade it is `76e14cad1678c4632a29dd0eee1ea2272503be3d`. Export local/new `.dez` work before switching versions. Do not reset a checkout with uncommitted work.

For a future released rollback, restore the previous frontend/Edge deployment, keep the builder disabled, and use the legacy default route. Retain additive tables, saved native projects and legacy provenance. Do not drop tables, remove student records, restore an old database wholesale or delete new snapshots to roll back a UI. Keep native `.dez` export available until any separately approved retirement.

## Remaining release evidence

- Hosted migration/history alignment, actual Edge bundle, private PostgREST end-to-end checks and disposable hosted-account testing.
- Real model quality, free-tier/limits/billing qualification and bounded A/B inference.
- Physical phone/touch, Safari and whole-native-editor assistive-technology coverage.
- Production/installed-PWA transfer/loading measurements. Local gzip estimates and development timings are not production performance scores.
