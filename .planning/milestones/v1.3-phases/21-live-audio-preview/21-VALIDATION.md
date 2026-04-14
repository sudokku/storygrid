---
phase: 21
slug: live-audio-preview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

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
| 21-01-01 | 01 | 0 | LAUD-01 | — | N/A | unit | `npx vitest run src/hooks/useAudioMix.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | LAUD-01 | — | N/A | unit | `npx vitest run src/hooks/useAudioMix.test.ts` | ✅ | ⬜ pending |
| 21-01-03 | 01 | 1 | LAUD-02 | — | N/A | unit | `npx vitest run src/hooks/useAudioMix.test.ts` | ✅ | ⬜ pending |
| 21-01-04 | 01 | 1 | LAUD-03 | — | N/A | unit | `npx vitest run src/hooks/useAudioMix.test.ts` | ✅ | ⬜ pending |
| 21-01-05 | 01 | 1 | LAUD-04 | — | N/A | unit | `npx vitest run src/hooks/useAudioMix.test.ts` | ✅ | ⬜ pending |
| 21-01-06 | 01 | 2 | LAUD-05 | — | N/A | unit | `npx vitest run src/hooks/useAudioMix.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/useAudioMix.test.ts` — stubs for LAUD-01 through LAUD-05
- [ ] AudioContext mock via `vi.stubGlobal('AudioContext', ...)` — jsdom has no Web Audio API; pattern established in Phase 19 tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible output from unmuted cells on play | LAUD-01 | Requires real audio hardware and browser | Open editor, add video with audio, press play, confirm sound from speakers |
| Silence when all cells muted | LAUD-03 | Requires audio hardware | Mute all cells, press play, confirm no audio |
| No InvalidStateError on rapid pause/resume | LAUD-05 | Race condition — difficult to reliably reproduce in headless test | Rapidly click play/pause 10+ times, check browser console for errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
