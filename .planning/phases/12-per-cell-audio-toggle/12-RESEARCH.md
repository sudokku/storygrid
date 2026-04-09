# Phase 12: Per-Cell Audio Toggle - Research

**Researched:** 2026-04-09
**Domain:** Web Audio API graph construction, MediaRecorder audio track injection, Zustand/Immer store mutation, React UI toggle patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Model**
- D-01: Add `audioEnabled: boolean` (required, not optional) to `LeafNode` in `src/types/index.ts`.
- D-02: Default is `true` everywhere — in `createLeafNode()` and on any rehydrated cell missing the field. No "new vs existing" branch.
- D-03: Field lives on every LeafNode regardless of `mediaType`. Image cells carry `audioEnabled: true` inertly; UI hides control, export ignores them.

**ActionBar UI**
- D-04: Speaker icon placed after Fit toggle and before Clear-media button. New video-cell order: `Drag | Upload | Split H | Split V | Fit | Audio | [Clear] | Remove`.
- D-05: `Volume2` (audio-on) and `VolumeX` (muted) from lucide-react.
- D-06: Muted state uses `text-red-500` on icon and `hover:bg-red-500/20` on wrapper. Audio-on state uses `text-white`.
- D-07: Audio button renders ONLY when `mediaType === 'video'`.
- D-08: Button sizing matches existing `w-16 h-16` with `ICON_SIZE = 32`.
- D-09: Tooltip copy: "Mute cell audio" when unmuted, "Unmute cell audio" when muted.

**Sidebar UI**
- D-10: New "Playback" subsection inside `SelectedCellPanel`, above EffectsPanel, video-only. Forward-looking container (future loop/trim/speed controls can land here).
- D-11: The Playback subsection currently holds only the audio toggle.
- D-12: Sidebar audio control is an icon button — same `Volume2`/`VolumeX`, same red-when-muted styling. Exact px is planner's call (44px suggested).
- D-13: Both surfaces call the same `toggleAudioEnabled` action — single code path.
- D-14: `MobileSheet` inherits Playback subsection via shared `SelectedCellPanel` — no mobile-specific work.

**Export Pipeline (Web Audio Graph)**
- D-15: Build Web Audio graph only if at least one audio-enabled cell has `mediaType === 'video'`. Otherwise skip entirely; no silent audio track.
- D-16: One `AudioContext` per export (created inside Export button handler). Per cell: `MediaElementAudioSourceNode` → single shared `MediaStreamAudioDestinationNode`. Merge `destination.stream.getAudioTracks()[0]` with canvas video track into `new MediaStream([...videoTracks, audioTrack])`, feed to `new MediaRecorder(...)`.
- D-17: `buildExportVideoElements()` must set `muted = false` for `audioEnabled === true` cells, `muted = true` for others. Currently hardcodes `muted = true` for all.
- D-18: Do NOT connect source nodes to `audioCtx.destination` — no preview audio during export.
- D-19: `AudioContext` lifecycle: create at export start, close in `recorder.onstop` AND error/catch paths (alongside `destroyExportVideoElements`).
- D-20: If `new AudioContext()` or `createMediaElementSource()` throws: log error, fall back to no-audio export. Do not fail the whole export.

**Export Loop Audio Behavior**
- D-21: Accept loop-boundary audio click as-is. No crossfade or GainNode automation.
- D-22: Audio loops with the video — "what you see is what you hear."
- D-23: Duration clipping is free — `recorder.stop()` fires at `elapsed >= totalDurationMs`.

**Store & History**
- D-24: Add `toggleAudioEnabled(nodeId)` action to `gridStore.ts` — flips field via Immer + calls `pushSnapshot` once.
- D-25: Every toggle click enters undo/redo history. Ctrl+Z undoes an accidental mute.
- D-26: Both ActionBar and sidebar call `toggleAudioEnabled(nodeId)` — single action, single history entry.
- D-27: AUD-08 (persistence) is automatically satisfied when Phase 14 serializes the tree.

**Test Fixture Migration**
- D-28: Every test constructing a `LeafNode` literal needs `audioEnabled: true` (or `false` for mute-specific tests) added.

