# OHMI website

Owner-approved Concept C: bold type and mint horizon. This is a separate static marketing site. The browser extension and backend are unchanged.

Production: [OHMI — Your Circuit Buddy](https://meetohmi.vercel.app/). Vercel project `meetohmi`, Hobby plan; automatic production deployments use `codex/ohmi-website` with root `website`. See [deployment settings and verification](VERCEL_DEPLOYMENT.md).

Earlier owner-private preview: [Sites preview](https://ohmi-circuit-buddy.purple-reed-2208.chatgpt.site).

`dist/` contains the **hand-authored, deployable source** (HTML, CSS, JavaScript and assets). `npm run build --prefix website` validates this output; no compiler or app dependencies are required. `.openai/hosting.json` identifies the earlier private Sites deployment. Design source, approval and prompts live in `design/`.

Preview from the repository root:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory website/dist
```

Open http://127.0.0.1:4173. Run `node tests/website.mjs` with that server running. The test uses the repository's existing Playwright installation and writes screenshots to ignored `website/.impeccable/review/`.

The learning preview is scripted and makes no AI request. Setup links point to the OHMI repository; this page does not claim Chrome Web Store availability. This website collects no student information and makes no external runtime requests.

Assets: `dist/assets/ohmi.png` is an exact copy of the approved original mascot, SHA-256 `815AD3DFF06433ED9081EF1A73FAC2F97D7943D760E95A9AC11660D11AD39382`. It must remain byte-identical. Special Gothic, Manrope and Silkscreen are self-hosted under their included SIL Open Font Licenses. Generated horizon provenance is recorded in `design/` and in the asset metadata.
