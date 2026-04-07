---
phase: 5
slug: polish-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vite.config.ts` (inline `test:` key) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 01 | 0 | POLH-01..12 | unit stub | `npx vitest run src/test/phase05-p01-templates.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-01-T2 | 01 | 1 | POLH-01 | unit | `npx vitest run src/test/phase05-p01-templates.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-01-T3 | 01 | 1 | POLH-02,03,04,05 | unit | `npx vitest run src/test/phase05-p01-canvas-settings.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-02-T1 | 02 | 2 | POLH-06 | unit | `npx vitest run src/test/phase05-p02-pan-zoom.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-02-T2 | 02 | 2 | POLH-07 | unit | `npx vitest run src/test/phase05-p02-cell-swap.test.ts` | ❌ Wave 0 | ⬜ pending |
| 05-02-T3 | 02 | 2 | POLH-11 | unit | `npx vitest run src/test/phase05-p02-export-settings.test.ts` | ❌ Wave 0 | ⬜ pending |
| 05-03-T1 | 03 | 3 | POLH-08 | unit | `npx vitest run src/test/phase05-p03-dark-theme.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-03-T2 | 03 | 3 | POLH-09 | unit | `npx vitest run src/test/phase05-p03-shortcuts.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-03-T3 | 03 | 3 | POLH-10 | unit | `npx vitest run src/test/phase05-p03-onboarding.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 05-03-T4 | 03 | 3 | POLH-12 | unit | `npx vitest run src/test/phase05-p03-responsive.test.tsx` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase05-p01-templates.test.tsx` — stubs for POLH-01
- [ ] `src/test/phase05-p01-canvas-settings.test.tsx` — stubs for POLH-02, POLH-03, POLH-04, POLH-05
- [ ] `src/test/phase05-p02-pan-zoom.test.tsx` — stubs for POLH-06
- [ ] `src/test/phase05-p02-cell-swap.test.ts` — stubs for POLH-07
- [ ] `src/test/phase05-p02-export-settings.test.ts` — stubs for POLH-11
- [ ] `src/test/phase05-p03-dark-theme.test.tsx` — stubs for POLH-08
- [ ] `src/test/phase05-p03-shortcuts.test.tsx` — stubs for POLH-09
- [ ] `src/test/phase05-p03-onboarding.test.tsx` — stubs for POLH-10
- [ ] `src/test/phase05-p03-responsive.test.tsx` — stubs for POLH-12

Existing test infrastructure (jsdom, setup.ts ResizeObserver polyfill, @testing-library/react) covers all new needs. No additional setup required.

**Canvas API mock note:** `renderGridToCanvas` tests require mocking `HTMLCanvasElement.getContext`. Use the same mock pattern as `canvas-export.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gap slider live update visible in editor | POLH-02 | CSS gap visual — jsdom does not render layout | Open dev server, drag gap slider, verify cell spacing changes |
| Pan mode dimmed overlay on other cells | POLH-06 | Visual overlay effect | Double-click a media cell, verify other cells darken |
| Drag handle initiates cell swap | POLH-07 | Pointer drag interaction in real browser | Drag handle of cell A onto cell B, verify content swap |
| Dark theme visual polish | POLH-08 | Color rendering | Inspect editor chrome for bg #0a0a0a–#141414, surfaces #1a1a1a–#222 |
| Onboarding spotlight cutout | POLH-10 | Visual clip-path/box-shadow rendering | First visit: verify 3-step overlay with highlighted elements |
| Export PNG reflects gap + radius + bg | POLH-11 | Requires real canvas rendering + image download | Export PNG, open in image viewer, verify gap/radius/bg match editor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
