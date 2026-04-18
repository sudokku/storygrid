---
status: diagnosed
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md, 28-HUMAN-UAT.md]
started: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:35:00Z
mode: re-confirmation
note: Re-confirmation UAT found insert (edge-drop) still broken on both desktop + touch. Debug agent identified TWO independent root causes in CanvasWrapper.tsx — missing onDragMove + unsafe activatorEvent cast (undefined on TouchEvent). H1/H2/H3/H4 all eliminated by evidence. Ghost 1:1 + accent ring + source dim + file-drop all confirmed. Ghost size enhancement noted twice (Test 1 + Test 4).
---

## Current Test

[testing complete]

## Tests

### 1. Desktop click-hold drag + drop (SC-1) — confirm gap-closure 28-11 fix
expected: On desktop (≥768px), mousedown on a cell, move ≥8px, release on different cell → cells swap (center drop) or insert (edge drop). Previously BLOCKER.
result: issue
reported: "1. The floating copy of the image makes it hard to see what's behind it - let's make it 3/4 times smaller than original cell. 2. The insert still not working."
severity: major
sub_issues:
  - "Ghost size too large — enhancement request (user raised same concern on Test 4 with a proposed fix: fixed max-width/max-height preset)"
  - "Insert (edge drop) still not committing on desktop — CORE FUNCTIONAL FAILURE (root cause: missing onDragMove handler; zone captured only on droppable enter/leave, stale at release)"

### 2. Touch press-and-hold drag + drop (SC-2) — confirm gap-closure 28-12 fix
expected: On a touch device, 250ms press-and-hold initiates drag. Ghost follows finger at 1:1 speed. Edge zones commit reliably. Per-zone icon emphasis NOT expected (D-15).
result: issue
reported: "1. The 1:1 speed is resolved. 2. Again, the edges do not work."
severity: major
partial_pass: "Ghost 1:1 speed confirmed — scaleCompensationModifier removal (28-12) works"
sub_issues:
  - "Edge-zone drop STILL not committing on touch — root cause: unsafe cast of activatorEvent to PointerEvent; TouchEvent.clientX/Y is undefined → NaN pointer → computeDropZone always returns 'center'. Explains first-pass 'I could swap them but I can't extend to top/bottom/left/right'."

### 3. File-drop onto cell still works (SC-4) — regression check
expected: Drag an image or video file from OS desktop onto a cell → media is placed in that cell. Workspace file-drop (outside grid) still works.
result: pass

