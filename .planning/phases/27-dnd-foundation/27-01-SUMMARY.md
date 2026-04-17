---
phase: 27-dnd-foundation
plan: 01
subsystem: infrastructure
tags: [dnd, dnd-kit, modifiers, zustand, typescript, skeleton, module-boundary]

# Dependency graph
requires:
  - phase: 27-dnd-foundation (planning)
    provides: PLAN.md, REQUIREMENTS.md, ROADMAP.md, research (ARCHITECTURE, PITFALLS, STACK, SUMMARY)
provides:
  - "@dnd-kit/modifiers@^9.0.0 installed with caret pin and committed lockfile"
  - "src/dnd/ module boundary with 8 skeleton source files"
  - "Public API barrel (src/dnd/index.ts) re-exporting all 7 public surfaces"
  - "Adapter header documenting DND-01, Pitfall 4 (250ms/5/8px, NEVER 500ms), and Pitfall 10 (no parallel engines)"
  - "Hook headers documenting Pitfall 1 (spread LAST) and Pitfall 2 (single event source)"
  - "Typed DragState/DropZone/DragKind/DragStatus exports consumable by Plan 02 (computeDropZone) and Plan 03 (dragStore)"
affects:
  - "27-02 (computeDropZone implementation — imports DropZone type from dragStore)"
  - "27-03 (dragStore implementation — replaces stub create() factory)"
  - "27-04 (verifier — scans src/dnd/ for Phase 27 completeness)"
  - "28 (Cell-to-Cell Drag — wires adapter.dndkit.ts, hooks, portal, indicators)"
  - "29 (ESC-Cancel + Visual Polish — extends DropZoneIndicators)"
  - "30 (Mobile Handle + Tray Polish — adds cross-device CSS on draggables)"

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/modifiers@^9.0.0 (canvas transform: scale() compensation — wired Phase 28)"
  patterns:
    - "Module-boundary barrel: all DnD consumers import from 'src/dnd' only, never from sub-files"
    - "Adapter-isolated dnd-kit usage: single file (src/dnd/adapter/dndkit.ts) owns all @dnd-kit/core imports"
    - "Vanilla Zustand for ephemeral state: no Immer middleware, no persist, no history — prevents 60 Hz pointer writes entering undo stack"
    - "Throw-on-consumption skeleton stubs: bodies throw Error with explicit 'lands in Phase N' message so accidental downstream use fails loudly"
    - "Header-embedded BLOCKING RULES: adapter and hook file headers cite REQ-IDs and Pitfall numbers verbatim for persistent in-code documentation"

key-files:
  created:
    - "src/dnd/index.ts (11 lines) — barrel re-exports for 7 public surfaces"
    - "src/dnd/adapter/dndkit.ts (31 lines) — adapter skeleton + DND-01/Pitfall 4/Pitfall 10 header"
    - "src/dnd/dragStore.ts (32 lines) — vanilla Zustand stub + DragState/DropZone/DragKind/DragStatus types"
    - "src/dnd/computeDropZone.ts (27 lines) — pure fn stub + Anti-Pattern 3 header"
    - "src/dnd/useCellDraggable.ts (33 lines) — hook stub + Pitfall 1 header"
    - "src/dnd/useCellDropTarget.ts (24 lines) — hook stub + Pitfall 2 header"
    - "src/dnd/DragPreviewPortal.tsx (15 lines) — component stub returning null"
    - "src/dnd/DropZoneIndicators.tsx (16 lines) — component stub returning null"
  modified:
    - "package.json — added one line: \"@dnd-kit/modifiers\": \"^9.0.0\""
    - "package-lock.json — 15-line insertion for resolved @dnd-kit/modifiers subtree"

