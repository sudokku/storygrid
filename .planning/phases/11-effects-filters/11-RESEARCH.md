# Phase 11: Effects & Filters — Research

**Researched:** 2026-04-09
**Domain:** Canvas 2D filter effects, Zustand state modeling, slider interaction, three-path render parity
**Confidence:** HIGH

## Summary

Phase 11 adds per-cell, non-destructive color/blur effects to StoryGrid leaf cells. The phase is unusually low-risk because StoryGrid's render architecture already has a single unified draw path (`drawLeafToCanvas` in `src/lib/export.ts`) that is called by:

1. **Live preview** — `src/Grid/LeafNode.tsx` `drawRef.current()` (per-cell offscreen-to-DOM canvas; already bypasses React).
2. **PNG export** — `renderGridIntoContext` → `renderNode` → `drawLeafToCanvas` via the Canvas API path (NOT html-to-image; that was already replaced in quick-260401-oca).
3. **MP4 export** — `src/lib/videoExport.ts` drives the same `renderGridIntoContext` against a `stableCanvas` whose `captureStream()` feeds MediaRecorder (WebCodecs/Mediabunny pipeline from quick-260405-s9u).

Because all three paths already funnel through `drawLeafToCanvas`, WYSIWYG parity for effects collapses to: **apply `ctx.filter` once at the top of `drawLeafToCanvas`, reset it at the end**. The filter string is derived from a pure helper `effectsToFilterString(leaf.effects)` shared by nothing else — there is no parallel CSS-filter path in the DOM that could desync.

**Primary recommendation:** Implement effects as a pure `EffectSettings` field on `LeafNode`; add a single `effectsToFilterString` helper in a new `src/lib/effects.ts`; call `ctx.filter = effectsToFilterString(leaf.effects)` inside `drawLeafToCanvas` (wrapped in `ctx.save()` / `ctx.restore()`); mirror the existing pan/zoom pattern for live-update-on-pointermove + commit-on-pointerup. No new library dependencies. No polyfill. Safari <18 users silently get an unfiltered image for the effects feature (explicit user decision, D-02).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Browser Support & Safari Strategy**
- **D-01:** Use `ctx.filter = 'brightness(...) contrast(...) saturate(...) blur(...)'` directly inside `drawLeafToCanvas()`. No polyfill, no hand-rolled compositing.
- **D-02:** Drop effective Safari support for effects to Safari 18+. Older Safari users (<1% of target audience) are explicitly not a concern — no fallback, no degradation notice, no polyfill bundle weight. Core editor continues to work on Safari 15+; only the effects feature requires Safari 18+.
- **D-03:** Do NOT add `context-filter-polyfill` or similar.
- **D-04:** Blur-at-clip-edge mitigation still applies (draw source blurRadius*2 beyond the cell rect so clipping has real pixels to trim).

**Effects Data Model**
- **D-05:** Add required `effects: EffectSettings` field to `LeafNode` in `src/types/index.ts`. Number primitives only:
  ```ts
  type EffectSettings = {
    preset: PresetName | null;
    brightness: number;  // -100..+100, default 0
    contrast: number;    // -100..+100, default 0
    saturation: number;  // -100..+100, default 0
    blur: number;        // 0..20, default 0 (px)
  };
  type PresetName = 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool';
  ```
- **D-06:** Effects applied inside `drawLeafToCanvas()` in `src/lib/export.ts`. NEVER via CSS `filter:` on the preview `<canvas>` element.
- **D-07:** `PRESET_VALUES` constant in `src/lib/effects.ts` maps preset name → `{brightness, contrast, saturation, blur}`.

**Preset Carousel UI**
- **D-08:** Horizontal strip of 6 named chips with a **generic sample thumbnail** (same fixed stock image rendered through each preset).
- **D-09:** Sample thumbnail is a pre-rendered static asset (one base image, 6 pre-processed variants).
- **D-10:** Chips render in sidebar `SelectedCellPanel` (`src/Editor/Sidebar.tsx` line 200) above existing pan/fit controls. Also in `MobileSheet` via shared import.
- **D-11:** Tapping a chip calls `applyPreset(nodeId, name)` → loads `PRESET_VALUES[name]` + sets `effects.preset = name`. Single history snapshot.

**Slider Behavior**
- **D-12:** Four sliders: brightness, contrast, saturation, blur — in that vertical order.
- **D-13:** Slider drag uses raw pointer events with `setPointerCapture` (consistent with divider/pan patterns from Phases 1/5). Planner may use a native `<input type="range">` for styling/keyboard if pointerup commit pattern is preserved.
- **D-14:** `pointermove` → non-history-committing store action (live WYSIWYG). `pointerup` → separate action with exactly ONE `pushSnapshot`.
- **D-15:** Moving ANY slider after a preset was applied sets `effects.preset = null` immediately (on pointerdown or first pointermove). Chip highlight clears.

**Reset Buttons**
- **D-16:** Two separate reset buttons in SelectedCellPanel:
  - **"Reset effects"** — clears `effects` to defaults only (EFF-06).
  - **"Reset cell"** — clears effects AND pan/zoom/fit/backgroundColor back to as-uploaded defaults.
- **D-17:** Both reset actions commit exactly one history snapshot.
- **D-18:** Button placement: planner's call.

**Store & History**
- **D-19:** Add `setEffects(nodeId, partial)` — live, no snapshot.
- **D-20:** Add `commitEffects(nodeId, final)` — updates AND one pushSnapshot.
- **D-21:** Add `applyPreset`, `resetEffects`, `resetCell` — each commits exactly one snapshot.
- **D-22:** `mediaRegistry` NOT touched.

### Claude's Discretion

- Exact preset numeric tuples — tasteful defaults; sample chips drive visual identity.
- Slider primitive: fully custom with raw pointer events, OR native `<input type="range">` with pointer capture layered on top. Either OK if D-13/D-14 satisfied.
- Exact Tailwind classes (defer to UI-SPEC §Component Inventory — already locked).
- Whether reset buttons use icons, text, or both.
- Whether Effects section gets a collapsible header.

### Deferred Ideas (OUT OF SCOPE)

