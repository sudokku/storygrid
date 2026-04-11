# Pitfalls Research

**Domain:** Web-based Instagram story editor — v1.3 feature additions (filters, boomerang, trim, audio preview, auto-mute, breadth-first drop)
**Researched:** 2026-04-11
**Confidence:** HIGH (based on direct codebase inspection + domain knowledge)

---

## Critical Pitfalls

### Pitfall 1: Instagram Filter CSS Approximation — Filter Function Order Is Non-Commutative

**What goes wrong:**
CSS filter functions are applied in declaration order, and that order changes the visual result. `brightness(1.2) saturate(1.5)` produces a different output than `saturate(1.5) brightness(1.2)`. The existing `effectsToFilterString` locks the order to brightness → contrast → saturate → blur. If Instagram-style presets are authored assuming a different order (e.g. contrast before brightness, as many LUT pipelines do), the exported result will look wrong relative to the preview and relative to Instagram's actual filters.

**Why it happens:**
Developers prototype filters interactively in DevTools and do not notice order dependence because the eye adapts. When the formula is later coded with a different sequence, the result diverges from the prototype.

**How to avoid:**
Lock the canonical order first, then tune numeric values to match the target look within that fixed order. The existing contract in `effects.ts` (brightness → contrast → saturate → blur) is the single source of truth. Any v1.3 preset must use this same function signature; the order must NOT change to accommodate a new preset's aesthetics. If a new preset genuinely requires a different function (e.g. `sepia()`, `hue-rotate()`), extend `effectsToFilterString` with those functions appended at a stable position, and update the contract tests in `effects.test.ts`.

**Warning signs:**
- The preset looks correct on screen but wrong in the exported PNG/MP4 (indicates the filter string is built differently in two code paths — check that both paths call `effectsToFilterString` from `effects.ts`, not a local string).
- Two presets that share the same slider values look different from each other (indicates order is inconsistent between them).

**Phase to address:**
Instagram preset redesign phase (first v1.3 phase). Lock contract tests before any preset values are tuned.

---

### Pitfall 2: CSS Filters Cannot Replicate LUT-Based Tone Curves — Manage Expectations Before Naming Filters

**What goes wrong:**
Instagram filters (Clarendon, Juno, Lark, etc.) use per-channel LUTs that bend the tone curve non-linearly. CSS `brightness/contrast/saturate/hue-rotate` are linear-gain operations applied uniformly to all channels. You cannot replicate the warm-shadows + cool-highlights of Clarendon with CSS filters; the result will look approximately similar at best. If the phase is named "Instagram filters" in user-facing UI, users will compare directly to their phone and notice the gap.

**Why it happens:**
The scope is defined by the feature name. Once the phase is complete, changing the product copy is a separate discussion, but the technical gap is fixed — you cannot add LUT support later without a canvas overlay pass.

**How to avoid:**
Name the presets with their own names (e.g. "Golden Hour", "Faded Film", "Vivid City") rather than Instagram's trademarked names. Define target aesthetics by the CSS sliders that are achievable, not by reverse-engineering Instagram. Research the visual territory each preset should occupy (warm/cool, high/low contrast, vivid/muted) and tune to that spec. Optionally: if a canvas overlay pass is added later (e.g. a semi-transparent gradient overlay per preset), it can extend the effect. But do not block v1.3 on canvas overlay — that is a separate feature.

**Warning signs:**
- A preset is named after an Instagram filter but the result looks noticeably different from the Instagram equivalent.
- Stakeholder feedback says "the filters don't look like Instagram" — this is expected and unavoidable with CSS-only; it should be addressed in the roadmap before naming.

**Phase to address:**
Instagram preset redesign phase. Naming and scope decisions happen in the plan doc, not in code.

---

### Pitfall 3: Boomerang rAF Loop — Frame Timing Drift Breaks Multi-Cell Sync

