## verdict

- **Resolved — native document replacement/private save identity.** The atomic capture now returns the document together with its session identity; the identity includes a replacement generation as well as the native UID. The private save hook binds its record ID/revision to that identity and creates a separate record after native replacement, while ordinary edits retain the current save target. The new replacement-safe capture visibly states that a separate private project was created. The supplied regression evidence exercises native Open/New/example and actual File Open through de_web_opened with an identical UID, verifies the old private row remains byte-identical, and preserves the ordinary-edit update to revision 2.
- No visible regression from this fix batch in the recaptured desktop/light, desktop/dark, mobile/top or mobile/editor viewports.

## remaining

Clear for the one scored material fix. This verdict covers that fix at approved M2 local-persistence scope, not whole-surface production readiness. Hosted storage rollout, M3 AI integration and M4 native accessibility/polish remain separately gated; existing heading/subheading advisories and design metadata drift remain disclosed.

disposition: ship
