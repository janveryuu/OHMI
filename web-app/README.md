# OHMI Web App + PWA

Current integration connects Google PKCE authentication, private files, profiles, conversations and saved tutorial progress to the existing Supabase backend. AI routes use the thin `ohmi-web` entry; Gemini generation is enabled after owner confirmation of free-only billing protection. See [configuration, verification and rollback](docs/BACKEND_INTEGRATION.md).

Copy `.env.example` to ignored `.env.local` for public configuration. Never add provider or service-role keys here. Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:browser`. The authorized integration test origin uses port 3115. Lists show the latest 100 files, 50 conversations and 50 analyses; older messages paginate in batches of 50.

Playground is live at [meetohmi.vercel.app/app/playground/](https://meetohmi.vercel.app/app/playground/), released from source `a6f6699` after explicit owner approval. It adds terminal-based circuit editing, bounded deterministic checks, three missions, private saved projects and contextual AI guidance. See [Playground verification](docs/PLAYGROUND_VERIFICATION.md), [remediation report](docs/PLAYGROUND_REMEDIATION_REPORT.md), [device matrix](docs/PLAYGROUND_DEVICE_MATRIX.md), [AI qualification](docs/PLAYGROUND_AI_QUALIFICATION.md), and [surface design notes](docs/PLAYGROUND_DESIGN.md).

The remaining text records the original frontend-only stage and is historical. This folder retains its independent dependency lockfile, build and server. The extension and cinematic landing retain separate deployments.

Live app: [meetohmi.vercel.app/app/](https://meetohmi.vercel.app/app/). Landing page: [meetohmi.vercel.app](https://meetohmi.vercel.app/). See [production setup and update instructions](docs/PRODUCTION.md).

## Preview

From this folder, run:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3100/app/. For production-mode PWA behavior:

```powershell
npm run build
npm run start
```

The service worker is intentionally disabled during development. Production uses the separate Vercel project `ohmi-workspace`, with `web-app` as its root and `codex/ohmi-web-app-pwa` as its tracked production branch. The landing project proxies `/app/` to this independent build. Browser URLs remain on the official domain, and its worker controls only `/app/`.

## Included

- Dashboard with original approved mascot and live session summaries.
- Ask OHMI: safe preset response formatting, local attachments, conversation switching, cancel, expand/restore.
- Assignment library: local multi-file selection/drop, filter/search, image/PDF previews and confirmed removal.
- Circuit Checker: local image preview, centered crop, reset and explicitly illustrative review states.
- Beginner LED guide: component list, schematic, five steps, checks, touch browsing and keyboard-friendly controls.
- Learning Progress: derived session milestones and achievements; no invented mastery scores.
- Settings: demo profile, appearance, larger text, reduced motion and future language preference.
- Floating companion: capability-detected Document Picture-in-Picture, with an in-app fallback.

## Data and integration boundary

No Supabase, authentication, AI SDK or upload endpoint is connected. Files use object URLs and remain on the device. Chat, profile, files, language and progress stay in React memory and clear on refresh. Only theme, larger-text and reduced-motion preferences persist in localStorage. Language selection records a preference; this stage's interface and preset replies are English.

`src/components/app-provider.tsx` owns demo state. `src/lib/content.ts` contains preset content and guide steps. `src/lib/demo.mjs` contains tested local validation/crop/progress logic. Route views are separated by task. Future integration should replace local handlers with authorized services and maintain truthful loading/error states. Do not add backend credentials to this frontend.

## PWA policy

The manifest supplies standalone display, icons, shortcuts and app metadata. A first-visit worker registers in production. It caches exactly the public offline page and approved mascot/icon assets. It never caches navigations, API/RSC responses, chat, blobs, credentials or learning records. Offline navigation opens an honest public fallback rather than stale personal screens. Updates wait until the user chooses Apply update; the UI warns that applying clears in-memory demo content.

Installation requires localhost or HTTPS and browser support. Safari on iPhone/iPad uses Share > Add to Home Screen. Other supported browsers expose Install OHMI or a browser menu. Document PiP is browser-dependent; availability or denial falls back to the in-app companion. No environment variables are required for this frontend deployment.

## Checks

```powershell
npm test
npm run typecheck
npm run build
npm run test:browser
```

Browser tests require Playwright Chromium (`npx playwright install chromium`) and a running production server at port 3100. `OHMI_TEST_URL` overrides the base URL. `OHMI_SKIP_MATRIX=1` runs focused interactions while omitting viewport/audit captures. Evidence is generated under ignored `test-results/`. Selected screenshots and verification notes live in `docs/`.

The root TypeScript and Vitest configurations exclude this independent app so its build artifacts and Node test runner cannot affect extension checks.

## Asset provenance

`public/mascot.png` is an exact byte copy of the approved `assets/mascot/ohmi-pixel-front.png`, SHA-256 `815ad3dff06433ed9081ef1a73fac2f97d7943d760e95a9ac11660d11ad39382`. Installation icons resize/pad that approved source; no replacement mascot was generated. Lucide supplies icons; shadcn/ui supplies Radix-backed button/dialog components customized with OHMI tokens. Geist is self-hosted through its fontsource package.

OHMI is independent of Autodesk. Example schematic and review copy are educational aids, not electrical verification.
