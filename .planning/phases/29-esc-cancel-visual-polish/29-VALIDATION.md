---
phase: 29
slug: esc-cancel-visual-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.ts` (vitest inline config) |
| **Quick run command** | `npx vitest run src/dnd/dragStore.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/dnd/dragStore.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | D-02 (store fields) | T-29-01 | Store resets correctly via end() | unit | `npx vitest run src/dnd/dragStore.test.ts` | ✅ (extend) | ⬜ pending |
| 29-01-02 | 01 | 1 | D-02 (store actions) | T-29-01 | setPointerDown/setLastDrop/clearLastDrop work | unit | `npx vitest run src/dnd/dragStore.test.ts` | ✅ (extend) | ⬜ pending |
| 29-02-01 | 02 | 1 | D-03/D-04 (ghost cap) | — | --ghost-cap CSS variable present | smoke | `grep -r 'ghost-cap' src/index.css tailwind.config.js` | ✅ | ⬜ pending |
| 29-02-02 | 02 | 1 | D-09 (wobble), D-08 (flash) | — | Keyframes defined with correct values | smoke | `grep -A4 'cell-wobble\|drop-flash' src/index.css tailwind.config.js` | ✅ | ⬜ pending |
| 29-03-01 | 03 | 2 | D-01 (grabOffsetModifier) | T-29-02 | grabOffsetModifier reads pointerDownX/Y | unit | `npx vitest run src/dnd/DragPreviewPortal.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 29-03-02 | 03 | 2 | D-06/CANCEL-01 (KeyboardSensor) | — | KeyboardSensor registered in useSensors | unit | `npx vitest run src/Grid/CanvasWrapper.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 29-03-03 | 03 | 2 | D-08 (setLastDrop ordering) | T-29-03 | setLastDrop called before end() in handleDragEnd | unit | `npx vitest run src/Grid/CanvasWrapper.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 29-04-01 | 04 | 2 | D-01/D-02 (pointer capture) | — | setPointerDown fires before isPanMode guard | unit | `npx vitest run src/Grid/LeafNode.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 29-04-02 | 04 | 2 | D-09 (wobble class) | — | isDragging drives animate-cell-wobble class | unit | `npx vitest run src/Grid/LeafNode.test.tsx` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/Grid/CanvasWrapper.test.tsx` — stubs covering D-06 (KeyboardSensor in sensors) and D-08 (setLastDrop ordering in handleDragEnd)
- [ ] `src/dnd/DragPreviewPortal.test.tsx` — stub covering D-01 (grabOffsetModifier reads pointerDownX/Y from dragStore)
- [ ] `src/Grid/LeafNode.test.tsx` — stubs covering D-01 (pointer capture fires before isPanMode guard) and D-09 (wobble class on isDragging)
- [ ] Update `src/dnd/dragStore.test.ts` `beforeEach` to include 3 new fields (`pointerDownX`, `pointerDownY`, `lastDropId`) in the reset object

*(Existing `src/dnd/dragStore.test.ts` covers the store contract and will cover D-02 with new tests added in the same file.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ESC key cancels active drag with 200ms snap-back | CANCEL-01, CANCEL-02 | Requires real browser DnD interaction and visual animation verification | Start dragging a cell; press ESC; verify ghost animates back to origin in ~200ms |
| Ghost spawns under grab point (no position jump) | GHOST-02 / D-01 | Pixel-level visual correctness requires human eye | Drag a cell; confirm ghost spawns exactly where clicked, not shifted |
| Ghost opacity 20% (drop zones visible through it) | GHOST-03 / D-05 | Visual opacity requires human verification | Drag a cell over drop zones; confirm zones are visible through the ghost |
| Ghost capped at ~200px (large cells shrink) | GHOST-04 / D-03 | Requires cells larger than 200px in viewport to test | Create a large split cell; drag it; confirm ghost renders at ≤200px |
| Drag-start wobble animation visible | D-09 | CSS animation requires visual verification | Drag any cell; confirm brief ±1.5deg wobble on drag start |
| Drop flash ring appears on landed cell | D-08 | CSS animation requires visual verification | Drop a cell; confirm a ring flash appears on the target for ~700ms |
| Active zone bright / inactive zones dim | D-10 | Already implemented; visual regression check | Drag over a cell; confirm active zone shows `text-white`, others `text-white/30` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
