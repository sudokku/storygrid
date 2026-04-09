---
phase: 13
slug: text-sticker-overlay-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | OVL-01 | — | N/A | unit | `npx vitest run src/store/__tests__/overlayStore.test.ts src/store/__tests__/stickerRegistry.test.ts src/utils/__tests__/canvasExport.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | OVL-14 | — | N/A | unit | `npx vitest run src/store/__tests__/overlayStore.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | OVL-15 | — | N/A | unit | `npx vitest run src/store/__tests__/overlayStore.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | OVL-17 | — | N/A | unit | `npx vitest run src/store/__tests__/overlayStore.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | OVL-13 | T-13-09 | Delete key guard: INPUT target must NOT call deleteOverlay | unit | `npx vitest run src/Grid/__tests__/OverlayLayer.test.tsx` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | OVL-10 | — | N/A | unit | `npx vitest run src/Editor/__tests__/OverlayHandles.test.tsx` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 2 | OVL-11 | — | N/A | unit | `npx vitest run src/Editor/__tests__/OverlayHandles.test.tsx` | ❌ W0 | ⬜ pending |
| 13-02-04 | 02 | 2 | OVL-12 | — | N/A | unit | `npx vitest run src/Editor/__tests__/OverlayHandles.test.tsx` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | OVL-16 | — | N/A | unit | `npx vitest run src/lib/__tests__/overlayExport.test.ts src/utils/__tests__/canvasExport.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-02 | 03 | 2 | OVL-16 | — | N/A | unit | `npx tsc --noEmit && npx vitest run` | — | ⬜ pending |
| 13-04-01 | 04 | 3 | OVL-09 | T-13-09 | SVG sanitized via DOMPurify before store | unit | `npx vitest run src/lib/__tests__/svgSanitize.test.ts` | ❌ W0 | ⬜ pending |
| 13-04-02 | 04 | 3 | OVL-08 | — | N/A | manual | — | — | ⬜ pending |
| 13-04-03 | 04 | 3 | OVL-13 | — | N/A | manual | — | — | ⬜ pending |
| 13-05-01 | 05 | 3 | OVL-02..07 | — | N/A | unit | `npx vitest run src/Editor/__tests__/OverlayPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 13-05-02 | 05 | 3 | OVL-14 | — | N/A | manual | — | — | ⬜ pending |
| 13-05-03 | 05 | 3 | OVL-15 | — | N/A | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All 3 Wave 0 files are created in Plan 01 Task 1 (Wave 1) before any Wave 2 tasks execute:

- [ ] `src/store/__tests__/overlayStore.test.ts` — stubs for OVL-01, OVL-14, OVL-15, OVL-17 (store actions, z-index reorder, mutual exclusion, undo/redo)
- [ ] `src/utils/__tests__/canvasExport.test.ts` — stubs for OVL-16 (canvas overlay draw pass — created in Plan 01, expanded in Plan 03)
- [ ] `src/store/__tests__/stickerRegistry.test.ts` — stubs for registry add/get/remove (mirrors mediaRegistry pattern)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag text overlay to any position on canvas | OVL-08 | Requires pointer events in browser | Add text overlay → drag to corner → verify position persists |
| Rotate image sticker via top handle | OVL-09 | Requires pointer events + visual check | Upload sticker → grab rotation handle → rotate 45° → verify angle in store |
| Emoji picker renders and inserts emoji sticker | OVL-13 | Requires emoji-mart UI interaction | Click emoji button → select emoji → verify sticker appears on canvas |
| z-order Bring Forward / Send Backward visual | OVL-14 | Requires visual stacking verification | Add 2 overlays → reorder → verify stacking in preview |
| Export PNG matches live preview stacking | OVL-15 | Requires visual comparison of export | Build canvas → export PNG → compare overlay positions/stacking |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
