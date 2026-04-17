---
status: diagnosed
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md, 28-HUMAN-UAT.md]
started: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:20:00Z
mode: re-confirmation
note: First-pass UAT found 3 issues (28-HUMAN-UAT.md). Gap closure plans 28-11/12/13 shipped. This re-confirmation found insert (edge-drop) still broken on both desktop + touch (shared root cause); ghost 1:1 + accent ring + source dim + file-drop all confirmed. Ghost size enhancement noted twice (Test 1 + Test 4).
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
  - "Insert (edge drop) still not committing on desktop — CORE FUNCTIONAL FAILURE"

### 2. Touch press-and-hold drag + drop (SC-2) — confirm gap-closure 28-12 fix
expected: On a touch device, 250ms press-and-hold initiates drag. Ghost follows finger at 1:1 speed. Edge zones commit reliably. Per-zone icon emphasis NOT expected (D-15).
result: issue
reported: "1. The 1:1 speed is resolved. 2. Again, the edges do not work."
severity: major
partial_pass: "Ghost 1:1 speed confirmed — scaleCompensationModifier removal (28-12) works"
sub_issues:
  - "Edge-zone drop STILL not committing on touch — same functional failure as Test 1; shared root cause"

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
  reason: "User reported edge/insert drops do not commit on desktop (Test 1) and on touch (Test 2). Swap (center) may be working but insert (edge) does not. Shared root cause — NOT sensor-specific, persists across both input modalities."
  severity: major
  test: [1, 2]
  hypotheses:
    - "H1: computeDropZone returns null/center when pointer is in the edge band → onDragEnd guard (`if (over && active.id !== over.id && zone)`) short-circuits for edge zones. Possible mismatch between visual indicator band geometry (DropZoneIndicators 20% per-axis) vs computeDropZone threshold (per-axis after 28-12 but verify alignment)."
    - "H2: gridStore.moveCell(sourceId, overId, 'top'|'bottom'|'left'|'right') has a bug in the insert branch (vs swap branch). The first-pass UAT Test 1 passed SWAP — insert-specific failure suggests moveCell's insert code path, not shared drag infrastructure."
    - "H3: Ghost occlusion blocks pointer → when the ghost is large enough to cover the edge bands, pointer-over resolves to a different cell OR loses the target entirely. User's ghost-too-large observation is correlated. Fixing ghost size may ALSO fix insert if the edge bands were being occluded."
    - "H4: DragOverlay element (document.body-portaled) intercepts the pointer despite pointer-events:none — browser may still not return the underlying droppable for collision detection. @dnd-kit uses rect-intersection by default; if DragOverlay rect is considered, collision could resolve to the overlay, not the droppable under it."
  artifacts: []
  missing: []

- truth: "Ghost visible without occluding drop zones on large cells (enhancement, not regression)"
  status: enhancement_request
  reason: "Raised twice in this session (Test 1 + Test 4). User suggests either a fixed linear scale (~25-33%) OR a max-width + max-height preset so ghost has a sensible cap when source cell is large."
  severity: minor
  test: [1, 4]
  type: spec_change
  proposed_fix: "Cap DragPreviewPortal ghost dimensions: e.g. max-width: 200px, max-height: 200px (or scale = min(1, 0.33) applied to sourceRect.width/height). Preserves aspect ratio via object-fit: cover already in place."
  note: "Spec change — GHOST-04 originally required ghost at source-cell size. May also alleviate hypothesis H3 (ghost occludes edge bands) — worth investigating insert first and seeing if ghost size change helps."
  artifacts: []
  missing: []
