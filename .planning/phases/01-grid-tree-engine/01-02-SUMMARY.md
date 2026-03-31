---
phase: 01-grid-tree-engine
plan: "02"
subsystem: state
tags: [zustand, immer, undo-redo, store, typescript, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Pure tree functions (splitNode, mergeNode, removeNode, resizeSiblings, updateLeaf, buildInitialTree) and GridNode types"
provides:
  - "useGridStore: Zustand store with Immer middleware, 10 tree actions, undo/redo history (capped 50, mediaRegistry excluded)"
  - "useEditorStore: flat Zustand store for UI state (selectedNodeId, zoom, showSafeZone, activeTool)"
  - "src/store/index.ts: re-exports both stores for consumer convenience"
  - "20 gridStore unit tests + 12 editorStore unit tests (32 new tests, all passing)"
affects:
  - "Phase 2 grid rendering — GridNode consumers import useGridStore, useEditorStore"
  - "Phase 3 media upload — addMedia/removeMedia/setMedia actions in gridStore"
  - "Phase 4 export engine — root state from gridStore"
  - "Phase 5 polish — undo/redo, zoom, activeTool used by toolbar/keyboard shortcuts"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand 5 + Immer middleware (immer from zustand/middleware/immer)"
    - "current() from immer to unwrap Draft proxy before structuredClone — required for history snapshots and undo/redo restore"
    - "pushSnapshot helper: snapshot-before-mutate, clear redo stack, cap at 50 — reused by all mutating actions"
    - "Two separate stores: gridStore (complex, Immer) and editorStore (flat, no Immer)"
    - "getInitialState() + setState(..., true) for Vitest test isolation"

key-files:
  created:
    - src/store/gridStore.ts
    - src/store/editorStore.ts
    - src/test/grid-store.test.ts
    - src/test/editor-store.test.ts
  modified:
    - src/store/index.ts

key-decisions:
  - "current() from immer must wrap Draft arrays in history before structuredClone — history entries become Immer Drafts inside set(), causing DataCloneError without unwrapping"
  - "pushSnapshot helper extracts shared history logic (snapshot, redo clear, cap, index update) to avoid duplication across 6 mutating actions"
  - "Initial tree stored as history[0] at store creation — undo can return to starting state without special-casing"
  - "HISTORY_CAP = 50 as named constant for clarity and easy future adjustment"

patterns-established:
  - "Pattern 1 (Immer+history): Every mutating action calls pushSnapshot(state) before state.root = pureFn(current(state.root), ...args)"
  - "Pattern 2 (undo/redo): current(state.history[index]) before structuredClone to unwrap Draft proxy"
  - "Pattern 3 (store reset in tests): useStore.setState(useStore.getInitialState(), true) in beforeEach"

requirements-completed:
  - GRID-11
  - GRID-12
  - GRID-13

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 1 Plan 02: Store Layer Summary

**Zustand gridStore with Immer middleware, 10 tree actions, undo/redo history (capped at 50, mediaRegistry excluded), and editorStore for UI state**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-31T22:25:02Z
- **Completed:** 2026-03-31T22:30:02Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- gridStore with 10 actions (split, merge, remove, resize, setMedia, updateCell, addMedia, removeMedia, undo, redo) using Zustand 5 + Immer middleware
- Undo/redo via history snapshot array: structuredClone snapshots of root only (not mediaRegistry), capped at 50, redo stack cleared on new action, initial tree stored as history[0]
- editorStore for flat UI state: selectedNodeId, zoom (clamped 0.5-1.5), showSafeZone, activeTool
- 32 new unit tests (20 gridStore + 12 editorStore), all 79 tests passing including no regressions on prior plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests then implement gridStore and editorStore** - `9e64ec3` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD plan — RED tests written first (confirmed failing), then GREEN implementation_

## Files Created/Modified
- `src/store/gridStore.ts` - Zustand gridStore with Immer, all 10 actions, history capped at 50
- `src/store/editorStore.ts` - Zustand editorStore, flat state, zoom clamped 0.5-1.5
- `src/store/index.ts` - Re-exports useGridStore and useEditorStore
- `src/test/grid-store.test.ts` - 20 tests covering all actions, undo/redo, history cap, mediaRegistry exclusion
- `src/test/editor-store.test.ts` - 12 tests covering all state fields and actions

## Decisions Made
- `current()` from immer must be called on `state.history[index]` before `structuredClone` in undo/redo — history array entries become Immer Draft proxies inside `set()` callbacks, and `structuredClone` throws `DataCloneError` on proxies
- `pushSnapshot` helper function extracts the 5-step history pattern shared by all 6 mutating actions, eliminating duplication
- Initial tree state pushed as `history[0]` at store creation per research recommendation, so undo can return to empty two-cell starting state
- `HISTORY_CAP = 50` as a named constant (not inline magic number)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DataCloneError in undo/redo: current() needed on history entries**
- **Found during:** Task 1 (GREEN phase — test run)
- **Issue:** `structuredClone(state.history[state.historyIndex].root)` inside Immer `set()` threw `DataCloneError` because history array entries are wrapped in Immer Draft proxies
- **Fix:** Added `const plainSnap = current(state.history[state.historyIndex])` before cloning, using the `current()` helper already imported for snapshot logic
- **Files modified:** src/store/gridStore.ts
- **Verification:** All 4 undo/redo tests pass after fix; mediaRegistry exclusion test (which triggered the bug) also passes
- **Committed in:** 9e64ec3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix required for correctness of undo/redo. Identical pattern to the existing `current(state.root)` usage already specified in the plan — no new patterns introduced.

## Issues Encountered
- Immer Draft proxy wrapping applies not just to `state.root` but to all nested array elements like `state.history[i]`. The plan specified `current(state.root)` for mutation but didn't address undo/redo restore paths — fixed by applying the same `current()` unwrap pattern consistently.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- gridStore and editorStore are complete and tested — Phase 2 rendering can import them directly
- `useShallow` from `zustand/react/shallow` is available for derived selectors in Phase 2 components
- All Phase 1 requirements (GRID-11, GRID-12, GRID-13) are now fulfilled
- No blockers for Phase 2

---
*Phase: 01-grid-tree-engine*
*Completed: 2026-04-01*
