---
status: complete
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md]
started: 2026-04-17T22:00:00Z
updated: 2026-04-17T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Desktop click-hold drag + drop (SC-1)
expected: On a ≥2-cell grid, mousedown on one cell, move ≥8px, release on a different cell — cells swap (center drop) or insert (edge drop) identically to Phase 9 semantics
result: issue
reported: "Absolutely nothing happens. The pointer is not showing drag, there is no animation of starting the drag-and-drop, cells don't move, I don't see the overlay icons before dropping. As if nothing there to test."
severity: blocker

### 2. Touch press-and-hold drag + drop (SC-2)
expected: On a touch device, 250ms press-and-hold on any cell initiates drag; release <250ms does not trigger drag; releasing on a different cell commits the move
result: issue
reported: "The semi-opaque copy of the cell content is moving at an accelerated pace compared to the pointer. I could swap them but it looks like I can't extend the cell to left/right/top/bottom. It also does not accentuate the icon of the move (swap or extend on specific direction). The whole logic \"works\" once in 3 times."
severity: major

### 3. File-drop onto cell still works (SC-4)
expected: Dragging an image/video file from OS desktop onto any cell places the media; workspace file-drop still works
result: pass

### 4. Ghost + zone visuals during drag (SC-5)
expected: Ghost image follows pointer with no jump; source cell shows at 40% opacity; 5-zone indicator appears on hovered target cell; accent outline on hovered cell
result: issue
reported: "As previously stated: the image follows pointer's direction at an accelerated speed. Yes, the source cell does have the opacity filter. The 5 zones indicators appear but I have no idea why they refuse to properly work (the only semi-consistend one is the center swap, while the extend ones are very buggy). There is no outline on hovered drop cell. As a followup note - this is only on mobile screen size. On desktop screen sizes it does not work at all, not even the swipe."
severity: major

## Summary

total: 4
passed: 1
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "On a ≥2-cell grid, mousedown on one cell, move ≥8px, release on a different cell — cells swap (center drop) or insert (edge drop) identically to Phase 9 semantics"
  status: failed
  reason: "User reported: Absolutely nothing happens. The pointer is not showing drag, there is no animation of starting the drag-and-drop, cells don't move, I don't see the overlay icons before dropping. As if nothing there to test."
  severity: blocker
  test: 1
  artifacts: []
  missing: []

- truth: "On a touch device, 250ms press-and-hold on any cell initiates drag; release <250ms does not trigger drag; releasing on a different cell commits the move"
  status: failed
  reason: "User reported: The semi-opaque copy of the cell content is moving at an accelerated pace compared to the pointer. I could swap them but it looks like I can't extend the cell to left/right/top/bottom. It also does not accentuate the icon of the move (swap or extend on specific direction). The whole logic \"works\" once in 3 times."
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Ghost image follows pointer with no jump; source cell shows at 40% opacity; 5-zone indicator appears on hovered target cell; accent outline on hovered cell"
  status: failed
  reason: "User reported: Ghost follows pointer at accelerated speed. 5 zones indicators appear but only center swap is semi-consistent; extend zones very buggy. No outline on hovered drop cell. Only works at all on mobile screen size — on desktop screen sizes nothing happens (not even swap)."
  severity: major
  test: 4
  artifacts: []
  missing: []
