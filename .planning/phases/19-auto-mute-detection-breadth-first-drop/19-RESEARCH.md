# Phase 19: Auto-Mute Detection & Breadth-First Drop - Research

**Researched:** 2026-04-13
**Domain:** Browser audio detection (AudioContext), BFS tree traversal, React UI locked-state rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `detectAudioTrack(file: File): Promise<boolean>` added as standalone exported utility in `src/lib/media.ts`. Uses `AudioContext.decodeAudioData()`. Returns `true` if `audioBuffer.numberOfChannels > 0`, `false` otherwise.

**D-02:** `detectAudioTrack()` called from two upload points:
- Inside `autoFillCells()` after each media assignment.
- Inside `LeafNode`'s `handleDrop` for single-file direct drops.

**D-03:** `FillActions` interface extended with `setHasAudioTrack: (nodeId: string, hasAudio: boolean) => void`. `autoFillCells()` calls `actions.setHasAudioTrack(targetNodeId, result)` after detection. `LeafNode`'s drop handler calls the store action directly.

**D-04:** `setHasAudioTrack(nodeId, value)` store action added to `gridStore.ts` (was deferred from Phase 17 D-04).

**D-05:** On any `decodeAudioData()` failure: assume `hasAudioTrack = true` (fail open). Never rejects.

**D-06:** Detection function catches all errors and resolves — callers do not need try/catch.

**D-07:** For no-audio video cells (`hasAudioTrack === false`), ActionBar renders a disabled, non-interactive VolumeX button with `text-gray-400 opacity-40`, `cursor-not-allowed`, `disabled` attribute (or `pointer-events-none`), tooltip `"No audio track"`, no `onClick`.

**D-08:** For user-muted cells (`audioEnabled === false`, `hasAudioTrack === true`), existing appearance unchanged: red `VolumeX`, `hover:bg-red-500/20`, tooltip `"Unmute cell audio"`.

**D-09:** Locked icon shows only when `mediaType === 'video' && !hasAudioTrack`.

**D-10:** Same visual treatment in SelectedCellPanel sidebar: disabled gray VolumeX with `"No audio track"` label/tooltip.

**D-11:** Sidebar reads `hasAudioTrack` from store for selected node via selector alongside `audioEnabled`.

**D-12:** `getBFSLeavesWithDepth(root: GridNode): Array<{ leaf: LeafNode; depth: number }>` added to `src/lib/tree.ts`. Uses BFS queue (array + shift). Root = depth 0.

**D-13:** `autoFillCells()` replaces `getAllLeaves(currentRoot)` with `getBFSLeavesWithDepth(currentRoot)`.

**D-14:** Overflow split direction: `depth % 2 === 0 → 'horizontal'`, `depth % 2 === 1 → 'vertical'`.

**D-15:** BFS queue entry carries depth, so split direction is computable without additional store queries.

### Claude's Discretion

- Whether to use temporary `AudioContext` or `OfflineAudioContext` for decode (reuse `videoExport.ts` `AudioContext` + `decodeAudioData` pattern is natural).
- Whether to use `file.arrayBuffer()` directly (simpler — avoids fetch round-trip) vs `fetch(blobUrl)`.
- Queue implementation for BFS (array + shift; no optimization needed for small trees).
- Exact Tailwind class for locked button container (`pointer-events-none` on wrapper vs `disabled` on `<button>` element — either satisfies "non-interactive").

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MUTE-01 | Detect absence of audio at upload time via `AudioContext.decodeAudioData()` | `detectAudioTrack()` utility pattern confirmed; `file.arrayBuffer()` + `decodeAudioData` is the canonical path |
| MUTE-02 | No-audio video cell shows grayed-out, non-interactive VolumeX in ActionBar portal | Existing ActionBar audio button block at lines 120–144 is the modification target; `disabled` attribute + Tailwind classes |
| MUTE-03 | No-audio video cell shows grayed-out, non-interactive audio toggle in SelectedCellPanel | Lines 332–351 of Sidebar.tsx are the modification target; same locked-state Tailwind pattern |
| DROP-01 | Multi-file drops fill cells level-by-level (breadth-first) | `getBFSLeavesWithDepth()` helper drives `autoFillCells()` rewrite |
| DROP-02 | Overflow splits alternate H/V by node depth | Depth carried in BFS entry; `depth % 2` determines direction |
| DROP-03 | Single-file drop onto specific leaf continues to target that cell exactly | `LeafNode.handleDrop` file-drop path is unchanged for single-file targeted drops |
</phase_requirements>

