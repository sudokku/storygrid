---
phase: 29-esc-cancel-visual-polish
verified: 2026-04-19T03:15:00Z
status: human_needed
score: 10/10
overrides_applied: 0
human_verification:
  - test: "ESC cancels an active drag and snap-back animation plays"
    expected: "While dragging a cell, pressing ESC returns the ghost to its origin with a 200ms ease-in animation. No cell swap occurs."
    why_human: "KeyboardSensor wired in code but real ESC behavior during pointer drag requires browser interaction to confirm"
  - test: "Ghost appears under exact grab point (no position jump)"
    expected: "Clicking and dragging a cell keeps the ghost image anchored at the pixel where the mouse was pressed, not the center of the cell"
    why_human: "grabOffsetModifier math can only be validated visually during real interaction"
  - test: "Ghost is 20% opacity and capped at 200px"
    expected: "Ghost image during drag is semi-transparent (faint) and never exceeds 200px in either dimension"
    why_human: "CSS visual property — requires browser rendering to confirm"
  - test: "Source cell shows wobble animation on drag activation"
    expected: "The cell being dragged rotates ±1.5deg briefly (150ms) as drag activates"
    why_human: "CSS animation timing — requires visual inspection"
  - test: "Landed cell shows 700ms ring flash after successful drop"
    expected: "The destination cell briefly shows an accent-color box-shadow ring that fades out over 700ms"
    why_human: "CSS animation on state change — requires live drop to confirm"
---

# Phase 29: ESC-Cancel + Visual Polish Verification Report