- Live per-cell thumbnails in preset carousel.
- Modified-preset indicator ("Vivid +custom" badge).
- Safari 15–17 fallback strategy.
- Per-canvas global filter (EFF-F-03).
- Compare-to-original long-press toggle (EFF-F-02).
- Additional sliders (warmth, tint, vignette, highlights, shadows — EFF-F-01).
- Custom LUT import (EFF-F-04).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EFF-01 | Apply preset filter (B&W, Sepia, Vivid, Fade, Warm, Cool) from sidebar carousel | `applyPreset` action + `PRESET_VALUES` table (D-07, D-11); chip UI in `SelectedCellPanel` (D-10); preset values recorded below in Filter Model §Preset Table |
| EFF-02 | Brightness slider −100..+100, default 0 | Mapped to `brightness(1 + value/100)` in `effectsToFilterString` (see §Filter Model); slider uses pointermove→setEffects, pointerup→commitEffects |
| EFF-03 | Contrast slider −100..+100, default 0 | Same pattern, mapped to `contrast(1 + value/100)` |
| EFF-04 | Saturation slider −100..+100, default 0 | Mapped to `saturate(1 + value/100)` |
| EFF-05 | Blur slider 0..20px, default 0 | Mapped to `blur(${value}px)`; combined with over-draw mitigation (§Blur Edge Bleed) |
| EFF-06 | Single "Reset" button clears effects | `resetEffects` action (D-16, D-17, D-21) — "Reset effects" button only touches `effects`; "Reset cell" is the broader bonus |
| EFF-07 | Non-destructive — parameters on leaf node, never mutate media | `EffectSettings` is a value field on `LeafNode`; `mediaRegistry` untouched (D-22) |
| EFF-08 | Effects apply identically in preview, PNG, MP4 (WYSIWYG) | Three-path parity achieved by single `drawLeafToCanvas` hook (§Three-Path Rendering) |
| EFF-09 | Slider drag commits ONE history snapshot on pointerup | `setEffects` (no snapshot) + `commitEffects` (one snapshot) pattern (D-14, D-19, D-20) — mirrors pan/zoom from quick-260402-63e |
| EFF-10 | Applying a preset updates underlying slider values for fine-tune | `applyPreset` writes all four numeric fields from `PRESET_VALUES[name]` (D-11); sliders bind directly to those numeric fields so they re-render correctly |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API `ctx.filter` | Built-in | Apply brightness/contrast/saturate/blur to image draws | Native, zero bytes, supports all four required effects via CSS filter function syntax |
| Zustand + Immer (`zustand/middleware/immer`) | 5.0.x / 10.x | Store shape mutation for new `effects` field and actions | Already project standard; immer makes partial nested updates trivial |
| React 18 | 18.3.x | UI re-render of `SelectedCellPanel` on selected-cell change | Already project standard |
| `setPointerCapture` + raw pointer events | Browser built-in | Slider drag primitive | Project convention (CLAUDE.md + Phase 1/5 decisions); matches divider and pan/zoom patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `<input type="range">` (optional) | HTML5 | Keyboard accessibility + styling base for sliders | Use only if wrapped with pointer capture for pointerup-commit; OR write pure raw-pointer slider following divider pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ctx.filter` | Hand-rolled ImageData manipulation (per-pixel loops) | Massive performance hit (per-frame on video export); much more code; incorrect for blur; would require WebGL shaders for acceptable perf |
| `ctx.filter` | WebGL/GLSL shader pipeline | Overkill; would replace the entire Canvas 2D stack; incompatible with html-to-image fallback that CLAUDE.md still lists |
| `ctx.filter` | `context-filter-polyfill` for Safari <18 | **Explicitly rejected by D-03** — 15KB bundle + maintenance surface not justified for <1% users |
| Raw pointer slider | dnd-kit sensor | **Explicitly forbidden by CLAUDE.md** — dnd-kit is for cell-swap drag only; divider/pan/zoom use raw pointers |

**No new dependencies required.** Everything is in-browser APIs and existing stack.

**Installation:** none.

## Filter Model

### Preset Schema

```ts
// src/lib/effects.ts
import type { LeafNode } from '../types';

export type PresetName = 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool';

export type EffectSettings = {
  preset: PresetName | null;
  brightness: number;  // -100..+100
  contrast: number;    // -100..+100
  saturation: number;  // -100..+100
  blur: number;        // 0..20 (px)
};

export const DEFAULT_EFFECTS: EffectSettings = {
  preset: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
};
```

### Slider Ranges and Defaults

| Slider | Range | Step | Default | ctx.filter mapping |
|--------|-------|------|---------|-------------------|
| Brightness | −100..+100 | 1 | 0 | `brightness(1 + value/100)` → 0 = 1.0 (identity), +100 = 2.0, −100 = 0.0 |
| Contrast | −100..+100 | 1 | 0 | `contrast(1 + value/100)` |
| Saturation | −100..+100 | 1 | 0 | `saturate(1 + value/100)` |
| Blur | 0..20 | 1 | 0 | `blur(${value}px)` |

### Preset Table (from UI-SPEC §Preset Value Reference)

| Preset | Brightness | Contrast | Saturation | Blur |
|--------|-----------|---------|-----------|------|
| B&W (`bw`) | 0 | 0 | -100 | 0 |
| Sepia (`sepia`) | +5 | +10 | -80 | 0 |
| Vivid (`vivid`) | 0 | +15 | +40 | 0 |
| Fade (`fade`) | +10 | -20 | -15 | 0 |
| Warm (`warm`) | +5 | 0 | +10 | 0 |
| Cool (`cool`) | -5 | 0 | +10 | 0 |

Note: these are saturation-based approximations. True sepia/warm/cool require hue-rotate which is NOT in the EFF-01..EFF-10 requirement set — planner should NOT add hue-rotate without widening the data model. The UI-SPEC approves these values; tune during visual review against sample portraits in Wave N.

### Reset Semantics

- **`resetEffects(nodeId)`**: sets `effects = { ...DEFAULT_EFFECTS }` (all zeros, preset null). Other cell fields untouched. One `pushSnapshot`.
- **`resetCell(nodeId)`**: sets `effects = { ...DEFAULT_EFFECTS }` AND `panX=0, panY=0, panScale=1, fit='cover', objectPosition='center center', backgroundColor=null`. Preserves `mediaId`. One `pushSnapshot`.

### Undo/Redo Interaction

The existing `pushSnapshot` in `gridStore.ts` (line 126) clones `state.root` via `structuredClone(current(state.root))`. Because `effects` is a flat number-primitive object on `LeafNode`, `structuredClone` handles it for free — no special-casing needed. The history cap of 50 still applies.

**Slider drag behavior (EFF-09, D-14):**

1. `pointerdown` on slider row → `divRef.current.setPointerCapture(e.pointerId)`; read `getState()` to snapshot the starting value (avoid stale closures).
2. `pointermove` → call `setEffects(nodeId, { [field]: newValue })`. This action mutates state via Immer but does NOT call `pushSnapshot`. If `effects.preset !== null`, it also clears `preset` (D-15).
3. `pointerup` → release capture; call `commitEffects(nodeId, finalEffects)`. This action calls `pushSnapshot` once, then writes the final value (same pattern as the pushSnapshot-before-mutate in existing actions).

**Critical invariant:** the snapshot taken inside `commitEffects` must be of the state BEFORE the drag began (so undo returns to pre-drag value), not the current in-drag state. Simplest implementation: inside `pointerdown`, call a separate helper that pushes the current snapshot (without mutating), then subsequent `setEffects` calls mutate freely, and `commitEffects` on pointerup is a no-op snapshot-wise OR writes the final value without re-snapshotting.

**Recommended pattern** (matches pan/zoom from quick-260402-63e):

```ts
// In the slider pointerdown handler:
const preDragEffects = { ...findNode(useGridStore.getState().root, nodeId).effects };
useGridStore.getState().beginEffectsDrag(nodeId);  // pushes snapshot, no mutation