---

## Summary

Phase 19 delivers two independent features in a single implementation pass. The first feature (`detectAudioTrack` + locked UI) introduces a new browser API call at upload time and two UI conditional rendering changes. The second feature (BFS fill order) is a pure algorithmic rewrite of `autoFillCells()` — the function signature stays the same but the traversal order and overflow split logic change.

The codebase is in an excellent state for this work. `hasAudioTrack` is already on `LeafNode` (added in Phase 17), `createLeaf()` already initializes it to `false`, and `videoExport.ts` already contains an identical decode pattern at lines 300–322 that serves as the canonical reference. The BFS helper has a clean insertion point in `tree.ts` alongside the existing DFS `getAllLeaves`.

The key risk is that `decodeAudioData()` is not available in jsdom (the test environment). All tests for `detectAudioTrack` must mock `AudioContext` at the global level. The existing `media.test.ts` already mocks `fileToBase64` using `vi.spyOn`, establishing the pattern for mocking module exports.

**Primary recommendation:** Implement in three waves — (1) `setHasAudioTrack` store action + `getBFSLeavesWithDepth` tree helper, (2) `detectAudioTrack` utility + `autoFillCells` BFS rewrite, (3) locked UI in ActionBar and Sidebar.

---

## Standard Stack

### Core (all pre-installed; no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Browser `AudioContext` | Web API | Decode audio from File to detect channels | Browser-native; already used in `videoExport.ts:300–322` |
| Vitest | ^2.1.9 | Unit + component testing | Project standard; ESM-native; used by all existing tests |
| React Testing Library | ^16.3.2 | Component render testing | Project standard; existing `action-bar.test.tsx` uses it |

### No New Packages Required

All v1.3 features use existing browser APIs per the requirements out-of-scope table. `file.arrayBuffer()` is available in all target browsers (Chrome 90+, Firefox 90+, Safari 15+). [VERIFIED: MDN — File.arrayBuffer() — Chrome 76+, Firefox 69+, Safari 14.1+]

---

## Architecture Patterns

### Recommended File Changes (in dependency order)

```
src/
├── types/index.ts            # no change needed — hasAudioTrack already present
├── lib/tree.ts               # add getBFSLeavesWithDepth()
├── lib/media.ts              # add detectAudioTrack(), extend FillActions, rewrite autoFillCells()
├── store/gridStore.ts        # add setHasAudioTrack action
├── Grid/ActionBar.tsx        # locked state rendering
└── Editor/Sidebar.tsx        # locked state in SelectedCellPanel
```

### Pattern 1: detectAudioTrack() Implementation

**What:** Standalone utility that reads a File's audio content and returns `true` if audio channels are present.

**Key insight from codebase:** `videoExport.ts:300–322` does exactly this for blob URLs. For a File at upload time, `file.arrayBuffer()` is simpler and avoids creating a blob URL.

```typescript
// Source: inferred from src/lib/videoExport.ts:300–322 [VERIFIED: existing codebase]
export async function detectAudioTrack(file: File): Promise<boolean> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      return audioBuffer.numberOfChannels > 0;
    } finally {
      await ctx.close();
    }
  } catch {
    // D-05: fail open — assume audio present on any error
    return true;
  }
}
```

**Critical: call `ctx.close()` after decode.** `videoExport.ts` already uses this pattern with `try/finally`. Not closing creates a resource leak (browsers warn about unclosed AudioContexts).

