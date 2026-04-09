---
phase: 12
slug: per-cell-audio-toggle
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (jsdom environment, src/test/setup.ts) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20–30 seconds full suite (based on current Phase 11 suite size: ~15s + ~5–10s new Phase 12 tests) |

---

## Sampling Rate

- **After every task commit:** Run targeted file command (per-task column below)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 12-01 | 1 | AUD-01, AUD-08 (data model) | unit | `npx vitest run src/store/gridStore.test.ts src/test/tree-functions.test.ts --reporter=verbose` | ✅ (extended in task) | ⬜ pending |
| 12-01-02 | 12-01 | 1 | D-28 (fixture migration) | build + unit | `npx tsc --noEmit && npx vitest run` | ✅ (fixtures migrated) | ⬜ pending |
| 12-02-01 | 12-02 | 2 | AUD-02, AUD-03 | unit | `npx vitest run src/Grid/__tests__/ActionBar.test.tsx --reporter=verbose` | ✅ (extended in task) | ⬜ pending |
| 12-02-02 | 12-02 | 2 | AUD-04 | unit | `npx vitest run src/test/sidebar.test.tsx --reporter=verbose` | ✅ (extended in task) | ⬜ pending |
| 12-03-01 | 12-03 | 2 | AUD-05, AUD-06 (helpers) | unit | `npx vitest run src/test/videoExport-audio.test.ts --reporter=verbose` | ❌ Wave 0 — new file | ⬜ pending |
| 12-03-02 | 12-03 | 2 | AUD-05, AUD-06, AUD-07 (integration) | unit | `npx vitest run src/test/videoExport-audio.test.ts --reporter=verbose && npx vitest run` | ❌ Wave 0 — extended | ⬜ pending |

*Populated by planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The following test scaffolds must exist before the corresponding implementation tasks run. All Wave 0 gaps are addressed within Plan 12-01 Task 1 and Plan 12-03 Task 1 (tdd="true") — the failing tests are written before implementation.

- [ ] **`src/test/videoExport-audio.test.ts`** (NEW FILE) — created in Plan 12-03 Task 1. Covers AUD-05 (`buildAudioGraph` wires source nodes to destination), AUD-06 (returns null when zero audio-enabled cells), de-duplication of shared mediaId across leaves, D-18 (never connect to `audioCtx.destination`).
- [ ] **`src/store/gridStore.test.ts`** — extended in Plan 12-01 Task 1 with new `describe('toggleAudioEnabled', ...)` block. Covers AUD-01 (flip + one snapshot + no-op), AUD-08 proxy (field survives undo/redo).
- [ ] **`src/test/tree-functions.test.ts`** — extended in Plan 12-01 Task 1. Covers AUD-01 (`createLeaf()` default `audioEnabled: true`).
- [ ] **`src/Grid/__tests__/ActionBar.test.tsx`** — extended in Plan 12-02 Task 1 with new `describe('audio button', ...)` block. Covers AUD-02 (video-only visibility), AUD-03 (click calls `toggleAudioEnabled`), icon + aria-label state.
- [ ] **`src/test/sidebar.test.tsx`** — extended in Plan 12-02 Task 2 with new `describe('playback section', ...)` block. Covers AUD-04 (video-only visibility, icon matches state, click wiring).
- [ ] **Fixture migration across ~25 files** — Plan 12-01 Task 2. Add `audioEnabled: true` to every `makeLeaf` helper and inline `LeafNode` literal so the required-field type change compiles.

*See 12-RESEARCH.md `## Validation Architecture` for the full per-requirement test map and deterministic check strategy.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible playback of exported MP4 | AUD-03, AUD-04 | Audio perception requires human ear; no headless audio-decode assertion is reliable | Export a 2-cell video collage with one cell muted and one cell audio-on. Play resulting MP4 in system player. Confirm only the unmuted cell's audio is audible; muted cell contributes silence. Then toggle and re-export — audible cell should switch. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s (targeted file commands ~5–15s each)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
