---
status: partial
phase: 10-restore-cell-controls-sizing-stacking
source: [10-VERIFICATION.md]
started: 2026-04-08T16:56:00Z
updated: 2026-04-08T17:08:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Flow F — Small-cell ActionBar stacking (CELL-01)
expected: Split a cell down to ~80px tall, hover it in Chrome/Firefox/Safari 15+. ActionBar should paint ABOVE the sibling cell it overflows into, not clipped at the cell boundary. The portal architecture (createPortal to document.body) is what enables this — verify it works in real browsers.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

> **Note (2026-04-08T17:08):** The original Flow E (clamp() viewport-extreme test) was removed during course correction. Phase 10-01 abandoned the clamp() approach in favor of fixed `w-16 h-16` portal-aware sizing — there are no viewport extremes to verify because button size is constant 64px in viewport space. See `10-VERIFICATION.md` revision header for the full rationale.
