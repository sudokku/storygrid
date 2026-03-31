---
phase: 0
slug: project-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vite.config.ts (test section) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 0-01-01 | 01 | 1 | SCAF-01 | build | `npm run dev -- --no-open` | ❌ W0 | ⬜ pending |
| 0-01-02 | 01 | 1 | SCAF-02 | import | `npm run build` | ❌ W0 | ⬜ pending |
| 0-01-03 | 01 | 2 | SCAF-03 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 0-01-04 | 01 | 2 | SCAF-04 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 0-01-05 | 01 | 2 | SCAF-05 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/setup.ts` — Vitest global setup file
- [ ] `vitest` + `@vitest/coverage-v8` + `jsdom` installed and configured
- [ ] `npm run test` script added to package.json

*These are installed as part of Phase 0 scaffolding itself.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three-region layout visible in browser | SCAF-03 | Visual layout check | Run `npm run dev`, open browser, confirm toolbar + canvas + sidebar regions visible |
| Tailwind CSS vars accessible in browser | SCAF-04 | CSS custom property runtime check | Open DevTools > computed styles on `:root`, confirm `--canvas-width`, `--canvas-height`, `--safe-zone-top` present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