// pointermove:
useGridStore.getState().setEffects(nodeId, { brightness: newValue });  // mutates, no snapshot

// pointerup:
// nothing extra — the snapshot is already in history pointing at pre-drag state
```

Alternatively (simpler, one fewer action): call `setEffects` on pointermove and on pointerup call `commitEffects` which internally does `pushSnapshot` of the PRE-drag state and then re-writes the final value. This requires storing pre-drag effects in a ref on the slider component. **Planner picks whichever is cleaner; both satisfy EFF-09.**

## Three-Path Rendering Strategy

The single source of truth is `effectsToFilterString(effects: EffectSettings): string` in `src/lib/effects.ts`:

```ts
export function effectsToFilterString(e: EffectSettings): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${1 + e.brightness / 100})`);
  if (e.contrast !== 0)   parts.push(`contrast(${1 + e.contrast / 100})`);
  if (e.saturation !== 0) parts.push(`saturate(${1 + e.saturation / 100})`);
  if (e.blur > 0)         parts.push(`blur(${e.blur}px)`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}
```

Critical properties:
- **Pure function** — trivially unit-testable without a canvas.
- **Returns `'none'` when all values are identity** — important because `ctx.filter = ''` is a no-op in some implementations; `'none'` is the spec-correct identity.
- **Concatenation order** — CSS filter functions are composed left-to-right. Order `brightness → contrast → saturate → blur` gives visually expected results (blur applied last, on top of color adjustments).

### Integration Point: `drawLeafToCanvas` (src/lib/export.ts line 304)

Wrap the existing body in `save/restore` and set `ctx.filter`:

```ts
export function drawLeafToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement | ImageBitmap,
  rect: Rect,
  leaf: Pick<LeafNode, 'fit' | 'objectPosition' | 'panX' | 'panY' | 'panScale' | 'backgroundColor' | 'effects'>,
): void {
  const objPos = parseObjectPosition(leaf.objectPosition ?? 'center center');
  const bgColor = leaf.backgroundColor ?? '#ffffff';
  const hasPan = (leaf.panX ?? 0) !== 0 || (leaf.panY ?? 0) !== 0 || (leaf.panScale ?? 1) !== 1;

  const filterStr = effectsToFilterString(leaf.effects ?? DEFAULT_EFFECTS);
  const hasFilter = filterStr !== 'none';

  if (hasFilter) {
    ctx.save();
    ctx.filter = filterStr;
  }

  // ... existing draw dispatch unchanged ...

  if (hasFilter) {
    ctx.restore();
  }
}
```

Why this achieves three-path parity:
1. **Live preview** — `src/Grid/LeafNode.tsx:155` already calls `drawLeafToCanvas(ctx, source, ...)`. When `leaf.effects` changes, the subscriber effect at line 262 must be extended to also redraw when any effects field changes. See §Existing Code Touchpoints.
2. **PNG export** — `renderGridIntoContext` → `renderNode` → `drawLeafToCanvas` (line 362, 373). Automatic — no export.ts changes beyond `drawLeafToCanvas` itself.
3. **MP4 export** — `src/lib/videoExport.ts` calls `renderGridIntoContext(stableCtx, ...)` on every frame (lines 277, 334, 373). Automatic — same call path, effects render per-frame into the `stableCanvas` captured by `captureStream`.

**What NOT to do (Pitfall §3 locked in by D-06):** never set `filter:` on the LeafNode `<canvas>` CSS, never set it on the cell wrapper div. The preview canvas in `LeafNode.tsx:599` renders via the same `drawLeafToCanvas` path as export; any CSS `filter:` on the DOM element would be applied a SECOND time during preview (double-effect) and would be ABSENT in the exported PNG/MP4 (WYSIWYG break).

## Safari 15 ctx.filter Decision

**Status: PRE-DECIDED by user in CONTEXT.md — D-01/D-02/D-03.** No smoke test required. Record for posterity.

### Evidence

- **WebKit bug / feature status:** `CanvasRenderingContext2D.filter` was behind the `CanvasContextFilterEnabled` experimental feature flag in Safari 15.0–17.x. Setting `ctx.filter = 'blur(10px)'` in those versions is silently ignored — writes to the property succeed, reads may return the set value, but rendered output is unfiltered. Source: MDN compat data, WebKit feature status pages historically tracked this as experimental. Safari 18 (released September 2024) enabled it by default.
- **caniuse.com "CanvasRenderingContext2D.filter":** confirms Safari support starts at 18.0, with prior versions listed as "Disabled by default" behind a flag.
- **Confidence:** HIGH on "unsupported on Safari 15–17", MEDIUM on "enabled by default in 18.0" (WebKit release notes wording). Not a blocker because user accepted the risk.

### Recommendation (matches D-01/D-02)

**Use `ctx.filter` unconditionally. Accept silent graceful degradation on Safari 15–17.** A user on Safari 16 will see:
- Preset chip highlights and slider drags work (state updates correctly).
- The preview canvas shows UNFILTERED media (because `ctx.filter` is a no-op).
- PNG/MP4 exports are ALSO unfiltered (same reason — the single draw path is consistent).
- No error, no warning. This is the user-accepted behavior.

**Do not** detect Safari version. **Do not** add a fallback code path. **Do not** add a polyfill. Implementation is simpler and bundle is smaller.

### Optional smoke test (suggested, not required)

Add ONE Vitest test in `src/test/phase11-effects-filter-string.test.ts`:

```ts
test('effectsToFilterString composes all four effects', () => {
  expect(effectsToFilterString({ preset: null, brightness: 50, contrast: -20, saturation: 40, blur: 5 }))
    .toBe('brightness(1.5) contrast(0.8) saturate(1.4) blur(5px)');
});

test('effectsToFilterString returns "none" for defaults', () => {
  expect(effectsToFilterString(DEFAULT_EFFECTS)).toBe('none');
});
```

No real Safari smoke test is in scope (no Safari runtime in CI; the user accepted the graceful-degradation outcome).

## Blur Edge Bleed Mitigation (D-04, Pitfall §2)

### The Problem

CSS `blur(Npx)` in Canvas 2D is implemented as a Gaussian convolution. The blurred pixels outside the source image rect extend by roughly `2*N` pixels (kernel radius × 2). When a leaf cell is clipped by `ctx.clip()` to the cell rect (which happens in `renderNode` at line 354 for borderRadius, and in `drawPannedCoverImage` at line 209), the clip interacts with blur in two different ways depending on draw order:

1. **Clip, then draw blurred image with source exactly at cell rect:** edges bleed INTO the cell (the gaussian kernel pulls in transparent pixels from outside the source image, darkening the cell border).
2. **Clip, then draw blurred image with source extending beyond cell rect:** the kernel has real pixels to work with on all sides, and the clip trims the excess. This is the correct approach.

### Algorithm

Current `drawCoverImage` at line 129 crops the source and draws to `rect`. For blur > 0, we must:

