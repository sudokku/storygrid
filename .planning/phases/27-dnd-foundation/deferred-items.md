# Phase 27 Deferred Items

Out-of-scope issues discovered during Phase 27 execution. Do NOT fix in this
phase — they belong to later plans or are pre-existing and tracked for
visibility.

## Pre-existing test failures (baseline-verified)

Verified pre-existing by running the affected suites against the skeleton
base (commit `af361ac`) before any Plan 02 changes were applied. These
failures are NOT caused by Plan 02.

All failures are in Phase 25 touch-DnD / ActionBar code that Phase 28 will
REMOVE as part of DND-04: "Phase 25 `@dnd-kit` wiring removed in SAME phase
as new engine (no parallel)". Do not repair them here — they will be
deleted wholesale.

| Test file | Failing count | Status |
|-----------|---------------|--------|
| `src/test/action-bar.test.tsx` | 1 | Pre-existing — rendering drift |
| `src/test/phase05-p02-cell-swap.test.ts` | 3 | Pre-existing — drag handle aria-label |
| `src/test/phase22-mobile-header.test.tsx` | 1 | Pre-existing — window.confirm mock |
| `src/test/phase25-touch-dnd.test.tsx` | 3 | Pre-existing — MouseSensor config expectation |
| `src/Grid/__tests__/ActionBar.test.tsx` | 1 | Pre-existing — getByRole mismatch |

Baseline confirmation run: commit `af361ac` without Plan 02 test or impl
files — same 9 failures observed. Plan 02 does not modify any of these files
or their dependencies.