**Critical: the `arrayBuffer` passed to `decodeAudioData()` is detached after the call.** Since `file.arrayBuffer()` is called directly (not fetched), the array buffer is consumed in one pass — this is fine.

### Pattern 2: getBFSLeavesWithDepth() Implementation

**What:** BFS traversal of the GridNode tree, collecting only leaf nodes with their depth.

**Why array+shift is correct here:** Trees in StoryGrid max out at ~20 cells. `array.shift()` on a short array is O(n) but n is negligibly small. No deque or linked list needed.

```typescript
// Source: derived from existing getAllLeaves() in src/lib/tree.ts:71–74 [VERIFIED: existing codebase]
export function getBFSLeavesWithDepth(
  root: GridNode,
): Array<{ leaf: LeafNode; depth: number }> {
  const result: Array<{ leaf: LeafNode; depth: number }> = [];
  const queue: Array<{ node: GridNode; depth: number }> = [{ node: root, depth: 0 }];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    if (node.type === 'leaf') {
      result.push({ leaf: node, depth });
    } else {
      for (const child of node.children) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }
  }

  return result;
}
```

**Depth convention:** Root node = depth 0. If the root is itself a container, its children are at depth 1. If the root is a single leaf (edge case), it is returned at depth 0. [ASSUMED — no explicit spec, but consistent with D-14: "even depth splits horizontal" and the standard BFS definition of depth]

### Pattern 3: autoFillCells() BFS Rewrite

**What:** Replace `getAllLeaves(currentRoot)` with `getBFSLeavesWithDepth(currentRoot)`. The overflow split direction changes from always `'horizontal'` to `depth % 2 === 0 ? 'horizontal' : 'vertical'`.

The `FillActions` interface gains `setHasAudioTrack`. After `actions.setMedia(targetNodeId, mediaId)`, call `detectAudioTrack(file)` for video files and invoke `actions.setHasAudioTrack(targetNodeId, result)`.

**Important sequencing constraint:** `detectAudioTrack()` must be called only for video files (`file.type.startsWith('video/')`). For image files, call `actions.setHasAudioTrack(targetNodeId, false)` — images have no audio track. This matches the `createLeaf()` default of `false`. [ASSUMED — images trivially have no audio; the locked icon is only shown for `mediaType === 'video'`, so the value for image nodes is never displayed. Setting `false` is conservative and correct.]

**Overflow split — tracking depth:** When overflowing, the `lastFilledDepth` must be tracked alongside `lastFilledNodeId`. The BFS entry already carries depth, so record it at fill time.

```typescript
// Revised autoFillCells skeleton — Source: src/lib/media.ts [VERIFIED: existing codebase]
let lastFilledNodeId: string | null = null;
let lastFilledDepth = 0;

for (const file of mediaFiles) {
  const currentRoot = actions.getRoot();
  const bfsLeaves = getBFSLeavesWithDepth(currentRoot);
  const emptyEntry = bfsLeaves.find(e => e.leaf.mediaId === null);

  let targetNodeId: string;
  let targetDepth: number;

  if (emptyEntry) {
    targetNodeId = emptyEntry.leaf.id;
    targetDepth = emptyEntry.depth;
  } else if (lastFilledNodeId !== null) {
    // Overflow: split direction based on depth of the node being split
    const splitDir = lastFilledDepth % 2 === 0 ? 'horizontal' : 'vertical';
    actions.split(lastFilledNodeId, splitDir);
    const freshLeaves = getBFSLeavesWithDepth(actions.getRoot());
    const newEmpty = freshLeaves.find(e => e.leaf.mediaId === null);
    if (!newEmpty) continue;
    targetNodeId = newEmpty.leaf.id;
    targetDepth = newEmpty.depth;
  } else {
    // Edge case: single filled root leaf
    const anyEntry = bfsLeaves[0];
    if (!anyEntry) continue;
    const splitDir = anyEntry.depth % 2 === 0 ? 'horizontal' : 'vertical';
    actions.split(anyEntry.leaf.id, splitDir);
    const freshLeaves = getBFSLeavesWithDepth(actions.getRoot());
    const newEmpty = freshLeaves.find(e => e.leaf.mediaId === null);
    if (!newEmpty) continue;
    targetNodeId = newEmpty.leaf.id;
    targetDepth = newEmpty.depth;
  }

  // ... media registration (unchanged from current) ...
  actions.setMedia(targetNodeId, mediaId);

  // Audio detection — video only
  const hasAudio = file.type.startsWith('video/')
    ? await detectAudioTrack(file)
    : false;
  actions.setHasAudioTrack(targetNodeId, hasAudio);

  lastFilledNodeId = targetNodeId;
  lastFilledDepth = targetDepth;
}
```