**What goes wrong:**
A boomerang cell plays forward then backward in a rAF loop. If the reverse loop is driven by decrementing a frame index on each `requestAnimationFrame` callback, the actual display timing depends on the rAF callback rate (typically 60 fps). If the source video is 30 fps, every other rAF callback will advance the index but show the same frame — this is fine. However, if the rAF callback is jittery (e.g. during heavy GPU load), the index increments at a variable rate. When other non-boomerang cells are also playing in the same rAF loop, they advance time using `video.currentTime`, which is independent of the rAF callback rate. The result is that boomerang cells drift out of sync with normal cells on low-end hardware.

**Why it happens:**
Two different time sources (rAF callback count vs. `video.currentTime`) are mixed in the same playback loop.

**How to avoid:**
Drive boomerang playback from wall-clock time, not from rAF callback count. Store `boomerangStartTime = performance.now()` when playback begins and compute `loopedVideoTime = computeBoomerangTime(performance.now() - boomerangStartTime, videoDuration)`. `computeBoomerangTime` maps wall-clock elapsed time into the forward+backward cycle using a triangle wave (t mod 2D, mirrored). Set `video.currentTime` from this computed time on each rAF callback instead of incrementing/decrementing a frame counter. This keeps boomerang cells synchronized with `video.currentTime`-driven non-boomerang cells.

**Warning signs:**
- Boomerang cell noticeably drifts relative to non-boomerang cells during a 10+ second playback.
- Boomerang loop gets faster or slower when the browser tab is backgrounded and then re-focused.

**Phase to address:**
Boomerang implementation phase. The `computeBoomerangTime` pure function should be unit tested before the rAF loop is wired up.

---

### Pitfall 4: Boomerang Export — Mediabunny Timestamps Must Be Monotonically Increasing

**What goes wrong:**
During MP4 export the encode loop in `exportVideoGrid` calls `videoSource.add(i / FPS, 1 / FPS)` where `i` is the frame index, so timestamps fed to Mediabunny are always monotonically increasing. However, for a boomerang cell, the video *content* plays in reverse. The frame decoded from the boomerang video must correspond to the reversed position, but the MP4 timestamp must still be `i / FPS`. The pitfall is confusing "the timestamp at which this frame appears in the output MP4" (always increasing) with "the position in the source video to decode from" (which reverses for boomerang). If code passes the reversed source timestamp directly to the export timestamp slot, Mediabunny will receive non-monotonic timestamps and the encoder will likely discard frames or produce a corrupt file.

**Why it happens:**
The existing `makeTimestampGen` generator produces source video timestamps (used by `samplesAtTimestamps` for seeking). If boomerang is implemented by modifying `makeTimestampGen` to yield timestamps that go backward, the generator output will be used correctly for seeking but the frame added to `videoSource.add()` will still use `i / FPS` — no bug. The bug arises only if someone misreads the architecture and feeds the source timestamp to `videoSource.add()`.

**How to avoid:**
Keep the two timestamp concepts named and documented separately:
- `sourceTimestamp`: where in the source video to seek (reverses for boomerang — drives `makeTimestampGen`)
- `exportTimestamp`: `i / FPS` — always monotonically increasing — drives `videoSource.add()`

`makeTimestampGen` for a boomerang cell should yield the triangle-wave source timestamp. `videoSource.add(i / FPS, 1 / FPS)` is unchanged. Add a comment in the export loop asserting `exportTimestamp === i / FPS` to prevent future confusion.

**Warning signs:**
- Exported MP4 plays normally during the forward portion but freezes or corrupts during the backward portion.
- Mediabunny throws an error mentioning "timestamp" or "PTS" during export.

**Phase to address:**
Boomerang export integration. Write a unit test for `makeTimestampGen` with boomerang that verifies the yielded source timestamps are a triangle wave, not a straight ramp.

---

### Pitfall 5: Video Trimming — Mediabunny `samplesAtTimestamps` Starting Mid-Video Requires GOP Alignment

