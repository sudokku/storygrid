---
phase: 32
slug: update-mobile-cell-tray-ui-ux
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-20
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | D-01/D-02/D-03/D-04/D-05/D-06/D-07/D-08 | T-32-01–T-32-05 | N/A | unit | `npx vitest run src/Editor/MobileCellTray.test.ts` | ✅ | ⬜ pending |
| 32-01-02 | 01 | 1 | D-09/D-10/D-12/D-13 | — | N/A | unit | `npx vitest run --run` | ✅ | ⬜ pending |
| 32-01-03 | 01 | 1 | D-07 (test coverage) | — | N/A | unit | `npx vitest run src/Editor/MobileCellTray.test.ts` | ✅ | ⬜ pending |
| 32-02-01 | 02 | 1 | D-11 | T-32-06 | N/A | build | `npm run build && grep "h-11 px-2" src/Editor/Toolbar.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tray scrolls horizontally on narrow phones | D-06 | Visual/touch interaction | Open on 375px viewport; verify all 7 buttons reachable by scrolling |
| Tray hides when sheet is fully open | D-07 | Visual state | Open sheet fully; confirm tray opacity=0, pointer-events=none |
| Effects button opens sheet | D-08 | Interaction flow | Tap Effects; confirm sheet transitions to 'full' state |
| Cell tap no longer auto-opens sheet | D-09 | Interaction behavior | Tap a cell; confirm sheet stays collapsed |
| Header touch targets ≥44px | D-11 | HIG compliance | Measure rendered header button height in DevTools |
| Sheet tab strip height updated with SNAP_TRANSLATE | D-12 | Visual/layout | Verify collapsed sheet shows full tab strip, not partially clipped |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
