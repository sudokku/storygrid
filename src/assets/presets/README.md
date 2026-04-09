# Preset thumbnails

These six 96×96 PNGs are displayed in `src/Editor/EffectsPanel.tsx` as the visual preview chip strip for each photo preset (B&W, Sepia, Vivid, Fade, Warm, Cool). Rendered at 48×48 in the UI; bundled at 96×96 for HiDPI.

The current set is **placeholder** — programmatically-generated HSL diagonal gradients tinted to match each preset's character. Replace with hand-curated photos in a follow-up quick task for stronger visual identity.

Do **NOT** rename these files — `EffectsPanel.tsx` imports each by exact filename.

Regenerate the placeholders via:

```bash
node scripts/generate-preset-thumbs.mjs
```
