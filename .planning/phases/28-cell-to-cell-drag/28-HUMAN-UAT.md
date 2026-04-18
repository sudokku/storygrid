---
status: partial
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md]
started: 2026-04-18T16:50:00Z
updated: 2026-04-18T16:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Mouse drag — cell-to-cell swap
expected: Cell-to-cell drag works for mouse. Release outside any cell is a no-op. Release on origin cell is a no-op. Ghost <img> follows pointer with grab-point preserved.
result: [pending]

### 2. Touch drag — 250ms hold activation
expected: Touch drag activates after 250ms hold, drag follows pointer, drop fires moveCell correctly.
result: [pending]

### 3. Native file drop co-existence
expected: Native file drop onto cells still works after Phase 28 changes; dataTransfer.types.includes('Files') guard preserved.
result: [pending]

### 4. Divider resize co-existence
expected: Divider resize works; data-dnd-ignore='true' on divider root and hit area prevents PointerSensor from claiming those events.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