### Claude's Discretion
- Exact tooltip copy wording beyond "Mute/Unmute cell audio".
- Whether to surface a toast when AudioContext init fails, or log-and-continue silently.
- Exact pixel size of sidebar audio button (44px suggested).
- Whether `toggleAudioEnabled` is its own action or thin wrapper over `updateCell`.
- Visual treatment of the "Playback" subsection label.
- Whether to add `mediaType` prop to `ActionBar` or read it from store via `mediaTypeMap[mediaId]`.
- Whether `MediaStreamAudioDestinationNode` or `AudioContext.createMediaStreamDestination()` naming style — same API.

### Deferred Ideas (OUT OF SCOPE)
- Audio preview during editing — editor remains silent.
- Per-cell volume slider.
- Background music / audio track upload.
- Audio crossfade at loop boundaries.
- "Play audio once then silence" alternate mode.
- Safari audio export — Chrome/Firefox only (AUD-09).
- Audio level meter / waveform in sidebar.
- Trim in/out points per cell.
- Global "mute all / unmute all" shortcut.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUD-01 | Each video cell has `audioEnabled: boolean` on its leaf node, defaulting to `true` | D-01..D-03 in CONTEXT; `createLeaf()` in `src/lib/tree.ts:94` is the single init site |
| AUD-02 | Video cell shows speaker icon in portal ActionBar; visible only for `mediaType === 'video'` | D-04..D-09; existing `hasMedia` conditional at ActionBar line 108 is the template |
| AUD-03 | Clicking speaker icon toggles `audioEnabled` and updates icon | D-24..D-26; `toggleAudioEnabled` follows `updateCell`/fit-toggle pattern |
| AUD-04 | Sidebar video cell panel exposes same audio toggle | D-10..D-14; `SelectedCellPanel` in `src/Editor/Sidebar.tsx` above EffectsPanel |
| AUD-05 | MP4 export mixes audio from enabled cells via Web Audio API graph | D-15..D-23; three changes to `src/lib/videoExport.ts` documented below |
| AUD-06 | Zero audio-enabled cells → exported MP4 has NO audio track | D-15: skip graph entirely; only canvas stream passed to MediaRecorder |
| AUD-07 | Audio in exported MP4 clipped to total export duration | D-23: satisfied by construction — `recorder.stop()` governs duration |
| AUD-08 | Audio toggle state persisted in saved projects and `.storygrid` files | D-27: free — Phase 14 serializes the full LeafNode tree |
| AUD-09 | Audio export Chrome/Firefox only — matches existing video export boundary | AUD-09 is locked by browser support decision in v1.0; no new work |
</phase_requirements>

---

## Summary

Phase 12 adds per-cell audio control to the existing MediaRecorder video export pipeline. The core work is three-layered: (1) a single new boolean field on `LeafNode` plus one store action, (2) two UI touch-points (ActionBar portal and Sidebar panel) that share an icon vocabulary and a single action, and (3) a Web Audio API graph built inside `exportVideoGrid()` that wires `MediaElementAudioSourceNode` instances for audio-enabled cells into a `MediaStreamAudioDestinationNode` whose audio track is merged with the canvas video track before handing off to `new MediaRecorder(...)`.

The critical insight from the codebase audit: `buildExportVideoElements()` currently sets `video.muted = true` unconditionally (line 70 of `videoExport.ts`). This is what must change first — `muted` must become conditional per cell — because a muted `HTMLVideoElement` cannot be tapped by `createMediaElementAudioSourceNode()`. Setting `muted = false` before calling `createMediaElementAudioSourceNode()` is the prerequisite the Web Audio spec requires.

The existing patterns are extremely well-matched to what this phase needs. The Phase 11 `effects` field migration (required field + factory init + test fixture grep) is the exact template for the `audioEnabled` field. The `toggleAudioEnabled` action is a 5-line addition following the fit-toggle pattern in `gridStore.ts`. The three `videoExport.ts` changes are surgical: update `buildExportVideoElements()` signature, add a `buildAudioGraph()` helper, and update `exportVideoGrid()` to conditionally merge the audio track.

**Primary recommendation:** Structure the phase as three plans — (1) data model + store action + fixture migration, (2) UI (ActionBar + Sidebar), (3) export pipeline Web Audio graph. Each plan is independently executable and verifiable.

---

## Standard Stack

### Core (no new dependencies needed)

