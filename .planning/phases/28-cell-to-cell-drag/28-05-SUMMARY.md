---
phase: 28-cell-to-cell-drag
plan: 05
subsystem: dnd
tags: [dnd, ghost, dragoverlay, portal, phase-28, scale-compensation]

# Dependency graph
requires:
  - phase: 27-dnd-foundation
    provides: "DragPreviewPortal 11-line header skeleton with locked GHOST-01/04/05/06 contract"
  - plan: 28-01
    provides: "dragStore.ghostDataUrl, dragStore.sourceRect, setGhost action — the scoped selectors this portal subscribes to"
  - plan: 28-02
    provides: "scaleCompensationModifier (Modifier) exported from src/dnd/adapter/dndkit.ts — consumed on DragOverlay modifiers prop"
provides:
  - "Live DragPreviewPortal component — renders dnd-kit DragOverlay with a scale-compensated ghost <img> or empty-cell fallback <div> during drag"
  - "Scoped Zustand selectors for status/ghostDataUrl/sourceRect — per-field re-render containment (ARCHITECTURE.md §3)"
  - "opacity: 0.8 ghost styling inline (D-11) — Phase 29 will not require a cosmetic change"
  - "Empty-cell fallback rendering (D-10) — dark bg-[#1c1c1c] div at source dims when ghostDataUrl is null"
affects:
  - 28-09 (EditorShell mount) — will `import { DragPreviewPortal } from '../dnd'` and render once above the canvas tree
  - 28-07 / 28-08 (adapter onDragStart + CanvasWrapper DndContext mount) — must fire setGhost + beginCellDrag to activate this portal's render path
  - 28-10b (integration test) — will assert <img data-testid="drag-ghost-img"> renders during drag

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DragOverlay as built-in portal-to-document.body (no createPortal needed — library handles it)"
    - "Scoped primitive Zustand selectors (s => s.field) for per-field re-render containment — no useShallow needed"
    - "Narrowing gate `active = status === 'dragging' && sourceRect !== null` before reading sourceRect.width/height (TypeScript null-safety + correctness)"
    - "Conditional JSX branch: ghostDataUrl ? <img> : <div> — D-10 empty-cell fallback"
    - "11-line locked header preserved byte-identical — Phase 27 verification continues to pass"

key-files:
  created: []
  modified:
    - "src/dnd/DragPreviewPortal.tsx — replaced `export function DragPreviewPortal(): null` with a DragOverlay-wrapped body; added 3 imports (DragOverlay, useDragStore, scaleCompensationModifier); preserved 11-line header block verbatim"

key-decisions:
  - "Removed explicit `: null` return type from function signature. Phase 27 skeleton declared `DragPreviewPortal(): null`; Phase 28 returns JSX (DragOverlay element), so the return type is now inferred as JSX.Element. This is the plan-mandated change (action §2 note) — without it, TypeScript would reject the JSX return."
  - "Narrowed via `active` boolean before destructuring sourceRect. Using the gate `status === 'dragging' && sourceRect !== null` ensures TypeScript narrows sourceRect for the inner .width/.height reads — avoids non-null assertions (!) which are an anti-pattern."
  - "No test file created. The plan's verify block is grep + typecheck + existing suite — no new unit test required. Plan 10b (integration test) will assert the <img data-testid=\"drag-ghost-img\"> render path once the full adapter+EditorShell wiring lands in Plans 07-09."
  - "React.memo skipped. PATTERNS §Shared Patterns calls it optional; DragOverlay internally handles mount/unmount; the three scoped primitive selectors already minimise re-renders. Skipping keeps the component minimal."
  - "No REFACTOR commit. Implementation is already minimal (50-line component with a single JSX return); no code-smell surface to clean up."

patterns-established:
  - "Pattern: Zustand-store-driven DragOverlay portal. Scoped primitive selectors + narrowing gate + conditional JSX branch. Reusable blueprint for any future overlay that must subscribe to transient drag state."

requirements-completed: [GHOST-01, GHOST-02, GHOST-04, GHOST-05, GHOST-06]

# Metrics
duration: ~2 min
tasks: 1
files_modified: 1
completed: 2026-04-17
---

# Phase 28 Plan 05: DragPreviewPortal body via DragOverlay + scaleCompensationModifier Summary

