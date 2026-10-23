# OHMI cinematic landing page

Owner-approved MotionSites-inspired countryside landing page, live at https://meetohmi.vercel.app/ from `codex/ohmi-website`. The PWA is live at https://ohmi-workspace.vercel.app/. See [deployment, updates and rollback](DEPLOYMENT.md).

Canonical source is `src/`. `dist/` is now generated and ignored. Native HTML/CSS/JavaScript; no application dependencies, environment variables, trackers, backend or AI requests.

From repository root:

```powershell
npm run build --prefix website
npm test --prefix website
python -m http.server 4177 --bind 127.0.0.1 --directory website/dist
```

Review http://127.0.0.1:4177. In a second terminal:

```powershell
npm run test:browser --prefix website
```

The browser script uses the repository's existing Playwright dev dependency and writes screenshots/recordings to ignored `website/.impeccable/review/cinematic/`. `OHMI_WEBSITE_URL` overrides the local URL. The historical root `tests/website*.mjs` suites describe the previous production design and are retained for that branch; this redesign uses `website/tests/`.

The supplied countryside PNG and canonical mascot PNG remain unchanged in `src/assets`. The browser receives smaller WebP copies of the same artwork. Grandstander 900 and Inter are self-hosted with SIL OFL texts. Feature images are actual screenshots from the existing local PWA, not generated app mockups. See `design/cinematic/ASSETS.json`.

Environmental animation uses a small native WebGL source-image wind field with separate grass, hair, cloth, sky and antenna regions. It is **not** an image-to-video generation. OHMI's face/body stay fixed. A 24-second periodic field renders at a capped 30 fps. Pause control, hidden/offscreen pause, reduced motion, data-saving mode, unavailable WebGL and context loss retain still content. Entrance uses WAAPI with a 160 ms headline stagger.

Existing public `#top`, `#explore`, `#how-it-works`, `#get-started` and `#faq` anchors remain available. Legal answers are preserved; the setup FAQ now links to the deployed PWA. Launch OHMI and Meet OHMI use `/app`; Ask, Checker and Guided Builds cards open their corresponding PWA sections. The in-page scripted preview remains available. No live AI or cloud backend is connected.

Production evidence is under `design/production/`. Earlier review results and limits remain in the [cinematic report](design/cinematic/VERIFICATION.md); original design decisions are in the [implementation contract](design/cinematic/PLAN.md). Build output and working recordings are ignored; selected production proof is versioned. The owner authorized frontend production hosting on 24 October 2026. Backend integration remains outside this release.
