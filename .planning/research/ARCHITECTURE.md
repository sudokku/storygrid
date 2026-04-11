# Architecture Research — v1.3 Integration Map

**Domain:** v1.3 feature integration into existing StoryGrid codebase
**Researched:** 2026-04-11
**Confidence:** HIGH — all findings derived from reading the actual source files

---

## System Overview (Current, post-v1.2)

```
+-----------------------------------------------------------------------------+
|  React component tree (EditorShell -> CanvasArea / Sidebar / Toolbar)      |
|                                                                             |
|  LeafNodeComponent (React.memo)         PlaybackTimeline                   |
|  +-- hidden HTMLVideoElement (videoElRef)  +-- setInterval 10fps sync      |
|  +-- <canvas> (canvasRef) -- WYSIWYG       +-- videoElementRegistry (Map) |
|  +-- rAF loop (isPlaying=true only)                                        |
|  +-- drawRef.current() <- drawLeafToCanvas()                               |
|                                                                             |
|  SelectedCellPanel / EffectsPanel / ActionBar (portal)                     |
|  +-- per-cell controls reading gridStore                                   |
+-----------------------------------------------------------------------------+
|  State stores (Zustand + Immer)                                            |
|                                                                             |
|  gridStore              editorStore           overlayStore                 |
|  +-- root: GridNode     +-- isPlaying         +-- overlays[]               |
|  +-- mediaRegistry      +-- playheadTime      +-- stickerRegistry          |
|  +-- mediaTypeMap       +-- totalDuration     +-- 8 actions                |
|  +-- thumbnailMap       +-- selectedNodeId                                 |
|  +-- 20+ actions        +-- borderRadius...                                |
|                                                                             |
|  videoElementRegistry (module-level Map, NOT Zustand)                      |
|  +-- nodeId -> HTMLVideoElement (playback & draw)                          |
|  +-- nodeId -> draw() callback (rAF redraw without React re-render)        |
+-----------------------------------------------------------------------------+
|  Pure libs / pipelines                                                     |
|                                                                             |
|  src/lib/effects.ts          src/lib/export.ts                             |
|  +-- EffectSettings type     +-- drawLeafToCanvas()  <- SINGLE DRAW PATH   |
|  +-- PRESET_VALUES{}         +-- renderGridIntoContext()                   |
|  +-- effectsToFilterString() +-- renderGridToCanvas()                     |
|                                                                             |
|  src/lib/videoExport.ts      src/lib/media.ts                              |
|  +-- exportVideoGrid()       +-- autoFillCells()                           |
|  +-- buildVideoStreams()      +-- fileToBase64()                           |
|  +-- mixAudioForExport()                                                   |
|  +-- Mediabunny pipeline                                                   |
|                                                                             |
|  src/lib/tree.ts                                                           |
|  +-- getAllLeaves() -- DFS, document order                                 |
+-----------------------------------------------------------------------------+
```

---

## 1. Instagram Presets -- Integration Map

### Where preset names map to filter values

The entire preset system lives in **`src/lib/effects.ts`**. This is the only file to change for a preset redesign.

```
src/lib/effects.ts
+-- type PresetName = 'bw' | 'sepia' | 'vivid' | 'fade' | 'warm' | 'cool'
+-- PRESET_VALUES: Record<PresetName, {brightness, contrast, saturation, blur}>
+-- effectsToFilterString(e: EffectSettings): string
     +-- outputs CSS filter string used by ctx.filter in drawLeafToCanvas()
```

The `PresetName` union type is the **data model contract**. `gridStore.applyPreset()` writes `{ preset: presetName, ...PRESET_VALUES[presetName] }` into `leaf.effects`. The string value of `preset` is stored in every history snapshot.

**Renaming/redesigning presets -- what to change:**

1. `src/lib/effects.ts` -- update `PresetName` union, `PRESET_VALUES` entries, and optionally add hue-rotate or sepia to `effectsToFilterString` if the new presets need new CSS filter functions
2. `src/Editor/EffectsPanel.tsx` -- display names and button labels (currently maps `'bw'` to `'B&W'`, etc.)
3. `src/Grid/__tests__/ActionBar.test.tsx`, `src/Editor/__tests__/EffectsPanel.test.tsx` -- preset name references in tests
4. `src/lib/effects.test.ts` -- contract-locked numeric tuples; update expected values

