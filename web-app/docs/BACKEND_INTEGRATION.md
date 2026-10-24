# PWA backend integration — 24 October 2026

The owner approved M2–M5 and frontend deployment. This release reuses the existing hosted schema, RLS and private bucket. One owner-approved additive migration repairs the missing artifact updated_at column. No policy relaxation, credential rotation, extension change or landing redesign is included.

## Configuration

Official landing: https://meetohmi.vercel.app/. Official app: https://meetohmi.vercel.app/app/. Independent app alias: https://ohmi-workspace.vercel.app/app/.

Vercel `ohmi-workspace` retains root `web-app`, production branch `codex/ohmi-web-app-pwa`, Next `/app` base path and trailing slashes. The landing's four existing rewrites remain unchanged. Both original production branches retain automatic Git deployments.

Production variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://meetohmi.vercel.app`, `OHMI_WEB_AI_ENABLED=true`. Provider and service-role keys remain in Supabase. No localhost exception exists in production.

Auth allowlist adds the exact official `/app/auth/callback/` and temporary authorized `http://127.0.0.1:3115/app/auth/callback/`. The original extension callback and Site URL stay unchanged. PKCE cookies use `/app/`, SameSite=Lax and Secure on HTTPS. Server operations verify the user and official Origin; callbacks and private APIs return private/no-store headers.

The new `ohmi-web` Edge entry imports the current validated handler and adds authenticated curated-guide enrollment. Deployed legacy `ohmi-ai` remains unchanged. Curated enrollment uses verified identity and an idempotent owner/fingerprint pair, without AI accounting or generation.

## Privacy and hosting

PDF/PNG/JPEG files up to 10 MiB upload directly to private Supabase Storage, avoiding Vercel's 4.5 MB request cap. Finalization inspects actual bytes before confirming readiness. Private responses revalidate ownership and stream bytes with no-store and nosniff. PDF previews render bounded pages locally with the existing PDF.js-based library after authenticated download; global anti-framing headers remain intact.

The worker still caches exactly six public files and excludes APIs, callbacks, queries, RSC and private data. Account changes invalidate in-flight results and clear private state. Cross-device updates use focus/visibility refetch; appearance preferences stay device-local.

## Rollback

Remote tag `ohmi-app-before-backend-integration-2026-10-24` preserves commit `11f6bbfa3fa520da356e928b39465d8659b2bf48`, deployment `dpl_Ft5m6Z8HejAxeKmnqNhR3NTLwhBQ`. Restore that Vercel deployment for frontend rollback; it remains compatible with `/app` rewrites. Reconcile Git with a normal revert. Keep existing schema and records. Close the web AI gate before an AI incident rollback; preserve the extension's legacy function.

## Evidence and limits

Real local account tests passed Google login/logout/refresh, separate A/B libraries, direct denial of A's file under B, PDF/PNG uploads including a 5.2 MB PNG, downloads, deletion after refresh and distinct saved guide steps. Authenticated-role probes confirmed symmetric file read/update/delete denial, conversation read/delete denial and tutorial/progress denial. Every write probe rolled back. Only synthetic files and test conversations were created; existing student data was preserved.

Local browser checks passed all seven routes at six viewport sizes, More containment at 320/390 pixels, five dock controls, default light on dark devices, persisted appearance/accessibility, private API/Origin rejection, crop, manifest/scope, public-only caches and offline fallback. Zero axe violations, page errors or failed public assets. Final review fixes and production verification belong in the release report.

The owner confirmed current free-only billing protection before live calls. Gemini is enabled through both the web gate and the Supabase kill switch. Unit tests cover provider errors, persistence/accounting, electronics calculations, code checks, evidence/tutorial contracts and multilingual policy; they do not establish live model accuracy. Qwen remains unqualified and inactive. The existing gateway does not support streaming generation; the UI waits for confirmed persistence.

Lists show the latest 100 files, 50 conversations and 50 analyses; older messages paginate in batches of 50. Minor limits: question totals reflect loaded messages; optional checker comparison/code-suggestion fields are not rendered. Physical phones, Safari, native installation and actual Document Picture-in-Picture remain unqualified.

References: [Vercel limits](https://vercel.com/docs/functions/limitations), [large bodies](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Deploy only the web Edge entry with its pinned import map: `supabase functions deploy ohmi-web --project-ref vhmdgfydvoljzqztuxmu --use-api --import-map supabase/functions/ohmi-web/import-map.json`. Provider keys remain unchanged. The shared tutor prompt is v3; live evaluation exposed overconfident typical-rating wording, so v3 explicitly requires actual datasheet limits. The extension’s deployed bundle is unchanged.

Approved schema repair: migration `20261024041136_ohmi_analysis_updated_at.sql` adds only the column already referenced by the completion function. Hosted metadata and a rolled-back completion probe pass. See `docs/PWA_ARTIFACT_SAVE_REPAIR.md` at repository root.
