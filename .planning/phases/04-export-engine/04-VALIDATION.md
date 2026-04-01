---
phase: 4
slug: export-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose src/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose src/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | EXPO-01 | unit | `npx vitest run src/store/__tests__/export.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | EXPO-01 | unit | `npx vitest run src/store/__tests__/export.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | EXPO-02 | unit | `npx vitest run src/components/__tests__/ExportSurface.test.tsx` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | EXPO-03 | unit | `npx vitest run src/lib/__tests__/exportEngine.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 2 | EXPO-04 | unit | `npx vitest run src/lib/__tests__/exportEngine.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 2 | EXPO-05 | unit | `npx vitest run src/lib/__tests__/exportEngine.test.ts` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 3 | EXPO-06 | unit | `npx vitest run src/components/__tests__/ExportButton.test.tsx` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 3 | EXPO-07 | manual | N/A — visual progress states | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/store/__tests__/export.test.ts` — stubs for EXPO-01 (export slice state shape)
- [ ] `src/components/__tests__/ExportSurface.test.tsx` — stubs for EXPO-02 (DOM presence, visibility:hidden)
- [ ] `src/lib/__tests__/exportEngine.test.ts` — stubs for EXPO-03, EXPO-04, EXPO-05 (engine function signatures)
- [ ] `src/components/__tests__/ExportButton.test.tsx` — stubs for EXPO-06 (button renders, disabled state)

*Existing vitest + jsdom + RTL infrastructure from prior phases covers all framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Export progress UI transitions ("Preparing..." → "Exporting..." → complete) | EXPO-07 | Timing-dependent visual state sequence; brittle to automate in jsdom | 1. Click Export button. 2. Observe button text cycles through all 3 states. 3. File downloads. |
| Downloaded PNG is exactly 1080×1920px | EXPO-01 | File download and image dimension verification requires real browser | 1. Export PNG. 2. Open in image viewer. 3. Check dimensions. |
| JPEG quality slider produces smaller file than PNG | EXPO-05 | File size comparison requires real browser download | 1. Export PNG, note file size. 2. Export JPEG at 80% quality. 3. Verify JPEG is smaller. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