**Data model safety rule:** The `preset` field on `LeafNode` stores the raw `PresetName` string, not a display name. As long as the union type and `PRESET_VALUES` keys stay consistent, history snapshots remain valid across the rename. Old snapshots with removed preset names will render with the slider values baked into them (the numeric tuple is always stored alongside the preset key), so no migration is needed for the preview path. Export calls `effectsToFilterString` which only reads the numeric sliders -- the `preset` string is cosmetic at draw time.

**New CSS filter functions:** If Instagram presets require `hue-rotate()` or `sepia()`, add those fields to `EffectSettings` and extend `effectsToFilterString`. The `drawLeafToCanvas()` call site in `src/lib/export.ts` is transparent to the filter string -- it just calls `ctx.filter = filterStr`. No changes needed in the export or rAF paths.

---

## 2. Boomerang -- Integration Map

### Data model change

Add one field to `LeafNode` in `src/types/index.ts`:

```typescript
boomerang: boolean;  // default: false
```

Add the default in `createLeaf()` inside `src/lib/tree.ts`. Add a `toggleBoomerang(nodeId)` action in `gridStore.ts` (pattern-identical to `toggleAudioEnabled`).

### rAF loop change (LeafNode.tsx)

The current rAF loop (`useEffect` on `isPlaying, isVideo`) calls `drawRef.current()` which reads `videoElRef.current` directly as the draw source. The video element's `currentTime` is advanced by the browser's natural playback.

For boomerang, the video element cannot be used in `loop=true` mode because the browser only plays forward. Instead:

**Approach: manual frame stepping in the rAF loop.**

1. Detect boomerang mode from the leaf's `boomerang` field inside the rAF tick (read from `useGridStore.getState()` -- same pattern as `findNode(useGridStore.getState().root, id)` already used in `drawRef`).
2. Set `video.loop = false` when boomerang is active.
3. Track a direction flag (`ref<'forward' | 'backward'>`) in the component.
4. Each tick: advance or decrement `video.currentTime` manually by `1/fps * speedMultiplier`. At `duration`, flip direction to backward; at `0`, flip to forward.
5. After setting `currentTime`, call `drawRef.current()` on the next rAF tick -- the seek is async so drawing immediately may produce the previous frame.

**Alternative (more correct):** Use `video.onseeked` to call `drawRef.current()` and keep the rAF only for advancing time, not for drawing. This eliminates the stale-frame issue at the cost of added complexity.

### Export pipeline change (videoExport.ts)

The `buildVideoStreams()` / `makeTimestampGen()` pipeline generates timestamps for `samplesAtTimestamps`. For boomerang cells, the timestamp generator must emit forward-then-backward frame timestamps.

**Strategy:**

1. Add a `boomerang: boolean` field to the per-leaf data read inside `exportVideoGrid`. The leaf's `boomerang` state is available via `getAllLeaves(root)`.
2. In `makeTimestampGen`, add a `boomerang` parameter. When true, the timestamp sequence should be: forward pass `0` to `effectiveDuration`, then backward pass back to `0`, cycling for the full export duration.
3. `samplesAtTimestamps` handles backward jumps by re-seeking the decoder automatically (documented in the existing `makeTimestampGen` comment).

Frame ordering for boomerang in export:

```
boomerangPeriod = 2 * effectiveDuration  // one forward+backward cycle

for frame i:
  cycleTime = (i / fps) % boomerangPeriod
  if cycleTime <= effectiveDuration:
    videoTimestamp = firstTimestamp + cycleTime
  else:
    videoTimestamp = firstTimestamp + (boomerangPeriod - cycleTime)
```

The existing `computeLoopedTime` function handles forward looping. For boomerang, a new `computeBoomerangTime(t, duration)` helper should be extracted alongside it with the same testability contract.

**Components to modify:** `src/lib/videoExport.ts` (`makeTimestampGen`, new `computeBoomerangTime`), `src/Grid/LeafNode.tsx` (rAF tick), `src/types/index.ts` (field), `src/lib/tree.ts` (`createLeaf` default), `src/store/gridStore.ts` (action).

---

## 3. Video Trimming -- Integration Map

