---
status: diagnosed
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

- truth: "Dropping multiple files fills cells level-by-level (BFS order), with overflow splits alternating direction (horizontal/vertical)"
  status: diagnosed
  reason: "User reported: It keeps on making the same splits (horizontal if empty project, and vertical to the 2 last items if there are already some items)."
  severity: major
  test: 1
  root_cause: "lastFilledDepth % 2 approach fails because splitNode Case B (appending sibling to existing parent when parent.direction matches) does not increase depth — depth stays the same so % 2 returns the same value every iteration, direction never toggles."
  artifacts:
    - path: "src/lib/media.ts"
      issue: "autoFillCells overflow split direction logic uses lastFilledDepth % 2 which stays constant when Case B splits are used"
  missing:
    - "Replace depth-based direction with an explicit alternation counter (overflowCount % 2)"
- truth: "For video cells with NO audio track, the ActionBar shows a dimmed non-clickable VolumeX with 'No audio track' tooltip"
  status: diagnosed
  reason: "User reported: No-audio video does not show dimmed non-clickable VolumeX — the locked state is not working as intended for no-audio files"
  severity: major
  test: 4
  root_cause: "AudioContext.decodeAudioData(arrayBuffer) cannot parse video container formats (MP4, WebM) — it only decodes audio formats. For ALL video files (audio or not), it throws, hitting the fail-open catch which returns true. So hasAudioTrack is always true."
  artifacts:
    - path: "src/lib/media.ts"
      issue: "detectAudioTrack uses AudioContext.decodeAudioData which throws for video formats — needs HTMLVideoElement.audioTracks + mozHasAudio instead"
  missing:
    - "Rewrite detectAudioTrack using HTMLVideoElement: create blob URL, load metadata, check audioTracks.length (Chrome/Safari) or mozHasAudio (Firefox), revoke URL"
- truth: "For no-audio video cells, the Sidebar audio toggle is disabled with label 'No audio track'"
  status: diagnosed
  reason: "User reported: Same issue - it does not understand that videos don't have audio"
  severity: major
  test: 5
  root_cause: "Same as test 4 — detectAudioTrack always returns true; hasAudioTrack is never set to false."
  artifacts:
    - path: "src/lib/media.ts"
      issue: "Same root cause as test 4"
  missing:
    - "Fixed by same fix as test 4"
- truth: "Overflow splits when dropping more files than empty cells alternate direction (horizontal then vertical then horizontal)"
  status: diagnosed
  reason: "User reported: The split direction does not alternate - just like in a previous test we had."
  severity: major
  test: 6
  root_cause: "Same root cause as test 1 — depth-based direction doesn't alternate."
  artifacts:
    - path: "src/lib/media.ts"
      issue: "Same root cause as test 1"
  missing:
    - "Fixed by same fix as test 1"