**What goes wrong:**
When a cell has `trimStart > 0`, the `makeTimestampGen` generator must start yielding timestamps at `trimStart` seconds instead of `firstTimestamp`. `VideoSampleSink.samplesAtTimestamps` will seek to the nearest keyframe (GOP boundary) that precedes the requested timestamp and then decode forward to reach the exact frame. If the GOP interval is large (2 seconds is common in user-shot mobile video) and `trimStart` lands in the middle of a GOP, the decoder must decode and discard several frames before reaching `trimStart`. This is not incorrect but adds latency proportional to `(trimStart % gopInterval) * fps` frames per seek. For a 30-fps video with 2-second GOPs, the worst case is 59 discarded frames per seek.

**Why it happens:**
Most video files from mobile phones use variable GOP sizes and the GOP boundaries are not exposed by the Mediabunny API. The caller cannot know the GOP interval at trim-setup time.

**How to avoid:**
Accept the GOP-alignment cost — it is one-time per video stream during export setup, not per-frame. The existing streaming architecture (`buildVideoStreams`) calls `samplesAtTimestamps` with a generator, so the decoder handles the initial seek internally. The phase implementation simply needs to ensure `makeTimestampGen` clamps the start of its yield range to `firstTimestamp + trimStart` and the end to `firstTimestamp + trimEnd`. Do not attempt to pre-seek `video.currentTime` before handing control to Mediabunny — this conflicts with the streaming iterator's internal seek state.

**Warning signs:**
- Export of a trimmed cell takes disproportionately longer than an untrimmed cell of the same duration.
- The first few frames of a trimmed export show content from before `trimStart`.

**Phase to address:**
Video trimming export integration. Add a test case where `trimStart > gopInterval` to confirm correct first-frame content.

---

### Pitfall 6: Video Trimming — Timeline Duration Mismatch Across Cells

**What goes wrong:**
The total export duration is currently computed from the longest video cell in the grid. If cell A is 10 seconds trimmed to 5 seconds, and cell B is 7 seconds untrimmed, the export duration should be `max(5, 7) = 7` seconds. If the trim duration is not reflected in the duration calculation, the export will be 10 seconds (the untrimmed duration of cell A), and cell A will show frozen frame or blank for seconds 5–10.

**Why it happens:**
The duration calculation happens early in the export setup before trim state is consulted. If `effectiveDuration` in `buildVideoStreams` uses `computeDuration - firstTimestamp` without subtracting `trimStart` or clamping to `trimEnd`, the loop runs longer than the trimmed playback.

**How to avoid:**
Pass trim settings alongside the leaf state into `buildVideoStreams`. Compute `effectiveDuration = min(trimEnd, rawDuration) - trimStart` (where `trimEnd = null` means use `rawDuration`). The `totalDuration` passed to `exportVideoGrid` must be `max over all cells of effectiveDuration`. Derive this in the UI's export trigger, not inside `exportVideoGrid`, so it is testable in isolation.

**Warning signs:**
- Exported video is longer than expected; trimmed cells show frozen last-frame for excess duration.
- Scrub bar in playback UI shows the wrong total duration after trimming.

**Phase to address:**
Video trimming implementation phase and export integration phase.

---

### Pitfall 7: AudioContext Autoplay Policy — Context Created Too Early Is Immediately Suspended

**What goes wrong:**
In Chrome and Safari, an `AudioContext` created without a prior user gesture is suspended. If a "live audio preview" AudioContext is created during component mount or store initialization (before any user interaction), its `state` will be `'suspended'` and all audio nodes wired into it will produce silence. The developer tests locally after the first user interaction and hears audio, so the bug goes unnoticed.

**Why it happens:**
Chrome's autoplay policy was tightened in 2018. The browser measures "user activation" per top-level browsing context. An AudioContext created before the user has clicked, tapped, or pressed a key on the page is automatically suspended.

