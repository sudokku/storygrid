---
phase: 25
slug: touch-drag-and-drop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react (jsdom) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/test/phase25-touch-dnd.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/test/phase25-touch-dnd.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | DRAG-01 | — | N/A | unit | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | DRAG-01 | — | N/A | unit | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ W0 | ⬜ pending |
| 25-01-03 | 01 | 1 | DRAG-02 | — | N/A | unit | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ W0 | ⬜ pending |
| 25-01-04 | 01 | 2 | DRAG-03 | — | N/A | integration | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ W0 | ⬜ pending |
| 25-01-05 | 01 | 2 | DRAG-04 | — | N/A | unit | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ W0 | ⬜ pending |
| 25-01-06 | 01 | 2 | DRAG-04 | — | N/A | unit | `npx vitest run src/test/phase25-touch-dnd.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase25-touch-dnd.test.tsx` — stubs for DRAG-01, DRAG-02, DRAG-03, DRAG-04

**Test stubs needed:**
- DRAG-01: TouchSensor configured with 500ms delay + 5px tolerance
- DRAG-01: MouseSensor configured with 5px distance constraint
- DRAG-02: isDragging → cell div has scale(1.08) + opacity:0.6
- DRAG-02: isDragging=false → no scale or opacity override
- DRAG-03: During active drag, non-dragged LeafNode shows zone overlay
- DRAG-03: Zone overlays cleared when drag ends or is cancelled
- DRAG-04: DragEnd with over=center calls moveCell(fromId, toId, 'center')
- DRAG-04: DragEnd with over=top calls moveCell(fromId, toId, 'top')
- DRAG-04: DragEnd with over=null is a no-op (D-10)
- DRAG-04: DragEnd with active.id === over.id is a no-op (self-drop)

**Existing tests to update (not Wave 0, but must not regress):**
- `src/test/phase09-p03-leafnode-zones.test.ts` — tests native dragover/drop handlers that will be removed; must be rewritten to use @dnd-kit's useDndMonitor pattern after implementation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 500ms long-press activates drag on real touch device | DRAG-01 | jsdom has no real touch event propagation to sensors | Open app on mobile device, hold finger on cell for 500ms, verify lift animation triggers |
| Pinch-to-zoom coexists without conflict during drag | DRAG-01 | Requires real browser and touch hardware | Initiate long-press, add second finger — verify drag cancels and pinch works |
| Nested DndContext non-interference (ActionBar vs GridNode) | D-03 | Requires full app render with both DndContexts active | Use ActionBar drag handle on desktop; drag cell on canvas — verify no cross-contamination |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
