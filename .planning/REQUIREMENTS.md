# Requirements: StoryGrid v1.2 — Effects, Overlays & Persistence

**Defined:** 2026-04-09
**Core Value:** A user can build a multi-cell photo/video collage from scratch, fill it with images or videos, and download a pixel-perfect 1080×1920px PNG or MP4 — entirely in the browser, no account or server required.

**Milestone Goal:** Expand StoryGrid from a layout/export tool into a full creative editor — add per-cell visual effects, a global overlay layer for text and stickers, project persistence, and per-cell audio toggle on video export.

## v1.2 Requirements

### Effects & Filters (per-cell, non-destructive)

- [ ] **EFF-01**: User can apply a named preset filter (B&W, Sepia, Vivid, Fade, Warm, Cool) to any leaf cell from a preset carousel in the sidebar
- [ ] **EFF-02**: User can adjust brightness on the selected cell via a slider (-100 to +100, default 0)
- [ ] **EFF-03**: User can adjust contrast on the selected cell via a slider (-100 to +100, default 0)
- [ ] **EFF-04**: User can adjust saturation on the selected cell via a slider (-100 to +100, default 0)
- [ ] **EFF-05**: User can adjust blur on the selected cell via a slider (0 to 20px, default 0)
- [ ] **EFF-06**: User can reset all effects on a cell to defaults via a single "Reset" button
- [ ] **EFF-07**: Effects are non-destructive — the original media is never modified; effect parameters are stored on the leaf node
- [ ] **EFF-08**: Effects apply identically in the live preview canvas, PNG export, and MP4 video export (WYSIWYG)
- [ ] **EFF-09**: Effects survive undo/redo; slider drags commit a single history snapshot on pointerup (not per pointermove)
- [ ] **EFF-10**: Applying a preset updates the underlying slider values so the user can fine-tune after selecting a preset

### Text & Sticker Overlay Layer (global, above the grid)

- [ ] **OVL-01**: User can add a text overlay to the canvas via a "Add Text" button; new text spawns centered on the canvas with placeholder text
- [ ] **OVL-02**: User can edit the text content of a selected text overlay via an inline editor or sidebar input
- [ ] **OVL-03**: User can change the font family of a selected text overlay (minimum 3 choices: Geist, serif display, script)
- [ ] **OVL-04**: User can change the font size of a selected text overlay via a slider (16–256px)
- [ ] **OVL-05**: User can change the text color of a selected text overlay via a color picker
- [ ] **OVL-06**: User can change the font weight of a selected text overlay (regular / bold)
- [ ] **OVL-07**: User can change the text alignment of a selected text overlay (left / center / right)
- [ ] **OVL-08**: User can add an emoji sticker via an emoji picker panel; emoji spawns centered on the canvas
- [ ] **OVL-09**: User can upload a custom PNG or SVG image sticker via a file picker; SVG content is sanitized via DOMPurify before use
- [ ] **OVL-10**: User can drag any overlay (text, emoji, image sticker) freely across the 1080×1920 canvas
- [ ] **OVL-11**: User can resize any selected overlay via a corner handle (proportional scaling)
- [ ] **OVL-12**: User can rotate any selected overlay via a top rotation handle
- [ ] **OVL-13**: User can delete a selected overlay via the Delete key or a trash button
- [ ] **OVL-14**: User can reorder overlays front-to-back via "Bring Forward" / "Send Backward" actions
- [ ] **OVL-15**: Overlay selection is mutually exclusive with cell selection — clicking one clears the other
- [ ] **OVL-16**: Overlays render identically in the live preview, PNG export, and MP4 video export, at the correct 1080×1920 coordinates
- [ ] **OVL-17**: Sticker image data is stored in a separate `stickerRegistry` (mirroring `mediaRegistry`) — never inlined into the grid tree or history snapshots

### Project Persistence (localStorage + file)

- [ ] **PERS-01**: Current project auto-saves to localStorage on every mutation (debounced to 300–500ms) so the project survives page reload
- [ ] **PERS-02**: User can open a "My Projects" panel listing all saved projects with thumbnail, name, and last-updated timestamp
- [ ] **PERS-03**: User can save the current project with a custom name; the project is added to the projects list
- [ ] **PERS-04**: User can load any project from the projects list, replacing the current canvas state
- [ ] **PERS-05**: User can rename a saved project from the projects list
- [ ] **PERS-06**: User can delete a saved project from the projects list (with confirmation)
- [ ] **PERS-07**: User can export the current project as a `.storygrid` JSON file via a download action
- [ ] **PERS-08**: User can import a `.storygrid` file via a file picker; the file is validated with Zod before loading
- [ ] **PERS-09**: Video blob URLs are omitted from `.storygrid` files and from persisted projects (they expire on reload); cells with missing videos show a "Re-upload video" placeholder on load
- [ ] **PERS-10**: Persistence gracefully handles `QuotaExceededError` (localStorage full) and `SecurityError` (Safari private browsing) with a user-visible toast and no data loss
- [ ] **PERS-11**: `.storygrid` files include a `version` field; unknown or malformed files are rejected with a clear error
- [ ] **PERS-12**: Saved projects include a small PNG thumbnail (generated via the existing Canvas API export renderer at save time)

