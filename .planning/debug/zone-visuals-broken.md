---
status: diagnosed
trigger: "Phase 28 UAT Test 4 — Ghost follows pointer at accelerated speed; no accent outline on hovered drop cell; 5 zones appear but active zone not emphasized. Only on mobile width."
created: 2026-04-17T23:00:00Z
updated: 2026-04-17T23:45:00Z
---

## Current Focus

hypothesis: 3 distinct root causes confirmed by source inspection + dnd-kit core internals
test: completed — read all relevant source, cross-checked with dnd-kit core.esm.js PositionedOverlay impl
expecting: DONE — all 3 bugs pinpointed at file:line
next_action: return diagnosis (goal: find_root_cause_only, no fix)

## Symptoms

expected: Ghost follows pointer 1:1, source cell 40% opacity, hovered target cell shows 5-zone indicator AND accent outline, the zone under the pointer is emphasized
actual: (mobile) ghost follows at accelerated speed; source cell 40% opacity ok; 5 zones appear but only center swap semi-consistent; extend zones buggy; NO outline on hovered drop cell. (desktop) nothing works at all — handled by separate agent
errors: none reported
reproduction: Mobile width viewport, Phase 28 UAT Test 4, press-hold-drag a cell
started: Phase 28 initial implementation (never worked right)

## Eliminated

- hypothesis: "Tailwind safelist strips blue ring class so outline never renders"
  evidence: class is `ring-2 ring-[#3b82f6] ring-inset` — same string used at LeafNode.tsx:662 for file-drag overlay which DOES render. So Tailwind compiles it fine.
  timestamp: 2026-04-17T23:30:00Z

- hypothesis: "isOverThisCell selector is wrong — should be !== instead of ==="
  evidence: Selector is `s.overId === id && s.status === 'dragging'` (LeafNode.tsx:54). handleDragOver calls setOver(String(over.id), zone) only when over && active.id !== over.id. So for the HOVERED (non-source) target cell, isOverThisCell=true. The store selector is correct.
  timestamp: 2026-04-17T23:30:00Z

- hypothesis: "DragPreviewPortal uses custom absolute positioning instead of DragOverlay"
  evidence: DragPreviewPortal.tsx:29 uses @dnd-kit DragOverlay as documented. The modifier is the problem, not the portal.
  timestamp: 2026-04-17T23:35:00Z

## Evidence

- timestamp: 2026-04-17T23:15:00Z
  checked: src/dnd/adapter/dndkit.ts:116-119 scaleCompensationModifier
  found: Modifier returns `{ ...transform, x: transform.x / scale, y: transform.y / scale }` where scale = useEditorStore.getState().canvasScale. On mobile, canvasScale ≈ 0.3 (autoFitScale fits 1080×1920 into mobile viewport with 90% margin). Dividing x/y by 0.3 multiplies them by 3.33.
  implication: Ghost transform is 3.33× the pointer delta on mobile → matches "accelerated speed" report exactly.

- timestamp: 2026-04-17T23:20:00Z
  checked: @dnd-kit/core dist/core.esm.js PositionedOverlay (line 3640) and measuringConfiguration defaults (line 2480)
  found: DragOverlay's internal PositionedOverlay renders with `top: rect.top, left: rect.left, transform: CSS.Transform.toString(modifiedTransform)`. The rect is `initialActiveNodeRect` (the draggable's rect from first measure). Draggable default measure = getTransformAgnosticClientRect. This function calls getBoundingClientRect AND applies inverseTransform ONLY against the element's OWN computed style. Since LeafNode itself has no transform (scale is on ancestor canvas-surface), inverseTransform is a no-op → rect = real viewport rect with scaled size and scaled position.
  implication: Overlay mounts at viewport-correct position/size. transform.x/y from dnd-kit is viewport pointer delta. Ghost = viewport element + viewport delta = 1:1 tracking. Any compensation is wrong. The scaleCompensationModifier is actively breaking correct behavior.

- timestamp: 2026-04-17T23:25:00Z
  checked: src/Grid/CanvasWrapper.tsx:189-210 render + :194 transform
  found: canvas-surface div has `transform: scale(${finalScale})` where finalScale = autoFitScale * zoom. DragOverlay (via DragPreviewPortal) is a SIBLING of this scaled div (line 208 inside DndContext but outside the scaled canvas-surface) and internally portals to document.body via createPortal — so overlay renders in viewport coord space, unscaled.
  implication: Overlay is NOT nested inside any transform: scale ancestor. No compensation needed. Confirms modifier is bug, not a correction.