**Phase Goal:** ESC-cancel during drag, ghost grab-point fix, source cell wobble animation, drop-flash ring — all visual/interaction polish for Phase 28's DnD implementation.
**Verified:** 2026-04-19T03:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | dragStore has pointerDownX, pointerDownY, and lastDropId fields that reset via end() | VERIFIED | All 3 in DragState type (lines 48-50) and INITIAL_STATE (lines 68-70); end() spreads INITIAL_STATE |
| 2 | setPointerDown(x, y), setLastDrop(id), clearLastDrop() actions implemented | VERIFIED | Lines 79-81 of dragStore.ts; 37 tests pass |
| 3 | CSS variable --ghost-cap: 200px defined in :root | VERIFIED | src/index.css line 13 |
| 4 | animate-cell-wobble and animate-drop-flash Tailwind utilities registered | VERIFIED | tailwind.config.js theme.extend.animation + keyframes; both keys present |
| 5 | Both animations suppressed in prefers-reduced-motion | VERIFIED | src/index.css lines 129-131: .animate-cell-wobble, .animate-drop-flash { animation: none !important } |
| 6 | ESC-cancel enabled via KeyboardSensor | VERIFIED | CanvasWrapper.tsx line 8 imports KeyboardSensor; line 65 includes keyboardSensor in useSensors |
| 7 | Ghost position uses pointerDownX/Y from dragStore (not activatorEvent) | VERIFIED | DragPreviewPortal.tsx lines 41-43: reads useDragStore.getState().pointerDownX/Y; no activatorEvent in code paths |
| 8 | Ghost renders at 20% opacity with 200px size cap | VERIFIED | DragPreviewPortal.tsx line 81: opacity: 0.2; line 78: className="max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)]" |
| 9 | Drop flash fires after successful drop | VERIFIED | CanvasWrapper.tsx line 128: setLastDrop(toId) called after end() but before setTimeout clearLastDrop; lastDropId populated for 700ms |
| 10 | Pointer coords captured at true pointerDown time before isPanMode guard | VERIFIED | LeafNode.tsx line 499: setPointerDown(e.clientX, e.clientY) before line 500: if (!isPanMode) return |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/dnd/dragStore.ts` | Expanded DragState type with 3 new fields and 3 new actions | VERIFIED | pointerDownX, pointerDownY, lastDropId in type + INITIAL_STATE; setPointerDown, setLastDrop, clearLastDrop implemented |
| `src/dnd/dragStore.test.ts` | Tests for new fields/actions + updated beforeEach reset | VERIFIED | beforeEach resets all 11 fields; describe sections 10 and 11 present; 37 tests pass |
| `tailwind.config.js` | animation + keyframes extensions for cell-wobble and drop-flash | VERIFIED | Both animation and keyframe keys present with correct values |
| `src/index.css` | --ghost-cap CSS variable + @keyframes + prefers-reduced-motion guards | VERIFIED | All three additions present; single prefers-reduced-motion block extended |
| `src/dnd/DragPreviewPortal.tsx` | Updated grabOffsetModifier + dropAnimation config + ghost opacity/size cap | VERIFIED | pointerDownX/Y used in modifier; dropAnimation { duration: 200, easing: 'ease-in' }; opacity 0.2; max-w/max-h classes |
| `src/Grid/CanvasWrapper.tsx` | KeyboardSensor in useSensors + correct handleDragEnd ordering | VERIFIED | KeyboardSensor imported and in useSensors; setLastDrop + clearLastDrop wired in handleDragEnd |
| `src/Grid/LeafNode.tsx` | handlePointerDown captures coords + wobble + flash animation classes | VERIFIED | setPointerDown at line 499; isLastDrop selector at line 311; animate-cell-wobble at line 582; animate-drop-flash at line 583 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/dnd/dragStore.ts` | `src/dnd/DragPreviewPortal.tsx` | useDragStore.getState().pointerDownX/Y in grabOffsetModifier | WIRED | DragPreviewPortal.tsx line 41 reads pointerDownX/Y from dragStore |
| `src/dnd/dragStore.ts` | `src/Grid/CanvasWrapper.tsx` | setLastDrop / clearLastDrop in handleDragEnd | WIRED | CanvasWrapper.tsx lines 128, 131: setLastDrop(toId) then clearLastDrop via setTimeout |
| `src/dnd/dragStore.ts` | `src/Grid/LeafNode.tsx` | useDragStore selector: lastDropId === id | WIRED | LeafNode.tsx line 311: const isLastDrop = useDragStore((s) => s.lastDropId === id) |
| `src/index.css` | `src/dnd/DragPreviewPortal.tsx` | max-w-[var(--ghost-cap)] Tailwind arbitrary value | WIRED | DragPreviewPortal.tsx line 78 uses max-w-[var(--ghost-cap)] max-h-[var(--ghost-cap)] |
| `tailwind.config.js` | `src/Grid/LeafNode.tsx` | animate-cell-wobble and animate-drop-flash classes | WIRED | LeafNode.tsx lines 582-583: both animation classes conditionally applied |
| `src/Grid/LeafNode.tsx` | `src/dnd/dragStore.ts` | setPointerDown in handlePointerDown | WIRED | LeafNode.tsx line 499: useDragStore.getState().setPointerDown(e.clientX, e.clientY) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DragPreviewPortal.tsx` | pointerDownX/Y | useDragStore.getState() in grabOffsetModifier | Yes — set by LeafNode handlePointerDown on actual pointer events | FLOWING |
| `LeafNode.tsx` | isLastDrop | useDragStore reactive selector | Yes — set by CanvasWrapper handleDragEnd on real drop events | FLOWING |
| `CanvasWrapper.tsx` | lastDropId | setLastDrop(toId) where toId = String(over.id) | Yes — dnd-kit over.id from actual dropped-on cell | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| dragStore 37 tests pass | `npx vitest run src/dnd/dragStore.test.ts` | 37 passed, 0 failed | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| Tailwind animation keys registered | `node -e "import('./tailwind.config.js').then(c => console.log(Object.keys(c.default.theme.extend.animation)))"` | [ 'cell-wobble', 'drop-flash' ] | PASS |
| No activatorEvent in DragPreviewPortal code | `grep -c "activatorEvent" DragPreviewPortal.tsx` (code only) | 0 code references (2 comment-only) | PASS |
| KeyboardSensor wired | `grep -c "KeyboardSensor" src/Grid/CanvasWrapper.tsx` | 2 matches (import + useSensor call) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CANCEL-01 | 29-01, 29-03, 29-04 | ESC cancels drag | VERIFIED | KeyboardSensor fires onDragCancel on ESC; handleDragCancel calls end() + cursor reset |
| CANCEL-02 | 29-03 | Snap-back animation 200ms | PARTIALLY VERIFIED | Duration 200ms correct; easing is `ease-in` not `cubic-bezier(0.15, 1.0, 0.3, 1.0)` — intentional deviation documented in 29-UI-SPEC.md D-07 |
| GHOST-03 | 29-03 | Ghost opacity 80% | DEVIATED (intentional) | Implemented as 20% opacity; explicitly overridden by 29-UI-SPEC.md D-05 and ROADMAP.md goal |
| GHOST-04 | 29-03 | Ghost renders at source-cell size, no cap | DEVIATED (intentional) | 200px cap added; explicitly overridden by 29-UI-SPEC.md D-03/D-04 and ROADMAP.md goal |
| DROP-08 | 29-01, 29-03, 29-04 | 700ms drop flash on landed cell | VERIFIED | drop-flash 700ms keyframe; setLastDrop/clearLastDrop wired; isLastDrop selector applies animate-drop-flash class |
| DRAG-05 | 29-02, 29-04 | Drag-start wobble (scale 1.00→1.05→1.02 with back-out spring) | DEVIATED (intentional) | Implemented as ±1.5deg rotation wobble 150ms ease-in-out; documented in 29-UI-SPEC.md D-09 |

**Note on GHOST-03, GHOST-04, and DRAG-05 deviations:** These requirements were explicitly overridden during the Phase 29 research and UI design phases. The ROADMAP.md Phase 29 goal itself states the revised values ("20% ghost opacity, 200px ghost size cap, drag-start wobble"). The 29-UI-SPEC.md documents the rationale. These are intentional design decisions, not implementation failures.

### Deviations from Plan Specification

**handleDragEnd ordering (informational):** Plan 03 specified `setLastDrop(toId)` BEFORE `end()`. The implementation calls `end()` BEFORE `setLastDrop(toId)` (CanvasWrapper.tsx lines 127-128). The code comment at line 124 explicitly explains this reversal: calling `setLastDrop` after `end()` keeps `lastDropId` populated while resetting all other drag state — which is functionally correct and achieves the drop-flash goal. This is not a bug.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments found in modified files. No empty returns, no hardcoded empty data passed to rendering paths.

### Human Verification Required

#### 1. ESC Cancels Active Drag

**Test:** Start dragging a cell by holding the mouse button down. Press ESC.
**Expected:** Ghost snaps back to origin with a visible 200ms animation. No cell is moved. Drag state returns to idle.
**Why human:** KeyboardSensor is wired correctly in code but the behavior of ESC during an active pointer drag requires browser interaction to confirm. dnd-kit's KeyboardSensor behavior during pointer drags is documented but untested here.

#### 2. Ghost Grab-Point Accuracy

**Test:** Click on the edge (not center) of a cell and drag it.
**Expected:** The ghost image appears anchored precisely at the click point — it does not jump to the cell center on drag activation.
**Why human:** The grabOffsetModifier math reads pointerDownX/Y correctly but the visual result depends on DragOverlay positioning behavior in the browser.

#### 3. Ghost Opacity and Size Cap

**Test:** Drag a large cell (e.g., full-width).
**Expected:** Ghost is faint/semi-transparent (20% opacity) and never appears larger than 200px in either dimension.
**Why human:** CSS visual properties — browser rendering must be observed.

#### 4. Source Cell Wobble Animation

**Test:** Activate a drag on any cell.
**Expected:** The cell briefly rotates ±1.5deg (wobble) for 150ms as the drag activates.
**Why human:** CSS animation timing and visual correctness requires live interaction.

#### 5. Drop Flash on Landed Cell

**Test:** Drag one cell and drop it on another cell (different from origin).
**Expected:** The destination cell shows a brief accent-color box-shadow ring that fades out over ~700ms.
**Why human:** Timing and appearance of the flash animation requires a successful drop to trigger.

### Gaps Summary

No automated gaps found. All 10 observable truths are verified, all 7 artifacts pass all levels (exists, substantive, wired), all 6 key links are wired, and all behavioral spot-checks pass.

The 5 human verification items are visual/interactive behaviors that cannot be confirmed programmatically without a running browser. These are standard UX quality checks, not implementation doubts.

The three requirements deviations (GHOST-03 opacity, GHOST-04 cap, DRAG-05 animation style) are documented intentional design decisions made during Phase 29 research — the ROADMAP.md goal itself reflects the revised values.

---

_Verified: 2026-04-19T03:15:00Z_
_Verifier: Claude (gsd-verifier)_
