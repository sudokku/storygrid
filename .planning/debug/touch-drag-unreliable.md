---
status: diagnosed
trigger: "On a touch device, 250ms press-and-hold on any cell initiates drag; release <250ms does not trigger drag; releasing on a different cell commits the move — Test 2 in 28-HUMAN-UAT.md"
created: 2026-04-17T22:35:00Z
updated: 2026-04-17T22:55:00Z
---

## Current Focus

hypothesis: "Three distinct root causes bundled in one UAT failure — all converging on the scale compensation modifier + phase-28 deferred-to-29 styling + ring placement."
test: "Trace code paths for ghost motion, zone commit, and hover accent."
expecting: "Each bug has a separable mechanism."
next_action: "Return structured diagnosis (find_root_cause_only mode)."

## Symptoms

expected: |
  On touch, 250ms press-hold starts drag. Ghost tracks pointer 1:1. Edge zones (top/bottom/left/right) insert,
  center swaps. Hovered target cell has accent outline. Zone icon under pointer accentuated.
actual: |
  1. Ghost moves faster than pointer (accelerated).
  2. Only center (swap) works — edge zones do not commit. Inconsistent (~1 in 3).
  3. No accent outline on hovered target. No per-zone icon accentuation.
  4. On DESKTOP screen size: nothing works at all (not even swap).
errors: "none logged"
reproduction: "Test 2 + Test 4 in 28-HUMAN-UAT.md — touch or mobile-width viewport; desktop worse than mobile."
started: "Phase 28 implementation — never worked on real device."

## Eliminated

- hypothesis: "Drop zone hit-test threshold wrong in computeDropZone"
  evidence: "computeDropZone math (src/dnd/computeDropZone.ts:26-40) is correct — uses viewport-space rect and viewport-space pointer consistently. Pitfall-free. Unit tests pass."
  timestamp: 2026-04-17T22:42:00Z

- hypothesis: "moveCell drops edge zones silently"
  evidence: "gridStore.moveCell (src/store/gridStore.ts:473-494) correctly branches: center → swapLeafContent; top/bottom/left/right → moveLeafToEdge. Edge semantics verified by 28-tree-level tests."
  timestamp: 2026-04-17T22:43:00Z

- hypothesis: "onDragEnd handler only wired for center zone"
  evidence: "CanvasWrapper.tsx:119 — `if (over && active.id !== over.id && zone)` accepts any zone value; passes it through to moveCell unchanged."
  timestamp: 2026-04-17T22:44:00Z

## Evidence

- timestamp: 2026-04-17T22:40:00Z
  checked: "src/dnd/adapter/dndkit.ts:116-119 scaleCompensationModifier"
  found: |
    Modifier returns { ...transform, x: transform.x / scale, y: transform.y / scale }.
    At canvasScale=0.5 (common on mobile/desktop-preview), a raw pointer delta of 50px becomes transform.x=100.
    Unit test dndkit.test.ts:288-295 literally asserts this doubling: "divides transform.x and transform.y by canvasScale=0.5" → x=200 from input x=100.
  implication: |
    This modifier was designed assuming the DragOverlay renders INSIDE the scaled container
    (where dividing by scale would cancel the parent transform). But DragOverlay uses
    createPortal(document.body) — it always portals OUTSIDE any ancestor transform.
    Dividing by scale AMPLIFIES movement by 1/scale. Ghost translates 2× at scale=0.5,
    3–5× at scale=0.2 (desktop preview-zoom-out).

- timestamp: 2026-04-17T22:41:00Z
  checked: "@dnd-kit docs on modifier/delta timing"
  found: |
    Modifiers run BEFORE the delta is delivered to onDragOver handlers and BEFORE collision
    detection. event.delta in handleDragOver is the POST-MODIFIER delta — the same amplified
    value the overlay's transform uses.
  implication: |
    CanvasWrapper.handleDragOver (lines 97-99) reconstructs pointer as
    `{ x: startX + delta.x, y: startY + delta.y }` using the amplified delta.
    Both the ghost AND the zone-computation pointer are shifted the same amount — so the
    user's actual finger sits 1/scale× CLOSER to the source than dnd-kit thinks.
    When finger enters a real cell, dnd-kit's ghost has overshot it and lands in a neighbour
    (or off-canvas), collision detection reports `over=null` or wrong cell, and zone math
    reads a pointer already past the cell edge.

- timestamp: 2026-04-17T22:45:00Z
  checked: "src/dnd/DropZoneIndicators.tsx:28 — zone prop"
  found: |
    `function DropZoneIndicators({ zone: _zone }: Props)` — the zone prop is destructured
    with a leading underscore to mark it INTENTIONALLY UNUSED. All 5 icons render with
    identical styling.
  implication: |
    Phase 28 ships all 5 zones in a base state with NO per-zone accent. Comment at lines
    20-25 explicitly documents this as D-15: "Phase 29 wires DROP-02/03 active/inactive
    styling off this value." User's "icon of the move is not accentuated" is a known
    deferred feature, not a bug — Phase 29 will implement it.