### Data model change

Add two fields to `LeafNode`:

```typescript
trimStart: number;  // seconds, default: 0
trimEnd: number | null;  // seconds; null = use video's natural duration
```

Add defaults in `createLeaf()`. Add a `setTrimPoints(nodeId, trimStart, trimEnd)` store action. Use the `beginEffectsDrag` pattern (push snapshot on drag start, no snapshot on each slider move) to avoid history pollution during drag.

### rAF loop / playback change (LeafNode.tsx)

The `video.loop = true` approach does not respect trim points. For trimmed playback:

1. Set `video.loop = false`.
2. In the rAF loop, when `video.currentTime >= (leaf.trimEnd ?? video.duration)`, manually seek back to `leaf.trimStart` and call `video.play()`.
3. The `seekAll(time)` function in `PlaybackTimeline.handleScrub` does not need changes -- the scrubber maps to global elapsed time, and each cell independently loops its trimmed window.

### Duration calculation change

`recomputeTotalDuration()` in `LeafNode.tsx` currently reads `video.duration` for each registered video element. For trimmed cells, the effective duration is `(trimEnd ?? video.duration) - trimStart`. The function must read trim values from the grid store:

```typescript
function recomputeTotalDuration() {
  let maxDur = 0;
  for (const [nodeId, video] of videoElementRegistry.entries()) {
    if (!video.duration || !isFinite(video.duration)) continue;
    const leaf = findNode(useGridStore.getState().root, nodeId) as LeafNode | null;
    const start = leaf?.trimStart ?? 0;
    const end = leaf?.trimEnd ?? video.duration;
    maxDur = Math.max(maxDur, end - start);
  }
  useEditorStore.getState().setTotalDuration(maxDur);
}
```

This is valid because `recomputeTotalDuration` already accesses `useEditorStore.getState()` directly (it is not a React hook), and `useGridStore.getState()` follows the same pattern.

### Export pipeline change (videoExport.ts)

With trimming, the `makeTimestampGen` parameters change:

- `effectiveDuration` becomes `trimEnd - trimStart`
- `firstTimestamp` becomes `firstTimestamp + trimStart`

The existing `computeLoopedTime` logic works unchanged -- the trim offset is absorbed into the `firstTimestamp` and `effectiveDuration` parameters.

**Per-mediaId vs per-leaf constraint:** `buildVideoStreams` creates one `Input` (Mediabunny decoder) per unique `mediaId`. If two cells reference the same video file, both cells get the same trim. This is a known limitation for v1.3. Full per-cell trim for shared mediaIds requires a per-leaf streaming pipeline refactor -- defer to a future milestone.

**Components to modify:** `src/lib/videoExport.ts` (`buildVideoStreams`, `makeTimestampGen`), `src/Grid/LeafNode.tsx` (rAF loop, video setup), `recomputeTotalDuration()`, `src/types/index.ts`, `src/lib/tree.ts`, `src/store/gridStore.ts`, `src/Editor/Sidebar.tsx` (trim UI).

---

## 4. Live Audio Preview -- Integration Map

### Current audio architecture

Export uses `mixAudioForExport()` (offline `OfflineAudioContext`). During editor playback there is **no live audio** -- all hidden video elements are `muted: true` (LeafNode.tsx line 197). `buildAudioGraph` was removed with the Mediabunny migration (Phase 14).

### Where live audio should live

A custom hook `usePlaybackAudio()` is the right shape. It should not live in `PlaybackTimeline` (which is a thin UI component) and must not live in `LeafNode` (which would attempt to create `MediaElementAudioSourceNode` more than once per element if the leaf re-mounts).

**Mount location:** Call `usePlaybackAudio()` once from `EditorShell.tsx` or `CanvasArea.tsx`.

### Hook design

```typescript
// src/hooks/usePlaybackAudio.ts
export function usePlaybackAudio(): void {
  const isPlaying = useEditorStore(s => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;

    const ctx = new AudioContext();

    for (const [nodeId, video] of videoElementRegistry.entries()) {
      const leaf = findNode(useGridStore.getState().root, nodeId) as LeafNode | null;
      if (!leaf?.audioEnabled) continue;
      if (!leaf.mediaId) continue;
      if (useGridStore.getState().mediaTypeMap[leaf.mediaId] !== 'video') continue;

      video.muted = false;
      const source = ctx.createMediaElementSource(video);
      source.connect(ctx.destination);
    }

    return () => {
      for (const video of videoElementRegistry.values()) {
        video.muted = true;
      }
      ctx.close();
    };
  }, [isPlaying]);
}
```

