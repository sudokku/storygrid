---
status: diagnosed
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md]
started: 2026-04-17T22:00:00Z
updated: 2026-04-17T22:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop click-hold drag + drop (SC-1)
expected: On a ≥2-cell grid, mousedown on one cell, move ≥8px, release on a different cell — cells swap (center drop) or insert (edge drop) identically to Phase 9 semantics
result: issue
reported: "Absolutely nothing happens. The pointer is not showing drag, there is no animation of starting the drag-and-drop, cells don't move, I don't see the overlay icons before dropping. As if nothing there to test."
severity: blocker

### 2. Touch press-and-hold drag + drop (SC-2)
expected: On a touch device, 250ms press-and-hold on any cell initiates drag; release <250ms does not trigger drag; releasing on a different cell commits the move
result: issue
reported: "The semi-opaque copy of the cell content is moving at an accelerated pace compared to the pointer. I could swap them but it looks like I can't extend the cell to left/right/top/bottom. It also does not accentuate the icon of the move (swap or extend on specific direction). The whole logic \"works\" once in 3 times."
severity: major

### 3. File-drop onto cell still works (SC-4)
expected: Dragging an image/video file from OS desktop onto any cell places the media; workspace file-drop still works
result: pass

### 4. Ghost + zone visuals during drag (SC-5)
expected: Ghost image follows pointer with no jump; source cell shows at 40% opacity; 5-zone indicator appears on hovered target cell; accent outline on hovered cell
result: issue
reported: "As previously stated: the image follows pointer's direction at an accelerated speed. Yes, the source cell does have the opacity filter. The 5 zones indicators appear but I have no idea why they refuse to properly work (the only semi-consistend one is the center swap, while the extend ones are very buggy). There is no outline on hovered drop cell. As a followup note - this is only on mobile screen size. On desktop screen sizes it does not work at all, not even the swipe."
severity: major

## Summary

total: 4
passed: 1
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "On a ≥2-cell grid, mousedown on one cell, move ≥8px, release on a different cell — cells swap (center drop) or insert (edge drop) identically to Phase 9 semantics"
  status: failed
  reason: "User reported: Absolutely nothing happens. The pointer is not showing drag, there is no animation of starting the drag-and-drop, cells don't move, I don't see the overlay icons before dropping. As if nothing there to test."
  severity: blocker
  test: 1
  root_cause: "Two PointerSensor subclasses (PointerSensorMouse + PointerSensorTouch) register activators under the identical React synthetic-event key 'onPointerDown'. @dnd-kit's useSyntheticListeners merges via object-keyed assignment, so PointerSensorTouch (registered second in CanvasWrapper useSensors) silently overwrites PointerSensorMouse. The surviving Touch activator returns false for pointerType !== 'touch' && !== 'pen' — mouse events are dropped silently, no drag lifecycle starts on desktop."
  artifacts:
    - path: "src/dnd/adapter/dndkit.ts"
      issue: "PointerSensorMouse (lines 58-74) and PointerSensorTouch (lines 86-102) share static activators eventName 'onPointerDown' — cannot coexist; second overwrites first"
    - path: "src/Grid/CanvasWrapper.tsx"
      issue: "Lines 60-63 register both sensors via useSensors — order guarantees Touch wins and mouse drags die"
    - path: "src/dnd/adapter/__tests__/dndkit.test.ts"
      issue: "Tests each activator in isolation; never exercises both bound under @dnd-kit's real listener-merge — gap that masked this bug"
  missing:
    - "Use @dnd-kit built-in MouseSensor (onMouseDown) + TouchSensor (onTouchStart) together — different React event keys, no collision. Requires relaxing SC-3 grep gate whose rationale (Phase 25 flakiness) is contradicted by this very failure."
    - "Alternative: single PointerSensor subclass with one activator that inspects event.pointerType at runtime, choosing delay vs distance activation constraint per pointer type."
    - "Add integration test that wires both sensors through a real DndContext and asserts mouse-drag + touch-drag both fire start events."
  debug_session: .planning/debug/desktop-drag-dead.md