### 4. Ghost + zone visuals during drag (SC-5) — confirm 28-12 + 28-13 fixes
expected: Ghost 1:1 speed. Source 40% opacity. 5-zone overlay. 2px accent outline visible on hovered cell including media cells. Per-zone icon emphasis NOT expected (D-15).
result: pass
minor_note: "Ghost size too large — user suggests capping with max-width + max-height preset so big cells don't have the ghost occluding drop zones. Same concern as Test 1."

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Edge-zone drop (top/bottom/left/right) commits insertion via gridStore.moveCell(sourceId, overId, zone) on both desktop and touch"
  status: failed
  reason: "User reported edge/insert drops do not commit on desktop (Test 1) and on touch (Test 2). Two independent root causes diagnosed — both in CanvasWrapper.tsx."
  severity: major
  test: [1, 2]
  root_cause: |
    TWO independent defects in src/Grid/CanvasWrapper.tsx (both verified against @dnd-kit/core source, node_modules/@dnd-kit/core/dist/core.esm.js):

    DEFECT 1 (affects desktop AND touch) — Missing onDragMove handler.
    handleDragOver (CanvasWrapper.tsx:88-111) is the ONLY code path that computes + stores the zone. @dnd-kit's onDragOver effect fires with deps [overId] (core.esm.js:3286) — ONLY when pointer crosses into/out of a droppable, NOT when moving within it. onDragMove (deps [scrollAdjustedTranslate.x, .y] at core.esm.js:3243) is the continuous-update handler — but CanvasWrapper never registers one. Result: zone is captured once at droppable ENTRY (often 'center' or whichever edge the pointer enters through), never refreshed. onDragEnd reads the stale zone.

    DEFECT 2 (amplifies to 'always center' on touch) — Unsafe activatorEvent cast.
    handleDragOver lines 99-100 cast activatorEvent to PointerEvent: `const startX = (activatorEvent as PointerEvent).clientX`. For CellDragMouseSensor (extends MouseSensor, bound to onMouseDown) the activator is a MouseEvent — clientX valid. For CellDragTouchSensor (extends TouchSensor, bound to onTouchStart) the activator is a TouchEvent — top-level clientX/Y is undefined; data lives on touches[0].clientX/Y. On touch: startX = undefined → pointer.x = NaN → every computeDropZone comparison (y < yThreshold etc.) is false → fall-through returns 'center'. Touch zone is ALWAYS 'center'; edge-insert physically unreachable.

    HYPOTHESES ELIMINATED BY EVIDENCE:
    - H1 (threshold mismatch): FALSE. computeDropZone.ts:44-45 and DropZoneIndicators.tsx:48-77 align on 20% per-axis bands.
    - H2 (moveCell insert branch bug): FALSE. gridStore.moveCell + lib/tree.moveLeafToEdge are pure and correct; the insert branch is never CALLED with non-center zone.
    - H3 (ghost occludes drop zones): FALSE as causal. Ghost sizing is an independent UX concern; reducing ghost does not fix the onDragMove gap or the NaN cast.
    - H4 (DragOverlay collision): FALSE. Not the cause — the zone never updates post-entry regardless of collision detection.
  artifacts:
    - path: "src/Grid/CanvasWrapper.tsx"
      issue: "Lines 88-111 — handleDragOver is the sole zone-compute site; no onDragMove registered on DndContext (line 182-188). Zone stale between ENTER and END."
    - path: "src/Grid/CanvasWrapper.tsx"
      issue: "Lines 99-100 — `(activatorEvent as PointerEvent).clientX/Y` unsafe cast; undefined on TouchEvent → NaN pointer → always zone='center' on touch."
    - path: "src/dnd/__tests__/CanvasWrapper.integration.test.tsx"
      issue: "No end-to-end test that drives DndContext through pointerdown → pointermove-within-droppable → pointerup and asserts moveCell called with correct edge-zone argument. This gap is why 28-VERIFICATION.md reported 895/895 green while the runtime behavior was broken."
    - path: "src/dnd/computeDropZone.test.ts"
      issue: "No NaN-input test case — would have caught the touch defect in isolation."
  missing:
    - "Register onDragMove on DndContext; move the pointer→rect→computeDropZone→setOver pipeline from onDragOver into onDragMove. Keep onDragOver only for null-over / self-over clearing (or subsume into onDragMove)."
    - "Replace the PointerEvent cast with input-type-safe coordinate extraction. Preferred: derive pointer from `active.rect.current.initial + delta` (input-agnostic). Alternative: branch on `activatorEvent instanceof TouchEvent` and read `touches[0].clientX/Y` (or `changedTouches[0]` on end)."
    - "Add integration test wiring DndContext through a real pointermove-within-droppable sequence and asserting gridStore.moveCell is called with zone ∈ {top, bottom, left, right} (not just 'center') — covers both defects as a regression lock."
    - "Add computeDropZone unit test for NaN inputs (fast isolation-level lock for the touch path)."
  debug_session: .planning/debug/insert-edge-drop-broken.md

- truth: "Ghost visible without occluding drop zones on large cells (enhancement, not regression)"
  status: enhancement_request
  reason: "Raised twice in this session (Test 1 + Test 4). User suggests either a fixed linear scale (~25-33%) OR a max-width + max-height preset so ghost has a sensible cap when source cell is large."
  severity: minor
  test: [1, 4]
  type: spec_change
  root_cause: "GHOST-04 spec originally required ghost at source-cell size (DragPreviewPortal.tsx:41-43 applies sourceRect.width/height). When source cells are large (common on desktop with few cells), the ghost covers most of the viewport — user cannot see target drop zones or hovered indicators underneath. Not a defect per spec; spec itself is the pain point."
  artifacts:
    - path: "src/dnd/DragPreviewPortal.tsx"
      issue: "Lines 41-43 — ghost dimensions = sourceRect.width × sourceRect.height (uncapped). Needs max-width/max-height cap or a scale factor."
  missing:
    - "Apply cap to DragPreviewPortal ghost dimensions. Recommended: `maxWidth: 200px, maxHeight: 200px` (or viewport-relative like `max(200px, min(source, 30vw))`) while preserving aspect ratio via object-fit: cover (already in place)."
    - "Update GHOST-04 spec language in VERIFICATION.md / ROADMAP ownership row to reflect the cap (ghost at source-cell size, capped to 200×200)."
    - "Add unit test that renders DragPreviewPortal with a very large sourceRect and asserts the rendered img style does not exceed the cap."
  debug_session: (no debug needed — spec change)
