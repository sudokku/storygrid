---
phase: 28-cell-to-cell-drag
plan: 02
subsystem: dnd/adapter
tags: [dnd, sensors, pointer, modifier, dndkit, adapter, scale-compensation]
requires:
  - .planning/phases/27-dnd-foundation/27-01-SUMMARY.md (skeleton + header block)
  - src/dnd/adapter/dndkit.ts (Phase 27 skeleton with 28-line header)
  - src/store/editorStore.ts (canvasScale field)
  - @dnd-kit/core (PointerSensor base class + Modifier type)
provides:
  - PointerSensorMouse — mouse-only PointerSensor subclass
  - PointerSensorTouch — touch/pen PointerSensor subclass
  - scaleCompensationModifier — divides transform.x/y by canvasScale
  - 26 unit tests locking all three behaviors
affects:
  - Plan 05 (DragPreviewPortal) will consume scaleCompensationModifier
  - Plan 07 (CanvasWrapper DndContext mount) will useSensor() both sensors
tech-stack:
  added: []
  patterns:
    - PointerSensor subclass via static activators[] override
    - Imperative Zustand read via useEditorStore.getState() in non-React code
    - DOM-attribute escape hatch via target.closest('[data-dnd-ignore]')
key-files:
  created:
    - src/dnd/adapter/__tests__/dndkit.test.ts
  modified:
    - src/dnd/adapter/dndkit.ts
decisions:
  - Split sensors (mouse vs touch+pen) per D-02 instead of a combined constraint — D-03 warns AbstractPointerSensor.attach collapses {delay, distance} to delay-only
  - activationConstraint NOT set on the class; deferred to useSensor() call site in Plan 07 per D-03
  - Ignore-check runs BEFORE onActivation to avoid starting a drag that will later be cancelled (D-26)
  - Defensive `typeof target.closest === 'function'` guard handles non-Element targets (e.g. window/document) without crashing
  - Inlined `ActivatorOptions` type instead of importing `PointerSensorOptions` from @dnd-kit/core — the internal interface is not part of the exported public surface in v6.3.x
metrics:
  duration: ~12 minutes
  tasks_completed: 1
  commits: 2
  files_created: 1
  files_modified: 1
  tests_added: 26
  tests_passing: 823 (was 797 before this plan — +26 new)
  tests_failing: 9 (pre-existing Phase 25 / ActionBar / phase22 failures, scheduled for removal in Plans 08-10 per D-21/D-22)
completed: 2026-04-17
---

# Phase 28 Plan 02: Adapter Sensor Subclasses + Scale Modifier Summary

Filled the Phase 27 adapter skeleton body in `src/dnd/adapter/dndkit.ts` with two
custom `PointerSensor` subclasses (mouse-only and touch+pen) and a custom
`Modifier` for ancestor-`transform: scale()` compensation, while preserving the
28-line BLOCKING RULES header verbatim.

## What Was Built

### `src/dnd/adapter/dndkit.ts` (modified — 31 → 116 lines)

Three new named exports replace the Phase 27 `export {};` stub:

1. **`PointerSensorMouse extends PointerSensor`** — activator rejects any
   `pointerType !== 'mouse'`, then checks for a `[data-dnd-ignore]` ancestor
   via `target.closest()` BEFORE firing `onActivation`. The
   `activationConstraint: { distance: 8 }` (REQ DRAG-04, Pitfall 4) is applied
   at the `useSensor()` call site in Plan 07 — never encoded on the class.

