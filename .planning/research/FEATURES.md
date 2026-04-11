# Feature Research — v1.3 Filters, Video Tools & Playback

**Domain:** Browser-based story collage editor — v1.3 incremental milestone
**Researched:** 2026-04-11
**Confidence:** HIGH (filter values from authoritative CSS library; audio/video detection from MDN)

> **Scope note:** This file covers only the NEW v1.3 features. The prior FEATURES.md (2026-03-31) covers the overall product feature landscape for v1.0–v1.2 decisions. This document answers the focused research question: "How do the v1.3 features work in practice?"

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Named Instagram presets (Clarendon, Juno, Lark, etc.) | Users know these filter names from Instagram; generic "Warm / B&W" labels read as unfinished | LOW | Values are well-documented in CSS filter libraries; only the preset definitions change, not the pipeline |
| Auto-mute lock for no-audio video | A grayed-out non-interactive disabled control is standard UX; clickable mute on a video with no audio is confusing | LOW | Detection at upload via `audioTracks.length` + legacy browser fallbacks; show VolumeX, cursor-not-allowed |
| Playback UI visual polish | The scrubber/play-button strip is the first thing users judge on quality; unpolished = untrustworthy | LOW | No new controls — purely a CSS/layout redesign of the existing timeline bar |
| Breadth-first multi-file drop | Dropping 4 files onto an empty canvas should produce a 2×2 grid, not an L-shape; the current depth-first behavior surprises users | LOW | Pure algorithm change in the tree traversal; no new state or data model changes |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Boomerang per-cell | Matches native Instagram story creation feel; no other browser collage editor offers per-cell boomerang | HIGH | Preview: rAF frame-buffer flip; Export: Mediabunny VideoSampleSink frames + reversed slice; see detail below |
| Video trimming per-cell | Lets users clip the best 3s of a 30s clip without leaving the editor | HIGH | Sidebar drag handles on mini timeline strip; `trimStart`/`trimEnd` ms on LeafNode; interacts with export |
| Live audio preview | Hear the actual per-cell audio mix during playback rather than visual-only sync | MEDIUM | `MediaElementAudioSourceNode` per unmuted cell; single shared `AudioContext`; autoplay policy pitfalls apply |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `video.playbackRate = -1` for boomerang | Obvious native API | Chrome and Firefox do not support negative playbackRate — only Safari does; WHATWG spec does not require it (issue #3754, Firefox Bugzilla #1468019) | Frame-buffer approach: decode all frames into array, append reversed slice, cycle in rAF |
| Waveform visualization in trim UI | Professional look | Computing a waveform from a video blob in-browser requires AudioContext decodeAudioData on the full clip — expensive for long videos; adds a dependency | Thumbnail strip or solid-color trim region with time labels is sufficient for v1.3 |
| Boomerang on untrimmed long clips | User may toggle it on any cell | Storing all frames of a 30s 30fps 1080×1920 video in memory = ~900 ImageBitmap objects = memory pressure; rAF loop slows | Enforce a max clip length warning (≤10s recommended, ≤5s optimal) before allowing boomerang toggle |

---

## Feature Details

### 1. Instagram-Style Named Presets

**Background:** The existing 6 presets (B&W, Sepia, Vivid, Fade, Warm, Cool) are generic. The v1.3 goal is to replace them with the 6 real Instagram filter names most recognizable to users, backed by research-accurate CSS `filter` strings.

**Source:** CSS filter values pulled directly from the distributed `instagram.css` v0.1.4 by picturepan2, cross-referenced with the CSSgram library by Una Kravets and Depositphotos filter analysis. These values are not guesses — they are the canonical open-source CSS approximations of Instagram's actual filters.

**Recommended 6 presets and their verified CSS filter strings:**

| Preset Name | CSS Filter String | Visual Character | Best For |
|------------|-------------------|-----------------|---------|
| **Clarendon** | `sepia(0.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)` | Cool-tinted, lifted highlights, deepened shadows — the most-used Instagram filter globally (119 countries) | Any content; universally flattering |
| **Juno** | `sepia(0.35) contrast(1.15) brightness(1.15) saturate(1.8)` | Punchy reds/yellows/oranges, high saturation, warm | Food, flowers, sunsets, colorful subjects |
| **Lark** | `sepia(0.25) contrast(1.2) brightness(1.3) saturate(1.25)` | Airy/bright, intensifies blues and greens, washes out reds | Landscapes, nature, outdoor shots |
| **Nashville** | `sepia(0.25) contrast(1.5) brightness(0.9) hue-rotate(-15deg)` | Warm pinkish-orange cast, high contrast, retro-romantic | Portraits, lifestyle, vintage feel |
| **Lo-fi** | `saturate(1.1) contrast(1.5)` | Maximum saturation, crushed blacks — dramatic 1990s aesthetic; NO sepia so hues stay pure | Cityscapes, bold graphic content |
| **Inkwell** | `brightness(1.25) contrast(0.85) grayscale(1)` | Classic B&W with lifted shadows — timeless monochrome; uses `grayscale(1)` not `sepia` so there is zero color cast | Portraits, architecture, storytelling |

**Why these 6:** They cover six distinct moods with minimal overlap — cool-lifted (Clarendon), warm-punchy (Juno), cool-airy (Lark), vintage-warm (Nashville), dramatic-saturated (Lo-fi), monochrome (Inkwell). Together they replace the prior set without losing tonal range.

**Data model impact:** The existing system stores presets as 4-slider tuples `[brightness, contrast, saturation, blur]`. Instagram presets add `sepia` and `hue-rotate` which are not slider-addressable. The preset data must be stored as a full CSS `filter` string. The existing `ctx.filter` path in `drawLeafToCanvas()` already accepts a complete CSS filter string, so the draw pipeline is unchanged. What changes is the preset definition format and how the 4 custom sliders are composed on top (they should be additive multiplicatively, not replacing the preset string).

**Confidence:** HIGH — CSS filter values sourced from `picturepan2/instagram.css` raw distributed file, verified against CSSgram, Depositphotos filter characteristics, and Animatron filter descriptions.

---

### 2. Boomerang Per-Cell

**How Instagram boomerang works exactly:** Instagram records 1–2 seconds of camera footage into a frame buffer, concatenates that buffer with its own reversal to produce a forward-then-backward sequence, and loops the combined sequence seamlessly. The result plays forward at normal speed, then backward at normal speed, then repeats — no pause, no direction indicator, no seam.

**Preview implementation (rAF loop):**

Negative `playbackRate` is NOT viable — Chrome and Firefox do not support it (WHATWG HTML issue #3754, Firefox Bugzilla #1468019). The only cross-browser approach is a frame-buffer array:

1. When boomerang is toggled ON on a video cell, decode the (trimmed) video into an array of `ImageBitmap` objects. The Mediabunny `VideoSampleSink` in Phase 15 already does this — it can be reused or its pattern copied.
2. Build `allFrames = [...forwardFrames, ...[...forwardFrames].reverse()]`.
3. In the cell's rAF loop, use `frameIdx = (frameIdx + 1) % allFrames.length` and draw `allFrames[frameIdx]` to the canvas.
4. When boomerang is toggled OFF, revert to the standard `video.currentTime`-based draw path.

**Export implementation (Mediabunny VideoSampleSink):**

The Phase 15 `VideoSampleSink` pipeline collects a `VideoFrame[]` array and loops through it during the Mediabunny encode pass. For boomerang:
1. Collect `frames[]` from `VideoSampleSink` as normal (already filtered by `trimStart`/`trimEnd` if trimmed).
2. Create `reversed = [...frames].map(f => f)` — do NOT close the originals yet; keep them open.
3. Append reversed to the encode loop: encode `[...frames, ...reversed.reverse()]` sequentially.
4. After encoding, close ALL frames (both original and reversed references) in the `finally` block. `VideoFrame` objects hold GPU memory and must be explicitly closed.

**Clip length guard:** Pre-loading all frames of a 30s 30fps 1080×1920 video as ImageBitmaps = ~900 frames × large pixel arrays = serious memory pressure. Enforce a maximum before allowing boomerang activation. Recommended limit: warn if trimmed clip > 10s; hard-cap at 15s.

**Loop behavior in mixed stories:** Non-boomerang cells loop normally. A boomerang cell's effective duration is `2 × (trimEnd - trimStart)`. The master timeline `max(cellDurations)` should use the doubled duration for boomerang cells.

**Confidence:** MEDIUM — frame-buffer approach is well-established in browser boomerang implementations (Paul Kinlan 2018, Cloudinary boomerang blog). Mediabunny VideoSampleSink integration inferred from Phase 15 architecture; no direct Mediabunny boomerang documentation found.

---

### 3. Video Trimming Per-Cell

**Expected UX (grounded in CapCut mobile and DaVinci Resolve mobile conventions):**

A trim panel appears in the sidebar when a video cell is selected. Elements:
- A **mini timeline strip** (~200px wide, ~36px tall) showing the video's full duration as a colored region (thumbnails optional; solid accent color bar is simpler and sufficient).
- **Two drag handles** — left = trim-in, right = trim-out. Handles are vertical bars with rounded caps, in the UI accent color. The active (trimmed) region between them is fully opaque; the inactive trimmed-out regions are dimmed (20–30% opacity).
- **Time inputs** below each handle showing `0:00.0` format (seconds + tenths). Directly editable.
- **Duration display**: "3.2s selected / 12.0s total" in small text below.
- Minimum selectable duration: 0.5s (prevent zero-length clips).

**Data model additions on `LeafNode`:**
```typescript
trimStart: number   // ms from start; default 0
trimEnd:   number   // ms from start; default = video.duration * 1000
```

**Interaction with story timeline:** `effectiveDuration(cell) = trimEnd - trimStart`. The master playback `max(effectiveDurations)` drives the timeline length. During playback, each cell's `video.currentTime` is clamped to `[trimStart/1000, trimEnd/1000]`; on reaching `trimEnd`, the video seeks back to `trimStart`.

**Interaction with boomerang:** `boomerangDuration(cell) = 2 × (trimEnd - trimStart)`. The cell contributes the doubled value to the master timeline max.

**Interaction with export:** The Mediabunny encode loop already iterates over `VideoFrame[]` from `VideoSampleSink`. When trim is active, filter the frame array to frames with `timestamp >= trimStart * 1000` and `timestamp < trimEnd * 1000` (VideoFrame timestamps are in microseconds in some APIs — verify units against Mediabunny's actual output).

**Drag handle implementation:** Use raw `pointerdown`/`pointermove`/`pointerup` on the handle elements — no @dnd-kit needed (no sortable/swap semantics). Clamp `trimStart <= trimEnd - 500` (0.5s minimum). Call `setPointerCapture` on `pointerdown` for smooth drag outside the element bounds.

**Confidence:** MEDIUM — trim UI conventions drawn from CapCut observations and general NLE UX patterns; no public CapCut design spec. Data model additions are straightforward.

---

### 4. Live Audio Preview

**How apps implement it:** During editor playback, route each unmuted video element's audio through the Web Audio API graph:

```
AudioContext (single, shared, created lazily on first user gesture)
  ├─ MediaElementAudioSourceNode (cell A's video element)
  │    └─ GainNode (cell A, gain = 1.0)
  │         └─ AudioContext.destination
  ├─ MediaElementAudioSourceNode (cell B's video element)
  │    └─ GainNode (cell B, gain = 1.0)
  │         └─ AudioContext.destination
  └─ ... (one per unmuted video cell)
```

**Critical pitfall — autoplay policy:** `AudioContext` created programmatically starts in `suspended` state in all major browsers. It can only transition to `running` after a direct user gesture. The correct pattern:

```typescript
// Inside the play button click handler (user gesture context):
if (!audioCtx) audioCtx = new AudioContext();
if (audioCtx.state === 'suspended') await audioCtx.resume();
// Now wire up MediaElementAudioSourceNodes
```

Never create the `AudioContext` in a `useEffect`, module initializer, or outside a gesture handler — it will stay suspended and produce no audio.

**Critical pitfall — single connection per element:** Chrome throws `InvalidStateError` if a `MediaElementAudioSourceNode` is created for a video element that already has one. Track which video elements have been connected and reuse the existing node across play/pause cycles. Do not disconnect and reconnect on every play — re-create only when the set of unmuted cells changes.

**Relationship to export audio graph:** The export `buildAudioGraph()` in `videoExport.ts` uses an `OfflineAudioContext` (Phase 14). The live preview uses a standard `AudioContext`. These are entirely separate contexts with no shared state. The live context must be torn down (all source nodes disconnected; context closed or suspended) when the user stops playback, to prevent the hidden video elements' audio from leaking into the output.

**Confidence:** HIGH — AudioContext autoplay policy from Chrome for Developers blog and MDN Web Audio API best practices. Single-connection constraint from MDN `MediaElementAudioSourceNode` docs and VideoJS issue tracker.

---

### 5. Playback UI Visual Redesign

**Design conventions from modern story editors (CapCut, TikTok in-app editor, Canva):**

Modern playback bars share these visual properties:
- **Background strip:** Semi-transparent dark overlay (`rgba(0,0,0,0.70–0.80)`) — not opaque, so the canvas is partially visible behind. Height: 48–56px total.
- **Scrubber track:** 2–3px thin horizontal line spanning the full width. Progress region filled in white or accent color; inactive region in `rgba(255,255,255,0.30)`. Track has 8–12px left/right padding.
- **Scrubber thumb:** 10–14px solid circle in white with a subtle drop shadow. Scales to ~16px on active drag (`transform: scale(1.3)`). No visible label on the thumb.
- **Time counter:** Small monospace text (10–12px). Left side = elapsed `0:00`, right side = total duration. Positioned directly below the scrubber track.
- **Play/pause button:** 40–44px circle, either solid fill or frosted glass (`backdrop-filter: blur`). No text label. Icon (Play▶ / Pause⏸) centered. Smooth CSS transition (`transition: opacity 150ms, transform 150ms`) between states — NOT an instant swap.
- **Overall bar height:** Aim for ≤56px. Compact matters — it should feel like a control strip, not a modal.

**What NOT to change:** No new controls in the playback bar (no frame counter, speed control, or per-cell volume). Those would require separate feature research and user testing.

**Confidence:** MEDIUM — conventions from CapCut and TikTok visual observations; no authoritative public design spec. These are strongly converged conventions across multiple products.

---

### 6. Auto-Mute Detection for No-Audio Video

**Detection at upload time:** Run after `loadedmetadata` fires on the video element. The most reliable cross-browser combined check:

```typescript
function hasAudio(video: HTMLVideoElement): boolean {
  return (
    Boolean((video as any).mozHasAudio) ||                     // Firefox — reliable
    Boolean((video as any).webkitAudioDecodedByteCount) ||     // Chrome legacy — more reliable than audioTracks in some formats
    Boolean(video.audioTracks?.length)                         // Standard W3C spec — reliable in Safari; partially reliable in Chrome/Firefox
  );
}
```

**Timing:** Must be called after `loadedmetadata` (not `canplay` or `play`). Calling it synchronously after setting `src` returns false negatives on Chrome and Firefox because track data is not yet populated.

**Browser-specific behavior:**
- Chrome: `audioTracks.length` may return 0 for some container formats even with audio. `webkitAudioDecodedByteCount` (legacy) is more reliable but requires a brief decode pass. Use the combined check as the safety net.
- Firefox: `mozHasAudio` is reliable and authoritative.
- Safari: `audioTracks.length` is reliable.

**Recommended LeafNode additions:**
```typescript
hasAudio:    boolean   // detected at upload; true = video has audio track
audioLocked: boolean   // true when hasAudio === false; toggle is disabled
```

**UI behavior when `audioLocked === true`:** Render the audio toggle as `VolumeX` icon, grayed out (`opacity: 0.4`), `cursor-not-allowed`, `pointer-events: none`. Do NOT show the toggle at all for image cells (already filtered by `mediaTypeMap` check in Phase 12).

**Edge case:** If detection is ambiguous (false negative on a video that does have audio), default `hasAudio = true` — err toward allowing the toggle. The video may just be silently muted. Better to show a functional toggle than to lock a user out.

**Confidence:** HIGH — sourced from MDN `HTMLMediaElement.audioTracks`, VideoJS GitHub issue #7096 (browser behavior differences discussed at length), and a widely-referenced GitHub Gist with cross-browser validation.

---

## Feature Dependencies

```
[Instagram Presets (new names + values)]
    └──replaces──> [Existing 6 generic presets (B&W, Sepia, Vivid, Fade, Warm, Cool)]
    └──requires──> [Extended preset definition: full CSS filter string, not 4-slider tuple]
    └──uses──> [drawLeafToCanvas() ctx.filter path — already exists, unchanged]

[Video Trimming]
    └──requires──> [trimStart / trimEnd fields on LeafNode]
    └──requires──> [Mediabunny VideoSampleSink frame array — already exists, Phase 15]
    └──enhances──> [Boomerang — trimmed duration drives boomerang clip length]
    └──enhances──> [Story timeline max-duration calculation]

[Boomerang]
    └──depends on──> [Video Trimming OR a hard clip-length guard]
    └──requires──> [Frame decode mechanism — Mediabunny VideoSampleSink already available]
    └──NOT using──> [playbackRate = -1 — not cross-browser; Chrome + Firefox don't support it]

[Live Audio Preview]
    └──requires──> [Per-cell audioEnabled — already exists, Phase 12]
    └──SEPARATE from──> [Export OfflineAudioContext — different context type, no conflict]
    └──requires──> [User gesture before AudioContext.resume()]

[Auto-Mute Detection]
    └──requires──> [Per-cell audioEnabled — already exists, Phase 12]
    └──enhances──> [Audio toggle — adds disabled/locked visual state]
    └──requires──> [hasAudio + audioLocked fields on LeafNode]

[Breadth-First Drop]
    └──replaces──> [Existing depth-first empty cell fill traversal]
    └──no new state or data model changes]

[Playback UI Polish]
    └──enhances──> [Existing timeline bar — CSS/layout only]
    └──no new dependencies]
```

---

## MVP Definition for v1.3

### Launch With (high confidence, low risk)

- [x] **Instagram-style named presets** — highest user-visible impact; no new pipeline; only preset definitions change
- [x] **Auto-mute detection** — low complexity; prevents a confusing UX state
- [x] **Breadth-first multi-file drop** — pure algorithm change; high UX impact on first-use flow
- [x] **Playback UI visual redesign** — polish only; no new controls needed

### Add After Validation (defer within v1.3 if timeline is tight)

- [ ] **Live audio preview** — MEDIUM complexity; AudioContext lifecycle must be managed carefully; high user value once working
- [ ] **Video trimming** — MEDIUM-HIGH complexity; requires LeafNode data model + sidebar UI + export integration; high value for video-heavy users

### Future Consideration (v1.4+)

- [ ] **Boomerang** — HIGH complexity; depends on trim or clip-length guard; memory-intensive for long clips; GPU memory management is non-trivial
- [ ] Per-cell volume slider (alongside audio toggle)
- [ ] Waveform visualization in trim timeline
- [ ] Boomerang with live camera capture

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Instagram presets (new names + CSS values) | HIGH | LOW | P1 |
| Auto-mute detection + locked toggle | MEDIUM | LOW | P1 |
| Breadth-first multi-file drop | MEDIUM | LOW | P1 |
| Playback UI polish | MEDIUM | LOW | P1 |
| Live audio preview | HIGH | MEDIUM | P2 |
| Video trimming | HIGH | HIGH | P2 |
| Boomerang | MEDIUM | HIGH | P3 |

---

## Sources

- instagram.css CSS filter values (raw distributed file): https://raw.githubusercontent.com/picturepan2/instagram.css/master/dist/instagram.min.css
- CSSgram library: https://github.com/una/CSSgram
- Instagram filter visual characteristics: https://blog.depositphotos.com/a-closer-look-at-popular-instagram-filters.html
- Instagram filter popularity and descriptions: https://www.animatron.com/blog/18-best-instagram-filters/
- Canva Instagram filter popularity data: https://www.canva.com/learn/popular-instagram-filters/
- Negative playbackRate — WHATWG spec issue: https://github.com/whatwg/html/issues/3754
- Negative playbackRate — Firefox Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=1468019
- Boomerang frame-buffer approach (Paul Kinlan): https://paul.kinlan.me/simple-boomerang-video/
- Cloudinary boomerang approach: https://cloudinary.com/blog/introducing_boomerang_video_effect_with_cloudinary
- WebCodecs VideoDecoder (Chrome for Developers): https://developer.chrome.com/en/articles/webcodecs/
- AudioContext autoplay policy (Chrome blog): https://developer.chrome.com/blog/web-audio-autoplay
- Web Audio API best practices (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- Autoplay guide for media and Web Audio APIs (MDN): https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- HTMLMediaElement.audioTracks (MDN): https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/audioTracks
- VideoJS audioTracks browser compatibility discussion: https://github.com/videojs/video.js/issues/7096
- Cross-browser audio detection gist: https://gist.github.com/spacedmonkey/4c60002ae41b272330395d4b78c814ec

---
*Feature research for: StoryGrid v1.3 — Instagram filters, boomerang, trimming, audio preview, playback UI, auto-mute*
*Researched: 2026-04-11*