### Pattern 4: setHasAudioTrack Store Action

**What:** Follows the exact same pattern as `toggleAudioEnabled` (line 221 of gridStore.ts). Uses `updateLeaf` with Immer draft. Does NOT push a snapshot (same rationale as `setMedia` — it is called as part of the upload flow which has its own snapshot context).

Wait — looking at `setMedia` at line 209, it DOES push a snapshot. The question is whether `setHasAudioTrack` should also snapshot. Given that it is called immediately after `setMedia` in the same async flow, pushing a separate snapshot would create spurious undo entries. [ASSUMED — the discussion context D-03 says the action is added but does not specify snapshotting behavior explicitly. Recommendation: do NOT push a snapshot, so the audio detection result is bundled with the media assignment rather than becoming a separate undo step. Callers can rely on the `setMedia` snapshot for undo behavior.]

```typescript
// Source: gridStore.ts:221–228 pattern [VERIFIED: existing codebase]
setHasAudioTrack: (nodeId: string, hasAudio: boolean) =>
  set(state => {
    const leaf = findNode(current(state.root), nodeId);
    if (!leaf || leaf.type !== 'leaf') return;
    state.root = updateLeaf(current(state.root), nodeId, {
      hasAudioTrack: hasAudio,
    });
  }),
```

**No `pushSnapshot` call** — this matches the spirit of `setEffects` (no-snapshot for ancillary state writes). If audio detection fires after `setMedia` has already pushed a snapshot, adding another snapshot here would pollute undo history.

### Pattern 5: ActionBar Locked State Rendering

**What:** The existing audio button block (`mediaType === 'video'` guard, lines 120–144 of ActionBar.tsx) must be extended to branch on `hasAudioTrack`.

**New selector needed:**
```typescript
// Source: ActionBar.tsx:42–45 pattern [VERIFIED: existing codebase]
const hasAudioTrack = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf && leaf.type === 'leaf' ? (leaf.hasAudioTrack ?? true) : true;
});
```

**Rendering logic:**
- `mediaType === 'video' && !hasAudioTrack` → render locked, disabled VolumeX button
- `mediaType === 'video' && hasAudioTrack` → render existing interactive toggle (unchanged)

**Locked button Tailwind:** `text-gray-400 opacity-40 cursor-not-allowed` on icon; `disabled` attribute on `<button>`. Using `disabled` is semantically correct (prevents keyboard focus, removes click events natively). The `pointer-events-none` alternative on a wrapper also works but is less accessible. [ASSUMED — D-07 says "either satisfies"; `disabled` attribute is recommended for semantic HTML]

### Pattern 6: Sidebar Locked State Rendering

**What:** Lines 216–219 and 332–351 of Sidebar.tsx are the modification targets.

**New selector** (alongside existing `audioEnabled` selector at line 216):
```typescript
// Source: Sidebar.tsx:216–219 pattern [VERIFIED: existing codebase]
const hasAudioTrack = useGridStore(s => {
  const n = findNode(s.root, nodeId) as LeafNode | null;
  return n && n.type === 'leaf' ? (n.hasAudioTrack ?? true) : true;
});
```

**Rendering logic** (within the `mediaType === 'video'` block at line 324):
- When `!hasAudioTrack`: render disabled gray VolumeX with label `"No audio track"` and `cursor-not-allowed`
- When `hasAudioTrack`: existing interactive toggle (unchanged)

