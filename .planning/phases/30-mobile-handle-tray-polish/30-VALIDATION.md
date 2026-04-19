---
phase: 30
slug: mobile-handle-tray-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose src/dnd/ src/Editor/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose src/dnd/ src/Editor/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | CROSS-02, CROSS-03 | — | N/A | unit | `npx vitest run src/dnd/useCellDraggable.test.ts` | ✅ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | CROSS-04, CROSS-05 | — | N/A | unit | `npx vitest run src/Editor/CanvasWrapper.test.ts` | ✅ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | CROSS-06, CROSS-07 | — | N/A | unit | `npx vitest run src/dnd/dragStore.test.ts` | ✅ | ⬜ pending |
| 30-01-04 | 01 | 1 | CROSS-08 | — | N/A | unit | `npx vitest run src/dnd/dragStore.test.ts` | ✅ | ⬜ pending |
| 30-01-05 | 01 | 2 | CROSS-08 | — | N/A | unit | `npx vitest run src/Editor/MobileCellTray.test.ts` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/dnd/useCellDraggable.test.ts` — stubs/cases for CROSS-02 (touchAction style) and CROSS-03 (WebkitTouchCallout style)
- [ ] `src/Editor/CanvasWrapper.test.ts` — stubs/cases for CROSS-04 (user-select body toggle), CROSS-05 (contextmenu listener)
- [ ] `src/Editor/MobileCellTray.test.ts` — stubs/cases for CROSS-08 tray opacity + pointer-events

*dragStore.test.ts already exists — extend in Wave 1 for CROSS-06, CROSS-07, CROSS-08 prevSheetSnapState.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 10ms haptic on drag-start | CROSS-06 | navigator.vibrate not available in jsdom; Android Chrome real device required | Long-press cell on Android Chrome; feel single short pulse at activation |
| 15ms haptic on drop commit | CROSS-07 | Same — real device only | Drop cell onto target on Android Chrome; feel slightly longer pulse |
| Image-action menu suppressed | CROSS-03 | iOS Safari behavior not testable in jsdom | Long-press media cell on iOS Safari 15+; Save/Copy/Share sheet must NOT appear |
| Bottom-sheet collapse on drag | CROSS-08 | Sheet snap interaction requires real browser layout | Drag cell on mobile; sheet must collapse to tab-strip at drag-start, restore on release |
| touch-action scope preserved | CROSS-02 | Pinch-to-zoom and sheet scrolling require real device | Verify pinch-to-zoom still works on iOS after change; sheet scrolls normally |
| No text selection / loupe | CROSS-04 | iOS loupe requires real device | Long-press and drag on iOS Safari; no text selection or loupe should appear |
| Address-bar collapse safety | Pitfall 7 | Address-bar behavior is browser-native | Start drag on iOS Safari; browser address bar collapsing must not cancel the drag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