**How to avoid:**
Create the `AudioContext` in the same synchronous call stack as the user gesture that starts playback (the play button click handler). Store the context in a ref (`useRef`) or module-level singleton. Implement a `resumeIfSuspended()` guard that calls `ctx.resume()` before connecting nodes. Never create the AudioContext during component mount or zustand store initialization. On Safari, additionally call `ctx.resume()` unconditionally in the play handler even if `ctx.state === 'running'` — Safari requires the call every time.

**Warning signs:**
- Audio preview works after clicking play a second time but not the first.
- `audioCtx.state === 'suspended'` logs appear in the console.
- Silent audio on Safari regardless of user interaction.

**Phase to address:**
Live audio preview implementation phase. The `resumeIfSuspended()` pattern must be established before any audio node graph is connected.

---

### Pitfall 8: Live Audio Preview — Rapid isPlaying Toggles Create Orphaned AudioNodes

**What goes wrong:**
If the user clicks play/pause rapidly, each toggle can create new `MediaElementAudioSourceNode`s connected to the AudioContext destination. `MediaElementAudioSourceNode` is a singleton per `HTMLVideoElement` instance — connecting the same video element twice throws `InvalidStateError: failed to construct MediaElementSourceNode`. But if new nodes are created for each playback cycle (because the graph is torn down and rebuilt on each toggle), old nodes may not be properly disconnected before the new ones are connected, or the GC doesn't run fast enough to collect the old nodes. The result is either an error or doubled/echoing audio.

**Why it happens:**
The audio graph teardown path is skipped when isPlaying transitions from `true → false → true` faster than the teardown completes (especially if teardown involves async operations).

**How to avoid:**
Treat the audio graph as a stable long-lived object. Create `MediaElementAudioSourceNode` instances once per video element (at upload time or first playback), not on each play toggle. Gate nodes on/off by muting/unmuting or by `gainNode.gain.setValueAtTime()`, not by connect/disconnect. On pause, do not disconnect nodes — just call `video.pause()`. Only disconnect and close the AudioContext when the grid is cleared or the component unmounts.

**Warning signs:**
- `InvalidStateError` in console when toggling play/pause quickly.
- Audio volume doubles after three play cycles.
- CPU usage climbs monotonically as play/pause is toggled.

**Phase to address:**
Live audio preview implementation phase. The audio graph must be described as a data structure (which nodes exist, their connections) before code is written.

---

### Pitfall 9: Auto-Mute Detection — Audio Track Info Unavailable Until After `loadedmetadata`

**What goes wrong:**
`HTMLVideoElement.audioTracks` (non-standard, WebKit) and `HTMLVideoElement.mozHasAudio` (Firefox) are checked before the video has loaded enough metadata for the browser to parse track info. At this point the properties return `undefined` or `0` even for videos that do have audio. The detection code incorrectly concludes "no audio" and marks the cell as permanently muted.

**Why it happens:**
Detection is run synchronously immediately after `URL.createObjectURL()`, before the browser has parsed the file's track header. The existing `captureVideoThumbnail` function in `gridStore.ts` already handles the async pattern (waits for `loadedmetadata`), but a naive audio detection implementation may not follow the same pattern.

**How to avoid:**
Run audio detection inside a `loadedmetadata` event listener, identical to the thumbnail capture pattern in `captureVideoThumbnail`. Do not check `audioTracks.length` or `mozHasAudio` synchronously. Also check `audioTracks.length > 0` AND `audioTracks[0].enabled` — a file may have a track header but the track may be disabled. As a fallback, attempt `decodeAudioData` on the blob and check the resulting `AudioBuffer.numberOfChannels > 0` and `AudioBuffer.length > 0` (this is codec-agnostic and works across browsers).

**Warning signs:**
- All uploaded videos are detected as "no audio" regardless of their actual content.
- Audio detection works in Chrome but not in Firefox (because `audioTracks` is Chrome/Safari only; Firefox requires `mozHasAudio` or `decodeAudioData` fallback).

**Phase to address:**
Auto-mute detection implementation phase. Write separate unit-test stubs for each detection method (audioTracks, mozHasAudio, decodeAudioData fallback) and verify the priority order is correct.

---