- timestamp: 2026-04-17T23:30:00Z
  checked: src/Grid/LeafNode.tsx:577-583 ringClass ternary + :586-617 JSX structure + :628-638 canvas clip wrapper
  found: ringClass applies `ring-2 ring-[#3b82f6] ring-inset` to root div. Tailwind ring-inset = `box-shadow: inset 0 0 0 2px color`. The root contains a child div `<div className="absolute inset-0 overflow-hidden">` (line 629) which fully covers the root's inner area with its own canvas. Box-shadow inset is painted between root's background and root's content; positioned children with auto z-index paint ABOVE the parent's box-shadow (CSS painting order: backgrounds → box-shadow → content → positioned descendants). The canvas-clip-wrapper has absolute inset-0 with no z-index, rendering above the ring-inset.
  implication: The inset ring is completely covered by the canvas on any cell with media. Only bare cells or rounded-corner slivers (when canvas-clip-wrapper has borderRadius > 0 and root doesn't) can show any ring. Compare with LeafNode.tsx:662 file-drag overlay — it uses `absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10` (overlay div ABOVE the canvas, z-10), which DOES render visibly. Cell-drag ringClass on the root does NOT use this overlay pattern.

- timestamp: 2026-04-17T23:35:00Z
  checked: src/dnd/DropZoneIndicators.tsx:28 signature
  found: `export function DropZoneIndicators({ zone: _zone }: Props)` — zone prop is destructured under underscore-alias and literally never read. All 5 icon zones render with identical className (`text-white`) in all states. Comment on lines 19-24 explicitly documents: "D-12: zone the pointer is currently in. In Phase 28 this is NOT used for visual differentiation (D-15 — all 5 icons render in the same base state). Phase 29 wires DROP-02/03 active/inactive styling off this value."
  implication: Active-zone emphasis is out-of-scope per the phase design (deferred to Phase 29). The user's expectation ("specific zone under the pointer gets stronger/highlighted visual") aligns with Phase 29 work. However, user expectation was set by truth statement "5-zone indicator appears" (SC-5) which did not promise active emphasis. This is a scope-boundary finding, not a code bug.

- timestamp: 2026-04-17T23:40:00Z
  checked: src/dnd/computeDropZone.ts:34 threshold formula vs src/dnd/DropZoneIndicators.tsx:49/58/67/75 band proportions
  found: computeDropZone uses `threshold = Math.max(20, Math.min(w, h) * 0.2)` — threshold in viewport pixels, derived from the SHORTER axis. DropZoneIndicators uses `height: 20%` for top/bottom bands and `width: 20%` for left/right bands — 20% of each axis independently. For non-square cells these diverge. Worked example: 100w × 300h cell on mobile → threshold = max(20, min(100,300)*0.2) = max(20, 20) = 20px. Top band indicator shows at 20% * 300 = 60px tall. User pointer at y=40 is inside the visible top-arrow indicator (40 < 60) but computeDropZone returns 'center' (40 > threshold 20). "Center semi-consistent; extend zones buggy" — user points at a visible edge-arrow, lands in center because compute disagrees with indicator.
  implication: Zone boundary mismatch between indicator visual (20% per axis) and compute function (20% of min-axis). On non-square cells this creates a dead-band where the indicator shows an edge zone but compute returns center. Secondary contributor to "extend zones very buggy."

- timestamp: 2026-04-17T23:42:00Z
  checked: src/Grid/CanvasWrapper.tsx:99 pointer derivation
  found: `pointer = { x: startX + delta.x, y: startY + delta.y }` where startX/Y = activatorEvent.clientX/Y and delta = dnd-kit's cumulative move vector. These are all viewport coords, so pointer is viewport-space — correct for computeDropZone (which also uses viewport rect). Pointer computation itself is not the bug.
  implication: Rules out "pointer is in wrong coord space" as a cause of zone miscompute.

## Resolution

root_cause: |
  Three separate bugs in the visual layer of Phase 28 cell-drag:

  BUG 1 (ghost accelerated): `scaleCompensationModifier` at src/dnd/adapter/dndkit.ts:116-119 divides dnd-kit's viewport-space `transform.x/y` by `canvasScale`. On mobile, canvasScale ≈ 0.3, so ghost moves at ~3.3× pointer speed. The modifier is based on a misunderstanding of where the overlay renders: DragOverlay mounts via createPortal(document.body), sibling to the scaled canvas-surface, in viewport coord space. The draggable rect measured by dnd-kit is viewport-scaled (getBoundingClientRect on a descendant of transform:scale() returns the scaled rect). No compensation is needed — dnd-kit's transform is already viewport delta in viewport space.

  BUG 2 (no outline on hovered cell): `ringClass` at src/Grid/LeafNode.tsx:577-583 applies `ring-2 ring-[#3b82f6] ring-inset` to the ROOT div, but LeafNode's children include a canvas-clip-wrapper (`<div className="absolute inset-0 overflow-hidden">` at line 629) that fully covers the root's inner area. The inset box-shadow is painted at the root's own paint step, beneath its positioned children in CSS painting order, so the canvas completely obscures the ring on any cell with media. Contrast with LeafNode.tsx:662 file-drag overlay which uses a SEPARATE overlay div (`absolute inset-0 ring-2 ring-inset z-10`) to paint the ring above the canvas — that pattern works; the ringClass pattern on the root does not.

  BUG 3 (active zone not emphasized): `DropZoneIndicators` at src/dnd/DropZoneIndicators.tsx:28 accepts the `zone` prop under an underscore-alias (`{ zone: _zone }`) and never reads it. All 5 icons render identically (`text-white`) regardless of which zone the pointer is in. Phase 28 scope deliberately defers this (comment at :19-24 — Phase 29 work under DROP-02/DROP-03). The visible 5-icon overlay matches the Phase 28 verification truth ("5-zone indicator appears"), but the user's UAT expectation of active emphasis crosses into Phase 29 scope.

  SECONDARY (zone threshold mismatch): computeDropZone threshold is `Math.max(20, min(w,h) * 0.2)` (scaled on the shorter axis only), but DropZoneIndicators draws top/bottom bands at 20% of the TALLER axis and left/right bands at 20% of the WIDER axis. On non-square cells these disagree, creating a dead-band where the user points at a visible edge-arrow but falls into center. Contributes to "extend zones very buggy."
fix: (diagnose-only mode — no fix applied)
verification: (diagnose-only)
files_changed: []