### Anti-Patterns to Avoid

- **Calling `detectAudioTrack()` for image files:** Images have no audio. Skip detection entirely and call `setHasAudioTrack(nodeId, false)` directly.
- **Creating AudioContext without closing it:** Always `ctx.close()` in a `finally` block. The browser emits warnings for unclosed contexts after a few are created.
- **Passing a detached ArrayBuffer to decodeAudioData twice:** `file.arrayBuffer()` can be called again if needed (File is not consumed by the first call), but the returned ArrayBuffer is transferred/detached after `decodeAudioData`. Do not reuse the ArrayBuffer reference.
- **Using `getAllLeaves` in `autoFillCells` after the rewrite:** Keep `getAllLeaves` intact (other consumers exist — `gridStore.ts:408`, `applyTemplate`). Only `autoFillCells` switches to BFS.
- **Snapshotting inside `setHasAudioTrack`:** Creates double-snapshot per upload (once for `setMedia`, once for audio detection). Makes undo granular in a confusing way.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio stream detection | Manual MP4/WebM header parser | `AudioContext.decodeAudioData()` | Browser handles codec variants; works for all formats in target browsers |
| BFS queue | Linked list or circular buffer | `Array.shift()` on small array | Trees never exceed ~20 cells; O(n) shift is negligible |
| Disabled button semantics | CSS-only `pointer-events-none` wrapper | HTML `disabled` attribute on `<button>` | `disabled` also prevents keyboard focus and AT announcements |

**Key insight:** The project already contains the `decodeAudioData` pattern in `videoExport.ts:300–322`. Phase 19 is lifting that logic into a reusable utility — not inventing a new approach.

---

## Common Pitfalls

### Pitfall 1: AudioContext Not Available in jsdom

**What goes wrong:** Tests that import or call `detectAudioTrack()` throw `ReferenceError: AudioContext is not defined` because jsdom does not implement Web Audio API.

**Why it happens:** jsdom stubs many Web APIs but not `AudioContext`. `detectAudioTrack` in `media.ts` references it directly.

**How to avoid:** In test files, mock `AudioContext` at the global level before importing the module:
```typescript
// In test setup or at the top of the test file
global.AudioContext = vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn().mockResolvedValue({ numberOfChannels: 2 }),
  close: vi.fn().mockResolvedValue(undefined),
}));
```
Or mock `detectAudioTrack` at the module level in tests that only need to verify `autoFillCells` behavior (same pattern as the existing `fileToBase64` mock in `media.test.ts`).

**Warning signs:** `ReferenceError: AudioContext is not defined` in test output.

### Pitfall 2: decodeAudioData Rejects for No-Audio Videos

**What goes wrong:** Some browsers (especially Safari) throw a `DOMException` when `decodeAudioData` is called on a video with no audio track, rather than returning an `AudioBuffer` with 0 channels. Other browsers return `numberOfChannels === 0`.

**Why it happens:** The behavior is not standardized for video-only files. [VERIFIED: referenced in videoExport.ts comment "Pitfall 3: skip cells without audio channels" at line 315]

**How to avoid:** The `try/catch` that catches all errors and returns `true` (fail-open per D-05) handles both cases: the rejection path returns `true` (assume audio), and the `numberOfChannels === 0` path returns `false`. Both branches are needed.

**Warning signs:** Silent videos incorrectly showing the interactive toggle in Safari.

### Pitfall 3: BFS Depth Off-By-One in Overflow Split

**What goes wrong:** When `lastFilledDepth` is 0 (the root is a single leaf, split happens at depth 0), the split direction is `horizontal`. The new sibling created is also at depth 1 (inside the new container), not depth 0. If the next overflow uses `lastFilledDepth` without re-reading the actual depth of the newly filled cell, direction alternation breaks.

**Why it happens:** The `lastFilledDepth` must be updated to the depth of the NEWLY FILLED cell, not the depth of the cell that was split.

