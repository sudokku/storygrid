---
status: diagnosed
trigger: "insert-edge-drop-broken: Cell-to-cell drag INSERT (edge drop: top/bottom/left/right) does not commit on desktop mouse-drag AND touch drag after 28-11/12/13 gap closure"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:20:00Z
---

## Current Focus

hypothesis: Two independent root-cause defects in CanvasWrapper.tsx:
  (A) `onDragOver` is used as if it fires continuously, but @dnd-kit's `onDragOver` only fires when `overId` CHANGES (enter/leave of a droppable). Zone is computed once on enter, stale thereafter — user moving within the same cell never re-triggers zone recomputation.
  (B) On touch, `activatorEvent` is a TouchEvent, not a PointerEvent. `TouchEvent.clientX/Y` is undefined — every pointer derivation on touch yields NaN, and computeDropZone(NaN, NaN) always returns 'center'.
test: Cross-referenced @dnd-kit/core/dist/core.esm.js (the actual installed dependency).
expecting: Evidence confirms both mechanisms. Either alone is sufficient to explain "edge drops do not work"; together they explain why both desktop AND touch fail with the same symptom.
next_action: Write root-cause diagnosis to ROOT CAUSE FOUND.

## Symptoms

expected: On both desktop (mouse-drag ≥8px) and touch (250ms press-and-hold + 5px), releasing the pointer in an edge zone (top / bottom / left / right) of a different cell commits the move via gridStore.moveCell(sourceId, overId, zone) such that the source cell inserts into the target cell along the chosen edge (semantics identical to Phase 9).
actual: User reports twice "the insert still not working" (Test 1, desktop) and "again, the edges do not work" (Test 2, touch). Edge-drop does not commit on either modality. 1:1 ghost tracking IS working (confirmed by user). Center swap is suspected to work (partial behavior observed in first-pass UAT). File-drop (SC-4) still works. Accent ring (28-13) IS working.
errors: None reported in console. Silent failure.
reproduction: dev server → build ≥2-cell grid → click-hold (or press-and-hold on touch) on one cell → move pointer/finger to an edge zone of a different cell (e.g., top 20% of target) → release → verify grid layout DID NOT change (bug).
started: First-pass UAT 2026-04-17 (28-HUMAN-UAT.md) attributed to scaleCompensationModifier (28-12 gap 2). 28-12 fix deployed but edge-drop STILL broken per 28-UAT.md 2026-04-18.

## Eliminated

- hypothesis: H1 — computeDropZone returns null/center because threshold math mismatches DropZoneIndicators band geometry
  evidence: computeDropZone.ts:44-45 uses per-axis yThreshold=max(20, h*0.2) / xThreshold=max(20, w*0.2); DropZoneIndicators.tsx:48-77 uses 20% height for top/bottom and 20% width for left/right. They align exactly. Math is correct.
  timestamp: 2026-04-18T00:10:00Z

- hypothesis: H2 — gridStore.moveCell has a bug in the edge-insert branch
  evidence: gridStore.ts:473-494 moveCell correctly switches on edge === 'center' (swapLeafContent) vs any other edge (moveLeafToEdge). lib/tree.ts:340-387 moveLeafToEdge is pure, correctly builds a new 50/50 container with sourceFirst based on edge, removes source with collapse-upward. Phase 9 tests at test/phase09-p02-store-move.test.ts presumably still pass. No bug in the insert branch itself — the bug is that moveCell is never called with zone != 'center'.
  timestamp: 2026-04-18T00:15:00Z

- hypothesis: H4 — DragOverlay rect participates in collision detection and resolves wrong droppable
  evidence: DragPreviewPortal uses DragOverlay with adjustScale=false. The `over` value reaching onDragEnd is the target cell (user confirms 1:1 ghost tracking and reports swap "works once in three times" in first-pass UAT — implying `over` resolves correctly; the FAILURE is in ZONE, not in OVER). The store's overId always points at the correct target; only activeZone is wrong.
  timestamp: 2026-04-18T00:18:00Z

## Evidence

- timestamp: 2026-04-18T00:05:00Z
  checked: CanvasWrapper.tsx handleDragOver (lines 88-111) and handleDragEnd (lines 113-125)
  found: handleDragEnd reads `zone = useDragStore.getState().activeZone` but DOES NOT re-derive pointer/zone from the DragEndEvent. The zone used is whatever was last written by onDragOver. Pointer derived in handleDragOver uses `(activatorEvent as PointerEvent).clientX` + delta.x.
  implication: Zone freshness depends entirely on onDragOver firing at the moment of release. If onDragOver does not fire continuously, the zone is stale by the time handleDragEnd reads it.

