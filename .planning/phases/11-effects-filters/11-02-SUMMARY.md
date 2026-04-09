---
phase: 11-effects-filters
plan: 02
subsystem: rendering
tags: [canvas, ctx-filter, blur, drawLeafToCanvas, export, three-path-parity]

requires:
  - phase: 11-effects-filters
    provides: effectsToFilterString contract + LeafNode.effects field (Plan 11-01)
provides:
  - drawLeafToCanvas applies ctx.filter from leaf.effects
  - Blur overdraw mitigation via cell-rect clip + expanded draw rect
  - LeafNode preview canvas redraws on effects reference change
  - Three-path parity (preview / PNG / MP4) verified by integration test
affects: [11-03]

tech-stack:
  added: []
  patterns:
    - "Single-hook effects application at the unified draw dispatch — caller-side parity guaranteed by structural forwarding"
    - "Blur overdraw + clip — expand destination rect by 2× blur, clip to original cell rect"

key-files:
  modified:
    - src/lib/export.ts
    - src/Grid/LeafNode.tsx
    - src/test/canvas-export.test.ts

key-decisions:
  - "Blur overdraw uses a cell-rect clip + expanded destination rect (D-04). Threading an inverse-scale through drawCover/drawContain would change their public contract; the documented intentional ~(rect.w + 4*blur)/rect.w content zoom under blur is consistent across preview/PNG/MP4."
  - "Fast path: when effectsToFilterString returns 'none', the function emits NO ctx.save/restore/filter assignment — zero overhead for leaves with default effects (which is the common case)."
  - "Defensive fallback: `leaf.effects ?? DEFAULT_EFFECTS` accommodates any future caller that constructs a partial leaf without the field; the type still requires it."
  - "videoExport.ts contains zero direct drawLeafToCanvas calls — it reaches the hook transitively through `renderGridIntoContext → renderNode → drawLeafToCanvas`. No videoExport changes were needed; integration test exercises the renderGridIntoContext path to lock the transitive chain."

requirements-completed: [EFF-05, EFF-08]

completed: 2026-04-09
---

# Phase 11 Plan 02: Draw Path Wiring

**Hooked the effects module into the single unified draw dispatch so preview, PNG export, and MP4 export all apply identical filters automatically — three-path parity is now structurally guaranteed and verified by an integration test.**

## drawLeafToCanvas — diff footprint

`src/lib/export.ts:304-360` (was 304-333). The function now reads `leaf.effects ?? DEFAULT_EFFECTS`, computes `filterStr` and `blurPad`, and conditionally wraps the existing four-branch dispatch in a `save/filter/clip … restore` block. The four dispatch branches now pass `drawRect` instead of `rect`. When `filterStr === 'none'` AND `blur === 0`, the function takes the zero-overhead fast path identical to its previous behaviour.

```ts
const effects = leaf.effects ?? DEFAULT_EFFECTS;
const filterStr = effectsToFilterString(effects);
const hasFilter = filterStr !== 'none';
const blurPad = effects.blur > 0 ? effects.blur * 2 : 0;

if (hasFilter) { ctx.save(); ctx.filter = filterStr; }
if (blurPad > 0) { ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip(); }

const drawRect = blurPad > 0
  ? { x: rect.x - blurPad, y: rect.y - blurPad, w: rect.w + blurPad * 2, h: rect.h + blurPad * 2 }
  : rect;

// existing four-branch dispatch — but now passes drawRect
...

if (hasFilter) { ctx.restore(); }
```

The clip is INSIDE the save/restore block, so a single `ctx.restore()` undoes both the filter and the clip together. This is safe because `blur > 0` always implies `filterStr !== 'none'` (the blur term contributes to the filter string), so the clip never lives outside a save/restore region.

## Blur overdraw algorithm

