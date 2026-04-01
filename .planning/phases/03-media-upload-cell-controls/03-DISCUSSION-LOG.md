# Phase 3: Media Upload & Cell Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 03-media-upload-cell-controls
**Areas discussed:** Upload trigger, Multi-file fill, Sidebar, Background color scope

---

## Upload Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Click empty → picker | Clicking empty cell immediately opens file picker; no selection step | |
| Click always selects | Clicking always selects; upload via button in sidebar or action bar | ✓ |
| Click selects; hint area triggers | Upload icon in empty state triggers picker; rest of cell selects | |

**User's choice:** Click always selects — upload via action bar button.
**Notes:** User specifically requested upload button in action bar, positioned before split buttons. Sidebar also gets Upload/Replace button.

---

## Multi-File Auto-Fill

| Option | Description | Selected |
|--------|-------------|----------|
| Fill leaves in order, stop | Fill empty cells; ignore extras with toast | |
| Fill leaves, auto-split for overflow | Fill empty cells; auto-split last filled cell for overflow files | ✓ |
| Fill all leaves (overwrite) | Fill all cells, overwriting filled ones if needed | |

**User's choice:** Fill leaves in document order, auto-split for overflow.
**Notes:** No explicit split direction preference stated; defaulting to horizontal per Claude's discretion.

---

## Sidebar — No Selection State

| Option | Description | Selected |
|--------|-------------|----------|
| Empty / hint | Show "Select a cell to see properties" hint | |
| Canvas-level controls | Show background color + gap slider (Phase 5 placeholders) | ✓ |

**User's choice:** Canvas-level controls when nothing selected.
**Notes:** Background color and gap slider should render as Phase 5 stub controls — wired later.

---

## Sidebar — Selected Cell Section Order

| Option | Description | Selected |
|--------|-------------|----------|
| Thumb → Fit → BG → Info → Actions | Visual first, then appearance, then metadata, then destructive | ✓ |
| Actions → Fit → BG → Info | Actions at top for quick access | |

**User's choice:** Thumbnail → Fit → Background (contain only) → Dimensions → Actions.

---

## Background Color Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-cell | `backgroundColor: string \| null` on LeafNode | ✓ |
| One global setting | Single color in editorStore, no LeafNode schema change | |

**User's choice:** Per-cell. LeafNode gets `backgroundColor: string | null` (null = default black).

---

## Claude's Discretion

- Color picker component (native `<input type="color">` acceptable for Phase 3)
- Cell dimension calculation strategy
- Confirm dialog for New/Clear (browser `confirm()` acceptable)
- Auto-split direction for overflow files (horizontal default)

## Deferred Ideas

None.