All required APIs are native browser APIs available in the locked tech stack. Zero new npm packages required for this phase.

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Web Audio API | browser-native | AudioContext, MediaElementAudioSourceNode, MediaStreamAudioDestinationNode | W3C spec; Chrome 35+, Firefox 25+ — well within AUD-09 Chrome/Firefox boundary |
| MediaRecorder API | browser-native | Record combined MediaStream (canvas video + audio) | Already in use in `videoExport.ts` |
| `canvas.captureStream()` | browser-native | Canvas video track | Already in use at videoExport.ts:223 |
| lucide-react | ^1.7.0 (pinned) | `Volume2`, `VolumeX` icons | Already installed; AUD-02 icons specified in D-05 |
| Zustand + Immer | ^5.0.12 + ^10.1.x (pinned) | `toggleAudioEnabled` action | Already installed; same pattern as `updateCell` |

### No New Dependencies

**Installation:** None required. All APIs are either browser-native or already in the project's `package.json`.

---

## Architecture Patterns

### Existing Codebase Structures (verified by direct file reads)

```
src/
├── types/index.ts              # LeafNode type — add audioEnabled: boolean
├── lib/
│   ├── tree.ts                 # createLeaf() at line 94 — add audioEnabled: true
│   └── videoExport.ts          # Three surgical changes (see patterns below)
├── store/
│   └── gridStore.ts            # Add toggleAudioEnabled action
├── Grid/
│   └── ActionBar.tsx           # Add Volume2/VolumeX button between Fit and Clear
└── Editor/
    └── Sidebar.tsx             # Add Playback subsection above EffectsPanel
```

### Pattern 1: Required Field on LeafNode (Phase 11 precedent)

**What:** Add a required boolean field to the `LeafNode` type. No optional/undefined branches.
**When to use:** Any new per-cell state that must always be present.

`src/types/index.ts` — current `LeafNode`:
```typescript
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
  // ADD:
  audioEnabled: boolean;
};
```

`src/lib/tree.ts:94` — `createLeaf()` factory:
```typescript
export function createLeaf(): LeafNode {
  return {
    type: 'leaf',
    id: nanoid(),
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: { ...DEFAULT_EFFECTS },
    audioEnabled: true,  // ADD — always true for new cells
  };
}
```

### Pattern 2: Store Action — toggleAudioEnabled

**What:** Single Immer mutation + `pushSnapshot`. Follows the fit-toggle / `updateCell` shape.
**When to use:** All single-click mutations that enter undo/redo history.

`src/store/gridStore.ts` — new action (add to `GridStoreState` type and store implementation):
```typescript
// In GridStoreState type:
toggleAudioEnabled: (nodeId: string) => void;

// In store implementation:
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

### Pattern 3: ActionBar Audio Button (video-only conditional)

**What:** New button slot between Fit toggle and Clear Media. Gated on `mediaType === 'video'`.
**Existing template:** `hasMedia &&` block at ActionBar.tsx:108 is the exact conditional pattern.

The `ActionBar` currently receives `nodeId`, `fit`, `hasMedia`, `onUploadClick`. It derives `mediaId` from the store (`line 34`). To gate on `mediaType`, the component needs to additionally read `mediaTypeMap[mediaId]` from the store, or the parent can pass `mediaType` as a prop. Both are acceptable per Claude's Discretion.

```tsx
// Option A: read from store inside ActionBar (avoids prop drilling)
const mediaType = useGridStore(s => {
  const leaf = findNode(s.root, nodeId) as LeafNode | null;
  return leaf?.mediaId ? s.mediaTypeMap[leaf.mediaId] ?? null : null;
});

