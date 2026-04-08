---
status: partial
phase: 10-restore-cell-controls-sizing-stacking
source: [10-VERIFICATION.md]
started: 2026-04-08T16:56:00Z
updated: 2026-04-08T16:56:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Flow E — Viewport-responsive ActionBar sizing (CELL-02)
expected: Open the app at 1024px viewport, hover a cell, inspect ActionBar button computed width — should be ≈28px (floor). Resize viewport to 3840px and re-check — should be ≈36px (ceiling). Icons scale proportionally 16→20px.
result: [pending]

### 2. Flow F — Small-cell ActionBar stacking (CELL-01)
expected: Split a cell down to ~80px tall, hover it in Chrome/Firefox/Safari 15+. ActionBar should paint ABOVE the sibling cell it overflows into, not clipped at the cell boundary.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
