---
phase: 09-improve-cell-movement-and-swapping
verified: 2026-04-08T04:32:00Z
status: passed
score: 10/10 must-haves verified
human_verification:
  - test: "Drag a cell by its ActionBar handle in the browser and hover over a target cell's top/bottom/left/right/center zones"
    expected: "Thick accent-blue insertion line appears on the matching edge (top/bottom/left/right) or a dimmed swap-icon overlay appears on the center — only one zone highlighted at a time, overlay visually stable as canvas scale changes"
    why_human: "Visual appearance, cursor-tracked hit regions, and canvas-scale-stable rendering cannot be asserted programmatically. jsdom's DragEvent drops clientX/Y and has no layout — test harness uses Object.defineProperty + mocked getBoundingClientRect. Real pointer UX needs a browser."
  - test: "Drop a cell on an edge and observe a single Ctrl+Z reverses the entire move (insert + remove + collapse-upward) in one step"
    expected: "Tree returns to exactly its pre-move shape; selected cell clears because the source leaf's id was discarded (D-06)"
    why_human: "End-to-end UX — atomic undo is verified at the store level (STORE-05/STORE-07) but the user-perceived 'feels instant and undoes as a unit' check is qualitative."
  - test: "Drop an empty (no-media) cell onto an edge of another cell (EC-06)"
    expected: "Drag handle is visible on the empty cell; drag initiates; move succeeds; new wrapper container replaces the target with the empty cell inserted on the chosen edge"
    why_human: "ActionBar gate relaxation is verified by unit tests, but the end-to-end drag of a visibly empty cell is easiest to confirm by eye."
  - test: "Drag a file from the desktop onto a cell and verify the workspace drop ring (Phase 8) does NOT fire during cell-to-cell drags (EC-12)"
    expected: "File drop shows the Phase 8 file-drop ring and imports media; cell drag shows the 5-zone overlay and performs a move. The two do not visually collide."
    why_human: "Phase 8 integration regression — asserted in unit tests but cross-phase visual coexistence benefits from a manual sanity check."
---

# Phase 9: Improve Cell Movement and Swapping — Verification Report

**Phase Goal** (from ROADMAP.md): "Users can MOVE a cell into any of 4 edge positions (split-insert + remove + collapse-upward) in addition to the existing center-drop swap — single atomic undo, full tree-layer correctness for n-ary trees, EC-06 empty-cell moves supported."

