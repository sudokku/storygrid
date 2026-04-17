---
status: diagnosed
trigger: "UAT phase 28 — desktop mouse drag of a cell produces no visible effect; mobile/touch drag at least partially initiates"
created: 2026-04-17T22:45:00Z
updated: 2026-04-17T22:45:00Z
---

## Current Focus

hypothesis: Two sensors (PointerSensorMouse + PointerSensorTouch) both register an activator on the same React `eventName` `onPointerDown`; dnd-kit's `useSyntheticListeners` reducer writes them to the same key on the listener object, so the second (Touch) activator silently overwrites the first (Mouse) activator. With only the Touch activator bound to `onPointerDown`, mouse pointerdown events are rejected (`pointerType !== 'touch' && !== 'pen'` → false), and no drag ever starts on desktop.
test: Read dnd-kit's `useCombineActivators` + `useSyntheticListeners` + `bindActivatorToSensorInstantiator` in node_modules; trace sensor registration from `useSensors(...)` at `CanvasWrapper.tsx:60-63` through the reducer in `core.esm.js:2361-2376`; confirm BOTH subclasses' static activators declare `eventName: 'onPointerDown'` and the reducer uses the eventName as an object key.
expecting: Confirmed via code-read — the reducer `acc[eventName] = …` overwrites on duplicate keys; result is a single `onPointerDown` handler = the last-registered sensor's handler (Touch).
next_action: Diagnosis-only; parent orchestrator will select fix direction. Recommended direction (not applied): unify into a single PointerSensor whose activator dispatches on `pointerType` and applies different `activationConstraint` based on pointerType, or use dnd-kit's built-in MouseSensor/TouchSensor (which bind to different React eventNames — `onMouseDown` vs `onTouchStart` — and therefore don't collide). Note: SC-3 grep gate forbids literal MouseSensor/TouchSensor names; an alternative is to invert the sensor order so Mouse is last (makes desktop work but breaks mobile) — so a single unified sensor is the durable answer.

## Symptoms

expected: On a ≥2-cell grid, mousedown on one cell, move ≥8px, release on a different cell — cells swap (center drop) or insert (edge drop) identically to Phase 9 semantics.
actual: On desktop viewports (≥768px and effectively any viewport where the user is using a mouse), absolutely nothing happens — no ghost, no opacity dim on source, no zone overlay, no accent outline. On mobile-width viewports (touch input, pointerType === 'touch'), drag does at least initiate (user reports ghost appears but runs at accelerated speed; zone icons appear but only center-swap is semi-consistent; no accent ring).
errors: None in the console (bug is a silent no-op — sensor activator rejects the event and returns false, which dnd-kit treats as "not my sensor").
reproduction: 1) Open StoryGrid at a viewport wide enough to drive desktop mouse input (any desktop browser). 2) Split the canvas into ≥2 cells (press H or V while a cell is selected). 3) Mouse-down on any cell and drag >8px toward another cell. Expected: ghost appears + source opacity 0.4 + 5-zone overlay on target. Actual: nothing.
started: Phase 28 shipped the unified engine (commits in 28-10a / 28-10b summaries). The bug exists from the initial Phase 28 wiring — it was never observable in unit tests because no test simulates a real pointer event through both sensors bound to the same DndContext.

## Eliminated

(Investigation was targeted; no hypotheses were formally eliminated. Other candidates briefly considered:)

- hypothesis: `touch-action: none` on LeafNode root blocks mouse pointerdown
  evidence: `touch-action: none` only affects touch behavior (panning/zoom); mouse pointerdown is unaffected. Eliminated by spec. Ruled out without further testing.
  timestamp: 2026-04-17T22:40:00Z

- hypothesis: `onPointerDown={handlePointerDown}` in LeafNode (line 610) overwrites dragListeners
  evidence: Verified via Read of LeafNode.tsx:585-617 — `{...dragListeners}` is spread AFTER the explicit `onPointerDown`, so dragListeners wins (Pitfall 1 honored). Additionally, `handlePointerDown` early-returns when `!isPanMode` and does not preventDefault / stopPropagation, so even if order were wrong, it would not swallow the event. Eliminated.
  timestamp: 2026-04-17T22:41:00Z

