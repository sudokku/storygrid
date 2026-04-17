---
status: partial
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md]
started: 2026-04-17T22:00:00Z
updated: 2026-04-17T22:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Desktop click-hold drag + drop (SC-1)
expected: On a ≥2-cell grid, mousedown on one cell, move ≥8px, release on a different cell — cells swap (center drop) or insert (edge drop) identically to Phase 9 semantics
result: [pending]

### 2. Touch press-and-hold drag + drop (SC-2)
expected: On a touch device, 250ms press-and-hold on any cell initiates drag; release <250ms does not trigger drag; releasing on a different cell commits the move
result: [pending]

### 3. File-drop onto cell still works (SC-4)
expected: Dragging an image/video file from OS desktop onto any cell places the media; workspace file-drop still works
result: [pending]

### 4. Ghost + zone visuals during drag (SC-5)
expected: Ghost image follows pointer with no jump; source cell shows at 40% opacity; 5-zone indicator appears on hovered target cell; accent outline on hovered cell
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
