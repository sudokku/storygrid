---
phase: 2
slug: grid-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + @testing-library/react 16.3.2 |
| **Config file** | `vite.config.ts` (test block; jsdom environment) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~1.3 seconds |

**Baseline:** 79 tests pass (7 test files) from Phase 1. Phase 2 must not break existing tests.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | 01 | 0 | REND-01,02,04,05,06,08,09,10 | unit stubs | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-W0-02 | 01 | 0 | REND-03 | unit stubs | `npx vitest run src/test/divider.test.tsx` | ❌ W0 | ⬜ pending |
| 2-W0-03 | 01 | 0 | REND-07 | integration stub | `npx vitest run src/test/canvas-wrapper.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-01 | 01 | 1 | REND-01 | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | REND-02 | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | REND-03 | unit | `npx vitest run src/test/divider.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | REND-04,05 | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | REND-06 | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-06 | 01 | 1 | REND-07 | integration | `npx vitest run src/test/canvas-wrapper.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-07 | 01 | 1 | REND-08 | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-08 | 01 | 1 | REND-09 | unit (render spy) | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |
| 2-01-09 | 01 | 1 | REND-10 | unit | `npx vitest run src/test/grid-rendering.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/grid-rendering.test.tsx` — stubs for REND-01, REND-02, REND-04, REND-05, REND-06, REND-08, REND-09, REND-10
- [ ] `src/test/divider.test.tsx` — stubs for REND-03 (pointer event simulation, local state, store write timing)
- [ ] `src/test/canvas-wrapper.test.tsx` — stubs for REND-07 (ResizeObserver mock, scale calculation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Divider drag feels lag-free in real browser | REND-01 | Performance feel cannot be asserted in jsdom | Open dev server; drag a divider; confirm no visible lag |
| Safari 15 overflow clipping works correctly | REND-10 | Safari-specific rendering cannot be tested in jsdom | Open in Safari 15+; confirm `isolation: isolate` prevents bleed on deeply nested cells |
| Canvas scale fits viewport correctly | REND-07 | Visual proportionality hard to assert in jsdom | Resize browser window; confirm canvas scales to ~90% of available height |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
