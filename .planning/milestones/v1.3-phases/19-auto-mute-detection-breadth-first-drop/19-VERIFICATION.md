---
phase: 19-auto-mute-detection-breadth-first-drop
verified: 2026-04-13T23:47:00Z
status: gaps_found
score: 4/6 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A no-audio video cell displays a grayed-out, non-interactive VolumeX icon in the portal ActionBar"
    status: failed
    reason: "ActionBar.tsx has no hasAudioTrack selector and no conditional render. The audio button block (lines 120-144) renders an interactive toggle unconditionally for all video cells regardless of hasAudioTrack value. The disabled/locked branch was never implemented."
    artifacts:
      - path: "src/Grid/ActionBar.tsx"
        issue: "No reference to hasAudioTrack anywhere in the file. Audio button shows interactive Volume2/VolumeX toggle for ALL video cells."
    missing:
      - "Add hasAudioTrack selector: const hasAudioTrack = useGridStore(s => { const leaf = findNode(s.root, nodeId) as LeafNode | null; return leaf && leaf.type === 'leaf' ? (leaf.hasAudioTrack ?? true) : true; });"
      - "Replace the audio button Tooltip block with a hasAudioTrack ? (interactive toggle) : (disabled locked button with aria-label='No audio track') branch"

  - truth: "A no-audio video cell displays a grayed-out, non-interactive audio toggle in the SelectedCellPanel sidebar"
    status: failed
    reason: "Sidebar.tsx SelectedCellPanel has no hasAudioTrack selector and no conditional render. Lines 331-358 render an interactive audio button unconditionally for all video cells. The locked/disabled state was never implemented."
    artifacts:
      - path: "src/Editor/Sidebar.tsx"
        issue: "No reference to hasAudioTrack in SelectedCellPanel. Audio button is always interactive regardless of whether the video has an audio stream."
    missing:
      - "Add hasAudioTrack selector to SelectedCellPanel alongside audioEnabled selector"
      - "Replace playback section audio button with hasAudioTrack ? (interactive toggle) : (disabled button, aria-label='No audio track', cursor-not-allowed) branch"

  - truth: "hasAudioTrack field is part of the canonical LeafNode TypeScript type"
    status: failed
    reason: "src/types/index.ts LeafNode type does not declare hasAudioTrack: boolean. The field is written by createLeaf() in tree.ts, read in swapLeafContent, and mutated in setHasAudioTrack — but is invisible to TypeScript's type checker. Any access via the typed interface would be a type error."
    artifacts:
      - path: "src/types/index.ts"
        issue: "LeafNode type ends at audioEnabled: boolean on line 21. hasAudioTrack field is absent from the exported type definition."
    missing:
      - "Add hasAudioTrack: boolean to LeafNode type in src/types/index.ts"
---

# Phase 19: Auto-Mute Detection & Breadth-First Drop — Verification Report

**Phase Goal:** No-audio video cells show a locked non-interactive mute icon, and multi-file drops fill the grid in breadth-first order
**Verified:** 2026-04-13T23:47:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `detectAudioTrack` returns false for silent video, true for audio-bearing video; `setHasAudioTrack` updates the field without a history snapshot (MUTE-01) | VERIFIED | `detectAudioTrack` in `src/lib/media.ts:38` — correct AudioContext/decodeAudioData/finally-close implementation. `setHasAudioTrack` in `src/store/gridStore.ts:234` — no `pushSnapshot` call. All 659 tests pass including phase19-foundation.test.ts. |
| 2   | ActionBar renders locked, non-interactive VolumeX when `hasAudioTrack === false` on a video cell (MUTE-02) | FAILED | `src/Grid/ActionBar.tsx` contains zero references to `hasAudioTrack`. Lines 120-144 show the interactive audio button rendered unconditionally for all video cells. No disabled/locked branch exists. |
| 3   | SelectedCellPanel (Sidebar) renders the same locked state for no-audio video cells (MUTE-03) | FAILED | `src/Editor/Sidebar.tsx` `SelectedCellPanel` contains zero references to `hasAudioTrack`. Lines 331-358 show the interactive audio button rendered unconditionally. No locked branch exists. |
| 4   | `autoFillCells()` fills cells in BFS level-order (DROP-01) | VERIFIED | `src/lib/media.ts:77` calls `getBFSLeavesWithDepth(currentRoot)` and picks `emptyEntry = bfsLeaves.find(e => e.leaf.mediaId === null)`. Tests in `phase19-foundation.test.ts` and `media.test.ts` pass. |
| 5   | Overflow cells get depth-based splits: even depth horizontal, odd depth vertical (DROP-02) | VERIFIED | `src/lib/media.ts:88`: `const splitDir = lastFilledDepth % 2 === 0 ? 'horizontal' : 'vertical'`. Logic present in all three overflow branches. |
| 6   | Single-file drop onto a specific cell targets that cell directly, not BFS fill (DROP-03) | VERIFIED | `src/Grid/LeafNode.tsx:478-497`: `if (files.length === 1)` branch calls `setMedia(id, mediaId)` where `id` is the specific cell's prop, then `setHasAudioTrack(id, hasAudio)`. Does not call `autoFillCells`. |

