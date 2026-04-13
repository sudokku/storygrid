---
phase: 19
status: warning
findings: 6
reviewed_files: 11
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 19 introduces BFS leaf traversal, audio detection via `AudioContext.decodeAudioData`, a no-snapshot `setHasAudioTrack` store action, a rewritten `autoFillCells` using BFS + depth-based overflow splits, and single-file direct drop targeting (DROP-03). The audio detection implementation is correct and the `ctx.close()` call in `finally` handles all error paths properly. The BFS traversal logic is clean. However, three correctness issues and three advisory items require attention before the phase can be called stable.

The most significant issue is that `hasAudioTrack` is absent from the canonical `LeafNode` type in `src/types/index.ts`, making the entire Phase 19 feature invisible to TypeScript's type checker. The second correctness issue is that `moveLeafToEdge` (the structural drag-to-edge primitive) silently drops both `audioEnabled` and `hasAudioTrack` when moving content — a pre-existing field-copy gap made worse by Phase 19 adding two new fields that were not back-filled into the copy set. The third is a wrong import in `media.test.ts`.

---

## Warnings

### WR-01: `hasAudioTrack` missing from the `LeafNode` type definition

**File:** `src/types/index.ts:9`
**Issue:** `LeafNode` does not declare `hasAudioTrack: boolean`. The field is written in `createLeaf()` (tree.ts:120), read in `swapLeafContent` (tree.ts:298/309), and mutated in `setHasAudioTrack` (gridStore.ts:239), but TypeScript sees none of this. Any code that accesses `leaf.hasAudioTrack` via the typed `LeafNode` interface will produce a TypeScript error (property does not exist), which means the locked-icon UI logic referenced in the phase brief cannot be implemented without a type assertion or `any` cast. This also means `tsc --noEmit` likely fails across the codebase.

**Fix:**
```typescript
// src/types/index.ts — add to LeafNode
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  panX: number;
  panY: number;
  panScale: number;
  effects: EffectSettings;
  audioEnabled: boolean;
  hasAudioTrack: boolean;   // true = video has an audio stream; false = confirmed silent
};
```

---

### WR-02: `moveLeafToEdge` drops `audioEnabled` and `hasAudioTrack` during structural moves

**File:** `src/lib/tree.ts:354`
**Issue:** The `sourceContent` object captured for the structural edge move includes `mediaId`, `fit`, `backgroundColor`, `panX`, `panY`, `panScale`, `objectPosition`, and `effects` — but not `audioEnabled` or `hasAudioTrack`. When a user drags a muted video cell to an edge position, the moved cell silently resets to `audioEnabled: true` and `hasAudioTrack: false`. `swapLeafContent` (same file, lines 289-309) correctly copies both fields for center-drop swaps, so the omission is inconsistent. Note that `audioEnabled` was already missing before Phase 19; `hasAudioTrack` is the new Phase 19 regression.

**Fix:**
```typescript
// src/lib/tree.ts — moveLeafToEdge, sourceContent block (line ~354)
const sourceContent: Partial<LeafNode> = {
  mediaId: sourceNode.mediaId,
  fit: sourceNode.fit,
  backgroundColor: sourceNode.backgroundColor,
  panX: sourceNode.panX,
  panY: sourceNode.panY,
  panScale: sourceNode.panScale,
  objectPosition: sourceNode.objectPosition,
  effects: { ...sourceNode.effects },
  audioEnabled: sourceNode.audioEnabled,       // add
  hasAudioTrack: sourceNode.hasAudioTrack,     // add
};
```

---

### WR-03: `media.test.ts` imports `GridNode` from `../lib/media`, which does not export it

**File:** `src/test/media.test.ts:11`
**Issue:** `import type { GridNode, FillActions } from '../lib/media'` — `FillActions` is correctly re-exported from `media.ts`, but `GridNode` is not; it lives in `src/types/index.ts`. Because this is an `import type`, the test runs at runtime (the type is erased), but `tsc --noEmit` will report a "Module '...media' has no exported member 'GridNode'" error. This makes the test unreliable as a CI type-check gate.

