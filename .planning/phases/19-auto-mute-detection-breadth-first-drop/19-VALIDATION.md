---
phase: 19
slug: auto-mute-detection-breadth-first-drop
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-13
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | MUTE-01 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | MUTE-02 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 19-01-03 | 01 | 1 | MUTE-03 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | DROP-01 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 1 | DROP-02 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 19-02-03 | 02 | 1 | DROP-03 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase19-foundation.test.ts` — created by Plan 01 Task 1 (TDD) covering MUTE-01, DROP-01, DROP-02
- [ ] `src/test/phase19-integration.test.ts` — created by Plan 02 Task 2 (TDD) covering DROP-01, DROP-02, DROP-03

*Existing vitest infrastructure assumed present; Wave 0 adds new test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VolumeX icon is visually grayed-out and non-interactive | MUTE-02 | Visual rendering + pointer-events requires browser | Drop a mute video onto a cell; confirm VolumeX icon appears grayed and clicking it does nothing |
| Audio toggle in SelectedCellPanel is grayed and non-interactive | MUTE-03 | Visual rendering requires browser | Select a no-audio cell; confirm sidebar toggle is grayed and non-interactive |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