- timestamp: 2026-04-17T22:47:00Z
  checked: "src/Grid/LeafNode.tsx:577-594 — ringClass applied to root div"
  found: |
    Accent outline is `ring-2 ring-[#3b82f6] ring-inset` applied via className on the
    root LeafNode div (line 593). Tailwind's ring-* renders as box-shadow.
    Sibling canvas wrapper (line 629) is `absolute inset-0 overflow-hidden` with a
    `<canvas className="absolute inset-0 w-full h-full">` child that paints the media.
  implication: |
    On cells WITH media, the canvas fully covers the cell interior INCLUDING the ring-inset
    box-shadow area. Ring is painted but hidden UNDER the canvas layer.
    File-drop's own highlight (line 661-662) avoids this by rendering a SEPARATE div with
    explicit `z-10` so it paints ABOVE the canvas. Cell-drag drop-target highlight was
    not given the same treatment — it's on the root div and gets occluded by the canvas.

- timestamp: 2026-04-17T22:50:00Z
  checked: "PITFALLS.md line 461 — dnd-kit issue #50"
  found: |
    Documented known issue: "DragOverlay at non-1x scale. Mitigation: override
    measuring.droppable.strategy with MeasuringStrategy.Always + getBoundingClientRect."
    Phase 28 plan went with a custom 'divide-by-scale' modifier instead. The upstream-
    recommended fix was not used.
  implication: |
    There is an upstream-known dnd-kit bug with scaled containers. The correct fix is
    measuring-strategy based, not modifier-based. The chosen modifier pattern was wrong
    from inception — the scale compensation math assumes ghost inside scale; the actual
    setup puts ghost outside scale via DragOverlay's createPortal.

- timestamp: 2026-04-17T22:52:00Z
  checked: "test suite — why wasn't this caught?"
  found: |
    dndkit.test.ts:288-349 asserts the scaleCompensation modifier doubles x/y at scale=0.5.
    The test validates the MATH of the modifier in isolation, not its correctness in
    context. There is no integration test that verifies the ghost-position-minus-pointer-
    position delta is zero at any scale. UAT was the first integration check — and it
    failed exactly as physics predicts.
  implication: |
    The test asserted the buggy behavior as correct. Unit tests that validate pure
    functions in isolation cannot catch architectural misassumptions about portal
    boundaries. This is the scaleCompensation modifier's design contradiction cemented
    in test form.

## Resolution

root_cause: |
  Three distinct root causes bundled in the symptom:

  BUG 1 (ghost accelerated): scaleCompensationModifier in src/dnd/adapter/dndkit.ts:116-119
  DIVIDES transform.x/y by canvasScale under the false premise that DragOverlay renders
  inside the scaled container. DragOverlay actually portals to document.body (outside any
  ancestor transform). Dividing by scale therefore AMPLIFIES movement by 1/scale instead
  of compensating — explains "ghost at accelerated pace". At scale=0.5 ghost moves 2×; at
  desktop preview scales (~0.2–0.3) ghost moves 3–5× → "doesn't work at all on desktop".

  BUG 2 (edge zones don't commit, swap works inconsistently, 1-in-3): flows from Bug 1.
  Modifiers run BEFORE delta is delivered to onDragOver. CanvasWrapper.handleDragOver
  (lines 97-99) reconstructs pointer from `activatorEvent.clientXY + event.delta` using
  the AMPLIFIED delta. Both dnd-kit's collision detection (ghost rect) and our
  computeDropZone input use this same overshot pointer. Actual finger lags the computed
  pointer by a factor of 1/scale. Center works sometimes because at short drag distances
  the discrepancy is small enough that the computed pointer still lands inside the target
  cell's center zone (20% inset = ~60% of cell width). Edge zones require pointer to land
  in a ~20% band — the amplified discrepancy pushes the computed pointer past the band
  into the next cell or off-canvas, so the drop commits to wrong target or null target.

  BUG 3 (no hover accent, no per-zone icon accent): two sub-causes.
    3a. No hovered-cell ring visible on cells with media: src/Grid/LeafNode.tsx:581-593
        puts `ring-2 ring-[#3b82f6] ring-inset` on the root div via className. The sibling
        `<div absolute inset-0 overflow-hidden>` + its `<canvas absolute inset-0>` (lines
        629-637) fully covers the ring area. File-drop highlight (line 662) avoids this
        by using a separate overlay div with explicit `z-10`. Cell-drag ring needs the
        same treatment.
    3b. No per-zone icon accentuation: src/dnd/DropZoneIndicators.tsx:28 destructures the
        zone prop as `_zone` (intentionally unused). Comment at lines 20-25 explicitly
        documents this as Phase 29 scope (D-15). This is NOT a bug — it is a planned
        deferral. User's expectation for Phase 28 was wrong.

fix: "[not applied — diagnose-only mode]"
verification: "[not applied — diagnose-only mode]"
files_changed: []