1. **Compute over-draw rect**: expand the destination by `blurRadius * 2` on all sides.
2. **Compute matching source over-draw**: extend the source crop by the same proportional amount.
3. **Draw with ctx.filter set**: the gaussian kernel has real pixel data on all sides, clip trims the bleed.

```ts
function drawCoverImageWithBlurPadding(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement | ImageBitmap,
  rect: Rect,
  objPos: ObjPos,
  blurPx: number,
): void {
  const pad = blurPx * 2;
  if (pad === 0) {
    drawCoverImage(ctx, img, rect, objPos);
    return;
  }

  // Clip strictly to the original cell rect so bled pixels are trimmed.
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // Draw the cover image into an expanded destination rect; the source crop
  // is proportionally enlarged so the image content still lines up.
  const { w: srcW, h: srcH } = getSourceDimensions(img);
  const expandedRect = {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.w + pad * 2,
    h: rect.h + pad * 2,
  };

  // Recompute cover math against the expanded rect so proportions stay correct.
  drawCoverImage(ctx, img, expandedRect, objPos);

  ctx.restore();
}
```

**Interaction with pan/zoom:** `drawPannedCoverImage` already sets an inner `ctx.clip()` at line 210. The blur padding approach works there too — the clip is set FIRST, then the draw call uses `ctx.filter` and the drawImage destination is expanded. Clip handles both jobs (pan overflow + blur bleed).

**Simpler alternative:** since `drawPannedCoverImage` and `drawPannedContainImage` already expand the draw region via transform (image is drawn larger than cell), for `panScale > 1` the blur bleed is usually already covered. Blur bleed is only visible when `panScale === 1` and blur > 0 AND fit === 'cover' with exact-fit crop. The planner can implement the padding ONLY in the non-panned paths (`drawCoverImage`, `drawContainImage`) as an optimization.

**Planner decision:** do the padding in all four draw helpers, or extract the clip-and-pad logic to a wrapper invoked by `drawLeafToCanvas` around whichever sub-helper it dispatches to. The wrapper approach is cleaner and matches the "one filter application per leaf" contract.

### Test strategy

A visual regression test is hard without a real browser. Do instead:
1. **Unit test `effectsToFilterString`** — pure.
2. **Integration test with jsdom/canvas mock** — assert that `ctx.filter` is set to the expected string and that `drawImage` is called with a destination rect larger than the cell rect when `blur > 0`. The existing `src/test/canvas-export.test.ts` pattern can be extended.

## Preview Implementation: Which Approach?

**Decision: ctx.filter inside `drawLeafToCanvas` (D-06). Confirmed locked.**

