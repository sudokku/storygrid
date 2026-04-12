---
phase: 18
slug: instagram-style-named-presets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | PRESET-01 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | PRESET-02 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 2 | PRESET-02 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 18-01-04 | 01 | 2 | PRESET-03 | — | N/A | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 18-01-05 | 01 | 3 | PRESET-04 | — | N/A | manual | See Manual-Only Verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/store/__tests__/effects.test.ts` — stubs for PRESET-01, PRESET-02 (preset apply/clear logic)
- [ ] `src/utils/__tests__/effectsToFilterString.test.ts` — stubs for PRESET-02, PRESET-03 (filter string construction)

*Existing vitest infrastructure covers the runner; only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preset chip visually renders with correct name and styling | PRESET-01 | DOM snapshot tests are brittle for visual styling | Open Effects panel, verify 6 chips (Clarendon, Lark, Juno, Reyes, Moon, Inkwell) appear |
| Preset applied to cell produces visually distinct result | PRESET-02 | Pixel-level visual output requires human judgment | Apply each preset to a media cell, confirm visible difference |
| PNG export matches canvas preview for preset+slider combo | PRESET-03 | Export file comparison is manual | Apply Clarendon + bump brightness, export PNG, compare visually to canvas |
| Reset clears preset selection but preserves slider values | PRESET-04 | State interaction requires manual flow | Apply Juno, adjust contrast, click Reset, verify chip deselected, slider values unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