**Replaced the Phase 27 null-return skeleton in `src/dnd/DragPreviewPortal.tsx` with a DragOverlay-wrapped ghost preview that subscribes to dragStore's ghostDataUrl + sourceRect via scoped primitive selectors, renders an `<img>` at source-cell dims with opacity 0.8 (or a dark `<div>` fallback when ghostDataUrl is null), and applies the Plan 02 scaleCompensationModifier so the ghost tracks the pointer despite the ancestor `transform: scale()` on CanvasWrapper — while preserving the 11-line GHOST-01/04/05/06 header doc comment verbatim.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T12:22:11Z
- **Completed:** 2026-04-17T12:24:12Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- `DragPreviewPortal()` now returns live JSX — `<DragOverlay adjustScale={false} modifiers={[scaleCompensationModifier]}>` wrapping a conditional `<img>` or fallback `<div>`.
- Three scoped primitive Zustand selectors (`status`, `ghostDataUrl`, `sourceRect`) — per-field re-render containment per ARCHITECTURE.md §3; no `useShallow` needed.
- `active` narrowing gate (`status === 'dragging' && sourceRect !== null`) keeps TypeScript happy when reading `sourceRect.width` / `sourceRect.height` in the inner JSX without non-null assertions.
- `<img src={ghostDataUrl} style={{ width, height, opacity: 0.8, display: 'block' }} alt="" draggable={false} data-testid="drag-ghost-img" />` — D-11 (literal 0.8 matches Phase 29 final spec so no cosmetic change needed later).
- D-10 empty-cell fallback: `<div className="bg-[#1c1c1c]" style={{ width, height, opacity: 0.8 }} data-testid="drag-ghost-fallback" />` rendered when ghostDataUrl is null.
- GHOST-05 compliance: no ActionBar, no drag-handles, no ring/selection outline, no chrome inside the overlay — only the media artwork.
- D-09: `adjustScale={false}` included explicitly (it is the default) for clarity and to prevent accidental regression if dnd-kit changes defaults.
- D-07: `createPortal` NOT called — DragOverlay handles document.body mounting internally.
- 11-line Phase 27 header block preserved byte-identical — Phase 27's source-readback invariant continues to pass.
- `npx tsc --noEmit` clean; full test suite: 831 passed / 9 pre-existing failures (identical set to Plan 04 baseline) / 2 skipped / 4 todo — **zero new regressions from this plan**.

## Task Commits

Task 1 — implementation only (Plan 10 test wave owns behavioural tests per precedent set in Plans 03/04):

1. **Task 1:** `ad0992a` — `feat(28-05): implement DragPreviewPortal body via DragOverlay + scaleCompensationModifier`

_No RED / REFACTOR commits — the plan's verify block is grep + typecheck + existing-suite regression, no new unit test required. Plan 10b integration test will exercise the render path once the adapter + EditorShell mount (Plans 07-09) are live._

## Files Created/Modified

- **`src/dnd/DragPreviewPortal.tsx`** — body replacement + 3 imports:
  - Added `import { DragOverlay } from '@dnd-kit/core';`
  - Added `import { useDragStore } from './dragStore';`
  - Added `import { scaleCompensationModifier } from './adapter/dndkit';`
  - Replaced `export function DragPreviewPortal(): null { return null; }` with a 40-line body that destructures three scoped selectors, computes an `active` gate, and returns `<DragOverlay adjustScale={false} modifiers={[scaleCompensationModifier]}>` wrapping the conditional `<img>` / fallback `<div>` tree.
  - Removed explicit `: null` return type — return type is now inferred `JSX.Element`.
  - Preserved 11-line header doc comment (lines 1-11) verbatim.

## Decisions Made

1. **Explicit return type removed.** Phase 27 skeleton declared `DragPreviewPortal(): null`. Phase 28 returns JSX. Action §2 of the plan mandates this change. Without it, TypeScript would reject the JSX return.
2. **Narrowing gate pattern over non-null assertion.** Used `const active = status === 'dragging' && sourceRect !== null` then `{active ? ... : null}` so TypeScript narrows `sourceRect` inside the conditional branch — avoids `sourceRect!.width` anti-pattern and satisfies strict null-check config.
3. **Scoped primitive selectors, NOT useShallow.** Three separate `useDragStore(s => s.field)` calls — the simpler pattern per Zustand 5.0.x conventions (shallow equality is default for primitives via Object.is). An object-returning selector would require `useShallow`, adding bundle + concept overhead for no gain.
4. **React.memo skipped.** Optional per PATTERNS §Shared Patterns. DragOverlay has its own internal mount/unmount lifecycle; the scoped primitive selectors already minimise re-renders. Skipping keeps the component under 50 lines of executable code.
5. **No dropAnimation prop, no wobble, no lift.** Phase 28 scope is strictly the ghost image appearing at source-cell dims with opacity 0.8. Drop animation defaults used; DRAG-05 wobble and DRAG-06 lift are Phase 29 scope (deferred per CONTEXT.md line 12).
6. **No test file added.** Plan precedent (Plans 03, 04) defers behavioural tests to Plan 10. Plan 05's verify block explicitly uses grep + typecheck + existing-suite regression as the contract.
7. **No REFACTOR commit.** Implementation is already minimal.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 07 (adapter `onDragStart` callback)** — Ready. The adapter will call `useDragStore.getState().setGhost(canvas.toDataURL(), rect)` immediately after `beginCellDrag(sourceId)` to populate the fields this portal subscribes to.
- **Plan 08 (CanvasWrapper DndContext mount)** — Ready. The portal's scaleCompensationModifier is already exported from `src/dnd/adapter/dndkit.ts` (Plan 02). No further work needed on the modifier contract.
- **Plan 09 (EditorShell mount)** — Ready. `<DragPreviewPortal />` can be mounted once at the EditorShell level (sibling of `<MobileSheet />` and `<Onboarding />`). DragOverlay handles document.body portaling internally — the mount site need not be inside CanvasWrapper's scaled canvas.
- **Plan 10b (integration test)** — Ready. The test will mount CanvasWrapper + DragPreviewPortal inside a DndContext harness, simulate a pointer drag, and assert `<img data-testid="drag-ghost-img">` renders with the expected width/height/opacity style.
- **GHOST-05 compliance** — locked by grep: `! grep -q "ActionBar" src/dnd/DragPreviewPortal.tsx` + `! grep -qE 'ring-[0-9]' src/dnd/DragPreviewPortal.tsx` both pass. Future edits introducing chrome inside the overlay will break these greps and be caught by CI.