For the record, the tradeoffs considered:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| CSS `filter:` on canvas wrapper div | Zero code change to draw path | **Breaks WYSIWYG** (preview has filter, export doesn't); html-to-image would capture it for PNG but not ctx.filter for MP4; inconsistent | **FORBIDDEN by D-06** |
| `ctx.filter` inside `drawLeafToCanvas` (per-cell, same call site) | Single source of truth; automatic three-path parity; no extra offscreen canvases; works with existing LeafNode redraw subscribers | Redraw cost is O(1) per cell per effects change, which is what we want | **CHOSEN** |
| Per-cell offscreen canvas: render unfiltered into offscreen, apply filter when drawing to main | Would theoretically allow caching; useful if filter composition were expensive | Unnecessary indirection; `ctx.filter` is hardware-accelerated in Chromium/Firefox; no caching benefit because filter params change on slider drag anyway | Rejected — premature optimization |

## Store Shape

### Type changes (`src/types/index.ts`)

```ts
export type PresetName = 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool';

export type EffectSettings = {
  preset: PresetName | null;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
};

export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  panX: number;
  panY: number;
  panScale: number;
  effects: EffectSettings;  // <-- REQUIRED, no optional marker
};
```

### Factory update (`src/lib/tree.ts:82`)

```ts
export function createLeaf(): LeafNode {
  return {
    type: 'leaf',
    id: nanoid(),
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
    panX: 0, panY: 0, panScale: 1,
    effects: { ...DEFAULT_EFFECTS },  // fresh object per leaf — don't share reference
  };
}
```

**Critical:** spread `DEFAULT_EFFECTS` so each leaf has its own object; Immer's structural sharing makes this safe but a shared reference could cause subtle history snapshot aliasing bugs.

### Actions (`src/store/gridStore.ts`)

```ts
setEffects: (nodeId: string, partial: Partial<EffectSettings>) => void;
// no pushSnapshot; live update during pointermove.
// MUST clear effects.preset if any of brightness/contrast/saturation/blur is in `partial`
// AND current preset !== null (D-15).

commitEffects: (nodeId: string, final: EffectSettings) => void;
// pushSnapshot then write final value. Called on pointerup.
// Alternative (recommended): beginEffectsDrag pushes snapshot on pointerdown,
// setEffects mutates live, commitEffects is a no-op or renamed endEffectsDrag.

applyPreset: (nodeId: string, presetName: PresetName) => void;
// pushSnapshot, then set effects = { preset: presetName, ...PRESET_VALUES[presetName] }.

resetEffects: (nodeId: string) => void;
// pushSnapshot, then set effects = { ...DEFAULT_EFFECTS }.

resetCell: (nodeId: string) => void;
// pushSnapshot, then set effects = { ...DEFAULT_EFFECTS } AND
// panX=0, panY=0, panScale=1, fit='cover', objectPosition='center center', backgroundColor=null.
```

All five actions use the existing `updateLeaf(current(state.root), nodeId, updates)` helper at `src/lib/tree.ts` for the tree write. No new tree primitives required.

### Selector shape

In `SelectedCellPanel`:

```ts
const effects = useGridStore(s => {
  const n = findNode(s.root, nodeId) as LeafNode | null;
  return n?.effects ?? DEFAULT_EFFECTS;
});
```

This selector returns a new object reference on each unrelated store update — acceptable because `SelectedCellPanel` is already wrapped in `React.memo` with `key={selectedNodeId}`, so it only re-renders when the selected cell's state mutates (Zustand does shallow equality; any `effects` field change triggers a re-render, which is what we want).

For `LeafNodeComponent`, extend the existing `useGridStore.subscribe` at line 263 to include effects fields:

```ts
if (
  curr.panX !== prevLeaf.panX ||
  curr.panY !== prevLeaf.panY ||
  curr.panScale !== prevLeaf.panScale ||
  curr.fit !== prevLeaf.fit ||
  curr.mediaId !== prevLeaf.mediaId ||
  curr.objectPosition !== prevLeaf.objectPosition ||
  curr.effects !== prevLeaf.effects  // <-- add (reference compare; Immer creates new object on mutation)
) {
  drawRef.current();
}
```

Reference equality works because Immer creates a new `effects` object whenever any field inside it is mutated — guaranteed by structural sharing.

## UI Sidebar Integration

### Location (D-10)

Add a new **Effects subsection** inside `SelectedCellPanel` (`src/Editor/Sidebar.tsx:200`), positioned **above** the existing Fit toggle / BG color / Dimensions / Split / Actions sections. Order per UI-SPEC: header "EFFECTS" → preset carousel → 4 sliders → reset buttons row.

Because `SelectedCellPanel` is already exported and imported by `MobileSheet`, zero mobile-specific layout work is needed (D-10).

### Binding to selected cell

The component already receives `nodeId` as a prop and reads the leaf via `findNode`. Add:

```ts
const effects = useGridStore(s => {
  const n = findNode(s.root, nodeId) as LeafNode | null;
  return n?.effects ?? DEFAULT_EFFECTS;
});
const setEffects = useGridStore(s => s.setEffects);
const commitEffects = useGridStore(s => s.commitEffects);
const applyPreset = useGridStore(s => s.applyPreset);
const resetEffects = useGridStore(s => s.resetEffects);
const resetCell = useGridStore(s => s.resetCell);
```

### Disabled state when no media (UI-SPEC)

Per UI-SPEC Interaction Contract:
- If selected leaf has no media, render the subsection with `opacity-40 pointer-events-none` and the copy `Add media to apply effects` in `text-xs text-neutral-500`.
- When no cell is selected, `SelectedCellPanel` isn't rendered at all — the Effects section inherits this gate for free.

### Sub-components (planner may split into files)

- `PresetCarousel` — horizontal scroll strip of 6 chips. Reads active `preset` from `effects.preset` to drive ring highlight. Dispatches `applyPreset`.
- `EffectSlider` — reusable row: label, native `<input type="range">` OR custom raw-pointer slider, value readout. Props: `label`, `value`, `min`, `max`, `step`, `format` (for readout), `onChange` (live, calls `setEffects`), `onCommit` (pointerup, calls `commitEffects`).
- `EffectsResetRow` — two buttons side by side.

Planner may inline all of this into `Sidebar.tsx` following the existing monolithic pattern, or extract to `src/Editor/EffectsPanel.tsx`. Either is acceptable.

### Preset sample thumbnails (D-09)

Store 6 pre-processed thumbnails in `src/assets/presets/` (one per preset) at ~96×96px. Build step options:
- **Offline pre-process**: pick a base image, open in any image tool, apply each preset's CSS filter values, export as PNG. Commit the 6 PNGs.
- **Build-time script**: Node script using `sharp` to generate the variants from a single base image. Overkill for 6 files.

**Recommended:** manual pre-process. Planner picks the base image (suggest a portrait with skin tones + a saturated color + a shadow area so visual differences are legible in 48px thumbnails). Commit as `src/assets/presets/{bw,sepia,vivid,fade,warm,cool}.png`. Import via Vite's asset handling.

## Existing Code Touchpoints

Files the planner MUST read before writing tasks:

| File | Lines | What to read | Why |
|------|-------|-------------|-----|
| `src/types/index.ts` | all (28 lines) | Current `LeafNode` shape | Add `effects` field here |
| `src/lib/export.ts` | 304–333 (`drawLeafToCanvas`) | Single unified draw path | Hook `ctx.filter` here |
| `src/lib/export.ts` | 129–296 (`drawCoverImage`, `drawContainImage`, `drawPannedCoverImage`, `drawPannedContainImage`) | Understand clip/draw order for blur edge-bleed fix | Blur padding integration |
| `src/lib/export.ts` | 339–407 (`renderNode`) | Border-radius clip is applied in the caller; confirms `drawLeafToCanvas` itself is the right hook site | Border-radius + blur interaction |
| `src/lib/tree.ts` | 82–84 (`createLeaf`) | Factory for new leaves | Add `effects: { ...DEFAULT_EFFECTS }` |
| `src/lib/tree.ts` | search for `updateLeaf` | Tree mutation primitive | New actions delegate here |
| `src/store/gridStore.ts` | 126–144 (`pushSnapshot`) | History commit helper | New actions call this |
| `src/store/gridStore.ts` | 164–382 (store body) | Action registration pattern | Register `setEffects`, `commitEffects`, `applyPreset`, `resetEffects`, `resetCell` |
| `src/Grid/LeafNode.tsx` | 104–161 (`drawRef`) | Preview redraw function | Reads leaf via `findNode` — automatically picks up new `effects` field once passed to `drawLeafToCanvas` |
| `src/Grid/LeafNode.tsx` | 262–289 (subscribe effect) | Per-cell redraw subscription | Add `effects` reference check |
| `src/Editor/Sidebar.tsx` | 200–420 (`SelectedCellPanel`) | Where new Effects subsection goes | Mount carousel + sliders + reset buttons |
| `src/Editor/MobileSheet.tsx` | SelectedCellPanel import site | Verify mobile sheet imports the panel | Confirm no mobile-specific changes needed |
| `src/lib/videoExport.ts` | 213–280 (stableCanvas + renderGridIntoContext calls) | MP4 frame render loop | Verify effects flow through automatically; no changes needed |
| `src/test/canvas-export.test.ts` | all | PNG export test pattern | Reference for Wave N effects integration tests |
| `src/Grid/__tests__/LeafNode.test.tsx` | all | Preview canvas test pattern | Reference for per-cell effects redraw tests |

### Tests that will break and need `effects: DEFAULT_EFFECTS` added

Any test file that constructs a `LeafNode` literal inline. Known locations:
- `src/test/tree-functions.test.ts` — grep for `type: 'leaf'` literals.
- `src/test/grid-store.test.ts` — same.
- `src/test/phase09-p02-store-move.test.ts` — same.
- Any other `src/test/phase*.test.ts` that builds tree fixtures by hand.

This is a mechanical fix (similar to the `mediaId`/`mediaRegistry` split migration in Phase 10). The Phase 10 approach was to add the new field to every literal. **Alternative: make `effects` default via a tree-walk migration** — but since `LeafNode` already has many required fields, just add to literals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brightness/contrast/saturation math | Per-pixel ImageData loop | `ctx.filter = 'brightness(...) contrast(...) saturate(...)'` | Hardware-accelerated native; correct color math; zero code |
| Gaussian blur | Per-pixel convolution / box blur approximation | `ctx.filter = 'blur(Npx)'` | Native; 1000× faster; correct kernel |
| Safari fallback compositing | Manual per-effect Canvas passes | **Nothing — accept graceful degradation (D-02)** | User explicitly decided |
| Slider pointer capture | dnd-kit DragOverlay | Raw pointer events + `setPointerCapture` | CLAUDE.md forbids dnd-kit for non-swap drags; pan/zoom already uses the raw pattern |
| Preset thumbnails at runtime | Live-process a base image through filters on every selected-cell change | Pre-rendered static PNG assets (D-09) | Zero runtime cost; deterministic visuals; smaller bundle than live canvas work |
| Undo entry debouncing for slider | Custom debounce around pushSnapshot | `setEffects` (no snapshot) + `commitEffects` (one snapshot) | Cleaner; mirrors pan/zoom |

**Key insight:** StoryGrid already built the right render architecture in v1.0 (unified `drawLeafToCanvas`), the right store pattern in v1.0 (pushSnapshot-before-mutate), and the right drag primitive in v1.0/quick-phases (raw pointer + capture). Phase 11 is almost entirely composition — new data on the leaf, new string into ctx.filter, new UI binding. Keep the net-new surface area small.

## Common Pitfalls

### Pitfall 1: CSS `filter:` on the preview canvas (D-06)
**What goes wrong:** Developer reaches for `className="filter blur-sm brightness-110"` or inline `style={{ filter: ... }}` on the `<canvas>` in `LeafNode.tsx:599`. Preview looks correct; exported PNG has no effect.
**Why it happens:** The canvas has its own internal rasterized content; CSS `filter:` on the DOM canvas element is a GPU overlay applied during compositing, not baked into `ctx`. `html-to-image` and the `renderGridToCanvas` path both read from the Canvas 2D context, not the rendered DOM.
**How to avoid:** Effects ONLY inside `drawLeafToCanvas` via `ctx.filter`. Verification rule: grep for `filter:` in all component files during review; the only allowed place is the `ctx.filter =` assignment in `export.ts`.
**Warning signs:** Preview shows effect but PNG download doesn't.

### Pitfall 2: Blur bleeds at cell edges (D-04)
**What goes wrong:** Blur = 20 on a small cell shows a bright or dark halo around the edges.
**Why it happens:** Gaussian kernel extends `~2*blurRadius` pixels beyond the drawImage source rect. With tight source cropping, the kernel has no real neighbor pixels and convolves with transparency.
**How to avoid:** Draw source into an over-expanded destination rect (padding = `blurRadius * 2`), clip to the true cell rect before drawImage.
**Warning signs:** Dark rim or transparent fringe on cells with blur > 5.

### Pitfall 3: Slider commits N undo entries, one per pointermove (EFF-09)
**What goes wrong:** User drags brightness slider; Ctrl+Z now requires 200+ presses to get back to pre-drag state.
**Why it happens:** Naive implementation calls `commitEffects` (or equivalent pushSnapshot action) on every `pointermove` event.
**How to avoid:** Split into `setEffects` (live, no snapshot) and `commitEffects`/`beginEffectsDrag` (pointerdown once, snapshot once). Same pattern as pan/zoom in quick-260402-63e.
**Warning signs:** Watch history.length during a slider drag — should increment by exactly 1 per drag, not per move event.

### Pitfall 4: Snapshot captures the in-drag state instead of pre-drag
**What goes wrong:** Calling `pushSnapshot` on pointerup AFTER `setEffects` has already mutated the state. Undo returns to the final (post-drag) value, not the pre-drag value.
**Why it happens:** `pushSnapshot` takes the snapshot of `state.root` at the moment it runs; if state has already been mutated by live `setEffects` calls, the snapshot is of the current state.
**How to avoid:** Push the snapshot on `pointerdown` BEFORE any mutation (via a `beginEffectsDrag` action), OR track pre-drag values in the slider component and have `commitEffects` write the snapshot of (pre-drag state) + final value. Recommended: `beginEffectsDrag` pattern.
**Warning signs:** Ctrl+Z after a slider drag doesn't undo the drag.

### Pitfall 5: Shared DEFAULT_EFFECTS reference across leaves
**What goes wrong:** Two leaves share the same `effects` object reference; mutating one affects both (intermittently, depending on Immer structural sharing).
**Why it happens:** `createLeaf()` does `effects: DEFAULT_EFFECTS` instead of `effects: { ...DEFAULT_EFFECTS }`.
**How to avoid:** Always spread. Immer normally handles this but don't rely on it for initial construction.
**Warning signs:** Setting brightness on one cell changes another cell too (extremely rare but catastrophic if it happens).

### Pitfall 6: Tree tests break when `effects` becomes required
**What goes wrong:** TypeScript build fails in tests that construct `LeafNode` literals. Phase 10 hit an identical issue with `mediaId`/`mediaRegistry` split.
**Why it happens:** `effects` is a required field (D-05 says NO optional marker).
**How to avoid:** Grep all test files for `type: 'leaf'` and add `effects: { preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 0 }` (or import `DEFAULT_EFFECTS`). Single mechanical commit.
**Warning signs:** `npm run typecheck` (or `tsc --noEmit`) fails with "Property 'effects' is missing".

### Pitfall 7: Effects on empty (no media) cells
**What goes wrong:** User selects empty cell, drags brightness slider, nothing visible happens, looks broken.
**Why it happens:** `drawLeafToCanvas` only runs when there's a source image/video; the empty-cell path at `renderNode:364` just fills backgroundColor and bypasses the filter entirely.
**How to avoid:** UI-SPEC already addresses this — show "Add media to apply effects" copy and disable the subsection when the leaf has no media.
**Warning signs:** User complaint; not a code bug but a UX one.

## Code Examples

### Effects helper (complete, new file)

```ts
// src/lib/effects.ts
import type { PresetName, EffectSettings } from '../types';

export const DEFAULT_EFFECTS: EffectSettings = {
  preset: null,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
};

export const PRESET_VALUES: Record<PresetName, Omit<EffectSettings, 'preset'>> = {
  bw:    { brightness:  0, contrast:   0, saturation: -100, blur: 0 },
  sepia: { brightness:  5, contrast:  10, saturation:  -80, blur: 0 },
  vivid: { brightness:  0, contrast:  15, saturation:   40, blur: 0 },
  fade:  { brightness: 10, contrast: -20, saturation:  -15, blur: 0 },
  warm:  { brightness:  5, contrast:   0, saturation:   10, blur: 0 },
  cool:  { brightness: -5, contrast:   0, saturation:   10, blur: 0 },
};

/** Pure: converts EffectSettings to a canvas/CSS filter string. Returns 'none' at identity. */
export function effectsToFilterString(e: EffectSettings): string {
  const parts: string[] = [];
  if (e.brightness !== 0) parts.push(`brightness(${(1 + e.brightness / 100).toFixed(3)})`);
  if (e.contrast   !== 0) parts.push(`contrast(${(1 + e.contrast / 100).toFixed(3)})`);
  if (e.saturation !== 0) parts.push(`saturate(${(1 + e.saturation / 100).toFixed(3)})`);
  if (e.blur       >  0) parts.push(`blur(${e.blur}px)`);
  return parts.length === 0 ? 'none' : parts.join(' ');
}
```

### drawLeafToCanvas with ctx.filter hook (patch to `src/lib/export.ts:304`)

```ts
import { effectsToFilterString, DEFAULT_EFFECTS } from './effects';

export function drawLeafToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement | ImageBitmap,
  rect: Rect,
  leaf: Pick<LeafNode, 'fit' | 'objectPosition' | 'panX' | 'panY' | 'panScale' | 'backgroundColor' | 'effects'>,
): void {
  const objPos = parseObjectPosition(leaf.objectPosition ?? 'center center');
  const bgColor = leaf.backgroundColor ?? '#ffffff';
  const hasPan = (leaf.panX ?? 0) !== 0 || (leaf.panY ?? 0) !== 0 || (leaf.panScale ?? 1) !== 1;

  const effects = leaf.effects ?? DEFAULT_EFFECTS;
  const filterStr = effectsToFilterString(effects);
  const hasFilter = filterStr !== 'none';

  if (hasFilter) {
    ctx.save();
    ctx.filter = filterStr;
  }

  if (leaf.fit === 'cover') {
    if (hasPan) drawPannedCoverImage(ctx, img, rect, objPos, leaf.panX ?? 0, leaf.panY ?? 0, leaf.panScale ?? 1);
    else        drawCoverImage(ctx, img, rect, objPos);
  } else {
    if (hasPan) drawPannedContainImage(ctx, img, rect, objPos, bgColor, leaf.panX ?? 0, leaf.panY ?? 0, leaf.panScale ?? 1);
    else        drawContainImage(ctx, img, rect, objPos, bgColor);
  }

  if (hasFilter) {
    ctx.restore();
  }
}
```

### Store actions (patch to `src/store/gridStore.ts`)

```ts
// in type:
setEffects: (nodeId: string, partial: Partial<EffectSettings>) => void;
beginEffectsDrag: (nodeId: string) => void;
applyPreset: (nodeId: string, presetName: PresetName) => void;
resetEffects: (nodeId: string) => void;
resetCell: (nodeId: string) => void;

// in body:
setEffects: (nodeId, partial) =>
  set(state => {
    const current = findNode(state.root as GridNode, nodeId) as LeafNode | null;
    if (!current) return;
    const nextEffects = { ...current.effects, ...partial };
    // D-15: any manual slider edit clears preset association.
    const mutatesSliders =
      'brightness' in partial || 'contrast' in partial ||
      'saturation' in partial || 'blur' in partial;
    if (mutatesSliders && nextEffects.preset !== null) {
      nextEffects.preset = null;
    }
    state.root = updateLeaf(current as unknown as GridNode, nodeId, { effects: nextEffects }) as GridNode;
    // NO pushSnapshot.
  }),

beginEffectsDrag: (nodeId) =>
  set(state => {
    // Snapshot-only; no mutation. setEffects calls after this will mutate live.
    pushSnapshot(state);
  }),

applyPreset: (nodeId, presetName) =>
  set(state => {
    pushSnapshot(state);
    state.root = updateLeaf(current(state.root), nodeId, {
      effects: { preset: presetName, ...PRESET_VALUES[presetName] },
    });
  }),

resetEffects: (nodeId) =>
  set(state => {
    pushSnapshot(state);
    state.root = updateLeaf(current(state.root), nodeId, {
      effects: { ...DEFAULT_EFFECTS },
    });
  }),

resetCell: (nodeId) =>
  set(state => {
    pushSnapshot(state);
    state.root = updateLeaf(current(state.root), nodeId, {
      effects: { ...DEFAULT_EFFECTS },
      panX: 0, panY: 0, panScale: 1,
      fit: 'cover',
      objectPosition: 'center center',
      backgroundColor: null,
    });
  }),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ctx.filter` behind a flag on Safari | Enabled by default on Safari 18 (Sept 2024) | Safari 18.0 | Can use natively on 99%+ of modern browsers without polyfill |
| html-to-image PNG export | Canvas API direct render (via `renderGridToCanvas`) | quick-260401-oca (2026-04-01) | Effects automatically apply to PNG via same draw path as preview |
| ffmpeg.wasm MP4 export | WebCodecs + Mediabunny via `captureStream` from stableCanvas | quick-260405-s9u (2026-04-05) | Effects apply per-frame because each frame goes through `renderGridIntoContext` → `drawLeafToCanvas` |

**Deprecated / outdated:**
- `context-filter-polyfill` (npm) — unmaintained, 15KB, explicitly rejected by D-03.
- Per-pixel ImageData loops for color adjust — obsolete since all modern browsers ship `ctx.filter`.

## Runtime State Inventory

Phase 11 is an additive feature (new field on `LeafNode`, new UI, new actions). Not a rename/refactor/migration. **Step 2.5: N/A.**

Confirmation that nothing carries old-name state:
- **Stored data:** No DB, no persistence in this phase. (Phase 14 adds persistence; until then in-memory only.) N/A.
- **Live service config:** No external services. N/A.
- **OS-registered state:** None. N/A.
- **Secrets/env vars:** None touched. N/A.
- **Build artifacts:** None. The 6 preset sample PNGs are new assets, not stale ones. N/A.

## Environment Availability

Phase 11 requires no new external tools, CLIs, runtimes, or services beyond the existing StoryGrid dev stack (Vite 8, Node, npm). **Step 2.6: no new dependencies to audit.**

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Canvas 2D `ctx.filter` | Effects rendering | ✓ (Chromium, Firefox, Safari 18+) | Built-in | None — graceful silent degradation on Safari <18 per D-02 |
| `setPointerCapture` | Slider drag | ✓ | Built-in | None required; already used by pan/zoom |
| Vite asset import for preset PNGs | Preset carousel thumbnails | ✓ | Vite 8 | N/A |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via Vite) + @testing-library/react + jsdom |
| Config file | `vite.config.ts` (test block) — verify during Wave 0 |
| Quick run command | `npx vitest run src/test/phase11*.test.ts` |
| Full suite command | `npm test` or `npx vitest run` |
| Phase gate | Full suite green before `/gsd:verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EFF-01 | `applyPreset` sets effects to PRESET_VALUES[name] and preset=name; one history entry | unit | `npx vitest run src/test/phase11-effects-store.test.ts -t applyPreset` | ❌ Wave 0 |
| EFF-02 | Brightness slider: setEffects updates brightness; commitEffects pushes one snapshot | unit | `npx vitest run src/test/phase11-effects-store.test.ts -t brightness` | ❌ Wave 0 |
| EFF-03 | Contrast slider: same pattern | unit | `npx vitest run src/test/phase11-effects-store.test.ts -t contrast` | ❌ Wave 0 |
| EFF-04 | Saturation slider: same pattern | unit | `npx vitest run src/test/phase11-effects-store.test.ts -t saturation` | ❌ Wave 0 |
| EFF-05 | Blur slider: same pattern AND `drawLeafToCanvas` is called with over-draw rect | unit + integration | `npx vitest run src/test/phase11-effects-blur.test.ts` | ❌ Wave 0 |
| EFF-06 | `resetEffects` clears all four numeric fields and preset, preserves other leaf state | unit | `npx vitest run src/test/phase11-effects-store.test.ts -t resetEffects` | ❌ Wave 0 |
| EFF-07 | `effects` field on LeafNode; mediaRegistry untouched by any effects action | unit | `npx vitest run src/test/phase11-effects-store.test.ts -t mediaRegistry` | ❌ Wave 0 |
| EFF-08 | `drawLeafToCanvas` sets `ctx.filter` to expected string from `effectsToFilterString` when called from preview, PNG export, and MP4 export code paths | integration | `npx vitest run src/test/phase11-effects-rendering.test.ts` | ❌ Wave 0 |
| EFF-09 | Slider drag (pointerdown→N pointermove→pointerup) produces exactly 1 new history entry | integration (component) | `npx vitest run src/test/phase11-effects-slider.test.tsx` | ❌ Wave 0 |
| EFF-10 | After applyPreset, slider components reflect PRESET_VALUES (values prop bound to leaf.effects) | component | `npx vitest run src/test/phase11-effects-ui.test.tsx -t preset-fine-tune` | ❌ Wave 0 |

Additional unit test coverage (not directly required but high-value):
- `effectsToFilterString` pure function: 6 cases (each preset) + identity + all-max + all-min + blur-only.
- `createLeaf()` initializes effects to DEFAULT_EFFECTS.
- `D-15` invariant: setEffects with any slider field clears `effects.preset`.
- `resetCell` touches both effects AND pan/zoom/fit fields.

Manual-only (acceptable gap, document in VERIFICATION.md):
- Actual visual output of each preset on a real image in a real browser (jsdom cannot render ctx.filter meaningfully).
- Safari 18+ actual filter rendering (no browser runtime in CI).
- MP4 export with effects applied (requires actual MediaRecorder + codec; current videoExport tests stub this).

### Sampling Rate

- **Per task commit:** `npx vitest run src/test/phase11*.test.ts` (should run in <10s once tests exist)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/phase11-effects-store.test.ts` — unit coverage for EFF-01..EFF-07, EFF-09, EFF-10 (store actions + invariants)
- [ ] `src/test/phase11-effects-rendering.test.ts` — integration coverage for EFF-08 (ctx.filter hook in drawLeafToCanvas)
- [ ] `src/test/phase11-effects-blur.test.ts` — integration coverage for EFF-05 blur over-draw mitigation
- [ ] `src/test/phase11-effects-slider.test.tsx` — component coverage for EFF-09 slider drag → one snapshot
- [ ] `src/test/phase11-effects-ui.test.tsx` — component coverage for SelectedCellPanel effects subsection (chip rendering, active chip ring, disabled state)
- [ ] Update any existing `type: 'leaf'` literals in `src/test/tree-functions.test.ts`, `src/test/grid-store.test.ts`, `src/test/phase09-p02-store-move.test.ts`, and other test files to include `effects: DEFAULT_EFFECTS`