**How to avoid:** After each fill, set `lastFilledDepth = targetDepth` where `targetDepth` is read from the fresh BFS result (the `newEmpty.depth` after overflow split). The skeleton code above already does this correctly.

**Warning signs:** Test for 5-file drop: cell 3 and cell 4 splits don't alternate H/V as expected.

### Pitfall 4: makeMockActions in Tests Must Extend FillActions

**What goes wrong:** The existing `makeMockActions()` helper in `media.test.ts` builds a `FillActions`-compatible object. After Phase 19, `FillActions` gains `setHasAudioTrack`. Tests that use the old helper will get TypeScript errors.

**How to avoid:** Add `setHasAudioTrack: vi.fn()` to `makeMockActions()`. Also update the type cast in the test: `actions as FillActions` is already typed, so TypeScript will catch the missing field.

### Pitfall 5: LeafNode handleDrop — Single-File Targeted Drop Must Stay Unchanged

**What goes wrong:** The locked decision (DROP-03) requires single-file drops on a specific cell to remain targeted. If `autoFillCells` is called from `LeafNode.handleDrop` for single-file drops (as it is currently, at line 476), it will now use BFS — but BFS will find the first empty cell in the entire grid, not the cell that was dropped on.

**Why it happens:** The current `handleDrop` routes all file drops through `autoFillCells`, which finds the first empty leaf globally. For multi-file drops this is fine. For single-file drops onto a filled cell, the user expects to replace that specific cell.

**How to avoid:** The existing code already handles this correctly for single-file targeted drops — only cell-drop (from a `text/cell-id` drag) is handled specially. When a user drops a file onto a specific cell, the current implementation routes it through `autoFillCells` (global fill). Looking at the context's D-02 again: it says `detectAudioTrack()` is called from `LeafNode`'s `handleDrop` for "single-file direct drops". The plan must ensure that single-file drops that already have a cell target use a targeted path (call `setMedia` directly for the cell being dropped on, then call `detectAudioTrack()`). This matches the sidebar's `handleFileChange` path (lines 239–261 of Sidebar.tsx) which already handles targeted single-file replacements by calling `setMedia` directly.

**Action required:** The planner must decide whether `LeafNode.handleDrop` for single-file drops should call `setMedia(id, newMediaId)` + `setHasAudioTrack(id, result)` directly (targeted), or route through `autoFillCells` (fills global first-empty). The CONTEXT.md D-02 says "inside `LeafNode`'s `handleDrop` for single-file direct drops" suggesting targeted behavior. The success criterion SC6 says "Dropping a single file directly onto a specific leaf cell continues to target that cell exactly."

**Resolution:** The `LeafNode.handleDrop` file-drop path (lines 473–482 of LeafNode.tsx) currently always calls `autoFillCells`. For targeted single-file behavior (SC6), this path should be changed to: if single file AND cell being dropped on is a leaf, assign media directly to `id` rather than calling `autoFillCells`. If multiple files, continue to use `autoFillCells`.

---

## Code Examples

### AudioContext.decodeAudioData Reference Pattern

```typescript
// Source: src/lib/videoExport.ts:300–322 [VERIFIED: existing codebase]
const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
try {
  const response = await fetch(blobUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  if (audioBuffer.numberOfChannels > 0) {
    // has audio
  }
} catch (err) {
  console.warn('[audio] Failed to decode audio for', mediaId, err);
} finally {
  await tempCtx.close();
}
```

For `detectAudioTrack()`, replace `fetch(blobUrl)` + `arrayBuffer()` with `file.arrayBuffer()` directly. [VERIFIED: existing codebase]

### Existing `toggleAudioEnabled` Action Pattern

```typescript
// Source: src/store/gridStore.ts:221–229 [VERIFIED: existing codebase]
toggleAudioEnabled: (nodeId) =>
  set(state => {
    const leaf = findNode(current(state.root), nodeId);
    if (!leaf || leaf.type !== 'leaf') return;
    pushSnapshot(state);
    state.root = updateLeaf(current(state.root), nodeId, {
      audioEnabled: !leaf.audioEnabled,
    });
  }),
```