### Pitfall 10: Breadth-First Drop — Alternating H/V Split Conflicts With Existing Tree Structure at Depth > 0

**What goes wrong:**
Breadth-first multi-file drop is designed to alternate split direction by tree depth: depth 0 splits horizontally, depth 1 vertically, depth 2 horizontally, etc. But if the existing tree was built by the user splitting manually (not by breadth-first drop), the tree's direction at a given depth may already be vertical. When new files are dropped and breadth-first logic calls `splitNode` on an existing leaf at depth 1 with `direction: 'horizontal'`, the existing `splitNode` logic (Phase 1) will create a cross-direction split (Case C in tree.ts) — wrapping the leaf in a new container. This produces deep nesting rather than a flat grid.

**Why it happens:**
`splitNode` is designed for user-driven splitting where the user explicitly chooses direction. Breadth-first drop imposes a structural regularity that conflicts with arbitrary existing trees.

**How to avoid:**
The breadth-first drop algorithm should NOT call `splitNode` on already-occupied cells. It should only target empty leaf cells (`mediaId === null`). The BFS traversal fills empty cells first; it only creates new cells (via `splitNode`) when all existing empty cells are exhausted. When the tree is empty (single empty leaf), breadth-first drop can build the grid structure freely. When the tree already has structure, breadth-first drop should fill empty cells in BFS order without restructuring. If the user drops more files than there are empty cells, the extra files are dropped (or queued) without auto-splitting. This avoids the nesting problem entirely.

**Warning signs:**
- Dropping 4 files onto a 2x2 grid (which has 4 cells) produces a nested structure instead of filling the cells.
- Dropping 6 files onto a single-cell canvas produces a deeply nested tree instead of a 3x2-like grid.

**Phase to address:**
Breadth-first drop implementation phase. The BFS traversal function should be a pure function (input: tree root, output: ordered list of target leaf IDs) so it can be unit tested against all tree shapes.

---

### Pitfall 11: Adding Per-Cell Boolean Flags — Snapshot Compatibility in History Array

**What goes wrong:**
When a new boolean field (e.g. `isBoomerang`, `isMuted`, `trimStart`) is added to `LeafNode`, existing snapshots in the `history` array do not have this field. If the user undoes past the point where the flag was introduced, the restored snapshot's leaves will have `undefined` for the new field instead of the default value. If component code accesses `leaf.isBoomerang` without a nullish fallback, it throws or renders incorrectly.

**Why it happens:**
Zustand's undo/redo stores `structuredClone` snapshots. Old snapshots were created before the new field existed. Unlike a database migration, there is no snapshot migration step.

**How to avoid:**
Always use optional chaining or nullish coalescing when reading new fields from leaf nodes: `leaf.isBoomerang ?? false`. Add the default value to `createLeaf()` so new leaves always have the field. Add the default value to `DEFAULT_EFFECTS` or its equivalent for the new field type. Do NOT rely on the snapshot having the field populated. Optionally, add a snapshot migration step in the `undo` action that patches restored snapshots with defaults for any missing fields — but the nullish fallback in component code is sufficient and simpler.

**Warning signs:**
- After undoing several steps, a cell behaves as if boomerang is enabled when it should be off (or vice versa).
- TypeScript does not catch this at compile time because the type declares the field non-optional, but the runtime snapshot lacks it.

**Phase to address:**
Any phase that adds new `LeafNode` fields. Apply the pattern consistently. Add a test that restores a snapshot missing the new field and verifies the component renders without error.

---

### Pitfall 12: Adding Per-Cell Boolean Flags — Immer Draft Reads vs. `current()` Snapshots

**What goes wrong:**
Inside a Zustand/Immer `set` callback, `state.root` is an Immer draft. Reading `leaf.audioEnabled` directly from the draft is fine for the purpose of toggling it. But if the new action for (e.g.) `toggleBoomerang` reads `leaf.isBoomerang` without first calling `current(state.root)`, and then calls `pushSnapshot(state)` which calls `current(state.root)`, the snapshot may capture the draft's in-progress mutations rather than the pre-mutation state. The existing `toggleAudioEnabled` action in `gridStore.ts` is the correct reference: it calls `findNode(current(state.root), nodeId)` (using `current()` to unwrap the draft) BEFORE calling `pushSnapshot(state)`.