- truth: "On a touch device, 250ms press-and-hold on any cell initiates drag; release <250ms does not trigger drag; releasing on a different cell commits the move"
  status: failed
  reason: "User reported: The semi-opaque copy of the cell content is moving at an accelerated pace compared to the pointer. I could swap them but it looks like I can't extend the cell to left/right/top/bottom. It also does not accentuate the icon of the move (swap or extend on specific direction). The whole logic \"works\" once in 3 times."
  severity: major
  test: 2
  root_cause: "scaleCompensationModifier divides dnd-kit's viewport-space transform by canvasScale (≈0.3 on mobile). But DragOverlay portals to document.body — OUTSIDE the scaled canvas-surface — so no compensation is needed. The divide AMPLIFIES pointer delta by 1/scale (~3× on mobile). This amplified delta is consumed by CanvasWrapper's onDragOver pointer reconstruction, so the zone-computation pointer overshoots too: short finger drags exit the center-zone threshold prematurely, edge bands are skipped past entirely → swap works only when amplified pointer stays in center; extend zones rarely commit. Unit tests at dndkit.test.ts:288-349 codified the wrong math as correct."
  artifacts:
    - path: "src/dnd/adapter/dndkit.ts"
      issue: "Lines 116-119 — scaleCompensationModifier: `{ x: transform.x / scale, y: transform.y / scale }` — inverted math for a document.body-portaled overlay"
    - path: "src/Grid/CanvasWrapper.tsx"
      issue: "Lines 86-109 — onDragOver reconstructs pointer from delta AFTER modifier applies, so zone math inherits the amplification (secondary effect)"
    - path: "src/dnd/adapter/__tests__/dndkit.test.ts"
      issue: "Lines 288-349 — 6 tests assert amplification as correct (e.g. x=100 in, x=200 out at scale=0.5); must be rewritten to assert identity"
    - path: "src/dnd/DropZoneIndicators.tsx"
      issue: "Line 28 — zone prop destructured as `_zone` (intentional D-15 Phase-29 deferral). No per-zone active emphasis. UAT expectation 'accentuate icon of the move' crosses Phase 29 scope."
    - path: "src/dnd/computeDropZone.ts"
      issue: "Line 34 threshold `max(20, min(w,h)*0.2)` uses shorter-axis; indicator bands in DropZoneIndicators use 20% per-axis independently — non-square cells expose dead-band where indicator shows but compute returns center"
  missing:
    - "Remove scaleCompensationModifier from DragPreviewPortal modifiers (or make it identity). Verify at canvasScale ∈ {0.3, 0.5, 1.0}."
    - "If subtle overlay drift remains at extreme scale, adopt @dnd-kit upstream fix: `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` on DndContext (see PITFALLS.md:461, issue #50)."
    - "Rewrite 6 scaleCompensation unit tests to assert NO transformation."
    - "Decide: defer 'active zone emphasis' to Phase 29, OR pull DROP-02/03 styling forward (read zone prop in DropZoneIndicators, apply accent class to matching zone child)."
    - "Align computeDropZone threshold with indicator band geometry (or vice versa) to eliminate non-square dead-band."
  debug_session: .planning/debug/touch-drag-unreliable.md

- truth: "Ghost image follows pointer with no jump; source cell shows at 40% opacity; 5-zone indicator appears on hovered target cell; accent outline on hovered cell"
  status: failed
  reason: "User reported: Ghost follows pointer at accelerated speed. 5 zones indicators appear but only center swap is semi-consistent; extend zones very buggy. No outline on hovered drop cell. Only works at all on mobile screen size — on desktop screen sizes nothing happens (not even swap)."
  severity: major
  test: 4
  root_cause: "Four distinct visual-layer defects, ordered by severity: (1) Same scaleCompensationModifier bug as Test 2 drives the accelerated-ghost symptom. (2) Accent outline invisible because ringClass in LeafNode (lines 577-595) applies `ring-2 ring-inset` via box-shadow on the ROOT div, but a sibling `absolute inset-0` canvas-clip-wrapper (lines 629-638) paints ABOVE the parent's inset shadow in CSS painting order — ring is fully occluded on any cell with media. The correct pattern is already used by file-drop highlight at LeafNode.tsx:662 (dedicated overlay div with explicit z-10). (3) Active zone not emphasized because DropZoneIndicators destructures `{ zone: _zone }` as intentional Phase-29 deferral (D-15). (4) Desktop completely dead — same eventName collision as gap 1."
  artifacts:
    - path: "src/Grid/LeafNode.tsx"
      issue: "Lines 577-595 — `ring-2 ring-[#3b82f6] ring-inset` applied on root div className; canvas-clip-wrapper at :629-638 occludes the inset box-shadow. File-drop pattern at :662 shows the correct fix (separate absolute-positioned overlay with z-10)"
    - path: "src/dnd/adapter/dndkit.ts"
      issue: "Lines 58-102 — PointerSensor eventName collision causes 'nothing happens on desktop' (same as gap 1)"
    - path: "src/dnd/adapter/dndkit.ts"
      issue: "Lines 116-119 — scaleCompensationModifier divides viewport transform by canvasScale → accelerated ghost (same as gap 2)"
    - path: "src/dnd/DropZoneIndicators.tsx"
      issue: "Line 28 `{ zone: _zone }` — intentional Phase-29 deferral per D-15 (zone prop plumbed but not consumed for active emphasis)"
  missing:
    - "Replace ringClass on LeafNode root div with dedicated overlay div: `{isOverThisCell && <div className=\"absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10\" />}` — same pattern as file-drop highlight."
    - "Consider applying the same overlay-div fix to isSelected and isPanMode ring paths (they likely share the occlusion on cells with media)."
    - "Fix gap 1 (sensor eventName collision) resolves desktop-dead symptom here."
    - "Fix gap 2 (scaleCompensationModifier) resolves accelerated ghost here."
    - "Zone-emphasis remains deferred to Phase 29 unless explicitly pulled into gap closure."
  debug_session: .planning/debug/zone-visuals-broken.md
