# Phase 6: Video Support (v2) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 06-video-support-v2
**Areas discussed:** Video storage model, LeafNode video rendering, Timeline bar UI, Video export UX

---

## Video Storage Model

| Option | Description | Selected |
|--------|-------------|----------|
| Blob URL | URL.createObjectURL() — zero memory overhead, native streaming, no base64 blowup | ✓ |
| Base64 dataURI | Same as images — consistent model but impractical (20MB video = ~27MB string) | |
| File reference only | Store File object directly — zero copy cost but not clonable for undo snapshots | |

**User's choice:** Blob URL

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clear on reload | Video cells become empty on page load; images (base64) survive as before | ✓ |
| Missing media placeholder | Cell shows broken indicator on reload; user can re-upload | |

**User's choice:** Clear on reload

---

## LeafNode Video Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| `<video>` overlay on canvas | `<video>` absolutely-positioned over canvas for video cells | |
| Canvas only, drawImage from video | Hidden `<video>` as source, rAF draws frames to canvas | ✓ |
| Replace canvas with `<video>` for video cells | Conditional canvas or `<video>` based on media type | |

**User's choice:** Canvas only, drawImage from video

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only while playing | rAF loop starts on play, stops on pause/seek end | ✓ |
| Always while video cell exists | Continuous rAF loop whenever video mediaId is set | |

**User's choice:** Only while playing

---

## Timeline Bar UI

| Option | Description | Selected |
|--------|-------------|----------|
| Below canvas, above toolbar | Below CanvasArea in canvas column, spans canvas width | ✓ |
| Full-width bar below everything | Spans full viewport width at bottom | |
| Inside canvas area bottom edge | Overlays bottom of canvas preview | |

**User's choice:** Below the canvas, above the toolbar (canvas column only)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Play/pause + scrubber | Essentials only: play/pause + range slider + time text | ✓ |
| Play/pause + scrubber + loop toggle | Adds loop button | |
| Play/pause + scrubber + speed control | Adds 0.5x/1x/2x speed | |

**User's choice:** Play/pause + scrubber (+ current time / total duration text)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only when video cells exist | Hidden when image-only; appears when first video added | ✓ |
| Always visible | Always shown, greyed out when no videos | |

**User's choice:** Only when video cells exist

---

## Video Export UX

| Option | Description | Selected |
|--------|-------------|----------|
| Longest video wins | Output duration = longest video; shorter videos loop; images are static | ✓ |
| User sets duration | Duration input in export popover | |
| Shortest video wins | Output trimmed to shortest video | |

**User's choice:** Longest video wins

---

| Option | Description | Selected |
|--------|-------------|----------|
| No options — H.264 MP4, fixed quality | Single path: H.264, CRF ~23, no user settings | ✓ |
| Quality slider only | CRF slider in export popover | |
| Codec + quality options | H.264 vs H.265 + quality | |

**User's choice:** No options — H.264 MP4, fixed quality

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect by cell content | Same Export button; ffmpeg if any video cell exists, else Canvas API | ✓ |
| Separate Export MP4 button | Separate buttons or format toggle when video cells exist | |

**User's choice:** Auto-detect by cell content

---

## Claude's Discretion

- How to track media type (image vs video) in the registry
- Whether to co-locate hidden `<video>` ref in LeafNode or use a global videoElementRegistry
- Exact CRF value and ffmpeg xstack filter graph

## Deferred Ideas

None