// Button (placed between Fit Tooltip block and hasMedia Clear block):
{mediaType === 'video' && (
  <Tooltip>
    <TooltipTrigger render={
      <button
        className={`${btnClass} ${!audioEnabled ? 'hover:bg-red-500/20' : ''}`}
        onClick={handleToggleAudio}
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
)}
```

### Pattern 4: Sidebar Playback Subsection

**What:** New named subsection in `SelectedCellPanel`, above `<EffectsPanel nodeId={nodeId} />`, video-only.

```tsx
{/* Playback subsection — video cells only (D-10, D-11) */}
{mediaType === 'video' && (
  <div className="space-y-2 border-b border-[#2a2a2a] pb-4 mb-4">
    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Playback</p>
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-400">Cell audio</span>
      <button
        className={`flex items-center justify-center rounded p-2 transition-colors ${
          node.audioEnabled
            ? 'hover:bg-white/10 text-white'
            : 'hover:bg-red-500/20 text-red-500'
        }`}
        onClick={() => toggleAudioEnabled(nodeId)}
        aria-label={node.audioEnabled ? 'Mute cell audio' : 'Unmute cell audio'}
      >
        {node.audioEnabled
          ? <Volume2 size={20} />
          : <VolumeX size={20} />
        }
      </button>
    </div>
  </div>
)}
{/* Effects (Phase 11 — D-10: above existing pan/fit controls) */}
<EffectsPanel nodeId={nodeId} />
```

### Pattern 5: Web Audio Graph in exportVideoGrid

**What:** Three surgical changes to `src/lib/videoExport.ts`.

**Change 1 — `buildExportVideoElements()` signature update:**
```typescript
// Signature change: add leaves parameter for per-cell audioEnabled lookup
async function buildExportVideoElements(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  mediaTypeMap: Record<string, 'image' | 'video'>,
): Promise<Map<string, HTMLVideoElement>>
```
The function already calls `getAllLeaves(root)` internally (line 54). It just needs to use `leaf.audioEnabled` when creating each video element:
```typescript
// In the loop creating each video element:
const leaf = leaves.find(l => l.mediaId === mediaId);
video.muted = !(leaf?.audioEnabled ?? true); // muted=false only for audio-enabled cells
```

**Change 2 — `buildAudioGraph()` new helper:**
```typescript
// Returns MediaStreamAudioDestinationNode or null (null = skip audio merge, AUD-06)
function buildAudioGraph(
  audioCtx: AudioContext,
  exportVideoElements: Map<string, HTMLVideoElement>,
  leaves: LeafNode[],
  mediaTypeMap: Record<string, 'image' | 'video'>,
): MediaStreamAudioDestinationNode | null {
  // Find leaves that are audio-enabled video cells
  const audioLeaves = leaves.filter(l =>
    l.audioEnabled &&
    l.mediaId &&
    mediaTypeMap[l.mediaId] === 'video' &&
    exportVideoElements.has(l.mediaId)
  );

  if (audioLeaves.length === 0) return null; // AUD-06: skip graph

  const destination = audioCtx.createMediaStreamDestination();

  for (const leaf of audioLeaves) {
    const videoEl = exportVideoElements.get(leaf.mediaId!)!;
    // NOTE: videoEl.muted must be false before this call
    const source = audioCtx.createMediaElementSource(videoEl);
    source.connect(destination); // D-18: only destination, NOT audioCtx.destination
  }

  return destination;
}
```

**Change 3 — `exportVideoGrid()` updates:**
```typescript
// After buildExportVideoElements and before recorder.start():
let audioCtx: AudioContext | null = null;
let combinedStream = stream; // default: canvas-only stream

const leaves = getAllLeaves(root);
const audioEnabledVideoLeaves = leaves.filter(l =>
  l.audioEnabled &&
  l.mediaId &&
  mediaTypeMap[l.mediaId] === 'video'
);

if (audioEnabledVideoLeaves.length > 0) {
  try {
    audioCtx = new AudioContext();
    const audioDestination = buildAudioGraph(audioCtx, exportVideoElements, leaves, mediaTypeMap);
    if (audioDestination) {
      const audioTrack = audioDestination.stream.getAudioTracks()[0];
      combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        audioTrack,
      ]);
    }
  } catch (err) {
    // D-20: log and fall back to no-audio export
    console.error('[AudioGraph] Failed to build audio graph, exporting without audio:', err);
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    combinedStream = stream; // fallback to canvas-only
  }
}

// Use combinedStream (not stream) for MediaRecorder:
const recorder = new MediaRecorder(combinedStream, { ... });

// In recorder.onstop:
recorder.onstop = () => {
  destroyExportVideoElements(exportVideoElements);
  audioCtx?.close().catch(() => {}); // D-19: close AudioContext
  const blob = new Blob(chunks, { type: selectedMimeType });
  resolve(blob);
};

