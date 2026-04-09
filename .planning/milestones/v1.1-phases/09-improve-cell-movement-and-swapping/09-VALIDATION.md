---
phase: 9
slug: improve-cell-movement-and-swapping
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (existing) |
| **Quick run command** | `npm test -- --run src/test/phase09-p01-cell-move.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds (Phase 9 files only) |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the changed plan's test file
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Edge Case / Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | RED: 18 failing unit tests for moveLeafToEdge (EC-01..EC-18 + content copy + order + no-ops) | unit (tree) | `npm test -- --run src/test/phase09-p01-cell-move.test.ts` | ❌ W0 (this task creates it) | ⬜ pending |
| 9-01-02 | 01 | 1 | GREEN: moveLeafToEdge implementation passes all 18 tests + phase05 swap regression | unit (tree) + regression | `npm test -- --run src/test/phase09-p01-cell-move.test.ts src/test/phase05-p02-cell-swap.test.ts` | ✅ (from 9-01-01) | ⬜ pending |
| 9-02-01 | 02 | 2 | RED: 9 failing store tests (STORE-01..STORE-09: edge path, center delegation, no-op guards, undo/redo, atomicity, history cap, EC-06 empty-cell move) | store unit | `npm test -- --run src/test/phase09-p02-store-move.test.ts` | ❌ W0 (this task creates it) | ⬜ pending |
| 9-02-02 | 02 | 2 | GREEN: gridStore.moveCell action passes store tests + no regressions in Plan 01 or Phase 5 + tsc clean | store unit + regression + typecheck | `npm test -- --run src/test/phase09-p02-store-move.test.ts src/test/phase09-p01-cell-move.test.ts src/test/phase05-p02-cell-swap.test.ts && npx tsc --noEmit` | ✅ (from 9-02-01) | ⬜ pending |
| 9-03-01 | 03 | 3 | RED: 12 failing integration tests for LeafNode 5-zone hit detection, overlays, moveCell dispatch, EC-12 file-drop coexistence, EC-11 dragLeave clearing, EC-17 order, small-cell minimum band | integration (LeafNode) | `npm test -- --run src/test/phase09-p03-leafnode-zones.test.ts` | ❌ W0 (this task creates it) | ⬜ pending |
| 9-03-02 | 03 | 3 | GREEN: LeafNode zone detection + insertion-line/swap-overlay rendering + moveCell dispatch + no regressions | integration + regression + typecheck | `npm test -- --run src/test/phase09-p03-leafnode-zones.test.ts src/test/phase09-p01-cell-move.test.ts src/test/phase09-p02-store-move.test.ts && npx tsc --noEmit` | ✅ (from 9-03-01) | ⬜ pending |
| 9-04-01 | 04 | 3 | EC-06: ActionBar drag handle renders unconditionally (gate relaxed); aria-label/title updated to "Drag to move" | UI edit (verified by grep) | `grep -c 'aria-label="Drag to move"' src/Grid/ActionBar.tsx` | ✅ (file exists) | ⬜ pending |
| 9-04-02 | 04 | 3 | Phase 5 cell-swap regression test inverted for EC-06 gate relaxation; all phase05 tests still pass | regression | `npm test -- --run src/test/phase05-p02-cell-swap.test.ts src/test/phase09-p01-cell-move.test.ts src/test/phase09-p02-store-move.test.ts` | ✅ (file exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**EC coverage map:**
- EC-01 (3-child parent, no collapse) → 9-01-01 MOVE-02
- EC-02 (2-child parent, collapse) → 9-01-01 MOVE-03
- EC-03 (source parent IS root) → 9-01-01 MOVE-04
- EC-04 (same parent, direction change) → 9-01-01 MOVE-05
- EC-05 (same-edge no-op) → 9-01-01 MOVE-06 + 9-02-01 STORE-03
- EC-06 (empty-cell move) → 9-01-01 MOVE-15 + 9-02-01 STORE-09 + 9-04-01/02
- EC-07 (N/A, documented) → 9-01-01 (no test, documented in plan)
- EC-08 (MIN_CELL_WEIGHT) → 9-01-01 MOVE-17
- EC-09 (history cap) → 9-02-01 STORE-08
- EC-10 (undo round-trip) → 9-02-01 STORE-05 + STORE-06
- EC-11 (dragLeave clearing) → 9-03-01 ZONE-07
- EC-12 (workspace ring coexistence) → 9-03-01 ZONE-10
- EC-13 (disjoint subtrees happy path) → 9-01-01 MOVE-01
- EC-14 (single-leaf root) → covered by no-op guards (9-01-01 MOVE-06..10)
- EC-15 (multi-level not needed) → documented, no test
- EC-16 (nested same-direction) → 9-01-01 MOVE-18
- EC-17 (top/left first, bottom/right second) → 9-01-01 MOVE-11..14
- EC-18 (stale selectedNodeId) → 9-02-02 (selection clearing; Plan 02 Task 2 action item)

**Decision coverage (D-01..D-08):**
- D-01 (5-zone geometry, 20%/minimum 20px) → Plan 03 Task 2 (implementation) + 9-03-01 ZONE-12
- D-02 (insertion line + swap overlay, canvas-scale stable) → Plan 03 Task 2 (implementation) + 9-03-01 ZONE-01..05
- D-03 (50/50 split) → 9-01-01 MOVE-01 (sizes: [1,1] assertion)
- D-04 (atomic moveCell action) → Plan 02 + 9-02-01 STORE-07
- D-05 (pure function moveLeafToEdge, collapse-upward) → Plan 01 + 9-01-01 MOVE-03, MOVE-04
- D-06 (fresh id, content-only move) → 9-01-01 MOVE-15, MOVE-16 + Plan 02 selection clearing
- D-07 (edge case enumeration) → 9-01-01 covers EC-01..EC-18
- D-08 (research directive) → 09-RESEARCH.md already produced
- D-09 (branch discipline, on main) → No worktree instructions in any plan

---

## Wave 0 Requirements

- [ ] `src/test/phase09-p01-cell-move.test.ts` — created by Plan 01 Task 1 (RED)
- [ ] `src/test/phase09-p02-store-move.test.ts` — created by Plan 02 Task 1 (RED)
- [ ] `src/test/phase09-p03-leafnode-zones.test.ts` — created by Plan 03 Task 1 (RED)

*Existing `vitest` + `@testing-library/react` infrastructure covers all needs; no new framework install.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Insertion-line visual fidelity (thickness, accent color, canvas-scale stability) | Visual rendering not reliably testable via DOM assertions | 1) Open app, split into ≥3 cells. 2) Drag a cell by its ActionBar handle. 3) Hover over target cell at each of 4 edges and the center. 4) Verify: thick accent-blue line appears on hovered edge only; swap icon overlay on center hover; line remains visually ~4px regardless of pinch-zoom (`canvasScale`). |
| Live drag/drop ergonomics on real desktop Chrome/Firefox/Safari | Native HTML5 drag events behave differently across engines | Drag cells across each supported browser; confirm no flicker, no stuck insertion lines after drop, no workspace drop-ring activation during cell drag (Phase 8 D-15 coexistence). |
| Undo atomicity (single Ctrl+Z reverses full move) | UX feel, not a unit testable concern | Move a cell via edge drop; press Ctrl+Z once; confirm the tree snaps back to the exact pre-move layout in one step. |
| Empty-cell drag UX | Visual confirmation the drag handle is now visible on empty cells | Open a fresh grid, do NOT upload media; hover the ActionBar on any cell — drag handle should be visible and draggable. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING test files
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-04-08