**Score:** 4/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/tree.ts` | `getBFSLeavesWithDepth` function | VERIFIED | Lines 80-98: exported BFS traversal returning `{ leaf, depth }[]` |
| `src/lib/media.ts` | `detectAudioTrack` + BFS `autoFillCells` + extended `FillActions` | VERIFIED | Lines 38-51: `detectAudioTrack`. Lines 59-131: `autoFillCells` using `getBFSLeavesWithDepth`. Line 26: `FillActions` includes `setHasAudioTrack`. |
| `src/store/gridStore.ts` | `setHasAudioTrack` store action without snapshot | VERIFIED | Lines 234-241: action present, no `pushSnapshot` call |
| `src/Grid/ActionBar.tsx` | Locked VolumeX for `hasAudioTrack: false` cells | STUB | No `hasAudioTrack` reference. Interactive toggle only. |
| `src/Editor/Sidebar.tsx` | Locked audio toggle for `hasAudioTrack: false` cells | STUB | No `hasAudioTrack` reference in `SelectedCellPanel`. Interactive toggle only. |
| `src/Grid/LeafNode.tsx` | Single-file direct drop targeting specific cell | VERIFIED | Lines 478-497: `files.length === 1` branch sets media directly on `id` |
| `src/types/index.ts` | `hasAudioTrack: boolean` in `LeafNode` type | MISSING | `LeafNode` type ends at `audioEnabled: boolean` on line 21. `hasAudioTrack` absent. |
| `src/test/phase19-foundation.test.ts` | Unit tests for BFS, detectAudioTrack, setHasAudioTrack | VERIFIED | 4 describe blocks, all tests pass |
| `src/test/phase19-integration.test.ts` | Integration tests for DROP-03 | VERIFIED | 4 tests for single-file drop store behavior, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/lib/media.ts` | `src/lib/tree.ts` | `import getBFSLeavesWithDepth` | WIRED | Line 3: `import { getBFSLeavesWithDepth } from './tree'` |
| `src/store/gridStore.ts` | `src/lib/tree.ts` | `updateLeaf` for `setHasAudioTrack` | WIRED | Line 238: `state.root = updateLeaf(current(state.root), nodeId, { hasAudioTrack: hasAudio })` |
| `src/Grid/ActionBar.tsx` | `src/store/gridStore.ts` | `hasAudioTrack` selector | NOT WIRED | No `hasAudioTrack` selector in ActionBar |
| `src/Editor/Sidebar.tsx` | `src/store/gridStore.ts` | `hasAudioTrack` selector | NOT WIRED | No `hasAudioTrack` selector in SelectedCellPanel |
| `src/Grid/LeafNode.tsx` | `src/lib/media.ts` | `detectAudioTrack` for single-file drop | WIRED | Line 494: `await detectAudioTrack(file)` in the `files.length === 1` branch |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npx vitest run` | 58 test files, 653 pass, 2 skipped, 4 todo | PASS |
| `getBFSLeavesWithDepth` unit tests | `npx vitest run src/test/phase19-foundation.test.ts` | 9 tests pass | PASS |
| DROP-03 integration tests | `npx vitest run src/test/phase19-integration.test.ts` | 4 tests pass | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MUTE-01 | 19-01 | `detectAudioTrack` + `setHasAudioTrack` store action | SATISFIED | Both functions implemented and tested |
| MUTE-02 | 19-03 | ActionBar locked VolumeX for no-audio cells | BLOCKED | `hasAudioTrack` not read in ActionBar; no conditional render |
| MUTE-03 | 19-03 | Sidebar locked audio toggle for no-audio cells | BLOCKED | `hasAudioTrack` not read in Sidebar SelectedCellPanel |
| DROP-01 | 19-02 | `autoFillCells` BFS level-order fill | SATISFIED | Uses `getBFSLeavesWithDepth`; tests verify BFS ordering |
| DROP-02 | 19-02 | Depth-based overflow splits | SATISFIED | `lastFilledDepth % 2 === 0 ? 'horizontal' : 'vertical'` present in all overflow branches |
| DROP-03 | 19-02 | Single-file drop targets specific cell | SATISFIED | `files.length === 1` branch in LeafNode.handleDrop calls `setMedia(id, ...)` directly |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/types/index.ts` | 9-21 | `hasAudioTrack` field missing from `LeafNode` type | Blocker | TypeScript sees no `hasAudioTrack` property on `LeafNode`. Code accessing `leaf.hasAudioTrack` in `createLeaf`, `swapLeafContent`, `setHasAudioTrack` bypasses type safety. Prevents type-safe implementation of locked UI. |
| `src/Grid/ActionBar.tsx` | 120-144 | No `hasAudioTrack` branch; always interactive audio button for video cells | Blocker | MUTE-02 not implemented. Silent video cells show interactive volume toggle. |
| `src/Editor/Sidebar.tsx` | 331-358 | No `hasAudioTrack` branch in SelectedCellPanel; always interactive audio button for video cells | Blocker | MUTE-03 not implemented. Silent video cells show interactive audio toggle in sidebar. |
| `src/Grid/LeafNode.tsx` | 482 | Dynamic `import('nanoid')` inside handleDrop on every single-file drop | Warning | Performance: adds microtask delay; defeats static bundle analysis. Advisory only per code review WR-02. |

