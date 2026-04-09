# Phase 12: Per-Cell Audio Toggle - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-cell audio on/off for video cells. Each video LeafNode carries a boolean `audioEnabled` field. A speaker icon in the portal ActionBar and a parallel control in the sidebar toggle the field; the icon is only visible for cells whose media is a video. MP4 export builds a Web Audio API graph from all audio-enabled cells, merges it with the existing `canvas.captureStream()` video track, and feeds the combined `MediaStream` to the existing MediaRecorder pipeline. When zero cells have audio enabled, the Web Audio graph is skipped entirely and the exported MP4 has no audio track (not a silent one).

**Explicitly NOT in scope:** background music, per-cell volume sliders, trim/fade UI, audio preview during editing, audio visualization, Safari support for audio export.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01:** Add a required `audioEnabled: boolean` field to `LeafNode` in `src/types/index.ts`. Always present — no optional/undefined branches anywhere downstream. Matches the Phase 11 pattern for `effects`.
- **D-02:** Default value is `true` uniformly — applied in both `createLeafNode()` (`src/lib/tree.ts:94` next to the `effects` init) AND anywhere an existing cell is rehydrated without the field. There is no "new vs existing" branch: if `audioEnabled` is missing, it becomes `true`. Returning videos already have sound; that's the expectation.
- **D-03:** The field lives on every LeafNode regardless of `mediaType`. Image cells keep `audioEnabled: true` by default — it's inert for them (UI hides the control, export ignores them). Cheaper than conditionalizing the type union.

### ActionBar UI
- **D-04:** Speaker icon sits **after the Fit toggle and before the Clear-media button** in the portal ActionBar row. New order for video cells: `Drag | Upload | Split H | Split V | Fit | Audio | [Clear] | Remove`. Image cells keep the existing order (no Audio slot).
- **D-05:** Icons: **`Volume2` from lucide-react for audio-on, `VolumeX` for muted.** Clearest convention, most direct affordance.
- **D-06:** Muted-state styling reuses the existing destructive/red pattern from Trash and Clear: `text-red-500` on the icon and `hover:bg-red-500/20` on the button wrapper. Audio-on state uses the default `text-white` matching the other ActionBar icons.
- **D-07:** Visibility gate: render the audio button **only when the selected cell's `mediaType === 'video'`**. Planner must read `mediaTypeMap[mediaId]` (same pattern as existing media-aware code paths) or add a `mediaType` prop to `ActionBar` alongside the existing `hasMedia`/`fit` props.
- **D-08:** Button sizing matches the existing ActionBar buttons — fixed `w-16 h-16` with `ICON_SIZE = 32`. No new sizing primitives.
- **D-09:** Tooltip copy: "Mute cell audio" when unmuted, "Unmute cell audio" when muted. Consistent with the existing Tooltip pattern in `ActionBar.tsx`.