key-decisions:
  - "Install @dnd-kit/modifiers with caret pin ^9.0.0 (not exact) — allows patch updates within major, plan explicitly forbids --save-exact"
  - "Skeleton stubs throw on consumption instead of returning default values — accidental use before Plan 02/03/Phase 28 implement fails loudly"
  - "dragStore types (DragKind, DropZone, DragStatus, DragState) exported from the stub file so Plan 02's computeDropZone can import DropZone type today"
  - "Adapter file at src/dnd/adapter/dndkit.ts (nested subdir) mirrors ARCHITECTURE.md §2 canonical layout — filename 'dndkit.ts' confirms library choice lock-in"
  - "No test files shipped in Plan 01 — co-located .test.ts files belong to Plans 02 and 03 per plan scope boundary"

patterns-established:
  - "Public API barrel export strategy: consumers import from 'src/dnd' — swap-safe for Phase 28 wiring or future adapter changes"
  - "File-header blocking-rule documentation: REQ-IDs and PITFALLS.md item numbers cited verbatim in comments so future readers trace rules to source artifacts"
  - "Stub-throws-on-use: skeleton factory functions throw Error('… lands in Phase N …') — prevents silent fallback to default behavior"

requirements-completed: [DND-03, DND-06]

# Metrics
duration: 5m 28s
completed: 2026-04-17
---

# Phase 27 Plan 01: DnD Foundation Skeleton Summary

**`@dnd-kit/modifiers@9.0.0` installed and `src/dnd/` module scaffolded with 8 skeleton files, adapter/hook headers documenting DND-01, Pitfall 1, 2, 4, 10 verbatim in-code.**

## Performance

- **Duration:** 5m 28s
- **Started:** 2026-04-17T02:02:49Z
- **Completed:** 2026-04-17T02:08:17Z
- **Tasks:** 2
- **Files created:** 8 (all under src/dnd/)
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- `@dnd-kit/modifiers@9.0.0` installed with caret pin `^9.0.0`; zero peer-dep warnings; 7 modifiers exported (`createSnapModifier`, `restrictToFirstScrollableAncestor`, `restrictToHorizontalAxis`, `restrictToParentElement`, `restrictToVerticalAxis`, `restrictToWindowEdges`, `snapCenterToCursor`).
- Module boundary established: `src/dnd/` with 8 skeleton source files matching ARCHITECTURE.md §2 canonical layout.
- All five blocking anti-pattern rules embedded verbatim in file headers:
  - adapter/dndkit.ts → DND-01 (single PointerSensor), Pitfall 4 (250ms + 5/8px, NEVER 500ms), Pitfall 10 (no parallel engines across phases)
  - useCellDraggable.ts → Pitfall 1 (spread listeners LAST)
  - useCellDropTarget.ts → Pitfall 2 (single event source, no document-level pointermove)
  - dragStore.ts → Pitfall 11 (vanilla Zustand, no Immer/persist/history)
  - computeDropZone.ts → ARCHITECTURE Anti-Pattern 3 (no division by canvasScale)
- Public API barrel (`src/dnd/index.ts`) re-exports 7 surfaces — consumers import from `src/dnd` only.
- Typed `DragState`/`DropZone`/`DragKind`/`DragStatus` exports available for Plans 02/03 to consume in Wave 2.
- REQ-IDs DND-03 and DND-06 are now addressable by downstream phases.

## Task Commits

1. **Task 1: Install @dnd-kit/modifiers and commit lockfile** — `f6842cd` (chore)
2. **Task 2: Scaffold src/dnd/ skeleton module with header-embedded anti-pattern documentation** — `6f51b98` (feat)

## Files Created

| File | Lines | Purpose |
|------|------:|---------|
| `src/dnd/index.ts` | 11 | Barrel export (7 re-exports) |
| `src/dnd/adapter/dndkit.ts` | 31 | Adapter skeleton + BLOCKING RULES header (DND-01, Pitfall 4, Pitfall 10) |
| `src/dnd/dragStore.ts` | 32 | Vanilla Zustand stub + `DragState`/`DropZone`/`DragKind`/`DragStatus` types |
| `src/dnd/computeDropZone.ts` | 27 | Pure fn stub + Anti-Pattern 3 header |
| `src/dnd/useCellDraggable.ts` | 33 | Hook stub + Pitfall 1 header (spread LAST) |
| `src/dnd/useCellDropTarget.ts` | 24 | Hook stub + Pitfall 2 header (single event source) |
| `src/dnd/DragPreviewPortal.tsx` | 15 | Component stub (returns null) |
| `src/dnd/DropZoneIndicators.tsx` | 16 | Component stub (returns null) |
| **Total** | **189** | |