**Verified:** 2026-04-08
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `moveLeafToEdge` pure function exists and composes `mapNode` + `removeNode` for the two-pass rewrite | VERIFIED | `src/lib/tree.ts:296-340` — exported function with Pass 1 `mapNode(root, toId, ...)` wrapping target, Pass 2 `removeNode(pass1, fromId)` |
| 2 | 50/50 container insertion with direction derived from edge (`top`/`bottom` → vertical, `left`/`right` → horizontal) and source-first order when `top`/`left` | VERIFIED | `src/lib/tree.ts:320-322, 328-334` — `direction` + `sourceFirst` flags; `sizes: [1, 1]` literal |
| 3 | Source content copy includes `objectPosition` (Pitfall 6 / EC-06 research finding) | VERIFIED | `src/lib/tree.ts:310-318` — all 7 fields (`mediaId`, `fit`, `backgroundColor`, `panX`, `panY`, `panScale`, `objectPosition`) copied into `sourceContent`; MOVE-15 test asserts `'50% 25%'` survives |
| 4 | Fresh `nanoid` ids for new leaf and new wrapper container (D-06) | VERIFIED | `src/lib/tree.ts:325` (`...createLeaf()`), `:330` (`id: nanoid()`); MOVE-16 test asserts ids differ from source/target |
| 5 | `gridStore.moveCell(fromId, toId, edge)` atomic action delegates center→`swapLeafContent`, edges→`moveLeafToEdge`; single `pushSnapshot` per successful call; no snapshot on no-op | VERIFIED | `src/store/gridStore.ts:329-350` — guards before `pushSnapshot`; branch on `edge === 'center'`; structural branch also clears `selectedNodeId` via `useEditorStore.getState().setSelectedNode(null)` |
| 6 | ActionBar drag handle renders unconditionally (EC-06 gate relaxed); `aria-label`/`title` = "Drag to move" | VERIFIED | `src/Grid/ActionBar.tsx:61-73` — `<button draggable …>` rendered outside any `hasMedia &&` wrapper; labels confirmed; other `hasMedia &&` gates (Clear Media at L108) retained |
| 7 | `LeafNode` computes active zone from `getBoundingClientRect` with threshold `max(20, min(w,h)*0.2)`; 5 overlays render at `z-20` with `pointer-events-none` | VERIFIED | `src/Grid/LeafNode.tsx:417-445` — zone math; `:637-675` — 5 conditional overlay divs with edge-line testids and `ArrowLeftRight` center icon; all use `pointer-events-none` |
| 8 | Drop routes through `moveCell`; `swapCells` no longer called from `LeafNode` (routing unified via center delegation) | VERIFIED | `src/Grid/LeafNode.tsx:468` — `moveCell(fromId, id, zoneAtDrop ?? 'center')`; grep `swapCells` in `LeafNode.tsx` = 0 matches |
| 9 | Overlays are canvas-scale stable (`4 / canvasScale` px lines, `32 / canvasScale` center icon) | VERIFIED | `src/Grid/LeafNode.tsx:641, 648, 655, 662, 671` — canvasScale-relative dimensions on all 5 overlays |
| 10 | File-drop path untouched (EC-12 coexistence with Phase 8 workspace ring) | VERIFIED | `src/Grid/LeafNode.tsx:441-443, 472-481` — file drag branch still flips `isDragOver`; file-drop `autoFillCells` call preserved; existing `drop-target-{id}` indicator unchanged |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/tree.ts` | Adds `moveLeafToEdge` + `MoveEdge` type | VERIFIED | Lines 274-340; pure append; no existing function modified |
| `src/store/gridStore.ts` | Adds `moveCell` action | VERIFIED | Type decl L107; impl L329-350; `swapCells` unchanged |
| `src/Grid/LeafNode.tsx` | 5-zone detection, overlay rendering, `moveCell` dispatch | VERIFIED | `activeZone` state L55; zone math L417-445; overlays L637-675 |
| `src/Grid/ActionBar.tsx` | Unconditional drag handle, "Drag to move" labels | VERIFIED | L61-73; gate removed; labels updated |
| `src/test/phase09-p01-cell-move.test.ts` | 18 tests for `moveLeafToEdge` | VERIFIED | File present; 18/18 pass in full suite run |
| `src/test/phase09-p02-store-move.test.ts` | 9 tests for `moveCell` store action | VERIFIED | File present; 9/9 pass |
| `src/test/phase09-p03-leafnode-zones.test.ts` | 12 tests for LeafNode zone detection | VERIFIED | File present; 12/12 pass |
| `src/test/phase05-p02-cell-swap.test.ts` | Regression updated for EC-06 relaxation | VERIFIED | 8/8 pass with inverted gate assertion + "Drag to move" aria-label |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `tree.ts:moveLeafToEdge` | `tree.ts:mapNode` | Pass 1 target wrap | WIRED | Line 328 `mapNode(root, toId, ...)` |
| `tree.ts:moveLeafToEdge` | `tree.ts:removeNode` | Pass 2 source removal | WIRED | Line 337 `removeNode(pass1, fromId)` |
| `gridStore.moveCell` | `tree.ts:moveLeafToEdge` | edge ≠ 'center' branch | WIRED | Line 344 |
| `gridStore.moveCell` | `tree.ts:swapLeafContent` | edge === 'center' branch | WIRED | Line 341 |
| `gridStore.moveCell` | `gridStore.pushSnapshot` | single atomic snapshot per successful call | WIRED | Line 338, gated by no-op guards L332-336 |
| `gridStore.moveCell` | `editorStore.setSelectedNode` | selection clearing on structural move (D-06) | WIRED | Line 348 `useEditorStore.getState().setSelectedNode(null)` |
| `LeafNode.handleDragOver` | `activeZone` state | getBoundingClientRect-based zone detection | WIRED | Lines 424-438 |
| `LeafNode.handleDrop` | `gridStore.moveCell` | reads `activeZone` at drop time | WIRED | Line 468 `moveCell(fromId, id, zoneAtDrop ?? 'center')` |
| `LeafNode overlays` | `editorStore.canvasScale` | scale-stable pixel math | WIRED | Line 46 selector; used in 5 overlay style props |
| `ActionBar drag handle` | `dataTransfer.setData('text/cell-id', nodeId)` | drag source unchanged, gate relaxed | WIRED | `ActionBar.tsx:63-66` |

All 10 key links verified.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `LeafNode.tsx` activeZone overlays | `activeZone` | `handleDragOver` writes via `setActiveZone(zone)` after real `getBoundingClientRect` math on cursor coords | Yes — populated from user cursor position during drag | FLOWING |
| `moveCell` action | `state.root` | `moveLeafToEdge(current(state.root), ...)` returns real new tree | Yes — pure function returns structurally new tree | FLOWING |
| `moveLeafToEdge` result | returned `GridNode` | Two-pass composition of `mapNode` (real rewrite) + `removeNode` (real collapse) | Yes — both helpers verified by prior phases | FLOWING |

All wired artifacts have real data paths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full vitest suite runs green on main | `npm test -- --run` | 43 files, 489 passed / 2 skipped / 0 failed in 7.45s | PASS |
| TypeScript typecheck clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Phase 9 test files present | `ls src/test/phase09-*.test.*` | Lists p01/p02/p03 test files | PASS |
| `moveLeafToEdge` exported | grep in `src/lib/tree.ts` | L277 type export, L296 function export | PASS |
| `moveCell` wired via both branches | grep in `src/store/gridStore.ts` | L341 swapLeafContent, L344 moveLeafToEdge | PASS |
| `swapCells` removed from LeafNode | grep `swapCells` in `src/Grid/LeafNode.tsx` | 0 matches (all routing via moveCell) | PASS |
| ActionBar drag handle outside hasMedia gate | inspect `ActionBar.tsx:61-73` | Button rendered directly, no `{hasMedia && (` wrapper | PASS |

### Requirements Coverage

Phase has no explicit requirement IDs (`requirements: []` in all four plans). Verification is goal-backward against D-01..D-09 and EC-01..EC-18 from 09-CONTEXT.md.

| Decision / Edge Case | Status | Evidence |
|---|---|---|
| D-01 (5 zones with 20% band + min 20px) | SATISFIED | `LeafNode.tsx:431` threshold `Math.max(20, Math.min(w,h)*0.2)` |
| D-02 (insertion-line visual, #3b82f6, canvasScale-stable) | SATISFIED | `LeafNode.tsx:641-671` — 4/canvasScale px, #3b82f6, swap icon on center |
| D-03 (50/50 split) | SATISFIED | `tree.ts:332` — `sizes: [1, 1]` |
| D-04 (atomic moveCell action, center delegates) | SATISFIED | `gridStore.ts:329-350` |
| D-05 (pure two-pass, composition) | SATISFIED | `tree.ts:296-340` |
| D-06 (fresh nanoid, selectedNodeId cleared) | SATISFIED | `tree.ts:325, 330` + `gridStore.ts:348` |
| D-07/D-08 (edge cases enumerated + tests) | SATISFIED | EC-01..EC-18 mapped to MOVE-01..MOVE-18 in phase09-p01 test; STORE-01..09 cover EC-05/06/09/10/18 |
| D-09 (direct on main, no worktree) | SATISFIED | Commits `6e30441`, `112244a`, `f03ad5b`, `e2097e8`, `e40e642`, `81a6daf`, `4ff520c`, `d9fda86` on main |
| EC-01..EC-05 (container/collapse cases) | SATISFIED | MOVE-02..MOVE-06 cover via unit tests |
| EC-06 (empty cell movable) | SATISFIED | ActionBar gate relaxed; STORE-09 asserts `mediaId: null` move succeeds |
| EC-08 (MIN_CELL_WEIGHT) | SATISFIED | MOVE-17 test asserts sizes >= 0.1 |
| EC-09 (history cap 50) | SATISFIED | STORE-08 — 55 calls → len 50 |
| EC-10 (undo round-trip) | SATISFIED | STORE-05 JSON round-trip |
| EC-11 (dragEnter/leave pattern) | SATISFIED | `handleDragLeave` clears `activeZone`; ZONE-07 test |
| EC-12 (file drop coexistence) | SATISFIED | ZONE-10 test asserts `Files` drag type does NOT render 5-zone overlays |
| EC-13..EC-18 | SATISFIED | Covered by MOVE-01, MOVE-15..18 and research-mapped tests |
| STORE-06 (redo round-trip) | PARTIAL — documented | Plan 02 SUMMARY Rule-1 deviation: pre-existing pushSnapshot model stores pre-mutation state, so strict redo round-trip impossible without store rewrite. Weakened assertion documented. Not a regression; shared by every mutating action. Follow-up tracked in SUMMARY. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None | — | — | — | — |

Scanned `src/lib/tree.ts`, `src/store/gridStore.ts`, `src/Grid/LeafNode.tsx`, `src/Grid/ActionBar.tsx` and the three new test files. No TODO/FIXME/placeholder/stub patterns found in the phase-9 additions. Existing `hasMedia` gates on other ActionBar buttons are intentional and not regressions.

### Human Verification Required

See YAML `human_verification` above — 4 items:

1. **Visual zone overlay feedback under real drag** — insertion line thickness, color, scale stability
2. **Single-Ctrl+Z atomic undo feel**
3. **Empty-cell drag end-to-end UX (EC-06)**
4. **Phase 8 workspace drop ring non-interference (EC-12)**

Automated tests cover the logic; these items confirm the user-perceived experience matches the design.

### Gaps Summary

No gaps blocking goal achievement.

All 10 observable truths verified, all 8 expected artifacts exist and are wired, all 10 key links verified. Full test suite (43 files / 489 tests) passes green with no regressions. TypeScript typecheck clean. ActionBar, LeafNode, gridStore, and tree.ts all reflect the decisions in 09-CONTEXT.md. The STORE-06 redo deviation is a pre-existing, documented, phase-wide limitation (not a Phase 9 regression) and was explicitly called out in the Plan 02 summary with a rationale for deferring.

The phase goal — "Users can MOVE a cell into any of 4 edge positions (split-insert + remove + collapse-upward) in addition to the existing center-drop swap — single atomic undo, full tree-layer correctness for n-ary trees, EC-06 empty-cell moves supported" — is achieved at the code level. Remaining items in human verification are interaction-quality checks, not correctness gaps.

---

*Verified: 2026-04-08T04:32:00Z*
*Verifier: Claude (gsd-verifier)*