### Sidebar UI
- **D-10:** Add a new **"Playback"** subsection inside `SelectedCellPanel` (`src/Editor/Sidebar.tsx`) that renders ONLY for video cells. Position: **above the existing EffectsPanel** (so the visual flow from top is: cell info → pan/fit → Playback → Effects → resets). EffectsPanel is not modified.
- **D-11:** The Playback subsection currently holds only the audio toggle. The subsection exists as a forward-looking container — future audio/video-behavior controls (loop trim, playback speed) could land here without a refactor.
- **D-12:** The audio control in the sidebar is an **icon button matching the ActionBar** — same `Volume2`/`VolumeX` icon, same red-when-muted styling, sized for the sidebar row (planner's call on exact px, likely 44px for touch). Tight parity by design: one visual vocabulary for audio state across both surfaces.
- **D-13:** Sidebar and ActionBar both call the same toggle action — they are not independent event paths. Clicking either updates the same `audioEnabled` field with identical semantics.
- **D-14:** `MobileSheet` inherits the Playback subsection via the existing shared `SelectedCellPanel` import — no mobile-specific layout work required.

### Export Pipeline (Web Audio Graph)
- **D-15:** Export gate: **iff at least one audio-enabled cell has `mediaType === 'video'`, build the Web Audio graph. Otherwise skip it entirely** and fall through to the existing canvas-only MediaStream path. No silent audio track is ever created (AUD-06).
- **D-16:** Graph shape — one `AudioContext` per export, created inside the Export button handler (satisfies the user-gesture requirement). For each audio-enabled video cell: create a `MediaElementAudioSourceNode` from the dedicated export video element, connect it to a single shared `MediaStreamAudioDestinationNode`. Take `destination.stream.getAudioTracks()[0]` and merge it into the existing `canvas.captureStream()` via `new MediaStream([...videoTracks, audioTrack])`. Feed that combined stream to `new MediaRecorder(...)`.
- **D-17:** Per the ROADMAP pitfall: the dedicated export video elements in `buildExportVideoElements()` (`src/lib/videoExport.ts:44`) currently set `video.muted = true` unconditionally. This must become conditional — **set `muted = false` for cells where `audioEnabled === true`, and `muted = true` for audio-disabled cells**. This is what allows `createMediaElementAudioSource()` to produce a real audio stream.
- **D-18:** Do NOT also connect the source nodes to `audioCtx.destination`. Preview audio during export is explicitly out of scope; the user should not hear audio leaking from the editor while export is running.
- **D-19:** `AudioContext` lifecycle: create at export start (after the user-gesture click), close it in both the `recorder.onstop` success path and the `recorder.onerror` / catch path (alongside `destroyExportVideoElements`). No global/shared AudioContext.
- **D-20:** Error handling: if `new AudioContext()` throws or `createMediaElementSource()` throws for any cell, **log the error and fall back to the existing no-audio export path** — do not fail the whole export. The user still gets a video file; it just has no audio. Planner decides whether to surface a toast ("Audio export unavailable in this browser — export continuing without audio").

### Export Loop Audio Behavior
- **D-21:** **Accept the loop-boundary audio click as-is.** No crossfade, no GainNode automation, no special handling. When `video.currentTime = loopedTime` is called inside the render loop (`src/lib/videoExport.ts:358`), whatever the `MediaElementAudioSourceNode` does naturally is what gets recorded. Matches the "small, fast tool" philosophy and keeps the Web Audio graph as minimal as possible.
- **D-22:** **Audio loops with the video.** A 3-second video inside a 10-second export loops its audio visually and audibly — "what you see is what you hear." No decoupled audio lifetime, no "play audio once then silence" special case. The existing `computeLoopedTime()` + seek behavior in `videoExport.ts` already handles this for free once `muted = false` is set on the relevant elements.
- **D-23:** Audio clipping to total video export duration (AUD-07) is satisfied by construction — `recorder.stop()` fires at `elapsed >= totalDurationMs` and `destination.stream` stops producing samples when the context closes. No explicit clipping logic needed.

### Store & History
- **D-24:** Add a `toggleAudioEnabled(nodeId)` action to `gridStore.ts` that flips the field via Immer AND calls `pushSnapshot` exactly once. Consistent with the existing `updateCell` / fit-toggle pattern.
- **D-25:** Every toggle click is part of undo/redo history — one snapshot per click. Ctrl+Z undoes an accidental mute. No special non-snapshot path; audio toggle is a normal mutating action.
- **D-26:** The sidebar and ActionBar button handlers both call `toggleAudioEnabled(nodeId)` — single action, single code path, single history entry per click regardless of which surface was clicked.
- **D-27:** AUD-08 (persistence in saved projects / `.storygrid` files) is satisfied automatically because `audioEnabled` lives on the LeafNode — whatever serialization Phase 14 ships will include it by default. No per-phase persistence work needed here.

### Test Fixture Migration
- **D-28:** Every test that constructs a `LeafNode` literal needs an `audioEnabled: true` (or `false` where the test is specifically about the muted case) field added. Planner should grep for `LeafNode` literals and update them alongside the type change, same way Phase 11 updated fixtures for `effects: DEFAULT_EFFECTS`.

### Claude's Discretion
- Exact tooltip copy wording (beyond the recommended "Mute/Unmute cell audio").
- Whether to surface a toast when AudioContext init fails, or log-and-continue silently.
- Exact pixel size of the sidebar audio button (44px is the Phase 5.1 mobile target; planner picks).
- Whether `toggleAudioEnabled(nodeId)` is its own action or a thin wrapper over `updateCell(nodeId, { audioEnabled: ... })`.
- Visual treatment of the "Playback" subsection label (title row, collapsible, plain header, etc.).
- Whether to add a `mediaType` prop to `ActionBar` or read it from the store via `mediaTypeMap[mediaId]` — both acceptable; pick whichever is less churn.
- Whether the `MediaStreamAudioDestinationNode` approach or `AudioContext.createMediaStreamDestination()` is used — they are the same thing, naming call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Per-Cell Audio — AUD-01 through AUD-09, the acceptance criteria this phase must satisfy
- `.planning/ROADMAP.md` §Phase 12 — goal, success criteria, and key pitfalls summary (pipeline rewrite, not a flag; createMediaElementAudioSourceNode() muted=true blocker; zero-enabled → skip graph entirely)

### Prior Phase Context (relevant decisions carried forward)
- `.planning/milestones/v1.0-phases/06-video-support-v2/06-CONTEXT.md` — Video element integration, blob URL handling, MediaRecorder export architecture
- `.planning/phases/11-effects-filters/11-CONTEXT.md` — Pattern for adding required fields to LeafNode (D-05 in that doc mirrors D-01 here); factory + test-fixture migration approach; single-action-one-snapshot pattern
- `.planning/milestones/v1.0-phases/01-grid-tree-engine/01-CONTEXT.md` — `pushSnapshot` pattern, history cap of 50

### Existing Code (must read before planning)
- `src/lib/videoExport.ts` — Full MediaRecorder export pipeline; `buildExportVideoElements()` is where `muted = false` must become conditional; `canvas.captureStream()` + merged `MediaStream` construction is where the audio track plugs in
- `src/Grid/ActionBar.tsx` — Portal ActionBar component; new button slot lands between the Fit `Tooltip` block and the `hasMedia && <Clear>` block
- `src/Editor/Sidebar.tsx` — `SelectedCellPanel` host for the new "Playback" subsection above EffectsPanel
- `src/store/gridStore.ts` — Location for `toggleAudioEnabled` action; follow the existing `updateCell`/`setEffects` patterns
- `src/types/index.ts` — `LeafNode` type definition (single source of truth for the new field)
- `src/lib/tree.ts` — `createLeafNode()` factory; add `audioEnabled: true` default alongside the existing `effects: { ...DEFAULT_EFFECTS }` init at line 94

### Project
- `.planning/PROJECT.md` — Vision, v1.2 scope, browser support constraints (Chrome/Firefox only for video export, AUD-09)
- `CLAUDE.md` §Tech Stack — Vite 8, React 18, Zustand 5, Immer 10, Tailwind 3.4 (locked)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/videoExport.ts:44-105` — `buildExportVideoElements()` creates dedicated detached `<video>` elements per unique video mediaId. Currently hardcodes `video.muted = true`. This is the single site where `muted = false` must be applied for audio-enabled cells. Planner will need to pass through the tree (or a per-mediaId audioEnabled map derived from leaves) to make this decision per element.
- `src/lib/videoExport.ts:223` — `canvas.captureStream(FPS)` returns a `MediaStream` with only a video track. Merging audio is a matter of constructing a new `MediaStream([...videoStream.getVideoTracks(), audioDestNode.stream.getAudioTracks()[0]])` and passing THAT to `new MediaRecorder(...)`.
- `src/Grid/ActionBar.tsx` — Portal-rendered ActionBar at fixed `w-16 h-16` per button. Existing `hasMedia` conditional at line 108 for Clear button is the exact template for the new video-only Audio button conditional (on `mediaType === 'video'`). `Tooltip` + `TooltipTrigger` wrapping pattern is reusable verbatim.
- `src/Editor/Sidebar.tsx` `SelectedCellPanel` — React.memo component with `key={selectedNodeId}` for clean remounts. New "Playback" subsection inserts above the existing Effects panel.
- `src/store/gridStore.ts` — `updateCell` and `setEffects`/`commitEffects` patterns already demonstrate the "Immer update + pushSnapshot once" shape. `toggleAudioEnabled` is a 5-line addition.
- `src/lib/tree.ts:94` — `createLeafNode()` factory; one-line addition (`audioEnabled: true`) alongside `effects: { ...DEFAULT_EFFECTS }`.

### Established Patterns
- **Portal-based ActionBar, fixed 64px buttons** (Phase 10 decision) — new slot inherits these constraints without any sizing work.
- **Required field on LeafNode, not optional** (Phase 11 `effects` precedent) — migration story is: update `src/types/index.ts`, update `createLeafNode`, grep-and-fix test fixtures, done.
- **One action = one snapshot** — audio toggle is a standard single-click mutation like fit toggle.
- **Unified render path for editor and export** (Phase 11 restated) — N/A for audio since preview has no audio, but the export-time graph construction must happen exactly once per export, in the same place the video element lifecycle is managed.
- **mediaRegistry + mediaTypeMap parallel to tree** — Audio graph construction reads `mediaTypeMap[mediaId] === 'video'` + leaf.audioEnabled to decide per-cell inclusion. Same lookup pattern as `buildExportVideoElements` already uses.

### Integration Points
- `src/types/index.ts` — Add `audioEnabled: boolean` to `LeafNode`.
- `src/lib/tree.ts:94` — Initialize `audioEnabled: true` in `createLeafNode()`.
- `src/store/gridStore.ts` — Add `toggleAudioEnabled(nodeId)` action.
- `src/Grid/ActionBar.tsx` — Add audio button between Fit and Clear; wire to `toggleAudioEnabled` and the cell's current `audioEnabled` state; gate on video mediaType.
- `src/Editor/Sidebar.tsx` — Add Playback subsection with audio icon button above EffectsPanel; video-only visibility.
- `src/lib/videoExport.ts` — Three changes:
  1. `buildExportVideoElements()` signature takes the tree/leaves so it can set `muted` per-element based on `audioEnabled`.
  2. New helper `buildAudioGraph(audioCtx, exportVideoElements, leaves)` that returns a `MediaStreamAudioDestinationNode` or `null` (null = skip audio merge).
  3. `exportVideoGrid()` constructs the merged `MediaStream` conditionally, creates/closes the AudioContext around the recorder lifecycle.
- Test fixtures (grep for `LeafNode` literal construction across `src/**/*.test.*` and `src/Editor/__tests__/`) — add `audioEnabled: true` field.

### Creative Options
- The Web Audio graph construction is a pure-enough function to unit test with a mocked AudioContext — return the destination node's track count given a tree of leaves + mediaTypeMap. Planner may want a dedicated `buildAudioGraph()` module.
- `mediaTypeMap[mediaId]` lookup could be promoted into a tiny helper `isVideoLeaf(leaf, mediaTypeMap)` used by both ActionBar visibility and audio graph inclusion.

</code_context>

<specifics>
## Specific Ideas

- **Visual convention:** Volume2 + red-when-muted matches the existing destructive action vocabulary (Trash/Clear) — "muted = this cell is excluded from something important, just like clear/remove."
- **Minimalism framing:** "Ship the click. It's a small fast tool." The loop-boundary audio click is explicitly accepted as the cheapest correct behavior rather than engineering a crossfade.
- **Parity first:** ActionBar and Sidebar audio buttons are intentionally the *same* visual primitive — the sidebar is NOT a labeled switch or a text button. One vocabulary, two surfaces.
- **Future-proof slot:** The "Playback" subsection in the sidebar is named that way (not "Audio") so future playback-behavior controls (loop count, trim in/out, speed) can land in the same container without a rename or refactor.
- **AUD-08 is free:** Because `audioEnabled` is just another field on LeafNode, Phase 14 persistence will serialize it automatically. No persistence work in Phase 12.
- **Fallback philosophy:** If Web Audio initialization fails for any reason, the export must still succeed producing a silent-video file. User preference established in Phase 11: small fast tool, modern browsers, don't engineer fallbacks for edge cases that don't affect >1% of users — but DO fail-soft within the supported browsers.

</specifics>

<deferred>
## Deferred Ideas

- **Audio preview during editing** — explicitly out of scope. Editor remains silent; audio is an export-only concern in Phase 12.
- **Per-cell volume slider** — not in AUD-01..AUD-09; out of scope. If requested, it's a future v1.3+ feature.
- **Background music / audio track upload** — explicitly deferred per PROJECT.md current milestone scope ("Simple and explicit — no background music, no mixing UI beyond the toggle").
- **Audio crossfade at loop boundaries** — rejected as over-engineering. If users complain about the click, revisit post-v1.2 with a GainNode + rAF ramp.
- **"Play audio once then silence" alternate mode** — rejected. Audio loops with the video; visual and auditory loops stay in sync.
- **Safari audio export** — explicitly deferred (AUD-09 locks Chrome/Firefox only; matches existing video export boundary).
- **Audio level meter / waveform in sidebar** — out of scope. No visualization.
- **Trim in/out points per cell** — out of scope. Future content for the Playback subsection if pursued.
- **Global "mute all" / "unmute all" shortcut** — not requested; not in AUD requirements. Skip unless feedback asks for it.

</deferred>

---

*Phase: 12-per-cell-audio-toggle*
*Context gathered: 2026-04-09*
