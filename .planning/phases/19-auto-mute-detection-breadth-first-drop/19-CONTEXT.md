# Phase 19: Auto-Mute Detection & Breadth-First Drop - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Two tightly scoped sub-features delivered together:

1. **Audio detection (MUTE-01/02/03):** When a video file is uploaded, detect whether it contains an audio stream using `AudioContext.decodeAudioData()`. Set `hasAudioTrack` on the `LeafNode`. No-audio cells display a locked, non-interactive VolumeX icon in both the ActionBar and SelectedCellPanel — visually distinct from the user-muted state.

2. **BFS fill order (DROP-01/02/03):** Rewrite `autoFillCells()` in `src/lib/media.ts` to fill cells in breadth-first order instead of the current DFS `getAllLeaves()` order. When overflow splits are needed, alternate H/V by node depth (even depth → horizontal, odd depth → vertical).

**In scope:** `detectAudioTrack()` utility, `setHasAudioTrack` store action, locked UI in ActionBar + SelectedCellPanel, `getBFSLeavesWithDepth()` tree helper, `autoFillCells()` rewrite.

**Out of scope:** Any changes to playback audio (Phase 21), undo/redo of `hasAudioTrack` beyond what Phase 17 already established, new UI panels or controls beyond the locked icon treatment.

</domain>

<decisions>
## Implementation Decisions

### Audio Detection — Integration Point
- **D-01:** Add `detectAudioTrack(file: File): Promise<boolean>` as a standalone exported utility in `src/lib/media.ts`. It attempts `AudioContext.decodeAudioData()` on the file and returns `true` if audio channels are detected, `false` if none are found.
- **D-02:** Call `detectAudioTrack()` from **two** upload points:
  - Inside `autoFillCells()` after each media assignment — handles multi-file drops and workspace uploads.
  - Inside `LeafNode`'s `handleDrop` for single-file direct drops — handles targeted cell drops.
- **D-03:** Extend the `FillActions` interface with `setHasAudioTrack: (nodeId: string, hasAudio: boolean) => void`. `autoFillCells()` calls `actions.setHasAudioTrack(targetNodeId, result)` after detection. LeafNode's drop handler calls the store action directly.
- **D-04:** A corresponding `setHasAudioTrack(nodeId, value)` store action must be added to `gridStore.ts` — this was explicitly deferred from Phase 17 (Phase 17 D-04 note).

### Audio Detection — Fallback Behavior
- **D-05:** On any `decodeAudioData()` failure (no audio stream, unsupported codec, test environment without AudioContext): **assume `hasAudioTrack = true`** (fail open). Rationale: a false positive (interactive toggle on a silent video) is a minor nuisance; a false negative (locked toggle on a video that has audio) is a worse UX outcome.
- **D-06:** The detection function catches all errors and resolves — it never rejects. Callers do not need try/catch.

### Locked State Visual — ActionBar
- **D-07:** For no-audio video cells (`hasAudioTrack === false`), the ActionBar renders a **disabled, non-interactive** VolumeX button with:
  - `text-gray-400 opacity-40` (visually dimmed)
  - `cursor-not-allowed` and `disabled` attribute (or `pointer-events-none`)
  - Tooltip text: `"No audio track"`
  - No `onClick` handler (or noop)
- **D-08:** For user-muted cells (`audioEnabled === false`, `hasAudioTrack === true`), the existing appearance is **unchanged**: red `VolumeX`, `hover:bg-red-500/20`, tooltip `"Unmute cell audio"`.
- **D-09:** The locked icon shows only when `mediaType === 'video' && !hasAudioTrack`. When the video has audio (`hasAudioTrack === true`), the existing interactive toggle renders as before.

### Locked State Visual — SelectedCellPanel (Sidebar)
- **D-10:** Same visual treatment as ActionBar: disabled gray `VolumeX` (`text-gray-400 opacity-40 cursor-not-allowed`) with label/tooltip `"No audio track"` for no-audio cells. The existing muted/unmuted interactive toggle is unchanged for cells with audio.
- **D-11:** The sidebar must read `hasAudioTrack` from the store for the selected node — add selector alongside the existing `audioEnabled` selector.

### BFS Fill Order — Tree Helper
- **D-12:** Add `getBFSLeavesWithDepth(root: GridNode): Array<{ leaf: LeafNode; depth: number }>` to `src/lib/tree.ts`. Uses a standard BFS queue (array + shift, or queue structure). Each entry carries the leaf and its depth in the tree (root = depth 0).
- **D-13:** `autoFillCells()` replaces the `getAllLeaves(currentRoot)` call with `getBFSLeavesWithDepth(currentRoot)`. Fill order becomes level-by-level (breadth-first).

### BFS Fill Order — Overflow Split Direction
- **D-14:** ~~(Original: depth-based direction via `depth % 2`)~~ **CORRECTED (UAT diagnosis, Plan 19-04):** When all existing empty cells are exhausted and a new cell must be created via split, the split direction is controlled by an explicit `overflowCount` counter: `overflowCount % 2 === 0 → 'horizontal'`, `overflowCount % 2 === 1 → 'vertical'`. The counter starts at 0 and increments after each overflow split. The original depth-based approach (`depth % 2`) was found unreliable during UAT: when `splitNode` uses Case B (appending a sibling to an existing parent whose direction already matches), the new node is inserted at the same depth level, so `depth % 2` returns the same value on consecutive overflow splits instead of alternating.
- **D-15:** ~~The BFS queue entry for each leaf already carries depth for overflow direction.~~ **Updated:** Depth is still carried for BFS ordering but is no longer used for overflow split direction. The `overflowCount` counter is local to `autoFillCells` and requires no additional store queries or `FillActions` additions.

