# OHMI cinematic landing page

Local review build of the owner's MotionSites-inspired countryside redesign. **Not deployed or approved for production.** Production remains https://meetohmi.vercel.app/ on `codex/ohmi-website`.

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

Existing public `#top`, `#explore`, `#how-it-works`, `#get-started` and `#faq` anchors remain available. Existing FAQ/legal answers are preserved. Launch OHMI opens the clearly labeled local scripted preview; there is no fake download or live AI.

Verification and limits: [cinematic report](design/cinematic/VERIFICATION.md). Original master prompt and reference comparison decisions: [implementation contract](design/cinematic/PLAN.md). Build output and screenshots/recordings are excluded from Git. No production deployment is authorized until owner review.
