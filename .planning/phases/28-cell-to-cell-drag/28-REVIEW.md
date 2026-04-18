---
phase: 28-cell-to-cell-drag
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/Grid/CanvasWrapper.tsx
  - src/dnd/DragPreviewPortal.tsx
  - src/dnd/__tests__/CanvasWrapper.integration.test.tsx
  - src/dnd/__tests__/DragPreviewPortal.test.tsx
  - src/dnd/computeDropZone.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: findings
---

# Phase 28: Code Review Report (gap-closure 28-14 + 28-15 scope)

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 5
**Status:** findings

**Scope note:** This review supersedes the 2026-04-17 review for the subset of files touched by the gap-closure plans 28-14 (input-agnostic pointer derivation + `handleDragMove` replacing `handleDragOver` as the authoritative zone-compute site in `CanvasWrapper.tsx`) and 28-15 (`computeCappedGhostSize` + `GHOST_MAX_DIMENSION` in `DragPreviewPortal.tsx`). The 2026-04-17 review's findings on files outside this scope (`DropZoneIndicators.tsx`, `adapter/dndkit.ts`, `Divider.tsx`, etc.) remain unchanged and authoritative for those files.

## Summary

Both gap-closure changes are mechanically correct and well-justified. The 28-14 fix is particularly strong: deriving the pointer from `active.rect.current.initial + delta` is genuinely input-type-agnostic and eliminates the `activatorEvent as PointerEvent` cast hazard on touch. The accompanying `computeDropZone.test.ts:330-360` NaN-fallthrough regression-lock is an excellent piece of diagnostic pinning — it documents the original defect symptom in the test suite itself.

The 28-15 cap math (`scale = min(1, max/w, max/h)`) is correct and preserves aspect ratio by construction. The `GHOST_MAX_DIMENSION` constant is used as both the JS cap and the CSS `maxWidth`/`maxHeight` defensive ceiling, so retuning happens in one place.

Two warnings flag real interaction hazards with the @dnd-kit lifecycle:
- `computeCappedGhostSize` does not defend against NaN or zero-size `sourceRect` inputs, which can propagate `NaNpx` CSS or collapse the ghost to 0×0;
- `handleDragMove` and `handleDragOver` both write `setOver(null, null)` on the null-over / self-over branches, producing a double store write per tick and contradicting the comment that claims `handleDragMove` is the sole authoritative writer.

Info items are minor style/consistency nits. No critical correctness, security, or crash issues.

## Warnings

### WR-01: `computeCappedGhostSize` propagates NaN to CSS and collapses to 0x0 on zero-dim sourceRect

**File:** `src/dnd/DragPreviewPortal.tsx:55-64`
**Issue:**
```ts
const scale = Math.min(1, max / sourceRect.width, max / sourceRect.height);
return { width: sourceRect.width * scale, height: sourceRect.height * scale };
```
Two degenerate inputs flow through without guards:

1. **NaN propagation** — if `sourceRect.width` or `.height` is `NaN` (e.g., a future caller passes through an unparsed DOM measurement, or the source cell is unmounted mid-drag), `Math.min(1, NaN, ...) = NaN` → `NaN * w = NaN`. React then emits `style="width: NaNpx"`, which browsers treat as invalid → the declaration is dropped and the `<img>` renders at intrinsic size. The defensive `maxWidth: GHOST_MAX_DIMENSION` on line 92 will cap visible width, but the aspect ratio is lost — the ghost becomes a 200×200 square regardless of source aspect, defeating part of the 28-15 intent.
2. **Zero-dimension source** — `getBoundingClientRect()` on a display:none or zero-size element returns `{ width: 0, height: 0 }`. `Math.min(1, 200/0, 200/0) = Math.min(1, Infinity, Infinity) = 1`, output `{0, 0}`. The ghost vanishes entirely during drag — no visible preview. Unlikely in current UX (user can't drag a hidden cell) but plausible under media-swap races where `LeafNode` measures mid-render.

The existing `computeCappedGhostSize` test suite (`DragPreviewPortal.test.tsx:211-263`) has no cases for these degenerate inputs, so a future refactor could regress silently.

**Fix:** Add a defensive clamp at the start of the helper and pin the behavior in tests:
```ts
export function computeCappedGhostSize(
  sourceRect: { width: number; height: number },
  max: number,
): { width: number; height: number } {
  // Defensive: NaN / non-finite / non-positive dims collapse to the cap (square)
  // rather than emit NaN-px CSS or 0x0 invisible ghost.
  const w = Number.isFinite(sourceRect.width) && sourceRect.width > 0 ? sourceRect.width : max;
  const h = Number.isFinite(sourceRect.height) && sourceRect.height > 0 ? sourceRect.height : max;
  const scale = Math.min(1, max / w, max / h);
  return { width: w * scale, height: h * scale };
}
```
Mirror the NaN regression-lock pattern from `computeDropZone.test.ts:330-360` by adding `{ width: 0, height: 100 }`, `{ width: NaN, height: 100 }`, and `{ width: 0, height: 0 }` cases to the `computeCappedGhostSize` describe block.

---

### WR-02: `handleDragMove` and `handleDragOver` both write `setOver(null, null)` on the null-over / self-over branch

**File:** `src/Grid/CanvasWrapper.tsx:141-161`
**Issue:** Both callbacks are registered on `DndContext` and both fire on overlapping lifecycle events. `handleDragOver` writes `setOver(null, null)` explicitly on line 144; `handleDragMove` invokes `_testComputeZoneFromDragMove` which also returns `{ overId: null, zone: null }` on the same branches (`CanvasWrapper.tsx:61-62`), then writes the same `setOver(null, null)` on line 160. This yields two store writes per pointer-move tick whenever the pointer is outside all droppables or back over the source cell.

Consequences:
- Two Zustand subscription notifications fire per tick instead of one. Zustand's default referential-equality check skips re-renders when `overId` and `activeZone` are already `null` (both stored values are the same literal `null`), so React subscribers are protected — but the store-write path still runs synchronously and re-triggers any `subscribe()`-based effects that listen for arbitrary state changes.
- The comment on `CanvasWrapper.tsx:146-149` states "Non-null over: handleDragMove will compute + write the zone on the next pointer-move tick. We intentionally do NOT write here". The stated division of labor is: `handleDragMove` owns ALL writes; `handleDragOver` only clears. But the implementation writes in both handlers on the same null/self branch — the comment becomes misleading.
- If a future maintainer adds side effects behind `setOver` (e.g., analytics, auto-scroll), the double-call could double-count.

This is not a correctness bug (the final state is identical), but it is a real interaction hazard with the dnd-kit lifecycle and contradicts the file's own stated architecture.

**Fix:** Pick one owner for the clear. The simplest option, aligned with the `handleDragMove`-is-authoritative comment at lines 151-157, is to make `handleDragOver` a pure no-op:
```ts
// Gap-closure 28-14: handleDragMove is the authoritative store writer for all
// zone transitions, including the null-over / self-over clear branches. Retained
// as a no-op in case dnd-kit later requires a listener for keyboard-drag events
// or A11Y announcements.
const handleDragOver = useCallback(() => {}, []);
```
Alternatively, keep `handleDragOver` as the clear-owner and make `handleDragMove` skip null/self:
```ts
const handleDragMove = useCallback((event: DragMoveEvent) => {
  const { over, active } = event;
  if (!over || active.id === over.id) return; // handleDragOver owns the clear
  const { overId, zone } = _testComputeZoneFromDragMove(event);
  useDragStore.getState().setOver(overId, zone);
}, []);
```
Either way, one write path per tick and the comment matches the code.

## Info

### IN-01: `_testComputeZoneFromDragMove` is exported as test-only but is the production implementation

**File:** `src/Grid/CanvasWrapper.tsx:38-83, 158-161`
**Issue:** The doc comment at lines 38-52 states the `_test` prefix signals "test-only — do not import in production code", but `handleDragMove` on line 159 calls it as its only implementation. The function is therefore both test-exported AND the real production engine extracted for testability — the underscore naming contract is slightly misleading.
**Fix:** Either rename to `computeZoneFromDragMove` (no underscore) and update the comment to "exported for unit testing; production-consumed by handleDragMove below", or leave the code unchanged but adjust the comment to: "exported with `_test` prefix because the only non-test call site is handleDragMove below; external code MUST NOT import it". Update the single import in `CanvasWrapper.integration.test.tsx:23` accordingly if renaming.

### IN-02: `_testComputeZoneFromDragMove` anchors at source cell CENTER, not pointer-down position — semantic change from the broken original

**File:** `src/Grid/CanvasWrapper.tsx:65-76`
**Issue:** The new pointer derivation is `initial.left + initial.width / 2 + delta.x` (center of source at drag start + delta). The broken original derivation attempted `activatorEvent.clientX + delta.x` — where `activatorEvent.clientX` was the pointer-down position (e.g., wherever the user actually pressed). These two anchors differ by up to `±cellWidth/2` horizontally.

For zone compute this is usually irrelevant — the user drags well past the source cell's width before reaching another droppable — but for degenerate drags (drag to an adjacent cell with a tiny delta), the reported pointer may be outside the actual physical pointer's cell. The 28-UAT tests pass because the test-helper's delta values push the pointer firmly inside target-cell zones. In real-world use, a very short drag from edge-of-source to edge-of-target might report a slightly different zone than the user perceives.

The change is correct for the touch-fix contract (the derivation is now input-type-agnostic), and the mathematical offset is bounded by source-cell dimensions. Flagging as Info because the center-anchor choice is not explicitly documented as a semantic tradeoff — the comment at lines 65-76 explains HOW the new derivation works but not WHY center was chosen over pointer-down (which would require `activatorEvent.clientX` + a type narrow).
**Fix:** Either document the semantic choice explicitly ("center-anchor chosen over pointer-down-anchor for input-type-agnosticism — see .planning/debug/insert-edge-drop-broken.md for trade-off analysis"), or switch to a type-narrowed `activatorEvent.clientX/Y` read that falls back to `initial` center when the activator is not a PointerEvent. The current implementation is defensible; it just needs an explicit comment.

### IN-03: `getBoundingClientRect()` via `querySelector` in per-tick handler bypasses dnd-kit's measured rect cache

**File:** `src/Grid/CanvasWrapper.tsx:78-80`
**Issue:** `document.querySelector('[data-testid="leaf-${over.id}"]')` + `getBoundingClientRect()` runs every pointer-move tick during a drag. dnd-kit already provides `event.over.rect` (a fresh `ClientRect` maintained by `MeasuringStrategy.Always` per the `DndContext` prop at line 240), so the DOM query is redundant. Two minor consequences:
1. Perf: `querySelector` + `getBoundingClientRect()` is cheaper than it used to be, but still runs synchronously at ~60Hz during drag.
2. Fragility: the `data-testid` key couples production drag logic to a testing affordance. A future test-id rename silently breaks zone computation.

**Fix:** The `event.over` object in `DragOverEvent`/`DragMoveEvent` exposes `event.over.rect` as a `ClientRect`. Replace lines 78-80 with:
```ts
const rect = (event as any).over?.rect as DOMRect | undefined;
if (!rect) return { overId: null, zone: null };
```
The parent 2026-04-17 review (WR-04) flagged the same coupling on `handleDragOver` + `handleDragStart` — this is the same class of issue on the new 28-14 code path.

### IN-04: `DragPreviewPortal` `<img>` has no `onError` handler for malformed data-URL

**File:** `src/dnd/DragPreviewPortal.tsx:87-101`
**Issue:** If `ghostDataUrl` is malformed (e.g., `canvas.toDataURL()` returned a truncated string, or a tainted-canvas case that the caller didn't guard — see parent review WR-03), the `<img>` fires `onerror` and renders a broken-image icon at capped dims. The D-10 empty-cell fallback `<div>` only activates when `ghostDataUrl === null`, not on invalid-but-non-null values.
**Fix:** Either add an `onError` handler that swaps to the dark-div fallback, or accept the current behavior and document it. Low priority — StoryGrid's MVP media pipeline is same-origin (no tainted-canvas risk) per project constraints in `CLAUDE.md`.

### IN-05: `GHOST_MAX_DIMENSION` used both as JS cap and raw CSS `maxWidth`/`maxHeight` — numeric-vs-string coupling

**File:** `src/dnd/DragPreviewPortal.tsx:38, 92-93, 112-113`
**Issue:** `GHOST_MAX_DIMENSION = 200` (a number) is passed directly to `style={{ maxWidth: GHOST_MAX_DIMENSION, maxHeight: GHOST_MAX_DIMENSION }}`. React accepts numeric style values and converts to `px`, so `maxWidth: 200` renders as `max-width: 200px`. This works today, but it's worth noting that if `GHOST_MAX_DIMENSION` is ever changed to a string (e.g., `'12.5rem'` for responsive sizing), the JS math in `computeCappedGhostSize` (`max / sourceRect.width`) will `NaN`-propagate silently. Keeping the constant numeric is fine; a type annotation `export const GHOST_MAX_DIMENSION: number = 200` makes the contract explicit.
**Fix:** Annotate the type: `export const GHOST_MAX_DIMENSION: number = 200;`. No runtime change.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