2. **`PointerSensorTouch extends PointerSensor`** — symmetrical; activator
   accepts `pointerType === 'touch' | 'pen'`. `activationConstraint: { delay:
   250, tolerance: 5 }` (REQ DRAG-03, Pitfall 4's "NEVER 500ms" rule) is
   similarly deferred to Plan 07.

3. **`scaleCompensationModifier: Modifier`** — reads
   `useEditorStore.getState().canvasScale` imperatively (non-React code path,
   D-04 pattern), divides `transform.x` and `transform.y` by `scale || 1`
   (divide-by-zero guard), and spreads the input `Transform` so `scaleX` and
   `scaleY` pass through untouched (D-09 — `adjustScale=false` on
   `DragOverlay`).

The 28-line header block (lines 1–28) is preserved byte-for-byte. The three
BLOCKING RULES (DND-01 single sensor, Pitfall 4 thresholds, Pitfall 10 no
parallel engines) remain intact — Phase 27 verification's source-readback
assertions continue to pass.

### `src/dnd/adapter/__tests__/dndkit.test.ts` (new — 26 tests)

Unit tests lock the three exports' behavior:

- **Class shape** (4 tests) — both sensor subclasses extend `PointerSensor` and
  have exactly one `onPointerDown` activator entry.
- **PointerSensorMouse.activator** (4 tests) — accepts `'mouse'`, rejects
  `'touch'`/`'pen'`, tolerates missing `onActivation` callback.
- **PointerSensorTouch.activator** (4 tests) — accepts `'touch'` and `'pen'`,
  rejects `'mouse'`, tolerates missing `onActivation`.
- **`[data-dnd-ignore]` escape hatch** (7 tests) — both sensors reject drags
  starting inside an ignored subtree (ancestor or self-match); null target
  tolerated; non-ignored targets still activate.
- **`scaleCompensationModifier`** (7 tests) — no-op at scale 1, divides
  correctly at 0.5 and 0.2, `scaleX`/`scaleY` preserved, divide-by-zero guard
  falls back to 1, reads FRESH canvasScale on every call (no stale closure).

Per D-31, sensor **timing** (250ms touch hold, 8px mouse distance) is NOT
tested via fake-timer simulation — that goes on the real-device UAT checklist.
These tests lock the *shape* and *pointerType discrimination* that make the
timing work once the constraints are applied.

## Deviations from Plan

**None functionally.** The implementation followed the plan's action steps verbatim.

Two minor mechanical adjustments:

1. **Typed the activator options inline** (step 7 of the plan's action) — the
   plan suggested inspecting whether `PointerSensorOptions` is exported from
   `@dnd-kit/core`. It is exported from the internal
   `@dnd-kit/core/dist/sensors/pointer/PointerSensor.d.ts` but not re-exported
   from the package root. Per the plan's fallback guidance, I inlined a local
   `ActivatorOptions = { onActivation?: (args: { event: Event }) => void }`
   type. This keeps the adapter self-contained without depending on an
   unstable internal re-export.

2. **Defensive `typeof target.closest === 'function'` guard** — added to both
   activators around the ignore-check. The plan's action shows
   `target?.closest('[data-dnd-ignore]')` which handles `target === null`; this
   additional guard handles `target` values that are DOM Nodes but not
   Elements (e.g. text nodes) so the runtime doesn't crash. This is Rule 2
   territory — a correctness reinforcement. Test "tolerates null target"
   covers the null branch; the function-check branch is exercised implicitly
   when closest isn't defined.

3. **Negative grep caveat** — the plan's acceptance grep
   `! grep -E '\b(MouseSensor|TouchSensor|KeyboardSensor)\b' src/dnd/adapter/dndkit.ts`
   is technically impossible to satisfy because those three tokens appear in
   the LOCKED header comment (`RULE 1` warns against them; `RULE 3` mentions
   the Phase 25 `CanvasWrapper.tsx` wiring). I verified the stricter intent —
   **no code/import usage** — by stripping comments first:
   ```
   grep -v '^\s*\*' dndkit.ts | grep -v '^\s*//' | \
     grep -E '\b(MouseSensor|TouchSensor|KeyboardSensor)\b'
   # → empty (0 matches)
   ```
   The plan's grep is preserved as a regression check for future edits that
   might *introduce* these imports.

## Verification Results

- `npx tsc --noEmit` → clean (0 errors)
- `npx vitest run src/dnd/adapter/__tests__/dndkit.test.ts` → 26/26 passed
  (17ms)
- `npm run test -- --run` → 823 passed / 9 failed / 2 skipped / 4 todo (838
  total)
  - Before this plan: 797 passed / 9 failed → **Delta: +26 passing, same 9
    pre-existing failures**
  - All 9 failures map to `action-bar.test.tsx`, `phase05-p02-cell-swap.test.ts`
    (ActionBar drag handle), `phase22-mobile-header.test.tsx`,
    `phase25-touch-dnd.test.tsx`, `ActionBar.test.tsx` — the exact pre-existing
    set documented in Phase 27's `deferred-items.md`, scheduled for wholesale
    deletion in Plans 08–10 (D-21/D-22).

### Grep acceptance (positive)

```
OK: class PointerSensorMouse extends PointerSensor
OK: class PointerSensorTouch extends PointerSensor
OK: export const scaleCompensationModifier: Modifier
OK: pointerType !== 'mouse'
OK: pointerType !== 'touch' && event.pointerType !== 'pen'
OK: data-dnd-ignore
OK: transform.x / scale
OK: RULE 1 preserved
OK: RULE 2 preserved
OK: RULE 3 preserved
OK: NEVER 500ms preserved
```

### Grep acceptance (negative — imports only, comments stripped)

```
OK: no code imports of MouseSensor/TouchSensor/KeyboardSensor
```

## Commits

- `f05114f` — `test(28-02): add failing tests for adapter sensors and scale modifier`
- `d9c0c62` — `feat(28-02): implement PointerSensorMouse, PointerSensorTouch, scaleCompensationModifier`

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| File contains literal strings `class PointerSensorMouse extends PointerSensor`, `class PointerSensorTouch extends PointerSensor`, `scaleCompensationModifier` | PASS |
| File does NOT import `MouseSensor`, `TouchSensor`, or `KeyboardSensor` | PASS (comment mentions in LOCKED header preserved intentionally) |
| Header block — `RULE 1/2/3` + `NEVER 500ms` + `No parallel engines` strings present | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| Phase 27's 17 test files still green (no regressions) | PASS (797 passing before → 823 after; 9 pre-existing failures unchanged) |
| `useEditorStore.getState().canvasScale` referenced exactly once inside the Modifier closure | PASS (line 113) |

## Downstream Enablement

- **Wave 3 (Plan 05 — DragPreviewPortal)** can now `import { scaleCompensationModifier } from './adapter/dndkit'` and pass it to `<DragOverlay modifiers={[scaleCompensationModifier]}>`.
- **Wave 4 (Plan 07 — CanvasWrapper DndContext mount)** can now `import { PointerSensorMouse, PointerSensorTouch } from '../dnd/adapter/dndkit'` and configure `useSensors(useSensor(PointerSensorMouse, { activationConstraint: { distance: 8 }}), useSensor(PointerSensorTouch, { activationConstraint: { delay: 250, tolerance: 5 }}))`.

## Known Stubs

None. All three exports are fully implemented and tested.

## Self-Check: PASSED

- File `src/dnd/adapter/dndkit.ts` exists and contains all three exports (FOUND)
- File `src/dnd/adapter/__tests__/dndkit.test.ts` exists with 26 tests (FOUND)
- Commit `f05114f` present in git log (FOUND)
- Commit `d9c0c62` present in git log (FOUND)
- `npx tsc --noEmit` — clean
- Full test suite — 823 passed / 9 pre-existing failed (delta: +26 from this plan)
