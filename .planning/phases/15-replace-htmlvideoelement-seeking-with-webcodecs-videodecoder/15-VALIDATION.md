---
phase: 15
slug: replace-htmlvideoelement-seeking-with-webcodecs-videodecoder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 15 — Validation Strategy

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
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | — | — | N/A | unit | `npx vitest run src/test/videoExport-mediabunny.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | — | — | N/A | unit | `npx vitest run src/test/videoExport-mediabunny.test.ts` | ✅ | ⬜ pending |
| 15-01-03 | 01 | 2 | — | — | N/A | integration | `npx vitest run` | ✅ | ⬜ pending |
| 15-01-04 | 01 | 3 | — | — | N/A | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/videoExport-mediabunny.test.ts` — test stubs for VideoDecoder pipeline (replaces videoExport-audio.test.ts imports of `buildExportVideoElements`)
- [ ] Ensure `videoExport-audio.test.ts` is updated to remove broken `buildExportVideoElements` import before it causes compile errors

*Wave 0 must create or update test files before any implementation tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frame extraction visual accuracy | — | Requires visual comparison of exported video frames | Export a short clip, inspect individual frames match source visually |
| Performance improvement vs seek baseline | — | Requires real browser timing measurement | Run export with before/after, compare total export time in devtools |
| Safari fallback behavior | — | WebCodecs not available in Safari 15 | Open in Safari 15, attempt video export, verify graceful fallback message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