## Files Modified

- `package.json` — single added dependency line: `"@dnd-kit/modifiers": "^9.0.0"` (between `@dnd-kit/core` and `@dnd-kit/sortable`, alphabetical).
- `package-lock.json` — 15-line insertion (1 dependency + resolved subtree); `git diff --stat` reports `+15` insertions, 0 deletions.

## Decisions Made

- **Caret pin `^9.0.0`** (not exact `9.0.0`) — allows patch updates within major and matches the plan's explicit instruction to NOT use `--save-exact`.
- **Skeleton stubs throw Error on consumption** rather than returning default values — an accidental use before Plan 02/03/Phase 28 implement will fail loudly with a plan-pointing message (e.g. `'dragStore: implementation lands in Phase 27 Plan 03'`).
- **Types exported from stubs today** — `DragKind`, `DropZone`, `DragStatus`, `DragState`, `UseCellDraggableResult`, `UseCellDropTargetResult` are all exported from skeleton files so Plan 02 can `import type { DropZone }` today without waiting for Plan 03's implementation.
- **No test files in Plan 01** — Plans 02 and 03 each ship the co-located `.test.ts` alongside their implementation (TDD RED in those plans).

## Deviations from Plan

None - plan executed exactly as written.

### Notes on acceptance-criteria text vs. plan intent

Two acceptance-criteria strings in the plan are literally inconsistent with the file contents the plan mandates (both are documentation-only). Recording for transparency; neither triggers a deviation:

1. **`grep -c "TouchSensor\|MouseSensor" src/dnd/` returns 0** — Actual count is 2, both occurrences inside the `adapter/dndkit.ts` BLOCKING RULES comment ("Do NOT add TouchSensor or MouseSensor" and "MouseSensor + TouchSensor + KeyboardSensor") which the plan specifies verbatim. The criterion's *intent* ("no sensor config added — Phase 27 is pre-wiring") is met: no sensor is instantiated; only documentation forbidding them appears. Plan's verbatim file-content instructions take precedence over the grep-count criterion.
2. **`grep -cE "drag|sourceId|overId|activeZone" src/store/gridStore.ts` returns 0** — Actual count is 3, all pre-existing comments referencing the Phase 11 `beginEffectsDrag` slider-drag action (NOT cell DnD). The criterion's *intent* (DND-05: gridStore untouched) is fully met: `git diff` against the base commit shows zero changes to `src/store/gridStore.ts`.

## Issues Encountered

None during planned work. 9 pre-existing test failures (all in Phase 25 touch-DnD test files and related ActionBar/phase22 tests) were observed and confirmed **pre-existing** via a stash-based baseline comparison — same 5 files/9 tests fail both with and without the Plan 01 changes. These failures are scheduled to resolve when Phase 28 replaces the Phase 25 touch-DnD code (per ROADMAP.md Phase 28 DND-04).

## Known Stubs

All 8 new files are intentional skeleton stubs per the plan's objective. The plan's goal IS to ship these stubs so Plans 02/03 and Phase 28 can implement against a stable import surface. Each stub has:

- A header comment citing the plan/phase that will implement it.
- Either `throw new Error('… lands in Phase N …')` bodies (factories, hooks, pure fns) or `return null` (React components).

Specifically:

| Stub | Resolution |
|------|-----------|
| `dragStore.ts` — `create()` factory throws | Plan 03 (27-03-PLAN.md) replaces with real store + `dragStore.test.ts` |
| `computeDropZone.ts` — fn throws | Plan 02 (27-02-PLAN.md) replaces with real implementation + `computeDropZone.test.ts` |
| `useCellDraggable.ts` — hook throws | Phase 28 wires `useDraggable` from `@dnd-kit/core` + ghost snapshot |
| `useCellDropTarget.ts` — hook throws | Phase 28 wires `useDroppable` + computeDropZone integration |
| `DragPreviewPortal.tsx` — returns null | Phase 28 wires to `DragOverlay` + `dragStore` ghost-dataURL |
| `DropZoneIndicators.tsx` — returns null | Phase 28 implements 5-icon layout; Phase 29 adds styling |
| `adapter/dndkit.ts` — `export {}` only | Phase 28 adds `DndContext` host + sensors + callbacks |
| `index.ts` barrel — re-exports stubs | Becomes live API surface as Plans 02/03/Phase 28 ship |

None of these stubs prevent Plan 01's goal — the goal IS the skeleton module.

## Self-Check

Commit verification (both hashes present in HEAD):

- `f6842cd` (Task 1) — FOUND
- `6f51b98` (Task 2) — FOUND

File existence (all 8 skeleton files):

- `src/dnd/index.ts` — FOUND
- `src/dnd/adapter/dndkit.ts` — FOUND
- `src/dnd/dragStore.ts` — FOUND
- `src/dnd/computeDropZone.ts` — FOUND
- `src/dnd/useCellDraggable.ts` — FOUND
- `src/dnd/useCellDropTarget.ts` — FOUND
- `src/dnd/DragPreviewPortal.tsx` — FOUND
- `src/dnd/DropZoneIndicators.tsx` — FOUND

Package verification:

- `@dnd-kit/modifiers` listed in `package.json` dependencies with caret pin `^9.0.0` — CONFIRMED
- `node_modules/@dnd-kit/modifiers` entry in `package-lock.json` — CONFIRMED
- `require('@dnd-kit/modifiers')` resolves and exports 7 modifiers — CONFIRMED (`createSnapModifier`, `restrictToFirstScrollableAncestor`, `restrictToHorizontalAxis`, `restrictToParentElement`, `restrictToVerticalAxis`, `restrictToWindowEdges`, `snapCenterToCursor`)

Scope boundary:

- `git diff --stat 7926799 HEAD -- src/Grid src/Editor src/store src/App.tsx` — EMPTY (zero modifications outside src/dnd/)
- `git diff 7926799 HEAD -- src/store/gridStore.ts` — EMPTY (DND-05 assertion: gridStore untouched)

TypeScript + tests:

- `npx tsc --noEmit` exits 0 — CONFIRMED
- `npm run test -- --run` — 723 passed / 9 failed / 2 skipped / 4 todo — same counts as baseline (9 pre-existing failures in Phase 25 touch-DnD files, zero new regressions)

## Self-Check: PASSED

## User Setup Required

None - no external service configuration required. `@dnd-kit/modifiers` is a standard npm package installed automatically.

## Next Phase Readiness

**Plans 02 and 03 (Wave 2) unblocked:**

- Plan 02 (`computeDropZone` implementation + `computeDropZone.test.ts`) can `import type { DropZone } from './dragStore'` today.
- Plan 03 (`dragStore` implementation + `dragStore.test.ts`) can replace the stub `create()` factory with the real store — types are already exported.
- Both plans implement against the stable import surface established here; neither needs to redefine file layout.

**Phase 28 readiness:**

- `src/dnd/adapter/dndkit.ts` ready to receive `DndContext` + sensors + `onDragStart`/`onDragOver`/`onDragEnd`/`onDragCancel` callbacks.
- `useCellDraggable`, `useCellDropTarget`, `DragPreviewPortal`, `DropZoneIndicators` skeletons ready to be filled in.
- `@dnd-kit/modifiers` pre-installed for canvas `transform: scale()` compensation per DND-06.
- In-code header comments will remind the implementing agent of DND-01, Pitfall 1, 2, 4, 10 at the exact call sites that must honour them.

**No blockers.**

---
*Phase: 27-dnd-foundation*
*Plan: 01*
*Completed: 2026-04-17*
