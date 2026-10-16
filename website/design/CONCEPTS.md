# OHMI website composition review

Prepared 16 October 2026. Owner clarified that this request is for a **new OHMI website**, separate from the existing extension. Three desktop concepts were generated using the built-in image tool, with the approved mascot and supplied Nimbus screenshot as references. The 5.43-second recording shows that same Nimbus composition with subtle character motion.

## Shared direction

- Near-black green ground, warm white typography, one mint action color.
- Spacious sans-serif display type; no gradient lettering. Headline: “A little buddy. A brighter build.”
- One clear primary action, a quieter secondary link, and compact navigation.
- Exact original pixel-art mascot rendered as a standalone image in implementation. Generated mascot details and generated wordmark lettering are **not** replacement approved assets.
- Sparse square star points adapt the reference's stars to OHMI's pixel-art identity. All motion needs a reduced-motion state.
- No invented social proof, store availability, pricing, adoption metrics, endorsements, or electrical verification.

## A: Orbit

Closest to the supplied reference. Center-aligned navigation and hero hierarchy: headline above supporting copy and two actions, with the mascot dominating the lower center. Roughly 5% side gutters, a 90px display at the generated image's width, a 720px text measure and generous 24–32px gaps. A single orbital ellipse frames the mascot's feet. Floating notes support the subject without competing with the main message; both are explicitly illustrative. Rounded mint CTA, thin secondary border, no boxed hero wrapper.

Implementation watchpoints: keep the headline and primary action above the fold at 1366×768; reduce star density and avoid oversized glow. On phones, stack text, actions and mascot; omit the peripheral notes if they crowd the subject. The image is a composition reference, not a page background.

## B: Workbench

Asymmetric roughly 50/50 text and character composition. The headline and actions occupy the left half; the right shows the mascot above one shallow product-preview panel. Mint is reserved for the active tab, primary action and modest environmental accents. The mock question and answer provide more immediate context than A. Strong visual scale contrast and a straight section divider give the following content a clear entry.

Implementation watchpoints: keep the preview as one clear interaction rather than nested cards. The generated headline extends close to the character; constrain the real grid to prevent overlap. On phones, text precedes the mascot and preview. Label the preview as scripted and make controls keyboard-operable.

## C: Spark

Typography takes roughly two thirds of the opening width, with the character lower-right. The mint horizon separates the hero from a brief follow-on message. Larger display type, fewer interface elements and no floating notes produce the strongest graphic statement. The image has roughly 4% outer gutters and a clear three-level type hierarchy: headline, supporting paragraph, and helper copy.

Implementation watchpoints: the large title needs fluid scaling and controlled wrapping. The generated title approaches the mascot, so real layout must allocate independent space. Keep the horizon decorative, avoid fabricating a 3D mascot or electrically meaningful diagram, and retain the exact source mascot.

## Proposed continuation

After the selected opening: one clearly labeled interactive learning preview; an open, concise introduction to assignments and saved steps grounded in source; setup instructions linking to the real repository; native FAQ disclosures and an independent-project footer. Every main action must reach a working destination. No data collection or provider request is needed.

## Status

The owner selected **C — Bold type and horizon** on 16 October 2026. The website has been implemented in `website/dist/`; see `SURFACE.md` for the approved direction and `VERIFICATION.md` for current evidence and limitations. The extension and backend remain outside this website scope.

Exact generation prompts and tool provenance are recorded in `prompts.json`. Original approved mascot authority remains `docs/OHMI_MASCOT.md`.
