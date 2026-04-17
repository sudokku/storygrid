---
phase: 28-cell-to-cell-drag
plan: 13
subsystem: dnd
tags: [gap-closure, accent-ring, overlay-div, css-painting-order, drop-04, unit-tests]
dependency_graph:
  requires: [28-11, 28-12]
  provides: [cell-drag-accent-ring-visible-on-media-cells, DROP-04-gap-closure]
  affects: [src/Grid/LeafNode.tsx, src/Grid/__tests__/LeafNode.test.tsx, .planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md]
tech_stack:
  added: []
  patterns: [dedicated-sibling-overlay-div, z-index-layering-over-canvas-clip, pointer-events-none-mandatory]
key_files:
  created: []
  modified:
    - src/Grid/LeafNode.tsx
    - src/Grid/__tests__/LeafNode.test.tsx
    - .planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md
decisions:
  - "Cell-drag-over ring MUST be a sibling overlay div, NEVER a ring-inset on a parent with absolute-positioned canvas descendants — CSS painting order occludes the inset box-shadow under any positioned child"
  - "isSelected and isPanMode ring paths left on root div — out of scope for this gap closure (not in 28-HUMAN-UAT missing items); tracked as follow-up in 28-VERIFICATION.md"
  - "Testid convention: drag-over-${id} for cell-drag, drop-target-${id} for file-drop — distinct testids encode the semantic boundary even though they cannot co-occur at runtime"
  - "Test 2 / Test 4 post-fix outcome is partial, NOT pass — the per-zone icon emphasis observation is accurately tracked as Phase-29 deferral (D-15), not silently labeled done"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_changed: 3
---

# Phase 28 Plan 13: Gap-Closure — Cell-Drag Accent Ring Overlay Summary

**One-liner:** Gap 3 'no accent outline on hovered drop cell' closed — moved cell-drag ring from occluded root box-shadow to a dedicated sibling overlay div with z-10, mirroring the existing correct file-drop highlight pattern already in the same file.

## What Was Built

### Task 1: TDD Red/Green — Test Coverage + Implementation

**Root cause (confirmed from `.planning/debug/zone-visuals-broken.md`):**

`ringClass = 'ring-2 ring-[#3b82f6] ring-inset'` applied to the LeafNode root div compiles to `box-shadow: inset 0 0 0 2px color`. The root div contains a sibling `<div className="absolute inset-0 overflow-hidden">` (the canvas-clip-wrapper) whose `<canvas className="absolute inset-0 w-full h-full">` fully covers the root's inner area. Per CSS painting order, a positioned descendant with default `z-auto` paints ABOVE the parent's inset box-shadow. On any cell with media, the canvas completely hides the ring — making the 2px accent outline invisible during drag-over.

**Correct pattern already in the same file:** `LeafNode.tsx:662` — the file-drop highlight — uses `<div className="absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10" data-testid={`drop-target-${id}`} />` as a SIBLING of the canvas-clip-wrapper. This paints above the canvas (explicit z-10) and is visible on media cells.

**Fix:**
1. Removed `isOverThisCell` branch from `ringClass` ternary. The remaining two branches (`isPanMode` amber, `isSelected` blue) are intentionally unchanged — out of scope per plan.
2. Added new `{isOverThisCell && <div className="absolute inset-0 ring-2 ring-[#3b82f6] ring-inset pointer-events-none z-10" data-testid={`drag-over-${id}`} />}` as a sibling of the canvas-clip-wrapper, immediately before `<DropZoneIndicators />`. Z-order: canvas (z-auto) < new overlay (z-10) < DropZoneIndicators (zIndex: 20) — arrows still paint above the accent ring.
3. Added inline comment block documenting CSS-painting-order rationale and scope deferral of `isSelected`/`isPanMode`.

**Test coverage added (6 new tests under `describe('LeafNode drag-over accent ring overlay (DROP-04, gap-closure 28-13)')`)**:
- At rest (dragStore idle): no `drag-over-leaf-1` element
- This cell is drag-over target (overId matches): overlay present with all required classes (`ring-2`, `ring-[#3b82f6]`, `ring-inset`, `pointer-events-none`, `z-10`, `absolute`, `inset-0`)
- Source cell during own drag (overId null): no overlay
- Non-target cell while drag in progress: no overlay
- Distinct testid from file-drop overlay: `drag-over-${id}` present, `drop-target-${id}` absent
- Root leaf div does NOT carry `ring-[#3b82f6]` when only `isOverThisCell` is true (ring moved to overlay)

All tests use the existing `makeLeaf` / `setStoreRoot` / `withDnd` harness primitives (not duplicated). A local `renderLeafNode` convenience wrapper composes them inside the describe block.

### Task 2: 28-VERIFICATION.md — Truth Row 16 + Gap-Closure Subsection