### Gaps Summary

The phase delivered the foundation correctly: BFS traversal (`getBFSLeavesWithDepth`), audio detection (`detectAudioTrack`), the no-snapshot store action (`setHasAudioTrack`), the `FillActions` extension, the BFS-rewritten `autoFillCells`, and single-file targeted drop in `LeafNode`. Tests are green across all 58 test files.

However, the critical UI deliverable — the locked non-interactive VolumeX state for no-audio video cells — was never implemented in either `ActionBar.tsx` or `Sidebar.tsx`. Both files have zero references to `hasAudioTrack`. This was the core user-visible feature of Plan 03 (MUTE-02 and MUTE-03 requirements).

Additionally, the `LeafNode` type in `src/types/index.ts` is missing the `hasAudioTrack: boolean` field declaration, making the field invisible to TypeScript's type system across the entire codebase. This means any attempt to implement the locked UI would require type assertions unless fixed first.

Three gaps block the phase goal:

1. **`src/types/index.ts`**: Add `hasAudioTrack: boolean` to `LeafNode`
2. **`src/Grid/ActionBar.tsx`**: Add `hasAudioTrack` selector and conditional locked/interactive audio button render
3. **`src/Editor/Sidebar.tsx`**: Add `hasAudioTrack` selector and conditional locked/interactive audio toggle in `SelectedCellPanel`

All three were planned in 19-03-PLAN.md but the commits that implemented 19-02 appear to have reverted or not applied the 19-03 locked UI work, consistent with the known issue AD-01 in the code review.

---

_Verified: 2026-04-13T23:47:00Z_
_Verifier: Claude (gsd-verifier)_