`setHasAudioTrack` follows this exact structure but without `pushSnapshot`.

### Existing BFS-adjacent Pattern (getAllLeaves DFS for comparison)

```typescript
// Source: src/lib/tree.ts:71–74 [VERIFIED: existing codebase]
export function getAllLeaves(root: GridNode): LeafNode[] {
  if (root.type === 'leaf') return [root];
  return root.children.flatMap(getAllLeaves);
}
```

The new `getBFSLeavesWithDepth` is additive — `getAllLeaves` is preserved for existing consumers.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 |
| Config file | `vite.config.ts` (vitest config inline) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MUTE-01 | `detectAudioTrack(file)` returns `false` for no-audio video | unit | `npx vitest run src/test/phase19-audio-detection.test.ts` | Wave 0 |
| MUTE-01 | `detectAudioTrack(file)` returns `true` on `decodeAudioData` rejection (fail-open) | unit | `npx vitest run src/test/phase19-audio-detection.test.ts` | Wave 0 |
| MUTE-01 | `autoFillCells()` calls `setHasAudioTrack` after video assignment | unit | `npx vitest run src/test/media.test.ts` | ❌ update needed |
| MUTE-02 | ActionBar renders disabled VolumeX when `hasAudioTrack === false` | component | `npx vitest run src/test/action-bar.test.tsx` | ❌ update needed |
| MUTE-02 | ActionBar locked button has `disabled` attribute | component | `npx vitest run src/test/action-bar.test.tsx` | ❌ update needed |
| MUTE-03 | Sidebar renders disabled VolumeX when `hasAudioTrack === false` | component | `npx vitest run src/test/sidebar.test.tsx` | ❌ update needed |
| DROP-01 | 4-file drop fills 2×2 grid in BFS order (level by level) | unit | `npx vitest run src/test/media.test.ts` | ❌ update needed |
| DROP-02 | Overflow split uses `depth % 2` for direction | unit | `npx vitest run src/test/media.test.ts` | ❌ update needed |
| DROP-03 | Single-file drop onto specific cell targets that cell | component | `npx vitest run src/test/phase19-leaf-drop.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/test/media.test.ts src/test/action-bar.test.tsx src/test/sidebar.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/test/phase19-audio-detection.test.ts` — unit tests for `detectAudioTrack()` and `getBFSLeavesWithDepth()`; covers MUTE-01 and DROP-01/02 tree helper
- [ ] `src/test/phase19-leaf-drop.test.ts` — component test for `LeafNode` single-file targeted drop (DROP-03)
- [ ] `AudioContext` global mock — needed in `phase19-audio-detection.test.ts` and `media.test.ts` (for video file detection calls); add to test setup or per-file global mock

---

## Open Questions (RESOLVED)

1. **Does `LeafNode.handleDrop` for multi-file drops still route through `autoFillCells`?**
   - What we know: Current implementation routes ALL file drops (1 or more files) through `autoFillCells` (line 476).
   - What's unclear: DROP-03 says single-file direct drops should still target the specific cell. This conflicts with routing through `autoFillCells` BFS (which fills the first globally-empty cell).
   - Recommendation: Change `LeafNode.handleDrop` to branch on file count: if `files.length === 1`, assign directly to `id` (targeted) + call `setHasAudioTrack`; if `files.length > 1`, route through `autoFillCells` (BFS). This matches the Sidebar `handleFileChange` pattern which already has this branching at lines 239–261.