### Claude's Discretion
- Implementation of `detectAudioTrack()` internals: whether to use a temporary `AudioContext` or `OfflineAudioContext` for the decode call (reuse the `videoExport.ts` pattern with `AudioContext` + `decodeAudioData` is the natural choice).
- Whether to use `response.arrayBuffer()` on a blob URL (same as videoExport.ts) or `file.arrayBuffer()` directly (simpler — avoids a fetch round-trip for a local file). Either is acceptable.
- Queue implementation for BFS in `getBFSLeavesWithDepth` (array + shift is idiomatic for small trees; no optimization needed).
- Exact Tailwind class for the button container when locked (e.g., `pointer-events-none` on the wrapper vs `disabled` attribute on the `<button>` element — either satisfies "non-interactive").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MUTE-01, MUTE-02, MUTE-03 — audio detection and locked toggle requirements
- `.planning/REQUIREMENTS.md` §DROP-01, DROP-02, DROP-03 — BFS fill order and depth-based split requirements
- `.planning/ROADMAP.md` §Phase 19 success criteria — 6 success criteria for this phase

### Prior Phase Context
- `.planning/phases/17-data-model-foundation/17-CONTEXT.md` — `hasAudioTrack` field decisions (D-01 through D-05); `setHasAudioTrack` store action deferred to Phase 19

### Source Files to Modify
- `src/lib/media.ts` — Add `detectAudioTrack()`, extend `FillActions` interface, rewrite `autoFillCells()` to BFS
- `src/lib/tree.ts` — Add `getBFSLeavesWithDepth()` helper
- `src/store/gridStore.ts` — Add `setHasAudioTrack(nodeId, value)` store action
- `src/Grid/ActionBar.tsx` — Locked state rendering for no-audio video cells
- `src/Editor/Sidebar.tsx` — Locked state rendering in `SelectedCellPanel` for no-audio video cells

### Existing Patterns to Follow
- `src/lib/videoExport.ts:300–322` — `fetch(blobUrl) + decodeAudioData()` pattern; pitfall: check `audioBuffer.numberOfChannels > 0` to confirm audio presence
- `src/lib/tree.ts:71–74` — `getAllLeaves()` (current DFS) — replace with BFS in `autoFillCells`, keep `getAllLeaves` for other consumers

### Tests to Update / Add
- `src/test/media.test.ts` — Tests for `autoFillCells`; update for BFS order
- `src/test/phase08-p02-workspace-drop.test.tsx` — Workspace drop tests; update for BFS order
- New test file for Phase 19: `detectAudioTrack()` unit tests, `getBFSLeavesWithDepth()` unit tests, locked UI behavior tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getAllLeaves(root)` in `tree.ts:71` — keep for other consumers; add `getBFSLeavesWithDepth` as a companion
- `autoFillCells(files, actions)` in `media.ts:34` — rewrite BFS logic here; signature unchanged from call sites' perspective
- `FillActions` interface in `media.ts:21` — extend with `setHasAudioTrack`
- `toggleAudioEnabled` store action already exists in `gridStore.ts` — `setHasAudioTrack` follows same pattern
- `ActionBar.tsx:42–46` — `audioEnabled` selector pattern to replicate for `hasAudioTrack`
- `Sidebar.tsx:216–218` — `audioEnabled` selector in `SelectedCellPanel` to replicate for `hasAudioTrack`
- `videoExport.ts:300–322` — decode pattern: `fetch(blobUrl) → arrayBuffer() → decodeAudioData()` + catch

### Established Patterns
- Store selectors: `useGridStore(s => (findNode(s.root, nodeId) as LeafNode | null)?.field ?? default)` — use same for `hasAudioTrack`
- `mediaType === 'video'` guard already gates the audio toggle in ActionBar — `hasAudioTrack` check layers on top
- Actions in `gridStore.ts` follow Immer draft mutation pattern with `pushSnapshot()` for undo/redo

### Integration Points
- `CanvasArea.tsx` passes `autoFillCells` the `FillActions` object — the extended interface is satisfied by adding the new store action to the object literal there
- `LeafNode.tsx:453` — `handleDrop` is where single-file drop lands; detection call goes here after media assignment
- `videoExport.ts` audio mix already uses `hasAudioTrack` (via `audioEnabled`) — Phase 19 makes `hasAudioTrack` meaningful; no changes needed to export path

</code_context>

<specifics>
## Specific Ideas

- Detection should use `file.arrayBuffer()` directly (simpler than `fetch(blobUrl)` since we have the File object in scope at upload time) — but the fallback still catches and returns `true`.
- The `decodeAudioData()` result check should mirror `videoExport.ts:315`: `audioBuffer.numberOfChannels > 0` is the signal that audio is present.
- For the locked button in ActionBar, using `disabled` on the `<button>` element is semantically correct and also prevents keyboard focus on the control.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-auto-mute-detection-breadth-first-drop*
*Context gathered: 2026-04-13*
