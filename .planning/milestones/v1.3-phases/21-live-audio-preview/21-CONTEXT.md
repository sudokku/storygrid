# Phase 21: Live Audio Preview - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up Web Audio API so unmuted video cells produce audible output through the speakers during editor playback. The visual mute state (`audioEnabled` + `hasAudioTrack`) from Phase 19 now drives a real `AudioContext` mix. Zero visual changes — this is pure audio routing logic.

**In scope:** AudioContext creation, MediaElementAudioSourceNode wiring, GainNode per cell, normalized volume mixing, real-time mute reactivity, autoplay policy compliance.

**Out of scope:** Video export audio (separate pipeline in videoExport.ts), any visual changes to PlaybackTimeline, volume UI controls, per-cell volume sliders.

</domain>

<decisions>
## Implementation Decisions

### D-01: Implementation home — `useAudioMix` hook
- Audio wiring lives in `src/hooks/useAudioMix.ts`.
- `PlaybackTimeline.tsx` calls `useAudioMix()` and receives `{ startAudio, stopAudio }` (or similar interface).
- Keeps PlaybackTimeline.tsx small. Isolates all Web Audio API code for independent testing.

### D-02: AudioContext lifetime — create once, suspend/resume
- AudioContext is created **synchronously inside the play button's click handler** (SC4 — satisfies browser autoplay policy).
- After creation, the context is stored in a `useRef` and persists for the component/hook lifetime.
- On subsequent play presses: `audioContext.resume()` (not a new context).
- On pause: `audioContext.suspend()`.
- This satisfies SC5: one `MediaElementAudioSourceNode` per `HTMLVideoElement` per `AudioContext` lifetime — nodes are never recreated.

### D-03: Node graph — GainNode per cell, gated not recreated
- On first play, for each video in `videoElementRegistry`:
  - Check `audioEnabled && hasAudioTrack` from gridStore leaf state.
  - Create `MediaElementAudioSourceNode` from the `HTMLVideoElement`.
  - Create `GainNode` (gain = 0 or normalized value, see D-04).
  - Wire: `sourceNode → gainNode → audioContext.destination`.
  - Store `Map<nodeId, { sourceNode, gainNode }>` in a ref — never recreated.
- On subsequent plays: reuse existing nodes, just update gain values and `resume()` the context.

### D-04: Volume mixing — normalized 1/N gain
- Active audio cells = cells where `audioEnabled=true && hasAudioTrack=true`.
- Each active cell's `GainNode.gain.value = 1 / activeCount`.
- Muted cells (audioEnabled=false OR hasAudioTrack=false): `GainNode.gain.value = 0`.
- If `activeCount === 0`: no audio plays (gain stays 0 for all).
- Recompute gains whenever mute state changes (see D-05).

### D-05: Mute reactivity — real-time during playback
- `useAudioMix` subscribes to gridStore leaf state.
- When `audioEnabled` or `hasAudioTrack` changes on any leaf while `isPlaying=true`:
  - Recompute `activeCount`.
  - Update all `GainNode.gain.value` immediately (instantaneous, no ramp needed).
- When not playing, gain values are updated at next play start.

### D-06: Autoplay policy compliance
- `AudioContext` construction is called in the synchronous call stack of the play button's `click` event (SC4).
- `video.muted = true` is already set in `LeafNode.tsx:197` — this is required for Web Audio routing to work in all target browsers (Chrome/Firefox/Safari).

### Claude's Discretion
- Exact hook interface shape (`startAudio(nodeIds)` vs. reactive effect watching `isPlaying`).
- Whether `suspend()`/`resume()` or `close()`/`new AudioContext()` is used (suspend/resume preferred per D-02).
- Error handling for `InvalidStateError` on rapid pause/resume (SC5 — use try/catch or guard against already-suspended state).
- Whether `GainNode.gain.setTargetAtTime()` is used for smoother mute transitions vs. instant value assignment.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Files
- `src/Editor/PlaybackTimeline.tsx` — entry point; `handlePlayPause()` is where AudioContext must be created/resumed
- `src/lib/videoRegistry.ts` — `videoElementRegistry` Map<nodeId, HTMLVideoElement> used to wire audio sources
- `src/store/gridStore.ts:222–239` — `toggleAudioEnabled` action and `setHasAudioTrack`; leaf shape with `audioEnabled` and `hasAudioTrack`
- `src/types/index.ts:20–21` — `LeafNode.audioEnabled` and `LeafNode.hasAudioTrack` field definitions
- `src/Grid/LeafNode.tsx:197` — `video.muted = true` — already set; required for Web Audio routing

### New File to Create
- `src/hooks/useAudioMix.ts` — all Web Audio API logic lives here

### Requirements
- `.planning/ROADMAP.md §Phase 21` — success criteria SC1–SC5 are the acceptance gates
- `.planning/STATE.md` — note: "Phase 21 LAUD depends on Phase 19 because hasAudioTrack must be reliable before AudioContext wiring — MUTE-01 is the prerequisite for LAUD-03"

</canonical_refs>

<code_context>
## Existing Code Insights

### videoElementRegistry
- `src/lib/videoRegistry.ts` — `Map<string, HTMLVideoElement>` with `registerVideo(nodeId, video, draw)` and `unregisterVideo(nodeId)`.
- All video elements that are currently mounted and loaded are in this registry.
- No audio metadata stored here — audio state comes from gridStore leaves.

### PlaybackTimeline play/pause flow
- `handlePlayPause()` (line 57) — synchronous function called via `onClick`.
- Play path: iterates `videoElementRegistry`, calls `video.play()`, calls `store.setIsPlaying(true)`.
- Pause path: iterates `videoElementRegistry`, calls `video.pause()`, calls `store.setIsPlaying(false)`.
- AudioContext creation/resume must be added here (in the synchronous call path).

### gridStore leaf reading
- `useGridStore.getState()` can be called outside React render (in event handlers, effects) to read current leaf state.
- To get all leaves with audio state, walk the tree from `root` or use a selector.
- `toggleAudioEnabled` (line 222) mutates `leaf.audioEnabled` and recalculates normalized gains must react to this.

### video.muted = true
- Already set in LeafNode.tsx — this is a prerequisite for `createMediaElementSource()` to work in Chrome/Safari without throwing or silencing the audio.

</code_context>
