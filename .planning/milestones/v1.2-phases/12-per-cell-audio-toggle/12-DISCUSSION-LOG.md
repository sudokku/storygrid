# Phase 12: Per-Cell Audio Toggle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 12-per-cell-audio-toggle
**Areas discussed:** ActionBar icon placement + visuals, Sidebar toggle placement, Export loop audio behavior, Defaults + undo granularity

---

## ActionBar icon placement + visuals

### Q1: Where should the speaker icon sit in the ActionBar button row?

| Option | Description | Selected |
|--------|-------------|----------|
| After Fit, before Clear | Groups media-behavior controls (Fit, Audio, Clear). Only visible for video cells. | ✓ |
| Far right, before Remove | Terminal slot, like a status flag. | |
| Right after Upload | Early/prominent position. | |

**User's choice:** After Fit, before Clear

### Q2: Which lucide icons for audio-on / audio-muted?

| Option | Description | Selected |
|--------|-------------|----------|
| Volume2 / VolumeX | Speaker with waves / speaker with X. Clearest convention. | ✓ |
| Volume2 / Volume | Waves / no waves. Subtler. | |
| Mic / MicOff | Microphone metaphor — wrong mental model. | |

**User's choice:** Volume2 / VolumeX

### Q3: How should the muted state be styled visually?

| Option | Description | Selected |
|--------|-------------|----------|
| Red-tinted like Trash | `text-red-500` + `hover:bg-red-500/20`. Reuses destructive action vocabulary. | ✓ |
| Dimmed white | `text-white/40`. Subtler "inactive" semantics. | |
| White + slash overlay | Neutral color, rely on VolumeX's X. Lowest visual weight. | |

**User's choice:** Red-tinted like Trash

---

## Sidebar toggle placement

### Q1: Where in SelectedCellPanel should the audio toggle appear for video cells?

| Option | Description | Selected |
|--------|-------------|----------|
| Own 'Playback' subsection above Effects | New titled row, video-only, forward-compatible slot for loop/trim/speed later. | ✓ |
| Inline with Fit/Pan controls | Conflates visual framing with audio; awkward conditional inside a non-conditional row. | |
| Below EffectsPanel above resets | Buries a primary attribute of videos. | |

**User's choice:** Own 'Playback' subsection above Effects

### Q2: What UI primitive for the sidebar toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| Icon button matching ActionBar | Same Volume2/VolumeX + red-when-muted; parity across surfaces. | ✓ |
| Labeled switch: 'Audio [toggle]' | iOS-style switch. New primitive not used elsewhere. | |
| Labeled icon button | Text + icon like Reset buttons. More verbose. | |

**User's choice:** Icon button matching ActionBar

---

## Export loop audio behavior

### Q1: What's the audio behavior at loop boundaries during MP4 export?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept the click — ship it | No fade, no special handling. MediaElementAudioSourceNode plays naturally through seeks. | ✓ |
| Audio first pass only, then silence | Disconnect source on video end. Clean but surprising. | |
| Crossfade 50ms via GainNode | Smoother but adds complexity and coordination with render loop. | |

**User's choice:** Accept the click — ship it

### Q2: Short video inside longer export — how is elapsed audio handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Audio loops with the video | What you see is what you hear. Pairs with "accept the click." | ✓ |
| Audio plays once, then silent | Decouples audio from visual loop. A/V mismatch. | |

**User's choice:** Audio loops with the video

---

## Defaults + undo granularity

### Q1: How should existing video cells (placed before the update) get audioEnabled?

| Option | Description | Selected |
|--------|-------------|----------|
| Default to true everywhere | Uniform rule, one code path, matches "videos have sound" expectation. | ✓ |
| false for existing, true for new | "Do no harm" migration, but adds complexity for marginal gain. | |

**User's choice:** Default to true everywhere

### Q2: Is the audio toggle part of undo/redo history?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — one snapshot per click | Consistent with fit toggle / remove / split. Ctrl+Z undoes accidental mute. | ✓ |
| No — exclude from history | Saves snapshots but breaks the undo mental model. | |

**User's choice:** Yes — one snapshot per click

### Q3: Field name and shape on LeafNode?

| Option | Description | Selected |
|--------|-------------|----------|
| `audioEnabled: boolean` required, always present | Matches Phase 11 `effects` pattern. Test fixture one-liner update. | ✓ |
| `audioEnabled?: boolean` optional | Forces undefined handling at every read site. | |

**User's choice:** `audioEnabled: boolean` required, always present

---

## Claude's Discretion

Areas the user left open for planner/implementer judgement:
- Exact tooltip copy wording
- Toast vs silent log on AudioContext init failure
- Exact pixel size of sidebar audio button
- Whether `toggleAudioEnabled` is a dedicated action or a thin `updateCell` wrapper
- Visual treatment of "Playback" subsection label (header style, collapsible, etc.)
- Whether ActionBar reads `mediaType` via new prop or store lookup
- `MediaStreamAudioDestinationNode` vs `createMediaStreamDestination()` naming (same thing)

## Deferred Ideas

- Audio preview during editing — out of scope
- Per-cell volume slider — v1.3+
- Background music / audio track upload — PROJECT.md explicitly deferred
- Audio crossfade at loop boundaries — rejected as over-engineering
- "Play audio once then silence" alternate mode — rejected
- Safari audio export — AUD-09 locks Chrome/Firefox only
- Audio level meter / waveform — out of scope
- Trim in/out points per cell — future Playback subsection content
- Global "mute all" shortcut — not requested