**Critical constraint: `MediaElementAudioSourceNode` can only be created once per `HTMLMediaElement`.** The cleanup path must close the `AudioContext` entirely so the next play session creates a fresh one. If the hook re-renders and tries to create a source for the same element twice within one play session, it will throw. The `useEffect` dependency on `isPlaying` ensures cleanup runs on pause.

**Interaction with rAF loop:** No conflict. The rAF loop calls `drawRef.current()` only -- it does not touch audio. The `video.play()` call in `PlaybackTimeline.handlePlayPause()` drives both the rAF draw and the `MediaElementAudioSourceNode` audio simultaneously.

---

## 5. Auto-Mute Detection -- Integration Map

### Data model change

Add one field to `LeafNode`:

```typescript
hasAudioTrack: boolean;  // default: true (safe; detection runs async after upload)
```

Add default `true` in `createLeaf()`. The field is read-only from the UI perspective -- the user cannot set it. UI shows a grayed non-interactive `VolumeX` icon when `hasAudioTrack = false`, regardless of `audioEnabled`.

### Detection integration point: addMedia in gridStore.ts

`addMedia` (gridStore.ts line 321) already launches an async thumbnail capture via `_capture.fn(dataUri)` for video cells. Audio detection runs in the same async follow-up pattern:

```typescript
// After setting mediaRegistry/mediaTypeMap in addMedia:
if (type === 'video') {
  // existing thumbnail path ...
  detectAudioTrack(dataUri).then(hasAudio => {
    if (!get().mediaRegistry[mediaId]) return; // removed during detection
    // set on all leaves referencing this mediaId at time of resolution
    set(state => {
      const leaves = getAllLeaves(current(state.root));
      for (const leaf of leaves) {
        if (leaf.mediaId === mediaId) {
          state.root = updateLeaf(current(state.root), leaf.id, { hasAudioTrack: hasAudio });
        }
      }
    });
  });
}
```

**Timing note:** `addMedia` runs before `setMedia` in `autoFillCells`. At the time `detectAudioTrack` resolves (async), the mediaId may already be assigned to a leaf. The async `.then()` runs after `setMedia` has completed in practice, so the leaf will be findable.

### Detection implementation

```typescript
// src/lib/detectAudioTrack.ts
export async function detectAudioTrack(blobUrl: string): Promise<boolean> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.muted = true;
    video.src = blobUrl;
    const onMetadata = () => {
      const hasAudio =
        (video as unknown as { mozHasAudio?: boolean }).mozHasAudio === true ||
        (video.audioTracks?.length ?? 0) > 0;
      cleanup();
      resolve(hasAudio);
    };
    const onError = () => { cleanup(); resolve(true); }; // safe fallback
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
      video.src = '';
    };
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('error', onError);
    video.load();
  });
}
```

`video.audioTracks` has limited cross-browser support. `mozHasAudio` works on Firefox. The fallback `resolve(true)` treats undetectable cells as having audio -- they show the interactive mute button rather than the grayed icon.

**Components to modify:** `src/types/index.ts`, `src/lib/tree.ts`, `src/store/gridStore.ts`, `src/lib/detectAudioTrack.ts` (new), `src/Grid/ActionBar.tsx`, `src/Editor/Sidebar.tsx`.

---

## 6. Breadth-First Drop -- Integration Map

### Current logic location

`src/lib/media.ts` -- `autoFillCells()` function, lines 34-93.

**Current algorithm:**
1. `getAllLeaves(root)` -- DFS document order
2. Find first leaf where `mediaId === null`
3. If no empty leaf: split `lastFilledNodeId` horizontally (always)

This depth-first + always-horizontal approach produces a column-stacked layout for 3+ files.

### BFS traversal

`getAllLeaves` uses DFS (`root.children.flatMap(getAllLeaves)`). A new `getAllLeavesBFS` function is needed in `src/lib/tree.ts`:

