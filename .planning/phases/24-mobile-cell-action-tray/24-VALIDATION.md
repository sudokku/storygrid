---
phase: 24
slug: mobile-cell-action-tray
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `vite.config.ts` (vitest config inline) |
| **Quick run command** | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 0 | CELL-01, CELL-02, CELL-03 | — | N/A | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | CELL-01 | — | N/A | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ✅ W0 | ⬜ pending |
| 24-01-03 | 01 | 1 | CELL-02 | — | N/A | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ✅ W0 | ⬜ pending |
| 24-01-04 | 01 | 1 | CELL-03 | — | N/A | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ✅ W0 | ⬜ pending |
| 24-01-05 | 01 | 2 | CELL-01 | — | N/A | unit | `npx vitest run src/test/phase24-mobile-cell-tray.test.tsx` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase24-mobile-cell-tray.test.tsx` — stubs for CELL-01, CELL-02, CELL-03

Follows the established pattern from `src/test/phase22-mobile-header.test.tsx`:
- Mock `window.matchMedia` with `(max-width: 767px)` returning true
- Reset `useEditorStore` and `useGridStore` in `beforeEach`
- Test button presence, classes, and conditional render via `@testing-library/react`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tray slides in/out with CSS transition | CELL-01 | CSS animation not testable in jsdom | Open on mobile viewport, tap cell, observe opacity+translate transition |
| 44×44px tap targets feel comfortable | CELL-03 | Physical touch requires device | Test on iOS/Android device or Chrome DevTools mobile emulator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