2. **Should `setHasAudioTrack` push a snapshot?**
   - What we know: `setMedia` pushes a snapshot; `setEffects` does not.
   - What's unclear: CONTEXT.md D-03/D-04 do not specify snapshotting behavior.
   - Recommendation: Do NOT push snapshot. Audio track detection is a consequence of media assignment, not an independent user action. Undo of the media assignment (via `setMedia`'s snapshot) is sufficient. If `setHasAudioTrack` pushes a snapshot, undo requires two presses to undo a single upload.

3. **What is the depth of the root node in `getBFSLeavesWithDepth`?**
   - What we know: D-14 says "depth of the node being split" determines direction. If the root is a leaf (single-cell canvas), it is at depth 0, so split is horizontal. The resulting container has children at depth 1.
   - What's unclear: Is "depth of the node being split" the node's own depth, or the container's depth after the split?
   - Recommendation: Use the depth of the node BEING SPLIT (before split). This matches the BFS entry's `depth` field. Root single-leaf is depth 0 → horizontal split. This creates a container at depth 0 with two children at depth 1. Next overflow splits a depth-1 node → vertical.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies identified. All functionality uses existing browser APIs (`AudioContext`, `File.arrayBuffer()`), existing project dependencies (Zustand, React, Tailwind), and existing test infrastructure (Vitest, Testing Library). No new CLI tools, services, or runtimes needed.

---

## Security Domain

The phase introduces no new network calls, authentication surfaces, or data persistence. `file.arrayBuffer()` reads a local File object already selected by the user — no CORS or injection risk. ASVS V5 input validation applies only to the media type guard (`file.type.startsWith('video/')`) which is already present in `autoFillCells`. No new security controls required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Images should call `setHasAudioTrack(nodeId, false)` (not skip the call entirely) after media assignment | Architecture Patterns §3 | If omitted and a cell previously held a video with `hasAudioTrack: true`, replacing it with an image would leave the stale `true` value. Impact: image cell might show interactive audio toggle. Low risk since audio toggle is gated by `mediaType === 'video'`, but defensive to set it. |
| A2 | `setHasAudioTrack` should NOT push a history snapshot | Architecture Patterns §4 | If the planner decides it SHOULD snapshot, undo of a single video upload would require 2 presses. Medium impact on UX. |
| A3 | `LeafNode.handleDrop` for single-file drops should bypass `autoFillCells` and assign directly to `id` | Common Pitfalls §5 / Open Questions §1 | If single-file drops continue to route through `autoFillCells`, SC6 (targeted drop) fails — drops go to the globally-first-empty cell, not the cell that was dropped on. HIGH impact. |
| A4 | Root-as-single-leaf has depth 0 in `getBFSLeavesWithDepth` | Architecture Patterns §2 | If depth is off-by-one, overflow split directions don't match the expected H/V alternation. LOW risk since the pattern is standard BFS. |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/videoExport.ts:300–322` — `AudioContext.decodeAudioData()` reference pattern; `numberOfChannels > 0` check; `try/finally ctx.close()` idiom
- `src/lib/tree.ts:71–74` — `getAllLeaves` DFS pattern; `getBFSLeavesWithDepth` insertion point
- `src/lib/media.ts:21–94` — `FillActions` interface; `autoFillCells` current implementation; overflow logic
- `src/store/gridStore.ts:221–229` — `toggleAudioEnabled` as pattern for `setHasAudioTrack`
- `src/Grid/ActionBar.tsx:120–144` — existing audio button block; exact modification target
- `src/Editor/Sidebar.tsx:216–351` — existing `audioEnabled` selectors and button block; modification target
- `src/types/index.ts:9–22` — `LeafNode` type with `hasAudioTrack: boolean` confirmed present
- `src/test/media.test.ts` — `makeMockActions` pattern; existing test coverage to update
- `src/test/action-bar.test.tsx` — `makeLeaf` helper; `useGridStore.setState` test pattern

### Secondary (MEDIUM confidence)
- MDN Web Docs — `File.arrayBuffer()` browser support (Chrome 76+, Firefox 69+, Safari 14.1+); confirmed within target browser matrix

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries pre-installed; no new dependencies
- Architecture: HIGH — all modification targets identified; patterns verified from existing codebase
- Pitfalls: HIGH — derived from existing code patterns and test harness constraints

**Research date:** 2026-04-13
**Valid until:** Stable (implementation against existing codebase; no external dependencies)