```typescript
export function getAllLeavesBFS(root: GridNode): LeafNode[] {
  const queue: GridNode[] = [root];
  const leaves: LeafNode[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.type === 'leaf') {
      leaves.push(node);
    } else {
      queue.push(...node.children);
    }
  }
  return leaves;
}
```

### Alternating H/V split direction

When splitting an overflow leaf, the split direction alternates by depth. A `getNodeDepth(root, nodeId)` helper is needed:

```typescript
export function getNodeDepth(root: GridNode, targetId: string, depth = 0): number {
  if (root.id === targetId) return depth;
  if (root.type === 'container') {
    for (const child of root.children) {
      const d = getNodeDepth(child, targetId, depth + 1);
      if (d >= 0) return d;
    }
  }
  return -1; // not found
}
```

Split direction in `autoFillCells`:

```typescript
const depth = getNodeDepth(currentRoot, lastFilledNodeId);
const direction = depth % 2 === 0 ? 'horizontal' : 'vertical';
actions.split(lastFilledNodeId, direction);
```

### Where to make changes

`src/lib/media.ts` -- modify `autoFillCells` to use `getAllLeavesBFS` for finding the next empty leaf and the depth-based direction for splits. The `FillActions` interface and callers in `LeafNode.tsx` and `EditorShell.tsx` do not need changes -- function signature is identical.

**Components to modify:** `src/lib/media.ts` (algorithm), `src/lib/tree.ts` (new `getAllLeavesBFS`, new `getNodeDepth`). Media lib tests will need updating.

---

## 7. Playback UI Redesign -- Integration Map

### Current component location and structure

`src/Editor/PlaybackTimeline.tsx` -- 125 lines.

**Current structure:**
- `<div className="h-12 flex ...">` -- fixed-height bottom bar
- Play/Pause button calls `videoElementRegistry` directly via `handlePlayPause()`
- `<input type="range">` scrubber calls `seekAll()`
- Time display reads `playheadTime` and `totalDuration` from `editorStore`
- `useEffect` interval (100ms) syncs `playheadTime` from the first registered video element

**No internal `useState`.** The component reads entirely from `editorStore` selectors. Event handlers are `handlePlayPause` and `handleScrub` -- both unchanged by a visual redesign.

### What changes for visual redesign only

Tailwind class replacement only. The event handlers, `seekAll` helper, `setInterval` sync loop, and store subscriptions are all unchanged.

Hardcoded values that will change: `h-12` (bar height), `w-11 h-11 rounded-full` (button size), `[&::-webkit-slider-runnable-track]:bg-muted`, `[&::-webkit-slider-thumb]:bg-[#3b82f6]`.

If the redesign adds new read-only display elements (waveform, time markers), those require new `editorStore` subscriptions but no new write actions.

**Components to modify:** `src/Editor/PlaybackTimeline.tsx` -- Tailwind class changes. Check `src/Editor/MobileSheet.tsx` to determine if `PlaybackTimeline` is also rendered on mobile.

---

## Component-Level Change Summary

| Component / File | Type of Change | v1.3 Feature |
|---|---|---|
| `src/types/index.ts` | Add fields to `LeafNode` | boomerang, trimStart, trimEnd, hasAudioTrack |
| `src/lib/tree.ts` | Update `createLeaf` defaults; add `getAllLeavesBFS`, `getNodeDepth` | all data model + breadth-first drop |
| `src/lib/effects.ts` | Update `PresetName` union and `PRESET_VALUES` | Instagram presets |
| `src/store/gridStore.ts` | Add actions: `toggleBoomerang`, `setTrimPoints`, `setAudioTrackDetected` | boomerang, trimming, auto-mute |
| `src/lib/media.ts` | Rewrite `autoFillCells` to BFS + alternating splits | breadth-first drop |
| `src/lib/detectAudioTrack.ts` | New file | auto-mute detection |
| `src/Grid/LeafNode.tsx` | rAF loop boomerang direction; video setup trim loop point; `recomputeTotalDuration` trim-aware | boomerang, trimming |
| `src/lib/videoExport.ts` | `makeTimestampGen` boomerang + trim params; new `computeBoomerangTime` | boomerang, trimming |
| `src/Editor/PlaybackTimeline.tsx` | Tailwind class changes | playback UI |
| `src/hooks/usePlaybackAudio.ts` | New file | live audio preview |
| `src/Editor/EditorShell.tsx` | Call `usePlaybackAudio()` | live audio preview |
| `src/Editor/EffectsPanel.tsx` | Update preset labels | Instagram presets |
| `src/Grid/ActionBar.tsx` | Boomerang toggle; grayed VolumeX when `!hasAudioTrack` | boomerang, auto-mute |
| `src/Editor/Sidebar.tsx` | Trim range UI; grayed audio icon | trimming, auto-mute |