- Truth row 16 evidence updated: from `ringClass on root div (occluded)` to `dedicated <div data-testid="drag-over-${id}"> sibling of canvas-clip-wrapper; z-10 pointer-events-none`
- `### Gap-Closure Plan 28-13` subsection appended under the `## Gap-Closure Updates` umbrella (created by plan 28-11, extended by plan 28-12)
- Documents: root cause, fix shape, artifact status table, scope deferral of `isSelected`/`isPanMode`, post-fix UAT mapping (Test 2 + Test 4 = `partial` with explicit D-15 deferral note), grep gates

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `46b0812` | test (RED) | Add LeafNode drag-over accent ring overlay coverage |
| `416d13a` | fix (GREEN) | Move cell-drag accent ring to dedicated overlay div (avoids canvas-clip occlusion) |
| `154744e` | docs | Document drag-over overlay gap closure + isSelected/isPanMode occlusion follow-up |

## Deviations from Plan

None — plan executed exactly as written. All artifacts match the plan's `must_haves` specifications. TDD RED/GREEN cycle completed cleanly with 3 confirmed failures before implementation, all 6 passing after.

## Test Results

- **13 tests in `src/Grid/__tests__/LeafNode.test.tsx`** — all passing (7 pre-existing + 6 new)
- **195 tests across `src/Grid/` + `src/dnd/`** — all passing, 0 regressions
- `npm run build` — exit 0 (1.01s)

## Grep Gates Post-28-13

```
grep -c 'drag-over-' src/Grid/LeafNode.tsx                → 1 (PASS, >=1)
grep -c 'pointer-events-none z-10' src/Grid/LeafNode.tsx  → 3 (PASS, >=2: dim-overlay + file-drop + cell-drag)
grep -nE 'isOverThisCell\s*\?' src/Grid/LeafNode.tsx       → 0 matches (PASS)
grep -c 'drag-over accent ring overlay' src/Grid/__tests__/LeafNode.test.tsx → 1 (PASS)
```

## Gap Closure Status — All Three Plans Combined

| Gap | Test | Status After 28-11 + 28-12 + 28-13 |
|-----|------|-------------------------------------|
| Gap 1 | Test 1 — Desktop click-hold drag | CLOSED by plan 28-11 (sensor key collision fix) |
| Gap 2 | Test 2 — Touch drag ghost + zones | PARTIAL — ghost 1:1 (28-12); edge zones reliable (28-12); **per-zone icon emphasis DEFERRED Phase 29 (D-15; design decision, not defect)** |
| Gap 3 (ghost) | Test 4 — Ghost acceleration | CLOSED by plan 28-12 |
| Gap 3 (outline) | Test 4 — Hovered cell accent outline | CLOSED by this plan (28-13) |
| Gap 3 (zone emphasis) | Test 4 — Active zone icon emphasis | DEFERRED to Phase 29 per D-15 (design decision, not defect) |

## Known Stubs

None — no stubs introduced. `DropZoneIndicators`'s `{ zone: _zone }` underscore-destructure is intentional per D-15 (Phase 29 scope), not introduced by this plan.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The new overlay `<div>` is a purely visual DOM element. `pointer-events-none` is enforced by test, preventing any new interaction surface.

## Follow-ups

- Open a future plan to unify `isPanMode` / `isSelected` / `isOverThisCell` ring paths into one overlay pattern. Audit codebase for other `ring-inset-on-parent-with-absolute-child` occurrences. Verify visual severity of `isSelected`/`isPanMode` occlusion on real media cells before prioritizing.

## Patterns

**CSS painting-order pitfall:** `box-shadow: inset` on a parent is painted UNDER positioned descendants. If a component renders children via `absolute inset-0` with default z-auto, a parent-level `ring-inset` is invisible on those children. Correct pattern: dedicated sibling overlay div with explicit `z-index` higher than the covering child.

## Lessons

An existing correct implementation for the same visual pattern existed in the same file (file-drop highlight at LeafNode.tsx:662). The cell-drag ring was written in isolation on the root `className` — re-introducing the ring-on-parent anti-pattern. Lesson: when adding a new `is-X-highlight` to a component, first grep the file for `ring-inset` and `absolute inset-0` — if both exist, prefer the sibling-overlay pattern over adding to the parent's className.

## Self-Check: PASSED

- `src/Grid/LeafNode.tsx` — contains `drag-over-${id}` overlay div as sibling of canvas-clip-wrapper (FOUND)
- `src/Grid/__tests__/LeafNode.test.tsx` — contains `describe('LeafNode drag-over accent ring overlay (DROP-04, gap-closure 28-13)')` with 6 tests (FOUND)
- `.planning/phases/28-cell-to-cell-drag/28-VERIFICATION.md` — contains `### Gap-Closure Plan 28-13` subsection (FOUND)
- Commits 46b0812, 416d13a, 154744e — all present in git log (VERIFIED)
- Grep gates — all PASS (verified above)