No framework install needed — Vitest is already project standard.

## Open Questions

1. **Exact preset values — do the UI-SPEC starting tuples survive visual review on real photos?**
   - What we know: UI-SPEC §Preset Value Reference records starting values approved by gsd-ui-checker.
   - What's unclear: how these look on varied content (portraits, landscapes, screenshots, food, low-light).
   - Recommendation: during Wave N implementation, the task that wires up the preset chips should include a brief manual visual review step (sample 3 photos, apply each preset, tune values in PRESET_VALUES if obviously wrong). No test-driven change; a judgment call.

2. **`beginEffectsDrag` vs. `commitEffects`-centralized-snapshot pattern — which is cleaner?**
   - What we know: both satisfy EFF-09.
   - What's unclear: which is easier to reason about for the slider component author.
   - Recommendation: planner picks. `beginEffectsDrag` is the recommendation here because it keeps the snapshot responsibility inside the store (pure) and the slider component can be dumb (just fires `setEffects` on move, does nothing on up beyond releasing pointer capture).

3. **Custom raw-pointer slider vs. native `<input type="range">` with pointer capture overlay?**
   - What we know: UI-SPEC Component Inventory line 112 specifies native `<input type="range">` with `accent-[#3b82f6]`, matching existing `CanvasSettingsPanel` pattern.
   - What's unclear: native range fires `input` events on every pixel of mouse drag AND on `change` at pointerup — but NOT via pointer events. Can we hook `onInput` → `setEffects` and `onChange` → `commitEffects` (or `onPointerUp`)?
   - Recommendation: native range with `onInput={e => setEffects(...)}` and `onPointerUp={() => commitEffects(...)}` (with `beginEffectsDrag` on `onPointerDown`). This matches CanvasSettingsPanel's existing gap/borderRadius sliders and gives free keyboard accessibility. Confirm in task PLAN by reading CanvasSettingsPanel source.

