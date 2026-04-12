# Preset Sample Photo

`sample.jpg` is a 192x192px bundled image used for live CSS-filter preview
chips in the EffectsPanel. Each chip renders this same base image with a
different `filter` CSS property computed from `effectsToFilterString()`.

The old static PNG approach (bw.png, sepia.png, etc.) was replaced in Phase 18
with live CSS-filter previews for accuracy and zero maintenance overhead.