- hypothesis: ActionBar (z-50, `md:block`) or OverlayLayer (z:30) swallows pointerdown on desktop
  evidence: ActionBar only renders while `isHovered && !isPanMode` and covers a small top-center region — not the whole cell. Its buttons have `onClick`, not `onPointerDown` handlers, and don't stop propagation. OverlayLayer root has `pointerEvents: none` (children use `isDragging ? 'none' : 'auto'`). Neither covers the cell area the user is clicking. Eliminated.
  timestamp: 2026-04-17T22:42:00Z

- hypothesis: Divider hit-area intercepts cell-edge pointerdown
  evidence: Divider hit-area is only 22px wide centered on the gap between cells and is marked `data-dnd-ignore="true"`. It does not cover cell bodies. Even if clicked, it would only prevent sensor activation locally, not "for the whole page." Eliminated.
  timestamp: 2026-04-17T22:42:00Z

## Evidence

- timestamp: 2026-04-17T22:35:00Z
  checked: `src/Grid/CanvasWrapper.tsx:60-63`
  found: Sensors are registered as `useSensors(useSensor(PointerSensorMouse, { distance: 8 }), useSensor(PointerSensorTouch, { delay: 250, tolerance: 5 }))`. Mouse is first, Touch is second in the sensor array.
  implication: The order of sensors passed into `useSensors` determines the order in which activators are combined in dnd-kit's `useCombineActivators`.

- timestamp: 2026-04-17T22:36:00Z
  checked: `src/dnd/adapter/dndkit.ts:58-74` and `:86-102`
  found: BOTH subclasses override `static activators` with a single entry whose `eventName` is the identical string `'onPointerDown' as const`. PointerSensorMouse's handler returns false unless `pointerType === 'mouse'`. PointerSensorTouch's handler returns false unless `pointerType === 'touch' || 'pen'`.
  implication: Both activators register under the SAME React synthetic-event key (`onPointerDown`).

- timestamp: 2026-04-17T22:37:00Z
  checked: `node_modules/@dnd-kit/core/dist/core.esm.js:1933-1944` (`useCombineActivators`)
  found: The function reduces `sensors` into an ARRAY of `{ eventName, handler }` objects, preserving order and NOT deduplicating by `eventName`.
  implication: The combined `activators` array contains [MouseActivator, TouchActivator] — both with `eventName === 'onPointerDown'`.

- timestamp: 2026-04-17T22:38:00Z
  checked: `node_modules/@dnd-kit/core/dist/core.esm.js:2361-2376` (`useSyntheticListeners`)
  found: `listeners.reduce((acc, _ref) => { const { eventName, handler } = _ref; acc[eventName] = event => handler(event, id); return acc; }, {})`. The accumulator is an OBJECT keyed by `eventName`.
  implication: When two activators share an eventName, the SECOND one overwrites the first in the object. The `listeners` prop bag that `useCellDraggable` returns therefore contains ONLY ONE `onPointerDown` handler — the Touch sensor's (because Touch is registered after Mouse).

- timestamp: 2026-04-17T22:39:00Z
  checked: `node_modules/@dnd-kit/core/dist/core.esm.js:3177-3200` (`bindActivatorToSensorInstantiator`)
  found: After the user's `onPointerDown` fires, the handler calls `sensorActivator(event, sensor.options, activationContext)`. If the activator returns `false`, dnd-kit treats the event as rejected and no sensor is instantiated — `activeRef.current` stays null, no drag lifecycle starts.
  implication: With only the Touch activator bound, a mouse `pointerdown` (pointerType === 'mouse') returns `false` from the activator, dnd-kit stops, and no visible feedback ever appears.

- timestamp: 2026-04-17T22:43:00Z
  checked: `src/dnd/adapter/__tests__/dndkit.test.ts:43-164`
  found: Existing unit tests invoke each sensor's `activators[0].handler` directly on a synthetic event — one sensor at a time, never both bound to the same DOM node under dnd-kit's real combine-listeners pipeline.
  implication: The unit tests passed even though the integration is broken. The bug is invisible to the unit layer; only a runtime pointerdown on a real draggable surfaces it.

