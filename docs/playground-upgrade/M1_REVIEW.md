## verdict

- **Resolved — internal exit/data-loss guard.** The unchanged desktop/mobile recaptures retain the download warning and local-preview UI. Updated `electronics-workspace.tsx` now intercepts in-app anchor navigation before Next.js unmounts the editor and uses a history sentinel plus capture-phase `popstate` guard for browser Back. The evidence in `m1-browser.json` and its test source opens a real `.dez`, cancels link navigation and browser Back while retaining the same iframe/runtime and document, then confirms an exit and verifies runtime teardown. Browser unload, file replacement and explicit reload remain guarded.
- No visible regression from this fix batch in the recaptured desktop/mobile layouts.

## remaining

Clear for the one scored material fix. This verdict covers that fix at approved M1 local-preview scope, not whole-surface production readiness. Cloud persistence, AI building and final native accessibility/polish remain M2–M4 gates; the existing heading-size advisory and design metadata drift remain disclosed.

disposition: ship