### Per-Cell Audio Toggle (video export)

- [ ] **AUD-01**: Each video cell has an audio-enabled boolean field on its leaf node, defaulting to `true` for newly added videos
- [ ] **AUD-02**: Each video cell shows a speaker icon (unmuted/muted) in the portal ActionBar; the icon is visible only for cells with `mediaType === 'video'`
- [ ] **AUD-03**: Clicking the speaker icon toggles the cell's audio-enabled state and updates the icon to reflect the new state
- [ ] **AUD-04**: The sidebar video cell panel also exposes the audio toggle (parity with ActionBar)
- [ ] **AUD-05**: MP4 video export mixes audio from all cells where audio is enabled via a Web Audio API graph (AudioContext → MediaElementAudioSourceNode per cell → MediaStreamAudioDestinationNode), combined with the canvas video track into a single MediaStream fed to MediaRecorder
- [ ] **AUD-06**: If zero cells have audio enabled, the exported MP4 contains no audio track (not a silent track)
- [ ] **AUD-07**: Audio in the exported MP4 is clipped to the total video export duration
- [ ] **AUD-08**: Audio toggle state is persisted in saved projects and `.storygrid` files
- [ ] **AUD-09**: Audio export is Chrome/Firefox only — matches the existing video export browser support boundary (Safari excluded)

## Future Requirements (deferred)

### Effects (future)

- **EFF-F-01**: Additional sliders (warmth, tint, vignette, highlights, shadows)
- **EFF-F-02**: Compare-to-original long-press toggle
- **EFF-F-03**: Global canvas-wide filter (applies to all cells at once)
- **EFF-F-04**: Custom LUT import

### Overlays (future)

- **OVL-F-01**: Text background pill / rect styling
- **OVL-F-02**: Text outline and shadow styling
- **OVL-F-03**: Overlay undo/redo (v1.2 ships with delete-only overlay history)
- **OVL-F-04**: Curved text and text path animation
- **OVL-F-05**: Sticker library (pre-built sticker packs)
- **OVL-F-06**: Snap-to-grid / snap-to-safe-zone alignment guides

### Persistence (future)

- **PERS-F-01**: IndexedDB backend for large projects exceeding localStorage quota
- **PERS-F-02**: Cross-tab sync (BroadcastChannel)
- **PERS-F-03**: Cloud sync / account-backed projects
- **PERS-F-04**: Project file zip-bundle format with embedded media assets

### Audio (future)

- **AUD-F-01**: Per-cell volume slider (not just on/off)
- **AUD-F-02**: Background music track layered over video cells
- **AUD-F-03**: Audio fade in / fade out

## Out of Scope

Explicitly excluded from v1.2 to prevent scope creep. Many were considered during v1.1 planning and remain deferred.

| Feature | Reason |
|---------|--------|
| Aspect ratio presets (1:1, 4:5) | Deferred — v1.2 focuses on creative tools, not canvas dimension changes |
| Multi-slide stories (add/remove/reorder pages, batch export) | Large separate feature — belongs in its own milestone |
| D-16: Cell swap touch on iOS/Android | Still deferred — dnd-kit TouchSensor refactor belongs in its own task |
| Real-time collaboration | Zero-backend constraint |
| Cloud storage / accounts | Zero-backend constraint |
| Safari MP4 export (including audio) | MediaRecorder codec support on Safari is too limited — existing v1.0 constraint |
| AI layout suggestions | Not core to manual collage value proposition |
| AI effect suggestions / auto-filters | Not core; adds ML model weight to bundle |
| Text animation / animated stickers | Would require per-frame state machine in export; deferred |
| Background removal for image stickers | Requires ML model; violates 500KB bundle budget |
| Full layer panel (Photoshop-style) | Overkill for expected 3–8 overlay items per project |
| Twemoji rendering for cross-platform emoji consistency | Document OS-dependent emoji appearance instead |
| React 19 | Peer dependency risk with dnd-kit |
| Tailwind v4 | Safari 15 target |

## Traceability

Which phases cover which requirements. Populated by roadmapper during Step 10.

| Requirement | Phase | Status |
|-------------|-------|--------|
| _(empty — pending roadmap)_ | | |

**Coverage:**
- v1.2 requirements: 43 total (10 EFF + 17 OVL + 12 PERS + 9 AUD — wait, recount below)
- Mapped to phases: 0
- Unmapped: 43 ⚠️ (pending roadmap)

**Counts:**
- EFF: 10 requirements
- OVL: 17 requirements
- PERS: 12 requirements
- AUD: 9 requirements
- **Total: 48 requirements**

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after initial v1.2 definition*