4. **Should the effects subsection have a collapsible header?**
   - What we know: CONTEXT.md D-22 discretion area. UI-SPEC doesn't specify collapsing.
   - What's unclear: screen real estate on mobile sheet with effects subsection added above existing cell panel.
   - Recommendation: do NOT collapse in v1.2. The subsection is only visible when a cell is selected (which is the user's explicit intent); collapsing adds a click step. Revisit if user feedback complains about mobile sheet height.

5. **Preset sample PNG asset generation — scripted or committed?**
   - What we know: D-09 mandates pre-rendered static assets; planner picks location/format.
   - What's unclear: should the 6 PNGs be committed directly, or generated at build time from a base image + preset values?
   - Recommendation: commit the 6 PNGs directly (under `src/assets/presets/`). Build-time generation adds tooling with zero benefit; 6 files are small (<20KB total at 96×96).

## Sources

### Primary (HIGH confidence)
- `src/lib/export.ts` lines 304–333 — `drawLeafToCanvas` unified draw path (read)
- `src/lib/export.ts` lines 339–447 — `renderNode`, `renderGridIntoContext`, confirms single-call-site (read)
- `src/store/gridStore.ts` lines 126–144 — `pushSnapshot` pattern (read)
- `src/Grid/LeafNode.tsx` lines 104–289 — preview `drawRef`, subscriber hook (read)
- `src/Editor/Sidebar.tsx` lines 200–420 — `SelectedCellPanel` structure (read)
- `src/lib/videoExport.ts` — stableCanvas + renderGridIntoContext loop (read)
- `src/lib/tree.ts:82` — `createLeaf` factory (read)
- `.planning/phases/11-effects-filters/11-CONTEXT.md` — 22 locked decisions (read)
- `.planning/phases/11-effects-filters/11-UI-SPEC.md` — preset values, slider binding, color contract (read)
- `.planning/REQUIREMENTS.md` — EFF-01..EFF-10 acceptance criteria (read)
- MDN `CanvasRenderingContext2D.filter` — filter string syntax and supported functions (HIGH, stable web standard)

### Secondary (MEDIUM confidence)
- caniuse.com `CanvasRenderingContext2D.filter` — Safari 18.0+ full support (MEDIUM; caniuse lags slightly behind browser releases)
- WebKit release notes Safari 18 — context-filter-enabled-by-default (MEDIUM; from training data, not re-verified during research)

### Tertiary (LOW confidence)
- None — all critical claims are verified against code or authoritative standards.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all pieces are built-in APIs or project-existing libraries; no new deps; no version risk.
- Architecture: HIGH — three-path parity is a direct consequence of the existing unified `drawLeafToCanvas` contract, verified by reading export.ts, LeafNode.tsx, and videoExport.ts.
- Pitfalls: HIGH — each pitfall is either pre-identified in CONTEXT.md/roadmap or verified against the actual code paths.
- Safari degradation: HIGH on "unsupported on Safari <18" (multiple historical sources), MEDIUM on "enabled by default in 18.0" (training data, not re-verified); does not block because user explicitly accepted degradation (D-02).

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days — stable native APIs, no fast-moving dependencies)

## RESEARCH COMPLETE
