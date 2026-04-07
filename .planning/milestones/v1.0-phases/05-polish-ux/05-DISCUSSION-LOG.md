# Phase 5: Polish & UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 05-polish-ux
**Areas discussed:** Style controls layout, Templates panel, Pan/zoom interaction, Onboarding style

---

## Style Controls Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar — canvas section | Permanent "Canvas" section always visible at top of sidebar, above cell panel | ✓ |
| Collapsible sidebar section | Same placement but collapsed by default | |
| Toolbar extension | Second toolbar row or popover for canvas controls | |

**User's choice:** Sidebar — canvas section (permanent, always visible)
**Notes:** Clear visual separation: canvas-level controls above, cell-level below.

---

## Background Gradient Complexity

| Option | Description | Selected |
|--------|-------------|----------|
| Simple: solid + linear gradient | Toggle solid/gradient, two color pickers + direction toggle | ✓ |
| Solid only | Skip gradient for this phase | |
| Full gradient builder | Angle slider 0–360° + two color pickers | |

**User's choice:** Simple: solid + linear gradient

---

## Templates Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar — top strip | Horizontal scroll strip always visible at top of sidebar | |
| Toolbar button → popover grid | Templates button opens 2×3 popover grid | ✓ |
| No-selection sidebar state | Templates only when no cell is selected | |

**User's choice:** Toolbar button → popover grid

---

## Template Application Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm dialog — clears everything | Show confirm for non-empty grids | ✓ |
| Always apply silently | Replace immediately, undo available | |

**User's choice:** Confirm dialog for non-empty grids; silent for empty grids.

---

## Pan/Zoom Visual Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor + ring color change | grab cursor + amber ring | |
| "Pan mode" label badge | Small "PAN" badge in cell corner | |
| Dimmed overlay on other cells | Other cells dimmed when pan mode active | ✓ |

**User's choice:** Dimmed overlay on other cells

---

## Pan/Zoom Technical Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Scale object-position (transform) | CSS transform: translate + scale on img | ✓ |
| object-fit: none + object-position | Pure CSS, no transform | |

**User's choice:** CSS transform approach — panX, panY, panScale stored on leaf node

---

## Cell-Swap Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Long-press to initiate swap | Hold 200ms to start swap drag | |
| Drag from action bar only | Drag handle icon in action bar | |
| Drag from cell edge | Edge = swap, center = pan | |
| Other (user specified) | Drag handle button in top-left of action bar | ✓ |

**User's choice:** Drag handle button in top-left corner of action bar (visible on hover). No new gestures.
**Notes:** User asked whether the full leaf node can be swapped (not just media). Confirmed: swap all leaf content (image, size/fit, background color, all pan/zoom parameters). Grid structure (cell positions/sizes) stays unchanged.

---

## Cell-Swap Content Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All leaf content — media, fit, bgColor, pan/zoom | Swap everything on the leaf | ✓ |
| Media only | Only swap the image | |

**User's choice:** All leaf content — media + fit + bgColor + pan/zoom state

---

## Onboarding Style

| Option | Description | Selected |
|--------|-------------|----------|
| Single dismissable tooltip | One tooltip anchored to canvas, dismissed on first click | |
| Step-by-step highlight overlay | 3-step guided tour | ✓ |
| No onboarding | Skip POLH-10 | |

**User's choice:** Step-by-step highlight overlay

---

## Onboarding Steps

| Option | Description | Selected |
|--------|-------------|----------|
| 3 steps, skip-able | Canvas → cell hover/upload → export button. Skip always visible. | ✓ |
| 2 steps only | Canvas area + toolbar Export only | |

**User's choice:** 3 steps with skip. Semi-transparent backdrop with spotlight highlight on focused element.

---

## Claude's Discretion

- Store architecture: editorStore extension vs. new canvasSettingsStore
- Template thumbnail rendering: SVG or styled divs
- L-shape and Mosaic tree structures
- Drag handle position within ActionBar
- Onboarding spotlight technique (box-shadow, clip-path, or portal)

## Deferred Ideas

None raised during discussion.
