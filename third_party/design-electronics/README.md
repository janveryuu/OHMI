# Pinned local electronics engine

Source: https://github.com/rORrEtboLt/designElectronics, commit `4d9cb373bd06afb2d99b1548e6c3a0c86992bd56` (MIT). `upstream/` is that source archive with four explicit OHMI changes:

- `CMakeLists.txt`: pinned external SDL paths, browser adapter export, exception catching, no dynamic JavaScript execution.
- `src/web.cpp`: register the live App with the browser adapter.
- `src/ohmi_web.cpp`: bounded operations using upstream Document, McpSession, Simulator and export code.
- `src/panels.cpp`: replace three light-only presentation colors with Theme fields.

The engine, Arduino interpreter, catalog, routing and exporters remain upstream. The host does not claim hardware or full Arduino compatibility. The browser build intentionally excludes the desktop localhost MCP server. Its controlled loader ignores URL hash imports and remote design URLs.

## Build on Windows

Use an isolated directory such as `%USERPROFILE%/.codex/toolchains`; nothing needs a permanent PATH change. Exact commits and versions are in `lock.json`.

1. Clone emsdk into `toolchains/emsdk`; checkout `emsdkCommit`, install and activate Emscripten `5.0.7` without `--permanent`.
2. Clone SDL into `toolchains/ohmi-sdl/SDL` and SDL_ttf into `toolchains/ohmi-sdl/SDL_ttf`. Checkout the locked commits, then initialize SDL_ttf's recursive submodules. The build script checks every pin.
3. Install `cmake==3.31.6 ninja==1.11.1.4` Python wheels with `--target toolchains/ohmi-build-tools`. This is a local build tool directory, not an application dependency.
4. Run `./scripts/build-design-electronics.ps1` from the repository. Optional parameters: `-ToolchainRoot` and `-BuildRoot`. The default build cache is outside the repository.

The script creates the three public runtime artifacts, bundled dependency notices and `engine-manifest.json` with artifact sizes/SHA-256 and patched-source hashes. Only these runtime assets are served, not the vendored source. Rebuild after any native adapter/presentation change. The checked-in build is generated locally from source, not copied from an upstream release.

FreeType uses its FreeType License, not the alternate GPL option. Public notices retain the MIT, SDL, font, FreeType/dlg, HarfBuzz, PlutoSVG/PlutoVG and CC0 notices. Fonts are Lato and Source Code Pro under OFL 1.1; preserve both their notices and reserved font names.

## Local verification

From `web-app`, run `npm run typecheck`, `npm test`, `npm run build`, and `node tests/electronics-browser.mjs` against an isolated Next server on port 3140. The browser test starts the local Auth/Data fixture on 54329; do not run another fixture suite simultaneously. Required server environment:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-publishable-key
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3140
OHMI_LOCAL_TEST=true
OHMI_WEB_AI_ENABLED=false
```

Run `npx next dev --hostname 127.0.0.1 --port 3140`. Tests use synthetic users/circuits, no real provider requests or student records. Results live in `docs/playground-upgrade/evidence/`. These environment values belong only to this local test process; never deploy them.

## Browser contract

The experimental authenticated route is `/app/playground/electronics/`; the existing Playground remains default. The iframe has an opaque origin (`allow-scripts allow-downloads`, without `allow-same-origin`). The parent transfers one MessagePort to that exact frame; requests require protocol, nonce, increasing ID and bounded allowlisted operations. No path/network tools, provider secrets or auth tokens cross the port. Public runtime assets alone allow anonymous CORS; other pages retain frame denial. The frame's CSP forbids arbitrary connections, top navigation, forms and dynamic JavaScript evaluation.

Bridge limits: 1 MiB input/document, 2 MiB response, 200 imported parts, 800 wires, bounded JSON depth/text/numbers. Observations use one fresh Simulator over 0.05–5 seconds with at most 100 parts. Oversized native projects may still use upstream native export menus. Browser runtime is destroyed on route/account unmount; no cross-account autosave is restored. Local edits must be downloaded as `.dez` before leaving. M2 will add separately reviewed private cloud storage; M3 adds AI only after its own gate.