// In recorder.onerror:
recorder.onerror = (e) => {
  destroyExportVideoElements(exportVideoElements);
  audioCtx?.close().catch(() => {}); // D-19: close AudioContext
  reject(new Error(...));
};
```

### Anti-Patterns to Avoid

- **Setting `video.muted = true` universally before `createMediaElementAudioSourceNode()`:** The Web Audio API spec requires the source element to NOT be muted. A muted element's audio output is zeroed out before it reaches the graph. This is the primary pitfall identified in the ROADMAP.
- **Connecting source nodes to `audioCtx.destination`:** Per D-18, this would cause the user to hear audio leaking from the editor during export. Only connect to `MediaStreamAudioDestinationNode`.
- **Creating AudioContext outside a user-gesture handler:** Chrome's autoplay policy blocks AudioContext creation without a preceding user gesture. The Export button click is the gesture. The `audioCtx = new AudioContext()` call must be inside the function triggered by that click, not in a useEffect or on mount.
- **Not closing the AudioContext after export:** Audio contexts are a finite browser resource. The `recorder.onstop` and error paths must both call `audioCtx.close()`.
- **Building the graph when zero cells are audio-enabled:** Creates a silent audio track that becomes an empty audio stream in the MP4, violating AUD-06. The `buildAudioGraph()` helper returns `null` in this case; `exportVideoGrid()` must check for null before merging.
- **Using a single MediaElementAudioSourceNode for a mediaId used in multiple cells:** If two cells share the same `mediaId`, `createMediaElementAudioSourceNode()` called twice on the same `HTMLVideoElement` throws `InvalidStateError: HTMLMediaElement already connected`. The `buildExportVideoElements()` function already de-duplicates by `mediaId` (one element per unique mediaId). The audio graph must use the same de-duplication — connect once per video element, not once per leaf.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mixing multiple audio streams | Custom Web Audio mixing | `createMediaElementAudioSourceNode()` + `MediaStreamAudioDestinationNode` | Handles sample rate negotiation, codec compatibility, timing automatically |
| Audio track injection into MediaStream | Custom byte-level stream manipulation | `new MediaStream([...videoTracks, audioTrack])` | Native API; supported in Chrome/Firefox exactly matching AUD-09 boundary |
| AudioContext user-gesture lifecycle | Custom gesture-detection | Export button handler IS the gesture | Browser policy is satisfied by construction; no extra plumbing |
| Silent audio track for zero-enabled cells | Generate silence bytes | Skip graph entirely (AUD-06) | Zero-audio-track MP4 is valid; silent track adds unnecessary complexity |
| Per-frame audio synchronization | Custom audio seek during render loop | Natural playback — `muted = false` + `MediaElementAudioSourceNode` | MediaRecorder records the live audio stream in real time alongside the canvas frames |

**Key insight:** The Web Audio API's `MediaStreamAudioDestinationNode` is designed exactly for this use case — combining audio from multiple media elements into a single `MediaStream` that can be fed to `MediaRecorder`. No custom audio plumbing is needed.

---

## Common Pitfalls

### Pitfall 1: `video.muted = true` blocks createMediaElementAudioSourceNode
**What goes wrong:** The exported MP4 has no audio even though the graph was built correctly.
**Why it happens:** `buildExportVideoElements()` currently sets `video.muted = true` unconditionally (line 70). A muted HTMLVideoElement does not emit audio into a connected AudioContext graph. The Web Audio API routes post-mute zeroed samples.
**How to avoid:** Change line 70 to be conditional: `video.muted = !(audioEnabled for this mediaId)`. The `buildExportVideoElements()` function already iterates leaves (line 54), so the `audioEnabled` lookup is a one-liner per leaf.
**Warning signs:** Audio graph built (destination returned non-null), audio track present in combined stream, but exported MP4 has silence.

### Pitfall 2: Same mediaId used in multiple leaves — duplicate createMediaElementAudioSourceNode
**What goes wrong:** `InvalidStateError: HTMLMediaElement already connected previously` thrown when wiring the audio graph.
**Why it happens:** Two cells can share the same `mediaId` (same video file dragged into two cells). `buildExportVideoElements()` de-dupes by mediaId (one element per unique mediaId). But `buildAudioGraph()` iterating `audioLeaves` might attempt to call `createMediaElementAudioSourceNode` twice on the same element.
**How to avoid:** In `buildAudioGraph()`, track which mediaIds have already been connected via a `Set<string>`. Skip duplicates.
**Warning signs:** Export throws `InvalidStateError` with two cells showing the same video.

### Pitfall 3: AudioContext not in resumed state when recording starts
**What goes wrong:** Audio graph is wired correctly but no audio appears in the exported MP4.
**Why it happens:** Chrome's autoplay policy can start `AudioContext` in `suspended` state even after a user gesture in some browser versions.
**How to avoid:** After `new AudioContext()`, check `audioCtx.state === 'suspended'` and call `await audioCtx.resume()` before wiring the graph.
**Warning signs:** `audioCtx.state` is `'suspended'` immediately after creation; debug by logging state.

### Pitfall 4: AudioContext closed before MediaRecorder stops
**What goes wrong:** The exported MP4 has partial or no audio — the audio track goes silent partway through.
**Why it happens:** If `audioCtx.close()` is called before `recorder.stop()` (or before `recorder.onstop` fires), the `MediaStreamAudioDestinationNode` stops producing samples.
**How to avoid:** Close the AudioContext ONLY inside `recorder.onstop` and the error path — the same places `destroyExportVideoElements()` is called. Never close it before the recorder stops.
**Warning signs:** MP4 has audio for the first N seconds then silence; N corresponds to when audioCtx was mistakenly closed.

### Pitfall 5: MediaRecorder mime type and audio codec compatibility
**What goes wrong:** `MediaRecorder.isTypeSupported()` returns `false` for mime types that include an explicit audio codec alongside the video codec.
**Why it happens:** The current mime type list in `exportVideoGrid()` only specifies video codecs. Adding an audio track doesn't require changing the mime type — MediaRecorder automatically muxes audio and video from the combined MediaStream. However, if explicit audio codec strings are added (e.g., `video/mp4;codecs=avc1.42E01E,mp4a.40.2`), browser support varies.
**How to avoid:** Do NOT change the existing mime type list. Pass the combined `MediaStream` to `new MediaRecorder(combinedStream, { mimeType: selectedMimeType })` unchanged. The browser handles audio codec selection automatically.
**Warning signs:** `new MediaRecorder(combinedStream, { mimeType })` throws `NotSupportedError` after adding audio track.

### Pitfall 6: Test fixture missing audioEnabled field causes TypeScript build failures
**What goes wrong:** After adding `audioEnabled: boolean` as a required field to `LeafNode`, the TypeScript compiler errors on all 25 test files that construct `LeafNode` literals without the new field.
**Why it happens:** The field is required (not optional), matching the Phase 11 `effects` precedent. TypeScript strictly checks object literal shape.
**How to avoid:** Update all `makeLeaf` helpers and inline `LeafNode` literals in the 25 identified test files to include `audioEnabled: true` (or `false` where the test specifically exercises the muted case).
**Warning signs:** `npm run build` or `vitest` fails immediately after type change with "Property 'audioEnabled' is missing in type..."

---

## Code Examples

Verified from `src/lib/videoExport.ts` (direct read):

### Current stream construction (videoExport.ts:223)
```typescript
// CURRENT — canvas-only stream:
const stream = (stableCanvas as unknown as { captureStream(fps: number): MediaStream })
  .captureStream(FPS);

