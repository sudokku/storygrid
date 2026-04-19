---
phase: 31
slug: improve-mobile-interactions-ui-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run src/test/divider.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/test/divider.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | D-01 | — | N/A | grep | `grep "touchAction: 'none'" src/Editor/CanvasArea.tsx` | ✅ | ⬜ pending |
| 31-01-02 | 01 | 1 | D-02 | — | N/A | grep | `grep "maximum-scale" index.html` | ✅ | ⬜ pending |
| 31-02-01 | 02 | 1 | D-04 | — | N/A | unit | `npx vitest run src/test/divider.test.tsx` | ✅ (needs update) | ⬜ pending |
| 31-02-02 | 02 | 1 | D-05 | — | N/A | unit | `npx vitest run src/test/divider.test.tsx` | ❌ Wave 0 gap | ⬜ pending |
| 31-02-03 | 02 | 1 | D-06 | — | N/A | unit | `npx vitest run src/test/divider.test.tsx` | ✅ (pre-existing guard) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/divider.test.tsx` — update `w-[22px]` assertion to `w-[40px]` (D-04)
- [ ] `src/test/divider.test.tsx` — add assertion `hitArea.style.touchAction === 'none'` (D-05)

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser zoom no longer competes with pinch-to-zoom on canvas | D-01 + D-02 | Requires physical touch device or DevTools touch simulation | Open on mobile or Chrome DevTools touch mode; two-finger pinch on canvas area with sheet collapsed — browser should not zoom page |
| Divider drag works reliably on touch | D-04 + D-05 | Requires physical touch device or DevTools touch simulation | Open on mobile; press and drag a divider — scroll should not hijack the drag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
