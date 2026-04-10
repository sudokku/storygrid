---
phase: 14
slug: migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | AUD-05 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | AUD-05 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | AUD-06 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 14-01-04 | 01 | 2 | AUD-07 | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/phase14-audio-encoder.test.ts` — stubs for AudioEncoder + AAC availability checks
- [ ] `src/test/phase14-audio-pipeline.test.ts` — stubs for OfflineAudioContext mixing pipeline

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Video export produces valid MP4 with audio | AUD-05 | Requires browser WebCodecs + real media | Open app, upload video with audio, export, verify MP4 plays with audio in VLC/QuickTime |
| Firefox export uses VP9 codec | AUD-07 | Browser-specific codec selection | Export in Firefox, verify MP4 uses VP9 via `ffprobe` or MediaInfo |
| Audio-disabled cells excluded from mix | AUD-06 | Requires real media playback | Toggle audio off on a cell, export, verify only other cells' audio present |
| COOP/COEP headers removed | D-10 | Requires deployed Vercel check | Deploy and check response headers: no `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` |
| Video-only fallback toast when AudioEncoder unavailable | D-03 | Requires browser without AAC support | Test in environment where `AudioEncoder` is unavailable; verify warning toast shows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