- timestamp: 2026-04-18T00:08:00Z
  checked: @dnd-kit/core source at node_modules/@dnd-kit/core/dist/core.esm.js lines 3244-3286
  found: The useEffect that dispatches onDragOver declares dependency array `[overId]` (line 3286). Effect body: `const overContainer = droppableContainers.get(overId); ... setOver(over); onDragOver(event);`
  implication: CRITICAL. @dnd-kit's onDragOver handler fires ONLY when overId changes (droppable ENTER/LEAVE), NOT on every pointer move within a droppable. This is deliberate — the name "onDragOver" refers to "over a new droppable", not "during drag move".

- timestamp: 2026-04-18T00:10:00Z
  checked: @dnd-kit/core source lines 3210-3243 — the onDragMove effect
  found: `useEffect(..., [scrollAdjustedTranslate.x, scrollAdjustedTranslate.y])`. This effect DOES fire on every pointer move (its deps are the continuously-changing translate).
  implication: onDragMove is the handler that fires continuously. Our CanvasWrapper does NOT install an onDragMove handler. The zone-computation code belongs in onDragMove, not onDragOver.

- timestamp: 2026-04-18T00:12:00Z
  checked: handleDragOver pointer derivation line 99: `const startX = (activatorEvent as PointerEvent).clientX;`
  found: For CellDragMouseSensor, activatorEvent is a DOM MouseEvent (onMouseDown). MouseEvent has `.clientX` / `.clientY` — safe. For CellDragTouchSensor, activatorEvent is a DOM TouchEvent (onTouchStart). TouchEvent does NOT have top-level `.clientX` / `.clientY`; coordinates live on `touches[0].clientX/Y` (or `changedTouches[0]` for touchend).
  implication: On touch, `startX` and `startY` are both `undefined`. Then `pointer = { x: undefined + delta.x, y: undefined + delta.y }` = `{ x: NaN, y: NaN }`. Then in computeDropZone: `y = NaN - rect.top = NaN`; every `y < yThreshold`, `y > h - yThreshold`, `x < xThreshold`, `x > w - xThreshold` comparison with NaN is `false`. Default-return is `'center'`. Touch path ALWAYS computes zone='center' regardless of where the finger is.

- timestamp: 2026-04-18T00:15:00Z
  checked: 28-HUMAN-UAT.md first-pass UAT Test 2 — user said "I could swap them but it looks like I can't extend the cell"
  found: On touch, SWAP succeeded (which matches zone='center' being the only zone ever computed). Edge-insert failed (edge zones never computable on touch). Exact match with the NaN pattern.
  implication: The touch-specific symptom ("edges don't work on touch") is fully explained by the clientX-undefined bug. This is DIFFERENT from the 28-12 scaleCompensationModifier diagnosis — that diagnosis was spurious. The real touch defect is the type mismatch.

- timestamp: 2026-04-18T00:17:00Z
  checked: 28-UAT.md Test 1 — desktop edges still don't work AFTER 28-12
  found: On desktop (mouse), activatorEvent IS a MouseEvent, pointer derivation is correct. So the pointer value reaching computeDropZone is valid. But the onDragOver handler only fires on overId ENTER/LEAVE, so zone is computed ONCE when the user enters target B (at whatever zone the entry path crossed — usually 'center' or the edge nearest the source cell), then NEVER UPDATED as the user continues moving within B.
  implication: On desktop, zone is stuck at entry-zone. Users typically enter a neighbor cell near the shared border (so entry zone = the edge closest to source), but then move their cursor toward a DIFFERENT edge or center before releasing — and the stale zone no longer matches their release location. Since entering from the left usually gives zone='left', and then moving to the top gives... still 'left' (stale). Since the store never updates, `handleDragEnd` uses the stale 'left'. In practice the stale zone is almost never what the user intended, and when the user drags relatively slowly toward the target center, the entry zone is often 'center' (if the target is larger than the source and they approach it centered) — which makes SWAP succeed some of the time. Matches user's Test 1 report ("insert still not working" while swap may work some of the time).

- timestamp: 2026-04-18T00:18:00Z
  checked: Integration test CanvasWrapper.integration.test.tsx + computeDropZone.test.ts
  found: Integration tests exercise dragStore actions directly (setOver, end) and gridStore.moveCell directly, but NEVER exercise the end-to-end onDragOver→computeDropZone→setOver→handleDragEnd→moveCell pipeline driven by real DndContext events. computeDropZone unit tests do not cover NaN inputs.
  implication: This IS the test-coverage gap called out in 28-UAT.md hypothesis (4): "edge-drop path is not actually exercised end-to-end". Both automated-gate PASS and UAT-FAIL are explicable — the automation never triggered the code path that is broken.