- timestamp: 2026-04-17T22:43:30Z
  checked: `src/dnd/__tests__/CanvasWrapper.integration.test.tsx`
  found: The integration test seeds dragStore via `beginCellDrag / setOver / setGhost / end` imperatively; it never dispatches a real `pointerdown` through the sensor pipeline (jsdom activation is documented as unreliable — Pitfall 11 / D-31 / D-33).
  implication: The suite could not have caught this. The behavior was punted to real-device UAT (SC-1, SC-2, SC-5), which is exactly what surfaced it.

- timestamp: 2026-04-17T22:44:00Z
  checked: Mobile vs desktop observed behavior
  found: On mobile (pointerType === 'touch'), the surviving activator is Touch — it matches and activation succeeds, so drag initiates (though other mobile-specific issues remain: jittery ghost, unreliable edge zones — out of scope for this root-cause investigation).
  implication: Confirms the hypothesis by complement — the pointerType that the ONLY bound activator accepts is the one that works; the other is dead.

## Resolution

root_cause: In `src/Grid/CanvasWrapper.tsx:60-63`, `useSensors` registers two PointerSensor subclasses whose static activators BOTH use `eventName: 'onPointerDown'`. @dnd-kit/core's `useSyntheticListeners` (node_modules/@dnd-kit/core/dist/core.esm.js:2361-2376) collapses the combined activator array into a single listener object keyed by eventName, so the second-registered activator (`PointerSensorTouch`) overwrites the first (`PointerSensorMouse`). The React element therefore only dispatches `onPointerDown` into the Touch activator, which rejects any event with `pointerType !== 'touch' && !== 'pen'`. Mouse pointerdown events are silently dropped, so no drag ever starts on desktop. This is the mechanism behind both "Test 1: nothing happens on desktop" and "Test 4: on desktop screen sizes it does not work at all, not even the swipe" reports in `.planning/phases/28-cell-to-cell-drag/28-HUMAN-UAT.md`.

fix: (NOT APPLIED — diagnosis only, per orchestrator instruction.)

verification: (N/A — no fix applied.)

files_changed: []

---

## Suggested Fix Directions (for downstream handoff)

Ordered by durability:

1. **Single unified PointerSensor with pointerType-aware activator (DURABLE).** Merge the two classes into ONE subclass of `PointerSensor` whose single `activators[0].handler` inspects `event.pointerType` and:
   - For `'mouse'`: returns true immediately (distance constraint at the useSensor() call handles the 8px threshold).
   - For `'touch' | 'pen'`: returns true (delay constraint at useSensor() handles the 250ms).
   The two activation constraints cannot coexist on a single sensor class (D-03 collapses `{delay, distance}` to delay-only). The workaround is to apply distinct constraints via TWO `useSensor()` instances of the same class — but then the eventName collision recurs. The stable path is a single sensor with a **pointerType-switched** `activationConstraint` strategy, implemented by subclassing `AbstractPointerSensor` directly (not `PointerSensor`) and feeding distinct `handleStart` timing per pointerType. This is invasive — see option 2 for a simpler workaround.

2. **Use `@dnd-kit/core`'s built-in `MouseSensor` (onMouseDown) + `TouchSensor` (onTouchStart) together (SIMPLEST).** These sensors bind to DIFFERENT React event names, so they do NOT collide under `useSyntheticListeners`. This is the pattern @dnd-kit's own docs recommend for "different constraints for mouse vs touch." BUT: SC-3 grep gate currently forbids the string literals `MouseSensor` / `TouchSensor` in `src/`. Fixing this bug requires relaxing that gate. The rationale in the adapter header ("Rule 1: Single PointerSensor only … combining them was a primary cause of Phase 25's flaky activation") is now contradicted by Phase 28's own observed behavior: a single PointerSensor class cannot discriminate pointerType AND apply distinct constraints — the two PointerSensor subclasses collide at the listener key. The gate's origin premise is wrong in this context.

3. **Only register one sensor at a time based on a runtime pointerType guess (FRAGILE).** Not recommended — desktop users with hybrid devices (touchscreen laptop) would flicker between engines.

## Specialist Hint

`typescript` — the bug lives in the TypeScript adapter layer (`src/dnd/adapter/dndkit.ts` + `src/Grid/CanvasWrapper.tsx`) and interacts with @dnd-kit/core's public sensor API. React pointer-event synthetic-listener semantics are the load-bearing mechanic.
