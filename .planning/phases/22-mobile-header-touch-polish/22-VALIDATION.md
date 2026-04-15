---
phase: 22
slug: mobile-header-touch-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run src/test/phase22` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run src/test/phase22`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | HEADER-01 | — | N/A | unit | `npm run test -- --run src/test/phase22-mobile-header` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 0 | SCROLL-01 | — | N/A | unit | `npm run test -- --run src/test/phase22-touch-polish` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | HEADER-01 | — | N/A | unit | `npm run test -- --run src/test/phase22-mobile-header` | ✅ W0 | ⬜ pending |
| 22-01-04 | 01 | 1 | HEADER-02 | — | N/A | unit | `npm run test -- --run src/test/phase22-mobile-header` | ✅ W0 | ⬜ pending |
| 22-01-05 | 01 | 1 | SCROLL-01 | — | N/A | unit | `npm run test -- --run src/test/phase22-touch-polish` | ✅ W0 | ⬜ pending |
| 22-01-06 | 01 | 1 | SCROLL-02 | — | N/A | unit | `npm run test -- --run src/test/phase22-touch-polish` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase22-mobile-header.test.tsx` — stubs for HEADER-01, HEADER-02
- [ ] `src/test/phase22-touch-polish.test.tsx` — stubs for SCROLL-01, SCROLL-02

*Use matchMedia mock pattern from existing Phase 5 test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pull-to-refresh suppressed on real device | SCROLL-01 | Browser gesture not testable in jsdom | Open on iOS Safari/Chrome, pull down canvas, verify no refresh |
| 300ms tap delay eliminated | SCROLL-02 | Timing perception not testable in unit tests | Tap buttons on real device, verify instant response |
| 44px tap targets visually correct | HEADER-02 | Pixel dimensions require visual inspection | Open DevTools mobile emulation, inspect button sizes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