- **Wrapper** (chosen over per-helper). The expanded `drawRect` is computed once at the entry point of `drawLeafToCanvas` and threaded into the existing dispatch unchanged. Sub-helpers (`drawCoverImage`, `drawContainImage`, `drawPanned*`) need no edits.
- **Documented intentional zoom**: cover/contain math runs against the larger destination rect, so content under blur is scaled by `(rect.w + 4 * blur) / rect.w`. For a 200×200 cell with blur=10, that's 240/200 = 1.2×; for 100×100 with blur=5 → 1.2×. Locked by `dw === 240` / `dh === 120` assertions in `canvas-export.test.ts`.
- **Clip uses original cell rect**, so the bleed beyond the cell border is trimmed before the next sibling renders.

## Three-path parity verification (EFF-08)

- `src/lib/export.ts:362` (video branch): `drawLeafToCanvas(ctx, video, rect, leaf);` — passes the full `LeafNode`.
- `src/lib/export.ts:373` (image branch): `drawLeafToCanvas(ctx, img, rect, leaf);` — passes the full `LeafNode`.
- `src/lib/videoExport.ts`: `grep -c 'drawLeafToCanvas' src/lib/videoExport.ts` → 0. videoExport reaches the hook only through `renderGridIntoContext → renderNode`.
- Both `renderNode` call sites pass the full `leaf` object (not a Pick or destructure), so widening the `drawLeafToCanvas` signature to read `leaf.effects` is automatic. No call-site refactors were required at any of the three paths.

The new integration test `three-path parity: renderGridIntoContext forwards effects through to drawLeafToCanvas` constructs a single-leaf tree with `effects.brightness === 50`, calls `renderGridIntoContext` directly, and asserts the recorded `ctx.filter` assignments contain `'brightness(1.5)'`. This locks the transitive chain so a future refactor that destructures `leaf` somewhere along the path will fail loudly.

## LeafNode subscriber

`src/Grid/LeafNode.tsx:267-277` — added one comparison line:

```ts
curr.effects !== prevLeaf.effects
```

Reference inequality is correct because the store mutates effects through Immer (`setEffects`/`applyPreset`/`resetEffects`/`resetCell` all replace `leaf.effects` with a new object), so any change produces a new reference. No deep compare needed.

The existing `drawLeafToCanvas(ctx, source, { x: 0, y: 0, w: cw, h: ch }, leafState)` call at line 155 already passes the full `leafState` object, so the `effects` field flows through automatically.

## Tests added (canvas-export.test.ts)

Six new tests under `describe('drawLeafToCanvas effects hook')`:

1. **No-effects fast path** — DEFAULT_EFFECTS produces zero filter assignments and zero save/restore/clip calls.
2. **Brightness filter string** — `brightness: 50` sets `ctx.filter = 'brightness(1.5)'` exactly once, save/restore called.
3. **Blur 200×200 → 240×240** — blur=10 expands `dw`/`dh` to 240, clip rect = original 200×200.
4. **Blur 100×100 → 120×120** — blur=5 → dw/dh = 120 (locks the documented zoom-under-blur factor).
5. **Combined brightness + blur** — composes `'brightness(1.5) blur(5px)'` and applies clip + overdraw together.
6. **renderGridIntoContext parity** — full transitive chain test that asserts the `effects` field reaches `drawLeafToCanvas` through the export-side render path.

A new `makeFilterCtx()` helper records all `ctx.filter` assignments via a getter/setter pair so tests can assert exact filter strings without re-mocking the canvas API per test. Total file count: **31 passing** (was 25). Full suite: **524 passed** (was 518).

## Edge cases handled

- `blur > 0` AND `filterStr === 'none'` is impossible — blur contributes to the filter string, so the implication `blurPad > 0 → hasFilter` always holds. Clip is always inside save/restore.
- `leaf.effects` undefined falls back to `DEFAULT_EFFECTS` defensively.
- `borderRadius > 0` clip in `renderNode` (existing behavior) wraps around the entire `drawLeafToCanvas` call, so the effects clip nests inside the borderRadius clip. No interaction issues — both clips combine intersectively.
