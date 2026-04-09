---
phase: 08-canvas-workspace-ux
plan: 03
subsystem: testing
tags: [test, regression, templates, tpl-01]
requires: [src/components/TemplatesPopover.tsx, src/store/gridStore.ts]
provides: [src/test/phase08-p03-template-no-confirm.test.tsx]
affects: []
tech_stack:
  added: []
  patterns: [vi-spyOn-window-confirm, zustand-setState-action-mock]
key_files:
  created:
    - src/test/phase08-p03-template-no-confirm.test.tsx
  modified: []
decisions:
  - "vi.spyOn(window,'confirm') default returns false so regression would fail in two ways: confirm called AND applyTemplate not called"
  - "applyTemplate replaced via useGridStore.setState({applyTemplate: vi.fn()}) per established Zustand v5 convention"
metrics:
  duration_minutes: 5
  tasks_completed: 1
  files_changed: 1
  completed_date: "2026-04-08"
---

# Phase 8 Plan 3: TPL-01 Silent Template Apply Regression Test Summary

Added a regression test file asserting that clicking any of the six preset template buttons never invokes `window.confirm` and always calls `gridStore.applyTemplate` exactly once — locking in the silent-apply behavior established by quick-260407-vth.

## What Was Built

**src/test/phase08-p03-template-no-confirm.test.tsx** (64 lines, 8 tests)

- Global `window.confirm` spy set up in `beforeEach`, restored in `afterEach`
- `applyTemplate` replaced on the live `useGridStore` via `setState({applyTemplate: vi.fn()})`
- Test suite layout:
  1. `does not call window.confirm when opening the popover` — validates the popover mount path is silent
  2-7. `applies template "<name>" without invoking window.confirm` — one test per template (`2x1`, `1x2`, `2x2`, `3-row`, `l-shape`, `mosaic`), each clicking the template button through `data-template` attribute query
  8. `applies all templates across multiple clicks with zero confirm prompts` — sequential click-all test asserting total apply count equals template count and confirm spy total call count is 0
- Uses `document.querySelector('button[data-template=...]')` rather than `getByText` to pin to the stable data attribute, not the human-readable label
- Re-opens the popover before each sequential click (handleApply auto-closes on apply)

## Verification

```
npm run test -- --run src/test/phase08-p03-template-no-confirm.test.tsx
```

Result: `Test Files 1 passed (1)` / `Tests 8 passed (8)` / duration ~131ms. Build (`npm run build`) also passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Cherry-picked TPL-01 fix as prerequisite**

- **Found during:** Plan start
- **Issue:** The worktree branch (`worktree-agent-af67eacc`) was based on commit `92dbd1e`, which predates the TPL-01 silent-apply fix. The plan (D-17) explicitly assumes the fix already exists on HEAD, and the test would fail (`window.confirm` would be called) without it. The fix lives only on `feature/mobile-ui` in commit `41cc818`.
- **Fix:** Cherry-picked `41cc818` (`feat(quick-260407-vth): apply templates silently without confirm dialog`) into the worktree before writing the test. Did NOT cherry-pick the follow-up `64a7cf8` (media migration) — it conflicted and isn't required for this test.
- **Files modified:** `src/components/TemplatesPopover.tsx` (brought back to the state the plan assumes)
- **Commit:** `04ff44d` (cherry-pick)

**2. [Rule 3 - Setup] Checked out phase 08 plan files from `c2feab0`**

- **Found during:** Plan start
- **Issue:** Phase 08 plan files (`08-01-PLAN.md`, `08-02-PLAN.md`, `08-03-PLAN.md`, `08-CONTEXT.md`, `08-DISCUSSION-LOG.md`) and the updated ROADMAP did not exist on the worktree branch — they live only on `feature/mobile-ui` commit `c2feab0`.
- **Fix:** `git checkout c2feab0 -- .planning/phases/08-canvas-workspace-ux/ .planning/ROADMAP.md` to stage them into the worktree so this plan could reference them.
- **Commit:** Included in the test commit `bb05fa2` alongside the test file.

No changes to `src/components/TemplatesPopover.tsx` or `src/store/gridStore.ts` as part of *this plan's work* — the cherry-pick restored state the plan already assumed existed.

## Key Decisions

- **Spy default returns false (not undefined):** if a regression were to re-introduce the `confirm()` call, the test would fail twice — once because the spy was invoked, and once because the user "canceled" so `applyTemplate` never fires. This gives the failure signal two independent vectors.
- **Action mock via `setState`, not `vi.spyOn`:** matches the project convention noted in STATE.md: "vi.spyOn cannot redefine Zustand v5 store actions — use setState({action: vi.fn()}) pattern instead".
- **data-template selector over text selector:** the template labels are human-readable ("2x1 Stacked", "3 Row") and could be re-styled or i18n'd. The `data-template` attribute values are the stable `TemplateName` union members — the test pins to those.

## Known Stubs

None — this is a test-only plan.

## Self-Check: PASSED

- File `src/test/phase08-p03-template-no-confirm.test.tsx` exists (verified via commit `bb05fa2`)
- Contains `vi.spyOn(window, 'confirm')`
- Contains `expect(confirmSpy).not.toHaveBeenCalled()`
- Contains all six template names: `2x1`, `1x2`, `2x2`, `3-row`, `l-shape`, `mosaic`
- All 8 tests pass (vitest exit 0)
- Build succeeds (`npm run build` exit 0)
- Acceptance criteria all met
