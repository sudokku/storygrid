# StoryGrid

## What This Is

StoryGrid is a fully client-side web app for creating Instagram Story photo/video collages. Users build dynamic grid layouts by recursively splitting cells (like Figma frames), drop media into leaf cells, and export the final composition as a 1080×1920px image or video. Zero backend — fully static, deploys to Vercel/Netlify.

**Current State:** v1.4 shipped 2026-04-17. v1.5 in progress (Phase 27). Cumulative: 12 phases validated across v1.0–v1.4, ~13,200 LOC TS/TSX, 628+ tests passing.

## Core Value

A user can build a multi-cell photo/video collage from scratch, fill it with images or videos, and download a pixel-perfect 1080×1920px PNG or MP4 — entirely in the browser, no account or server required.

## Shipped Milestones (summary)

Full validated-requirements lists and per-phase PLAN/CONTEXT/SUMMARY/VERIFICATION files are archived under `.planning/milestones/v1.X-*`. High-level per-milestone deliverables:

- **v1.0** — Grid tree engine, rendering, media upload, Canvas API export, polish, mobile-first UI (Phase 5.1 inserted), video support via MediaRecorder.
- **v1.1** — Portal-based ActionBar, safe-zone overlay, friction-free template apply, full-workspace drop zone, atomic cell MOVE (5-zone overlay).
- **v1.2** — Per-cell effects (6 presets + 4 sliders), per-cell audio toggle, text/emoji/sticker overlay layer, Mediabunny direct MP4 pipeline (no ffmpeg.wasm, no COOP/COEP), VideoSampleSink decode-then-encode (-99.4% export seek time), dev export metrics panel.
- **v1.3** — Instagram-style filter presets, auto-mute detection, breadth-first media drop, playback UI polish, live audio preview.
- **v1.4** — Mobile UX overhaul (5-button header, chevron-toggle bottom sheet, cell action tray, touch drag-and-drop), 8 Instagram-style Google Fonts for text overlays.

Deferred: AUD-08 (persist `audioEnabled` — deferred alongside PERS-01..12 persistence block); Phase 25 touch-drag interaction model flagged for v1.5 overhaul.

## Active Milestone: v1.5 Unified Drag-and-Drop UX

**Goal:** Replace current touch/desktop DnD with a unified engine delivering identical, intuitive cell-drag behavior on both platforms and clear visual affordances at every stage of the interaction.

**Target features:**
- Unified DnD engine powering cell drag across desktop + mobile
- Drag cursor on hover + press-and-hold affordance with subtle drag-start animation
- Semi-opaque cell-content preview following pointer/finger during drag
- 5-icon drop-zone overlay: center = swap; top/right/bottom/left = insert
- ESC-to-cancel drag
- Complete replacement of Phase 25 touch DnD + `@dnd-kit` wiring

**Phases:** 27 DnD Foundation, 28 Cell-to-Cell Drag, 29 ESC-Cancel + Visual Polish, 30 Mobile Handle + Tray Polish. Full acceptance criteria in `.planning/REQUIREMENTS.md`.

**Key context:** Library choice open (pragmatic-drag-and-drop, @dnd-kit rebuild, or other) — research selects. File-from-desktop drops, overlay drag, and divider resize stay on current native-pointer implementations unless unification yields clear maintenance gains. Milestone intentionally iterative — more DnD phases expected as implementation reveals needs.

## Out of Scope

- Backend / server-side rendering — zero backend by design; static-only
- User accounts / cloud storage — MVP is local-only; no ops burden
- Real-time collaboration — single user session only
- Safari video export — MediaRecorder codec availability on Safari is limited; explicitly deferred
- AI layout suggestions — high complexity, not core to manual collage value
- Direct Instagram publish API — OAuth + app review scope creep; download-and-upload suffices
- React 19 — peer dependency risk with dnd-kit; no relevant features for this SPA
- Tailwind v4 — requires Safari 16.4+; project targets Safari 15+

## Constraints

- **Tech Stack:** Vite + React 18 + TypeScript + Zustand + Immer + Tailwind CSS 3 — pre-decided, do not substitute
- **State:** Zustand with Immer middleware; immutable updates on nested tree; undo/redo via history array
- **Export (image):** Custom Canvas API renderer (html-to-image replaced in quick task 260401-oca)
- **Export (video):** Mediabunny direct MP4 pipeline (MediaRecorder+ffmpeg.wasm replaced Phase 14)
- **Bundle:** MVP bundle under 500KB gzipped
- **Browser Support:** Chrome 90+, Firefox 90+, Safari 15+ (MVP). Video export Chrome/Firefox only.
- **Deployment:** Vite static build → `dist/` → Vercel or Netlify

## Key Decisions (still load-bearing)

| Decision | Rationale |
|----------|-----------|
| Recursive split-tree (not CSS grid) | Arbitrary nesting, maps directly to tree data, Figma-like model |
| LeafNode renders via `<canvas>` (not `<img>`) | WYSIWYG parity — same `drawLeafToCanvas()` pipeline as export |
| Canvas API export (replaced html-to-image) | Deterministic output, handles object-fit correctly, zero dependency |
| Mediabunny direct MP4 (Phase 14) | No WASM, no COOP/COEP, simpler pipeline, full audio parity |
| Mediabunny VideoSampleSink decode (Phase 15) | Eliminated 99.4% of export seek time; sequential decode bounds GPU memory |
| Portal-based ActionBar (v1.1) | `createPortal(document.body)` renders in viewport space outside canvas transform → fixed `w-16 h-16` stable at any cell size |
| Blob URLs for video, base64 for images | Images need undo-safe snapshotting; videos are large blobs (revoked on removeMedia/clearGrid/applyTemplate) |
| 5-zone LeafNode drop overlay | MOVE (edge insertion) and SWAP (center) are distinct semantics; single-undo atomicity via `moveCell` |
| CSS-driven responsive breakpoint | Avoids FOUC, aligns with Tailwind conventions |
| No backend / localStorage only | Zero ops, instant deploy, privacy-first |

Full historical decision log per phase: `.planning/milestones/v1.X-phases/*/CONTEXT.md` and `SUMMARY.md`.

## Architecture

The grid uses a **recursive split-based tree structure** modeled after Figma's frame splitting. The canvas is always 1080×1920px internally; the editor shows a scaled-down preview via CSS `transform: scale()`. Every leaf renders via a `<canvas>` element sharing the `drawLeafToCanvas()` pipeline — guaranteeing WYSIWYG export parity.

- ActionBar renders via `createPortal(document.body)` in viewport space (not inside canvas transform)
- Cell MOVE/SWAP are distinct gestures via 5-zone LeafNode drop overlay
- Video export uses Mediabunny `CanvasSource`+`AudioBufferSource` + OfflineAudioContext mix + `VideoSampleSink` decode path

## Evolution

This document evolves at phase transitions and milestone boundaries.

- **Per-phase** (`/gsd:transition`): move invalidated reqs to Out of Scope; add emerging reqs to Active; log new Key Decisions if still load-bearing.
- **Per-milestone** (`/gsd:complete-milestone`): full section review; update "Current State" line; archive the completed milestone's Active list into `.planning/milestones/v1.X-REQUIREMENTS.md`.

---
*Last updated: 2026-04-17 — v1.5 milestone active. Historical detail lives in `.planning/milestones/` (per-milestone REQUIREMENTS/ROADMAP + phase-level PLAN/CONTEXT/SUMMARY/VERIFICATION).*