**Why it happens:**
Immer drafts look like plain objects but carry mutation proxies. Calling `current()` materializes a plain snapshot. If the draft is mutated before `current()` is called, the snapshot captures the mutated state — effectively making undo skip the pre-mutation state.

**How to avoid:**
Follow the exact pattern in `toggleAudioEnabled`:
1. `const leaf = findNode(current(state.root), nodeId)` — unwrap draft first
2. `if (!leaf || leaf.type !== 'leaf') return` — guard
3. `pushSnapshot(state)` — snapshot the pre-mutation state
4. `state.root = updateLeaf(current(state.root), nodeId, { ... })` — apply mutation

Do not reorder steps 1-4. Add this pattern to the project conventions in CLAUDE.md.

**Warning signs:**
- Undo after toggling a boolean flag restores a state that already has the toggled value (the snapshot captured the post-mutation state).
- The history array contains duplicate states.

**Phase to address:**
Every phase that adds new store actions. The pattern should be a CLAUDE.md convention, not rediscovered each phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reading `leaf.newField ?? defaultValue` everywhere instead of migrating snapshots | No migration code needed | Every future new-field read site must include the fallback | Acceptable for boolean flags; never for fields where `null` is a valid non-default value |
| Hardcoding 30fps in `FPS` constant for all video operations | Simple implementation | Boomerang frame-rate mismatch if source video is not 30fps | Acceptable for MVP; a follow-up should read fps from track metadata |
| Creating `AudioContext` in the play button handler instead of a singleton | Avoids suspended-context bugs | Multiple AudioContexts can be created if play is clicked before prior context closes | Acceptable if guarded by a ref that checks `ctx.state !== 'closed'` before creating a new one |
| Skipping GOP alignment measurement during trim | No extra API surface needed | First-frame accuracy after trim is probabilistic | Acceptable; seeking to nearest-preceding keyframe is standard behavior |
| Using `decodeAudioData` for auto-mute detection (loads full audio into memory) | Codec-agnostic, accurate | Large audio files briefly double memory during detection | Acceptable at upload time for files under 500MB |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `drawLeafToCanvas` + preset filters | Adding a `hue-rotate()` or `sepia()` CSS function outside `effectsToFilterString` (e.g. inline in the component) | All filter functions must go through `effectsToFilterString` in `effects.ts`; the Canvas `ctx.filter` is set once per leaf from this string |
| Mediabunny `samplesAtTimestamps` + trim | Starting the generator at `trimStart` in seconds but forgetting `firstTimestamp` offset | Generator must yield `firstTimestamp + trimmedOffset`, not just `trimmedOffset`; see existing `makeTimestampGen` for the offset pattern |
| Mediabunny `samplesAtTimestamps` + boomerang | Yielding negative timestamps when the reverse phase wraps below `firstTimestamp` | Clamp yielded timestamps to `[firstTimestamp, firstTimestamp + effectiveDuration]`; the triangle wave calculation must respect this range |
| `VideoSampleSink` + boomerang | Calling `.return()` on the iterator mid-stream when the direction reverses | Do NOT destroy and recreate the iterator at the direction reversal; `samplesAtTimestamps` handles backward jumps internally via re-seek |
| AudioContext + video `MediaElementAudioSourceNode` | Creating a new node for the same `HTMLVideoElement` twice | `MediaElementAudioSourceNode` is a singleton per video element; store the node in a `WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>` keyed by element |
| `pushSnapshot` + new Immer action | Reading from draft before calling `current()` | Always call `current(state.root)` before `pushSnapshot` and before any read used to compute the new value |
| BFS drop + `splitNode` | Calling `splitNode` on a filled leaf | BFS drop should only call `splitNode` on empty (`mediaId === null`) leaf nodes; do not restructure filled cells |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Boomerang preview rAF loop seeking `video.currentTime` every frame | Visible stutter on mobile, high CPU | Set `video.currentTime` only when the computed time differs from previous by more than one video frame duration | At 60fps rAF on a 30fps video; every other seek is redundant |
| Live audio preview `OfflineAudioContext` created per playback session | Memory pressure if playback is toggled frequently | Use Web Audio API `MediaElementAudioSourceNode` for live preview (real-time, not offline); `OfflineAudioContext` is export-only | More than 3 play/pause cycles without GC running |
| Trim sliders triggering `pushSnapshot` on every drag event | History array fills to cap (50 entries) after one drag operation | Use `beginEffectsDrag` pattern: snapshot on `pointerdown`, no snapshot during drag, one undo entry per drag | Any trim slider drag longer than a few pixels |
| `decodeAudioData` for audio detection running on every file in a multi-file drop | Drop of 10 videos blocks UI for several seconds | Run audio detection in a queued async batch after all files are added to cells; do not block the drop handler | Multi-file drop with 5+ video files |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Boomerang toggle shown for image cells | Confusion; no visible effect | Show boomerang toggle only when `mediaTypeMap[leaf.mediaId] === 'video'`; same guard as the audio toggle |
| Trim handles visible but non-interactive during export | User expects to continue editing but the UI is frozen | Disable trim handle pointer events during export; same as existing export progress lock |
| Auto-mute icon (grayed VolumeX) looks like an interactive button | Users click it expecting to unmute | Use `cursor-not-allowed` and a tooltip "No audio track" rather than making the icon look like a toggle |
| Live audio preview plays during export | Export is already mixing audio via OfflineAudioContext; real-time preview creates a second concurrent decode | Stop the live AudioContext (pause all source nodes, do not close) when export starts; resume after export completes |
| Preset rename confusion | Users expecting Instagram names see different names | If presets are renamed for v1.3, any locally stored project files (if persistence is added later) need a migration for the `preset` enum in `EffectSettings` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Instagram presets:** Verify `effectsToFilterString` produces identical output in preview canvas (`ctx.filter`) and in export canvas (`drawLeafToCanvas`). Both must call the same function from `effects.ts` — there is no second code path.
- [ ] **Boomerang preview:** Verify boomerang cells stay in sync with non-boomerang cells at 5, 10, and 30 seconds of playback on a low-end device simulation (CPU throttle in DevTools).
- [ ] **Boomerang export:** Verify the exported MP4 timestamp sequence fed to Mediabunny is strictly increasing (add assertion in test or debug log during development).
- [ ] **Trim export:** Verify first frame of exported trimmed cell shows content at `trimStart`, not at 0. Use a video with a visible timecode or distinctive frames.
- [ ] **Trim + total duration:** Verify export duration equals `max(effectiveDuration for each cell)` accounting for trim, not `max(rawDuration)`.
- [ ] **AudioContext autoplay:** Verify live audio preview works on the FIRST play button press on a fresh page load (no prior user gesture except clicking play itself). Test on Chrome and Safari.
- [ ] **Auto-mute detection:** Verify a video with no audio track (e.g. a screen recording without microphone) is detected correctly. Verify a video with audio is NOT incorrectly flagged as muted.
- [ ] **BFS drop:** Verify dropping N files onto a grid with N empty cells fills all cells without creating new splits. Verify dropping N+1 files fills N cells and drops the extra without error.
- [ ] **New LeafNode fields + undo:** Verify that after adding a boomerang/trim field, undoing past the "field introduction" point (restoring an old snapshot) does not crash or produce incorrect state.
- [ ] **Immer draft order:** Verify all new `set` callbacks follow the `current()` → guard → `pushSnapshot` → mutate order for every new action.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Filter order wrong in presets | LOW | Change numeric values in `PRESET_VALUES`; order is fixed by `effectsToFilterString`. No architecture change needed. |
| Boomerang timestamp monotonicity bug in export | MEDIUM | Isolate `makeTimestampGen` for boomerang case, add triangle-wave unit tests, fix generator output. No change to `videoSource.add()` call. |
| AudioContext suspended on first play | LOW | Wrap existing audio init in `resumeIfSuspended()` call in play handler. One-line fix per play trigger site. |
| BFS drop causes nesting instead of filling | MEDIUM | Rewrite the BFS traversal to target `mediaId === null` leaves only; no tree mutation until all empties are filled. Pure function — unit testable without DOM. |
| Snapshot compatibility breaks after new field | LOW | Add `?? defaultValue` at every field read site. Grep for all usages of the new field name and add fallbacks. |
| Immer draft read-before-current bug | MEDIUM | Requires tracing through undo history to confirm the bug, then reordering 3 lines in the affected action. Undo history corruption is hard to detect without explicit tests. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Filter function order non-commutativity | Instagram preset redesign | `effects.test.ts` contract tests pass; preview and export produce identical renders for each preset |
| CSS filters cannot replicate LUTs | Scoping/naming decision before coding | Preset names in UI do not reference Instagram trademarks |
| Boomerang rAF timing drift | Boomerang preview phase | Sync test: boomerang + normal cell, measure drift at 30s playback |
| Boomerang export timestamp monotonicity | Boomerang export phase | Unit test on `makeTimestampGen` with triangle-wave; assert strict increase in export timestamps |
| Trim GOP alignment latency | Trim export phase | Manual test: time export of clip trimmed to mid-GOP vs. keyframe-aligned |
| Trim total duration mismatch | Trim + export integration | Test: trimmed cell A shorter than untrimmed cell B; export duration equals B duration |
| AudioContext autoplay policy | Live audio preview phase | Fresh-page test on Chrome + Safari: audio heard on first play click |
| Rapid play/pause orphaned AudioNodes | Live audio preview phase | Click play/pause 10x rapidly; no console errors, no audio doubling |
| Auto-mute detection timing | Auto-mute phase | Test with no-audio video: correctly detected. Test with audio video: not falsely muted |
| BFS drop + nesting | Breadth-first drop phase | Drop N files into N-empty-cell grid: no new splits created |
| Snapshot field compatibility | Every phase adding LeafNode fields | Unit test: restore snapshot missing new field; no crash; default value applied |
| Immer draft read order | Every phase adding store actions | Code review checklist: action follows `current()` → guard → `pushSnapshot` → mutate pattern |