---

## Build Order (dependency-driven)

1. **Data model** (`src/types/index.ts`, `src/lib/tree.ts`) -- all other changes depend on the new fields
2. **Store actions** (`src/store/gridStore.ts`) -- UI controls depend on store actions
3. **Instagram presets** (`src/lib/effects.ts`, `src/Editor/EffectsPanel.tsx`) -- self-contained; no cross-feature deps
4. **Auto-mute detection** (`src/lib/detectAudioTrack.ts`, store, `src/Grid/ActionBar.tsx`) -- depends on data model only
5. **Breadth-first drop** (`src/lib/media.ts`, `src/lib/tree.ts`) -- self-contained; depends only on tree primitives
6. **Playback UI redesign** (`src/Editor/PlaybackTimeline.tsx`) -- purely visual; no dependency order constraint
7. **Boomerang** (`src/Grid/LeafNode.tsx`, `src/lib/videoExport.ts`) -- depends on data model and store action
8. **Video trimming** (`src/Grid/LeafNode.tsx`, `src/lib/videoExport.ts`, sidebar UI) -- depends on boomerang rAF changes being stable; both touch the same rAF loop
9. **Live audio preview** (`src/hooks/usePlaybackAudio.ts`, `src/Editor/EditorShell.tsx`) -- depends on auto-mute detection being correct so `audioEnabled` state is reliable

---

## Critical Architectural Constraints

**Single draw path invariant.** `drawLeafToCanvas()` in `src/lib/export.ts` is the single draw function for both preview and export. Any new per-cell visual property must be handled by what is loaded into the `CanvasImageSource` (which frame the video is at), not inside `drawLeafToCanvas`. The function receives a source and display settings only -- it has no concept of time.

**videoElementRegistry is not Zustand.** `videoElementRegistry` and `videoDrawRegistry` are plain `Map`s in `src/lib/videoRegistry.ts`. Any code that needs the video element (audio hook, boomerang rAF, trim loop) reads from these maps directly. This is already the pattern in `PlaybackTimeline` and `recomputeTotalDuration`.

**MediaElementAudioSourceNode single-creation constraint.** A `MediaElementAudioSourceNode` can only be created once per `HTMLMediaElement`. The live audio hook must create a new `AudioContext` on each play session and close it on pause. Creating it twice within one `AudioContext` lifecycle throws. The hook's `useEffect` cleanup must close the context entirely.

**History snapshot scope.** `mediaRegistry`, `mediaTypeMap`, and `thumbnailMap` are excluded from undo history. If `hasAudioTrack` is stored on `LeafNode` (not in a parallel map), it IS included in snapshots -- this is acceptable since it is a read-only detection result from the user's perspective. On undo, the restored snapshot may have a stale detection value for newly uploaded media, but this is benign.

**Export pipeline: per-mediaId streaming.** `buildVideoStreams` creates one `Input` per unique `mediaId`. Boomerang and trim parameters for a `mediaId` appearing in multiple cells apply uniformly to all cells sharing that file. Per-cell boomerang/trim for shared mediaIds requires a per-leaf streaming refactor. Document this as a v1.3 known limitation.

---

*Architecture research for: StoryGrid v1.3 -- Filters, Video Tools & Playback*
*Researched: 2026-04-11*
*Sources: direct codebase reading -- src/types/index.ts, src/store/gridStore.ts, src/store/editorStore.ts, src/lib/effects.ts, src/lib/export.ts, src/lib/videoExport.ts, src/lib/media.ts, src/lib/tree.ts, src/lib/videoRegistry.ts, src/Grid/LeafNode.tsx, src/Editor/PlaybackTimeline.tsx, .planning/PROJECT.md*