// NEW — conditionally merged stream (passes to new MediaRecorder):
const combinedStream = audioDestination
  ? new MediaStream([...stream.getVideoTracks(), audioDestination.stream.getAudioTracks()[0]])
  : stream;
```

### Current MediaRecorder construction (videoExport.ts:286)
```typescript
// CURRENT:
const recorder = new MediaRecorder(stream, {
  mimeType: selectedMimeType,
  videoBitsPerSecond: 6_000_000,
});

// CHANGE to:
const recorder = new MediaRecorder(combinedStream, {
  mimeType: selectedMimeType,
  videoBitsPerSecond: 6_000_000,
  // Do NOT add audioBitsPerSecond — let browser choose default
});
```

### AudioContext safety pattern (resume check)
```typescript
// Source: Web Audio API spec + MDN (browser behavior verified)
audioCtx = new AudioContext();
if (audioCtx.state === 'suspended') {
  await audioCtx.resume();
}
```

### toggleAudioEnabled store action (follows updateCell pattern from gridStore.ts:211)
```typescript
// From gridStore.ts updateCell (reference pattern):
updateCell: (nodeId, updates) =>
  set(state => {
    pushSnapshot(state);
    state.root = updateLeaf(current(state.root), nodeId, updates);
  }),

// New toggleAudioEnabled (same shape):
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