---

## Sources

- StoryGrid codebase: `src/lib/effects.ts` — `effectsToFilterString` contract and filter ordering
- StoryGrid codebase: `src/lib/videoExport.ts` — `makeTimestampGen`, `buildVideoStreams`, `mixAudioForExport` architecture
- StoryGrid codebase: `src/lib/export.ts` — `drawLeafToCanvas`, blur overdraw pattern, `ctx.filter` assignment
- StoryGrid codebase: `src/lib/tree.ts` — `createLeaf`, `splitNode` Case A/B/C logic
- StoryGrid codebase: `src/store/gridStore.ts` — `pushSnapshot`, `toggleAudioEnabled` pattern, `captureVideoThumbnail` async pattern
- StoryGrid codebase: `src/types/index.ts` — `LeafNode` shape with `audioEnabled: boolean`
- MDN Web Audio API — AudioContext autoplay policy: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy
- Chrome autoplay policy: https://developer.chrome.com/blog/autoplay/
- CSS filter specification — application order is sequential left-to-right: https://www.w3.org/TR/filter-effects/#funcdef-filter-brightness
- Mediabunny VideoSampleSink — sequential decode model (from v1.2 Phase 15 implementation notes in PROJECT.md)
- Immer documentation — `current()` usage inside `produce`: https://immerjs.github.io/immer/current

---
*Pitfalls research for: StoryGrid v1.3 feature additions*
*Researched: 2026-04-11*
