---
phase: 1
slug: grid-tree-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vite.config.ts` (test block, jsdom environment) |
| **Quick run command** | `npm run test -- --reporter=verbose` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --reporter=verbose`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | GRID-01..13 | unit | `npm run test -- src/test/tree-functions.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | GRID-01,02,03,04 | unit | `npm run test -- src/test/tree-functions.test.ts` | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | GRID-05,06,07 | unit | `npm run test -- src/test/tree-functions.test.ts` | ✅ | ⬜ pending |
| 1-01-04 | 01 | 2 | GRID-08,09,10,11,12 | unit | `npm run test -- src/test/grid-store.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 2 | GRID-13 | unit | `npm run test -- src/test/editor-store.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 3 | All | integration | `npm run test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/tree-functions.test.ts` — stubs/scaffolding for GRID-01 through GRID-07 (pure function tests)
- [ ] `src/test/grid-store.test.ts` — stubs for GRID-08 through GRID-12 (gridStore + undo/redo)
- [ ] `src/test/editor-store.test.ts` — stubs for GRID-13 (editorStore)

*Existing Vitest infrastructure (setup.ts, vite.config.ts test block) covers the framework — only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `structuredClone` snapshot never includes Immer Draft | GRID-11 | Runtime proxy behavior not detectable at type level | In devtools, inspect `useGridStore.getState().history[0]` — should be plain object, no `$__` draft markers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
