---
status: resolved
phase: 28-cell-to-cell-drag
source: [28-VERIFICATION.md]
started: 2026-04-18T16:50:00Z
updated: 2026-04-19T00:00:00Z
---

## Current Test

[complete]

## Tests

### 1. Mouse drag — cell-to-cell swap
expected: Cell-to-cell drag works for mouse. Release outside any cell is a no-op. Release on origin cell is a no-op. Ghost <img> follows pointer with grab-point preserved.
result: passed

### 2. Touch drag — 250ms hold activation
expected: Touch drag activates after 250ms hold, drag follows pointer, drop fires moveCell correctly.
result: skipped (deferred to Phase 30 mobile polish)

### 3. Native file drop co-existence
expected: Native file drop onto cells still works after Phase 28 changes; dataTransfer.types.includes('Files') guard preserved.
result: passed

### 4. Divider resize co-existence
expected: Divider resize works; data-dnd-ignore='true' on divider root and hit area prevents PointerSensor from claiming those events.
result: passed

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
