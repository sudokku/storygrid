# Requirements: StoryGrid v1.3

**Defined:** 2026-04-11
**Core Value:** A user can build a multi-cell photo/video collage from scratch, fill it with images or videos, and download a pixel-perfect 1080×1920px PNG or MP4 — entirely in the browser, no account or server required.

## v1.3 Requirements

### Instagram-Style Presets

- [ ] **PRESET-01**: User can choose from 6 Instagram-style named presets (Clarendon, Lark, Juno, Reyes, Moon, Inkwell) in the Effects panel
- [ ] **PRESET-02**: Each named preset produces a visually distinct result approximating the aesthetic of its Instagram namesake using CSS filter functions (`brightness`, `contrast`, `saturate`, `sepia`, `hue-rotate`, `grayscale`)
- [ ] **PRESET-03**: Preset and slider values (brightness/contrast/saturation/blur) combine in a single draw call, producing identical results in canvas preview, PNG export, and MP4 export
- [ ] **PRESET-04**: User can toggle off an active preset by clicking its chip again — this resets all effect fields (brightness, contrast, saturation, blur, sepia, hueRotate, grayscale) to neutral defaults and deselects the preset chip

### Cell Drop Distribution

- [ ] **DROP-01**: When multiple files are dropped on the canvas (or via the workspace drop zone), media fills cells in breadth-first order (level by level) rather than depth-first stacking
- [ ] **DROP-02**: When auto-fill exhausts all existing empty cells and must create new ones, splits alternate between horizontal and vertical based on node depth (even depth → horizontal, odd depth → vertical)
- [ ] **DROP-03**: Dropping a single file onto a specific leaf cell continues to work as a targeted direct drop (behavior unchanged)

### Audio State Hardening

- [ ] **MUTE-01**: When a video file with no audio stream is uploaded, StoryGrid detects the absence of audio at upload time (via `AudioContext.decodeAudioData()` fallback chain)
- [ ] **MUTE-02**: A video cell with no detected audio stream displays a grayed-out, non-interactive VolumeX icon in the portal ActionBar
- [ ] **MUTE-03**: A video cell with no detected audio stream displays a grayed-out, non-interactive audio toggle in the SelectedCellPanel sidebar
- [ ] **MUTE-04**: The `hasAudioTrack` field on LeafNode is included in undo/redo snapshots and correctly restored after undo/redo

### Playback UI

- [ ] **PLAY-01**: The PlaybackTimeline component has a visually polished, modern appearance — refined colors, spacing, and control shapes aligned with contemporary story editor conventions (CapCut/Instagram reference)
- [ ] **PLAY-02**: The play/pause button, scrubber track, and time display are visually cohesive and clearly readable on dark backgrounds
- [ ] **PLAY-03**: Playback UI changes are Tailwind-class-only — no changes to event handlers, store subscriptions, or playback logic

### Live Audio Preview

- [ ] **LAUD-01**: During editor playback, audio from all unmuted video cells is mixed and audible through the browser's audio output
- [ ] **LAUD-02**: Audio starts when the play button is pressed and stops when playback is paused or the story end is reached
- [ ] **LAUD-03**: Only cells with `audioEnabled: true` and `hasAudioTrack: true` contribute audio to the live preview mix
- [ ] **LAUD-04**: AudioContext is created inside the play button's synchronous gesture handler (browser autoplay policy compliant)
- [ ] **LAUD-05**: Each HTMLVideoElement is connected to at most one MediaElementAudioSourceNode per AudioContext lifetime (nodes not recreated on pause/resume; AudioContext closed and recreated per play session)

## v1.4 Requirements (Deferred)

### Video Editing Tools

- **TRIM-01**: User can set a trim start point on a video cell via a drag handle on a mini-timeline in the sidebar
- **TRIM-02**: User can set a trim end point on a video cell via a drag handle on a mini-timeline in the sidebar
- **TRIM-03**: User can enter precise trim start/end times via manual numeric inputs alongside the drag handles
- **TRIM-04**: Trimmed video cells play only the trimmed segment during editor playback and export
- **TRIM-05**: The story timeline duration reflects the longest trimmed clip (not the raw source duration)
- **BOOM-01**: User can toggle boomerang mode on a video cell — video plays forward then backward in a continuous loop
- **BOOM-02**: Boomerang loop runs for the full story duration (minimum one complete forward+backward cycle)
- **BOOM-03**: Boomerang preview uses frame-buffer reversal in the rAF loop (not `playbackRate = -1`, which is unsupported)
- **BOOM-04**: Boomerang cells export correctly in the Mediabunny pipeline with monotonically increasing encode timestamps

### Project Persistence

- **PERS-01**: User can save the current project (layout + media) to a local `.sgrid` file
- **PERS-02**: User can open a previously saved `.sgrid` file to restore the full project state
- *(See AUD-08 from v1.2 — persist `audioEnabled` per cell in project file)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend / cloud storage | Zero backend by design; free Vercel tier cost concern for open-source project |
| Project persistence in v1.3 | Deferred to v1.4 alongside video editing tools |
| Boomerang in v1.3 | GPU memory complexity (ImageBitmap frame buffer); depends on trimming being stable; re-classified P3 by research |
| Video trimming in v1.3 | Higher complexity; deferred to v1.4 with boomerang |
| Safari live audio | Safari AudioContext autoplay restrictions make this unreliable; Chrome/Firefox only for LAUD |
| New npm dependencies | All v1.3 features use existing browser APIs + Mediabunny; no new packages needed |
| Playback control additions | UI polish only — no new controls (loop mode, time counter, etc.) in v1.3 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MUTE-04 | Phase 17 | Pending |
| PRESET-01 | Phase 18 | Pending |
| PRESET-02 | Phase 18 | Pending |
| PRESET-03 | Phase 18 | Pending |
| PRESET-04 | Phase 18 | Pending |
| MUTE-01 | Phase 19 | Pending |
| MUTE-02 | Phase 19 | Pending |
| MUTE-03 | Phase 19 | Pending |
| DROP-01 | Phase 19 | Pending |
| DROP-02 | Phase 19 | Pending |
| DROP-03 | Phase 19 | Pending |
| PLAY-01 | Phase 20 | Pending |
| PLAY-02 | Phase 20 | Pending |
| PLAY-03 | Phase 20 | Pending |
| LAUD-01 | Phase 21 | Pending |
| LAUD-02 | Phase 21 | Pending |
| LAUD-03 | Phase 21 | Pending |
| LAUD-04 | Phase 21 | Pending |
| LAUD-05 | Phase 21 | Pending |

**Coverage:**
- v1.3 requirements: 19 total
- Mapped to phases: 19/19 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 — traceability filled after roadmap creation (Phases 17–21)*
