# Phase 11: Effects & Filters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 11-effects-filters
**Areas discussed:** Safari fallback, Preset carousel UI, Reset scope, Preset stickiness

---

## Safari 15 Fallback Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled compositing | Canvas 2D compositing + ImageData blur; zero dep; full WYSIWYG everywhere; high upfront cost | |
| context-filter-polyfill | Ship ~15KB polyfill; fast to integrate; bundle weight; slow blur on Safari | |
| Graceful degradation on Safari 15 | Use ctx.filter on modern browsers; show toast on old Safari | |
| **Drop Safari <18 entirely (user override)** | Use ctx.filter directly; no fallback; no polyfill; accept <1% user breakage | ✓ |

**User's choice:** Drop Safari <18 support for effects feature entirely.
**Notes:** User rationale — "Why even bother with older versions of browsers? This is a small and fast tool. I don't care about some legacy browsers filling less than 1% of users." This loosens the CLAUDE.md browser support floor for the effects feature only; core editor remains Safari 15+.

---

## Preset Carousel UI

| Option | Description | Selected |
|--------|-------------|----------|
| Live thumbnails of user's image | Per-cell canvas renders through each preset; Instagram-style; high discoverability; 6 off-screen renders per selection | |
| Static named chips | Text-only chips; simple; less discoverable | |
| Named chips with generic sample thumbnails | Fixed stock image rendered through each preset; zero runtime cost; still discoverable | ✓ |

**User's choice:** Named chips with generic sample thumbnails.
**Notes:** Balances discoverability and implementation simplicity. No per-cell render cost.

---

## Reset Button Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Effects only | One button; clears effects only; pan/zoom/fit untouched | |
| Entire cell state | One button; clears effects + pan/zoom/fit/bg | |
| Two buttons | Separate 'Reset effects' and 'Reset cell' | ✓ |

**User's choice:** Two separate reset buttons.
**Notes:** Precise control — EFF-06 satisfied by "Reset effects"; "Reset cell" adds broader escape hatch.

---

## Preset Stickiness After Fine-Tuning

| Option | Description | Selected |
|--------|-------------|----------|
| Preset clears — raw sliders only | Moving a slider clears preset highlight; preset is a starting point | ✓ |
| Sticky with modified indicator | Preset stays highlighted with 'modified' dot/badge | |
| Sticky, no indicator | Preset label stays highlighted even after tuning | |

**User's choice:** Preset clears on any slider nudge.
**Notes:** Simplest mental model. Preset is pure starting point. No "Vivid +custom" ambiguity.

---

## Claude's Discretion

- Exact preset numeric values (brightness/contrast/saturation/blur tuples per preset)
- Slider primitive implementation (custom pointer events vs native range with pointer capture layer)
- Exact Tailwind classes / visual design of chips, sliders, and reset buttons
- Whether the Effects section uses a collapsible header in SelectedCellPanel
- Whether reset buttons use icons, text, or both

## Deferred Ideas

- Live per-cell thumbnails in preset carousel (rejected for simplicity; revisit post-v1.2)
- Modified-preset indicator badge (rejected for simpler mental model)
- Safari 15–17 fallback (explicitly dropped)
- Global canvas-wide filter (EFF-F-03) — future requirement
- Compare-to-original long-press (EFF-F-02) — future requirement
- Additional sliders (warmth/tint/vignette/highlights/shadows — EFF-F-01) — future requirement
- Custom LUT import (EFF-F-04) — future requirement
