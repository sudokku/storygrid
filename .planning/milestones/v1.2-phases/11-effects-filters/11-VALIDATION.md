---
phase: 11
slug: effects-filters
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (test block) or vitest.config.ts |
| **Quick run command** | `npm test -- --run src/lib/effects.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command for touched file's test
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | EFF-01..EFF-10 | unit/integration | TBD after planning | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*This table will be filled in by the planner once task IDs are assigned.*

---

## Wave 0 Requirements

- [ ] `src/lib/effects.test.ts` — unit tests for `effectsToFilterString`, `PRESET_VALUES`, `DEFAULT_EFFECTS`
- [ ] `src/lib/export.test.ts` (extend) — stub for filter application in `drawLeafToCanvas` (PNG parity)
- [ ] `src/store/gridStore.test.ts` (extend) — stubs for `setEffects`, `beginEffectsDrag`, `applyPreset`, `resetEffects` (undo semantics)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live preview visual parity vs PNG export | EFF-05 | Pixel comparison across DOM and canvas paths requires visual inspection | Apply each preset + each slider extreme, export PNG, open both in image viewer, compare |
| MP4 export filter parity | EFF-06 | Video export runtime is ~30s+, not suited to unit tests | Export 2s MP4 with B&W preset + blur=8, inspect first frame visually matches preview |
| Safari 15 graceful degradation | EFF-09 | Requires real Safari 15 browser, not available in CI headless | Load on Safari 15, apply filters, verify no crash and unfiltered output (per locked decision D-02) |
| Blur edge bleed at clip boundaries | EFF-03 | Requires visual inspection of cell borders | Apply blur=20 to cell in grid, verify no dark halo outside clip rect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
