---
status: complete
phase: 19-auto-mute-detection-breadth-first-drop
source: [19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md]
started: 2026-04-14T00:00:00Z
updated: 2026-04-14T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. BFS Fill Order — Multiple Files
expected: Drop 4+ image files onto the canvas (outside any specific cell, or via the toolbar upload). Cells should fill level-by-level (BFS): top-left first, then top-right, then next row left-to-right. NOT depth-first (i.e., not filling all children of the first cell before moving to siblings).
result: issue
reported: "It keeps on making the same splits (horizontal if empty project, and vertical to the 2 last items if there are already some items). It's not really giving the BFS feel. Try alternating the direction of split."
severity: major

### 2. Single-File Targeted Drop
expected: Drag a single image or video file and drop it onto a specific leaf cell. Only that cell receives the media — no other cells are filled or modified, even if other empty cells exist.
result: pass

### 3. Audio Detection — Video With Audio
expected: Drop a video file that has an audio track onto a cell. After upload, the audio toggle in ActionBar (and Sidebar if cell is selected) should be interactive (not locked) — Volume2/VolumeX icon is clickable and not dimmed.
result: pass

### 4. Audio Detection — Video Without Audio Track
expected: Drop a video file that has NO audio track (muted video, screen recording, etc.) onto a cell. After upload, the ActionBar should show a dimmed/disabled VolumeX icon. Hovering shows "No audio track" tooltip. The button is not clickable.
result: issue
reported: "No-audio video does not show dimmed non-clickable VolumeX — the locked state is not working as intended for no-audio files"
severity: major

### 5. Locked Audio Toggle in Sidebar
expected: Select a cell containing a no-audio video. In the right sidebar's playback section, the audio toggle should be disabled and the label should read "No audio track" (not "Cell audio"). The button should appear dimmed and not respond to clicks.
result: issue
reported: "Same issue - it does not understand that videos don't have audio"
severity: major

### 6. Multi-File Drop with Overflow Splits
expected: Drop more files than there are empty cells. The app should create new cells by splitting the last filled cell (alternating horizontal/vertical splits as the grid grows deeper). All dropped files eventually appear in the grid.
result: issue
reported: "The split direction does not alternate - just like in a previous test we had."
severity: major

## Summary

total: 6
passed: 2
issues: 4
skipped: 0
pending: 0

## Gaps

- truth: "Dropping multiple files fills cells level-by-level (BFS order), with overflow splits alternating direction (horizontal/vertical) as the grid grows deeper"
  status: failed
  reason: "User reported: It keeps on making the same splits (horizontal if empty project, and vertical to the 2 last items if there are already some items). It's not really giving the BFS feel. Try alternating the direction of split."
  severity: major
  test: 1
  artifacts: []
  missing: []
- truth: "For video cells with NO audio track, the ActionBar shows a dimmed non-clickable VolumeX with 'No audio track' tooltip"
  status: failed
  reason: "User reported: No-audio video does not show dimmed non-clickable VolumeX — the locked state is not working as intended for no-audio files"
  severity: major
  test: 4
  artifacts: []
  missing: []
- truth: "For no-audio video cells, the Sidebar audio toggle is disabled with label 'No audio track'"
  status: failed
  reason: "User reported: Same issue - it does not understand that videos don't have audio"
  severity: major
  test: 5
  artifacts: []
  missing: []
- truth: "Overflow splits when dropping more files than empty cells alternate direction (horizontal then vertical then horizontal)"
  status: failed
  reason: "User reported: The split direction does not alternate - just like in a previous test we had."
  severity: major
  test: 6
  artifacts: []
  missing: []