**Fix:**
```typescript
// src/test/media.test.ts — line 11
import type { FillActions } from '../lib/media';
import type { GridNode } from '../types';
```

---

## Advisory

### AD-01: Locked VolumeX UI for `hasAudioTrack: false` not implemented in ActionBar or Sidebar

**File:** `src/Grid/ActionBar.tsx:120`, `src/Editor/Sidebar.tsx:341`
**Issue:** The phase brief states "Added locked VolumeX icon in ActionBar and Sidebar for `hasAudioTrack: false` video cells." Neither file references `hasAudioTrack`. The ActionBar renders the audio toggle unconditionally for video cells (lines 120-143) and the Sidebar does the same (lines 341-357). A video detected as silent (`hasAudioTrack: false`) presents an interactive volume button that does nothing useful — the user can toggle `audioEnabled` on a cell with no audio stream, which is confusing. The locked/disabled state described in the plan was not shipped.

**Fix:** Read `hasAudioTrack` from the store and conditionally disable / lock the audio toggle:
```tsx
// ActionBar.tsx — add alongside audioEnabled selector (line ~42)
const hasAudioTrack = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf?.hasAudioTrack ?? false;
});

// Replace the Tooltip block for the audio button:
{mediaType === 'video' && (
  hasAudioTrack ? (
    <Tooltip>
      <TooltipTrigger render={
        <button
          data-testid="audio-button"
          className={`${btnClass} ${!audioEnabled ? 'hover:bg-red-500/20' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleAudioEnabled(nodeId); }}
          aria-label={audioEnabled ? 'Mute cell audio' : 'Unmute cell audio'}
        />
      }>
        {audioEnabled
          ? <Volume2 size={ICON_SIZE} className="text-white" />
          : <VolumeX size={ICON_SIZE} className="text-red-500" />
        }
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {audioEnabled ? 'Mute cell audio' : 'Unmute cell audio'}
      </TooltipContent>
    </Tooltip>
  ) : (
    <Tooltip>
      <TooltipTrigger render={
        <button
          data-testid="audio-button"
          className={`${btnClass} opacity-40 cursor-not-allowed`}
          disabled
          aria-label="No audio track"
        />
      }>
        <VolumeX size={ICON_SIZE} className="text-neutral-500" />
      </TooltipTrigger>
      <TooltipContent side="bottom">No audio track</TooltipContent>
    </Tooltip>
  )
)}
```

---

### AD-02: Unnecessary dynamic `import('nanoid')` on every single-file drop in LeafNode

**File:** `src/Grid/LeafNode.tsx:483`
**Issue:** `handleDrop` uses `const { nanoid } = await import('nanoid')` for single-file drops. `nanoid` is already statically imported in `media.ts` (line 1) which is already imported by this module. The dynamic import adds a microtask delay on every drop and defeats static bundle analysis. This is not a bug but it is inconsistent with the rest of the codebase.

**Fix:**
```tsx
// src/Grid/LeafNode.tsx — add to existing imports at top of file
import { nanoid } from 'nanoid';

// src/Grid/LeafNode.tsx — handleDrop, line ~483, remove the dynamic import
// Before:
const { nanoid } = await import('nanoid');
// After: (removed; use static nanoid import)
const mediaId = nanoid();
```

---

### AD-03: Test fixtures for ActionBar and Sidebar omit `hasAudioTrack` field

**File:** `src/test/action-bar.test.tsx:19`, `src/test/sidebar.test.tsx:10`
**Issue:** The `makeLeaf()` helper in action-bar.test.tsx and all `GridNode` literals in sidebar.test.tsx construct leaf nodes without `hasAudioTrack`. Once WR-01 is fixed and the field is added to the type, these fixtures will produce TypeScript errors (missing required property). There are no test cases for the locked audio state (AD-01 above), which is a coverage gap.

**Fix:** Add `hasAudioTrack: false` to all leaf fixture definitions in both test files. Add test cases for `hasAudioTrack: false` that verify the audio button is disabled/locked.

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
