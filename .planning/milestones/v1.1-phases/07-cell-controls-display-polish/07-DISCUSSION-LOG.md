# Phase 7: Cell Controls & Display Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 07-cell-controls-display-polish
**Areas discussed:** ActionBar Overflow, Sizing Units, Video Thumbnail, Empty Cell Text

---

## ActionBar Overflow (CELL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Portal (ReactDOM.createPortal) | Render bar outside cell DOM, position absolutely relative to canvas wrapper | |
| `overflow-visible` on cell + split clipping layer | Change cell container to overflow-visible; move `overflow-hidden` to a canvas-only inner wrapper | ✓ |
| Reposition above cell boundary | Float bar as a sibling of the cell, not a child | |

**User's choice:** `overflow-visible` approach — preserves existing absolute-positioning logic, avoids portal complexity. Canvas/media layer still needs its own clipping wrapper.

---

## Sizing Units (CELL-02 + CELL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| `vw`-based with clamp | `clamp(28px, 1.8vw, 40px)` — scales with viewport width | |
| Canvas-relative with clamp | Size relative to canvas element, bounded by clamp | ✓ |
| Fixed px with breakpoints | Keep px, add responsive breakpoints per viewport range | |

**User's choice:** Canvas-relative with `clamp()`. Both ActionBar button/icon sizes and empty cell icon use the same approach.

---

## Video Thumbnail (MEDIA-01)

| Option | Description | Selected |
|--------|-------------|----------|
| At media registration time | Capture first frame when video is added to store; store data URL in `thumbnailMap` | ✓ |
| Lazily in Sidebar | Draw frame when sidebar panel opens for a video cell | |
| In LeafNode at video load | Store thumbnail in component ref, pass upward | |

**User's choice:** At registration time. Avoids later bugs from lazy capture. Stored in a parallel `thumbnailMap` in gridStore.

---

## Empty Cell Text/Label (CELL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Scale with same unit as #2 | Canvas-relative clamp for text as well | |
| Hide on small cells | Suppress label below a size threshold; keep icon only (also canvas-relative) | ✓ |

**User's choice:** Hide the text label on small cells. Icon uses the canvas-relative clamp from decision #2.

---

## Claude's Discretion

- Exact `clamp()` values for button and icon sizes
- Implementation mechanism for canvas-relative sizing (container queries vs. injected custom property vs. ResizeObserver inline style)
- Exact height threshold for hiding empty cell label
- Whether to use `seeked` or `loadeddata` event for reliable first-frame thumbnail capture

## Deferred Ideas

None.