---

## Runtime State Inventory

Step 2.5: SKIPPED — this phase adds a new field to an in-memory data model. There are no stored databases, live service configurations, OS-registered state, or build artifacts that embed any string being renamed. The `audioEnabled` field is new; no migration of existing data is required beyond TypeScript type updates.

---

## Environment Availability

Step 2.6: Web Audio API and MediaStream API are browser-native; no CLI tools or services to probe.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Web Audio API (AudioContext) | AUD-05 audio graph | ✓ (Chrome 35+, Firefox 25+) | browser-native | Log error + fall back to no-audio export (D-20) |
| `canvas.captureStream()` | AUD-05 combined stream | ✓ (already in use) | browser-native | — |
| `MediaRecorder` with audio | AUD-05 | ✓ (already in use for video-only) | browser-native | — |
| `Volume2`, `VolumeX` lucide-react icons | AUD-02, AUD-04 | ✓ (lucide-react ^1.7.0 installed) | ^1.7.0 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** AudioContext failure → D-20 fall back to no-audio export (graceful degradation, not a hard blocker).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts at project root) |
| Config file | `vitest.config.ts` — jsdom environment, `src/test/setup.ts` setup file |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUD-01 | `createLeaf()` returns `audioEnabled: true`; `LeafNode` type enforces field presence | unit | `npx vitest run src/test/tree-functions.test.ts -t "createLeaf"` | ❌ Wave 0 — add test |
| AUD-01 | `toggleAudioEnabled` flips boolean and pushes one snapshot | unit | `npx vitest run src/store/gridStore.test.ts -t "toggleAudioEnabled"` | ❌ Wave 0 — add describe block |
| AUD-02 | Audio button renders only when mediaType='video', not for images or empty cells | unit | `npx vitest run src/Grid/__tests__/ActionBar.test.tsx -t "audio"` | ❌ Wave 0 — add describe block |
| AUD-03 | Clicking audio button calls `toggleAudioEnabled` | unit | `npx vitest run src/Grid/__tests__/ActionBar.test.tsx -t "audio toggle"` | ❌ Wave 0 |
| AUD-04 | Sidebar Playback section renders for video cells, not image cells | unit | `npx vitest run src/test/sidebar.test.tsx -t "playback"` | ❌ Wave 0 |
| AUD-05 | `buildAudioGraph` returns destination node for 1+ audio-enabled video leaf | unit | `npx vitest run src/test/videoExport-audio.test.ts -t "buildAudioGraph"` | ❌ Wave 0 — new file |
| AUD-06 | `buildAudioGraph` returns null when zero cells have audioEnabled=true | unit | `npx vitest run src/test/videoExport-audio.test.ts -t "no audio"` | ❌ Wave 0 — new file |
| AUD-07 | Audio duration clipping: satisfied by construction (no isolated unit test needed) | N/A — verified by AUD-05 integration | — | N/A |
| AUD-08 | `audioEnabled` field survives store serialize/deserialize round-trip | unit | `npx vitest run src/store/gridStore.test.ts -t "audioEnabled"` | ❌ Wave 0 |
| AUD-09 | No-op — browser support gate is enforced by existing MediaRecorder check in exportVideoGrid | existing | `npx vitest run src/test/videoExport-loop.test.ts` | ✅ |
| D-28 | TypeScript build green after adding required `audioEnabled` field | build | `npx tsc --noEmit` | ✅ (after fixture migration) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/videoExport-audio.test.ts` — new file; covers AUD-05 (`buildAudioGraph` wires source nodes), AUD-06 (returns null for zero audio-enabled cells), de-duplication of shared mediaId
- [ ] Add `toggleAudioEnabled` describe block to `src/store/gridStore.test.ts` — covers AUD-01 (flip + one snapshot), AUD-08 (field persistence across undo/redo)
- [ ] Add `audio button` describe block to `src/Grid/__tests__/ActionBar.test.tsx` — covers AUD-02 (video-only visibility), AUD-03 (calls toggleAudioEnabled)
- [ ] Add `playback section` describe block to `src/test/sidebar.test.tsx` — covers AUD-04 (video-only visibility, icon state matches audioEnabled)
- [ ] Fixture migration across 25 files — add `audioEnabled: true` to all `makeLeaf` helpers and inline `LeafNode` literals. Files identified: `src/test/action-bar.test.tsx` (makeLeaf at line 19), `src/Grid/__tests__/ActionBar.test.tsx`, and 23 others (full list: grep `type: 'leaf'` across `src/`).

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| ffmpeg.wasm for video export | MediaRecorder + canvas.captureStream (switched in Phase quick-260405-s9u) | This phase builds on MediaRecorder — correct foundation |
| HTMLVideoElement.muted=true unconditionally in buildExportVideoElements | muted conditional on audioEnabled (Phase 12 change) | The muted=true default was correct for video-only export; becomes conditional now |

---

## Open Questions

1. **AudioContext state on Firefox vs Chrome after user gesture**
   - What we know: Chrome occasionally starts AudioContext in `suspended` state even after a user gesture click (depends on Chrome version and page state); `await audioCtx.resume()` is the fix.
   - What's unclear: Whether Firefox has the same behavior.
   - Recommendation: Always call `await audioCtx.resume()` after construction regardless of browser. Adds one microtask; no downside.

2. **Multiple cells sharing the same video mediaId in audio graph**
   - What we know: `buildExportVideoElements()` creates one `HTMLVideoElement` per unique `mediaId`. Calling `createMediaElementAudioSourceNode()` twice on the same element throws `InvalidStateError`.
   - What's unclear: Whether this scenario is common enough to need explicit testing vs just being documented.
   - Recommendation: Track connected mediaIds in a `Set` inside `buildAudioGraph()`. Add a test case for this in the Wave 0 `videoExport-audio.test.ts`.

3. **Combined MediaStream and MP4 audio codec**
   - What we know: MediaRecorder with a combined audio+video stream automatically selects an audio codec when using `video/mp4` or `video/webm` mime types without explicit codec strings. The selected codec (AAC for MP4, Opus for WebM) is browser-determined.
   - What's unclear: Whether `video/mp4;codecs=avc1.42E01E` (the preferred mime type) triggers a `NotSupportedError` when an audio track is added without an explicit audio codec.
   - Recommendation: Test `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E')` with a combined stream in the export path. If it fails, fall back to `video/mp4` (generic, which allows browser to auto-select codecs including audio). The existing mime type fallback list already handles this gracefully.