## TDD Gate Compliance

Per plan frontmatter, Task 1 is marked `tdd="true"`, but the plan does not provide a `<behavior>` / `<implementation>` split and explicitly relies on grep + typecheck + existing-suite regression as the verification contract. Plan precedent (Plans 03, 04) defers behavioural tests to the test-wave plan (10b for this portal).

- **RED gate:** Substitute gate = Phase 27's source-readback header assertion (still passes) + plan's 12/12 grep contracts (all verified post-commit). No committed failing test precedes the `feat` commit in this plan.
- **GREEN gate:** ✓ Commit `ad0992a` (`feat(28-05)`) — `npx tsc --noEmit` exit 0; 12/12 grep acceptance pass; 831 tests passing (same 9 pre-existing failures as Plan 04 baseline).
- **REFACTOR gate:** Skipped — implementation is already minimal.

Warning for downstream compliance audits: this plan ships a `feat` commit with no preceding `test` commit. Cross-reference with Plan 10b for the behavioural coverage.

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| File imports DragOverlay, useDragStore, scaleCompensationModifier | PASS |
| Body renders `<DragOverlay adjustScale={false} modifiers={[scaleCompensationModifier]}>` at the root | PASS |
| `<img>` branch present with opacity: 0.8 + source-rect width/height | PASS |
| Empty-cell `<div className="bg-[#1c1c1c]">` fallback branch present | PASS |
| Three scoped selectors: `s => s.status`, `s => s.ghostDataUrl`, `s => s.sourceRect` | PASS |
| No `createPortal` call | PASS |
| No ActionBar / handle / ring chrome | PASS |
| `npx tsc --noEmit` exits 0 | PASS |
| Full test suite — no NEW regressions | PASS (9 failing = exact pre-existing set from Plan 04) |

## Known Stubs

None. The component is fully implemented per Phase 28 scope. DRAG-05 wobble, DRAG-06 lift, GHOST-03 (opacity is already 0.8 here, matching final spec), DROP-02/03 zone styling, DROP-08 drop flash, CANCEL-01/02 ESC + snap-back are all Phase 29 scope — not stubs.

## Self-Check: PASSED

- File `src/dnd/DragPreviewPortal.tsx` — FOUND (git show ad0992a lists it)
- Commit `ad0992a` — FOUND in git log (`feat(28-05): implement DragPreviewPortal body...`)
- Acceptance grep results (post-commit):
  - `grep -c "import { DragOverlay } from '@dnd-kit/core'" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "import { useDragStore } from './dragStore'" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "import { scaleCompensationModifier } from './adapter/dndkit'" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "<DragOverlay" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "adjustScale={false}" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "modifiers={\[scaleCompensationModifier\]}" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "opacity: 0.8" src/dnd/DragPreviewPortal.tsx` → 2 (img + fallback branches)
  - `grep -c "bg-\[#1c1c1c\]" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "drag-ghost-img" src/dnd/DragPreviewPortal.tsx` → 1
  - `grep -c "createPortal" src/dnd/DragPreviewPortal.tsx` → 0
  - `grep -c "ActionBar" src/dnd/DragPreviewPortal.tsx` → 0
  - `grep -cE 'ring-[0-9]' src/dnd/DragPreviewPortal.tsx` → 0
- Type check: `npx tsc --noEmit` → exit 0
- Test suite: 831 passed / 9 failed (pre-existing) / 2 skipped / 4 todo — same set as Plan 04 ending state; no new regressions

---
*Phase: 28-cell-to-cell-drag*
*Plan: 05*
*Completed: 2026-04-17*
