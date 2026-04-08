---
phase: 9
slug: improve-cell-movement-and-swapping
status: draft
nyquist_compliant: false
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
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test -- --run src/test/phase09-p01-cell-move.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the changed plan's test file
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

> Filled in by the planner. Each task in each PLAN must map to a row here before execution starts.

| Task ID | Plan | Wave | Edge Case / Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------------|-----------|-------------------|-------------|--------|
| 9-XX-XX | XX | N | EC-NN | unit / integration | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase09-p01-cell-move.test.ts` — unit tests for `moveLeafToEdge` pure function, covering EC-01..EC-18 from RESEARCH.md
- [ ] `src/test/phase09-p02-store-move.test.ts` — store tests for `gridStore.moveCell` action (atomic snapshot, center-swap delegation, no-op cases, undo/redo)
- [ ] `src/test/phase09-p03-leafnode-zones.test.ts` — integration tests for `LeafNode` 5-zone hit detection and `handleDrop` routing

*Existing `vitest` + `@testing-library/react` infrastructure covers all needs; no new framework install.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Insertion-line visual fidelity (thickness, accent color, canvas-scale stability) | Visual rendering not reliably testable via DOM assertions | 1) Open app, split into ≥3 cells. 2) Drag a cell by its ActionBar handle. 3) Hover over target cell at each of 4 edges and the center. 4) Verify: thick accent-blue line appears on hovered edge only; swap icon overlay on center hover; line remains visually ~4px regardless of pinch-zoom (`canvasScale`). |
| Live drag/drop ergonomics on real desktop Chrome/Firefox/Safari | Native HTML5 drag events behave differently across engines | Drag cells across each supported browser; confirm no flicker, no stuck insertion lines after drop, no workspace drop-ring activation during cell drag (Phase 8 D-15 coexistence). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