- timestamp: 2026-04-18T00:19:00Z
  checked: 28-12 gap-closure plan claimed scaleCompensationModifier was the root cause
  found: 28-12 removed scaleCompensationModifier and added MeasuringStrategy.Always. These fix the ghost-speed/drift issues but do NOT fix either mechanism found here. The real issues were invisible to the 28-12 diagnosis because it never simulated a real full-move pipeline and never considered `onDragOver` firing semantics.
  implication: 28-12 was a partial fix — it unblocked ghost 1:1 speed (which the user confirms works) but missed the two underlying defects in the zone-computation plumbing.

## Resolution

root_cause: |
  Two independent defects in `src/Grid/CanvasWrapper.tsx` cause insert (edge) drops to fail across both input modalities:

  **Defect 1 (affects BOTH desktop and touch) — onDragOver fires only on droppable enter/leave, not on move-within.**

  `handleDragOver` (CanvasWrapper.tsx:88-111) computes the pointer, calls `computeDropZone(rect, pointer)`, and writes the result to `useDragStore.setOver(overId, zone)`. `handleDragEnd` (CanvasWrapper.tsx:113-125) reads the zone back from the store and passes it to `moveCell`.

  But @dnd-kit/core's DndContext wires `onDragOver` with `useEffect(..., [overId])` (verified in `node_modules/@dnd-kit/core/dist/core.esm.js` lines 3244-3286) — it fires ONLY when `overId` changes, i.e., when the pointer crosses into a new droppable or leaves the current one. It does NOT fire on every pointer move inside the same droppable.

  Result: on mouse drags, the zone is computed ONCE at the moment of ENTER into the target cell, and then remains frozen in the store regardless of where the user subsequently moves inside that cell. When the user releases on an edge zone (top/bottom/left/right) of the target, `handleDragEnd` reads the stale entry-zone instead of the release-zone, so edge intent is lost. The zone that actually fires `moveCell` is whatever zone the pointer happened to be in when it first crossed the target boundary — most commonly `'center'`, producing the stale "swap works sometimes, edges never work" pattern.

  Fix: Install an `onDragMove` handler on `DndContext` that performs the same pointer-→-rect-→-computeDropZone pipeline currently in `onDragOver`. `onDragMove` is wired on `[scrollAdjustedTranslate.x, scrollAdjustedTranslate.y]` (core.esm.js:3210-3243) and fires on every pointer move. The existing `onDragOver` can stay as a fast-path for enter/leave (setting zone on first entry) but the authoritative continuous update must come from `onDragMove`.

  **Defect 2 (touch-only amplifier) — activatorEvent is a TouchEvent on touch, not a PointerEvent; `.clientX/Y` is undefined.**

  `handleDragOver` line 99-100 casts `activatorEvent` to `PointerEvent` and reads `.clientX / .clientY` directly. For `CellDragMouseSensor` (subclass of `@dnd-kit/core` MouseSensor bound to `onMouseDown`), this is a real MouseEvent with valid `clientX/Y`. For `CellDragTouchSensor` (subclass of TouchSensor bound to `onTouchStart`), `activatorEvent` is a TouchEvent — which does NOT expose top-level `clientX/Y`; coordinates live on `touches[0]` (or `changedTouches[0]` for touchend). Reading `.clientX` on a TouchEvent returns `undefined`.

  Result: `pointer.x = undefined + delta.x = NaN`, same for y. `computeDropZone(rect, { x: NaN, y: NaN })` evaluates all four edge comparisons as `false` (any comparison with NaN is false) and falls through to `return 'center'`. On touch, zone is ALWAYS `'center'` regardless of finger position — edge-insert is physically unreachable. This is a pre-existing defect that was not addressed by 28-11, 28-12, or 28-13.

  Fix: branch on `activatorEvent instanceof TouchEvent` (or equivalent) and read coordinates from `touches[0].clientX/Y` in the touch case; keep the MouseEvent path as-is. Alternatively, use `active.rect.current.initial` + `delta` (the active rect's initial position is known to dnd-kit and is input-type-agnostic) to derive pointer, eliminating the activatorEvent type branching entirely.

  **Test coverage gap that masked both defects.**

  `CanvasWrapper.integration.test.tsx` exercises dragStore actions and `gridStore.moveCell` in isolation but never drives a synthetic DndContext end-to-end (onDragStart → onDragMove pattern → onDragEnd with pointer coordinates). `computeDropZone.test.ts` does not test NaN inputs. Phase 28's jsdom integration tests all passed (28-VERIFICATION.md gates PASS) because they never touched the broken pipeline. Adding an integration test that renders `<CanvasWrapper/>`, dispatches `pointerdown/pointermove/pointerup` via @testing-library, and asserts that `moveCell` is called with the correct edge-zone argument would catch both defects.

fix: (diagnose-only mode; no fix applied)
verification: (pending)
files_changed: []
