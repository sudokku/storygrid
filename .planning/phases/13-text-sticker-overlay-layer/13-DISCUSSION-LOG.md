# Phase 13: Text & Sticker Overlay Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 13-text-sticker-overlay-layer
**Areas discussed:** Overlay Store Architecture, Text Editing UX, Font Loading & Choices, Emoji Picker Approach

---

## Overlay Store Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Separate overlayStore | New Zustand store next to gridStore/editorStore. Clean separation. | ✓ |
| Extend gridStore | Add overlays array and actions to existing gridStore. Unified undo stack. | |
| You decide | Claude picks. | |

**User's choice:** Separate overlayStore

---

| Option | Description | Selected |
|--------|-------------|----------|
| Add & delete only | Undo tracks adding and deleting only. Move/resize/rotate not undoable. | ✓ |
| All overlay actions | Add, delete, move, resize, rotate all tracked. More complete UX. | |
| No undo for overlays | Overlay actions never undoable. Simplest but risky. | |

**User's choice:** Add & delete only (matches OVL-F-03 noting full undo is future)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Add selectedOverlayId to editorStore | One new field; mutual exclusion enforced by clearing the other. | ✓ |
| Keep selection in overlayStore | overlayStore owns selectedOverlayId; creates cross-store coupling. | |

**User's choice:** Add selectedOverlayId to editorStore

---

| Option | Description | Selected |
|--------|-------------|----------|
| Type union: TextOverlay \| EmojiOverlay \| StickerOverlay | TypeScript narrowing, clean discriminant. | ✓ |
| Single Overlay type with optional fields | Simpler but loses narrowing. | |

**User's choice:** Type union with discriminant

---

## Text Editing UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline contenteditable over canvas | Double-click reveals contenteditable div positioned over canvas in viewport space. | ✓ |
| Sidebar input only | Edit in sidebar text field; canvas updates in real-time. | |
| You decide | Claude picks. | |

**User's choice:** Inline contenteditable over canvas

---

| Option | Description | Selected |
|--------|-------------|----------|
| DOM element over canvas | Overlays rendered as absolutely-positioned DOM divs; canvas only renders on export. | ✓ |
| Draw on canvas in editor too | Second canvas or same canvas draws overlays in editor. True pixel parity. | |

**User's choice:** DOM element over canvas (export-only canvas path)

---

| Option | Description | Selected |
|--------|-------------|----------|
| React component handles over DOM overlay | Corner + top handles using raw pointer events (same as Divider + pan/zoom). | ✓ |
| dnd-kit for drag, custom for handles | Mix of dnd-kit + custom pointer events. | |

**User's choice:** React component handles with raw pointer events

---

## Font Loading & Choices

| Option | Description | Selected |
|--------|-------------|----------|
| Google Fonts via \<link\> in index.html | Async load, cached, no JS overhead. Works with document.fonts.ready for export. | ✓ |
| CSS @font-face with bundled files | Self-hosted, works offline. ~100-300KB per family. | |
| System fonts only | No loading. Cross-device variance is significant. | |

**User's choice:** Google Fonts via index.html link

---

| Option | Description | Selected |
|--------|-------------|----------|
| Playfair Display + Dancing Script | Elegant serif + flowing handwriting. Popular Instagram story fonts. | ✓ |
| Lora + Pacifico | Warm serif + bold casual script. More casual feel. | |
| You decide | Claude picks. | |

**User's choice:** Playfair Display + Dancing Script

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown with font name in its own typeface | Each option rendered in that font. | ✓ |
| Chip row (effects presets pattern) | 3-4 chip buttons in a row, each in its font. | |

**User's choice:** Dropdown with self-rendering font labels

---

## Emoji Picker Approach

| Option | Description | Selected |
|--------|-------------|----------|
| emoji-mart library (lazy-loaded) | ~100KB, search + categories. Lazy chunk so no initial bundle hit. | ✓ |
| Lightweight custom grid | ~100 common emojis, zero dependency, ~2KB. No search. | |
| You decide | Claude picks. | |

**User's choice:** emoji-mart, lazy-loaded

---

| Option | Description | Selected |
|--------|-------------|----------|
| ctx.fillText with emoji char | Store raw emoji char; render with fillText on export. Fast. | ✓ |
| Rasterize emoji to image at add-time | Pixel-perfect cross-browser, but stores image data per emoji. | |

**User's choice:** ctx.fillText with raw emoji character

---

| Option | Description | Selected |
|--------|-------------|----------|
| Popover from toolbar 'Add' button | Same pattern as TemplatesPopover (already in codebase). | ✓ |
| Sidebar panel section | Picker in sidebar as collapsible section. | |

**User's choice:** Popover from toolbar "Add" button

---

## Claude's Discretion

- Exact Tailwind styling of overlay DOM elements and handles
- Whether OverlayPanel is a new sidebar section or type-switch in SelectedCellPanel
- Handle sizing (likely 8–12px thumbs matching existing interactive patterns)
- Whether overlayStore uses Immer middleware
- Snapshot merging strategy (grid + overlay array in one snapshot, or parallel arrays)
- contenteditable vs controlled textarea for inline text editing
- "Add" toolbar button layout details
- emoji-mart configuration (skin tone, dark theme)

## Deferred Ideas

None — discussion stayed within phase scope.