---

## Sources

### Primary (HIGH confidence)
- Direct read: `src/lib/videoExport.ts` — full MediaRecorder pipeline; stream construction at line 223; muted=true at line 70; MediaRecorder construction at line 286
- Direct read: `src/types/index.ts` — current LeafNode type definition
- Direct read: `src/store/gridStore.ts` — updateCell/setEffects patterns; pushSnapshot helper
- Direct read: `src/Grid/ActionBar.tsx` — existing button structure, hasMedia conditional at line 108
- Direct read: `src/Editor/Sidebar.tsx` — SelectedCellPanel structure, EffectsPanel placement
- Direct read: `src/lib/tree.ts:94` — createLeaf() factory; effects: { ...DEFAULT_EFFECTS } is the precedent
- Direct read: `src/lib/effects.ts` — EffectSettings type, DEFAULT_EFFECTS pattern (Phase 11 precedent for required field)
- Direct read: `.planning/phases/12-per-cell-audio-toggle/12-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- MDN Web Audio API: `createMediaElementSource()` requires element to NOT be muted — behavior documented in spec (W3C Web Audio API §5.4)
- MDN MediaStream: `new MediaStream([...tracks])` constructor accepts array of tracks — standard API
- MDN AudioContext: `resume()` after `suspended` state — documented best practice for user-gesture contexts

### Tertiary (LOW confidence)
- AudioContext `suspended` state on Firefox vs Chrome — from developer community documentation; not independently verified for all browser versions in scope

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all needed APIs are browser-native and already partially in use
- Architecture: HIGH — verified directly from codebase reads; no speculation
- Pitfalls: HIGH for pitfalls 1/2/5/6 (verified from code); MEDIUM for pitfalls 3/4 (based on Web Audio API spec behavior)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable APIs; no new library versions needed)
