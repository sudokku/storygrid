---
phase: 33
slug: ios-safari-video-compatibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | D-01 | — | N/A | unit | `npx vitest run src/lib/videoExport` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | D-02 | — | N/A | unit | `npx vitest run src/lib/media` | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 2 | D-03 | — | N/A | unit | `npx vitest run src/Grid/LeafNode` | ❌ W0 | ⬜ pending |
| 33-02-02 | 02 | 2 | D-03 | — | N/A | unit | `npx vitest run src/store/gridStore` | ❌ W0 | ⬜ pending |
| 33-02-03 | 02 | 2 | D-04 | — | N/A | unit | `npx vitest run src/lib/videoExport` | ❌ W0 | ⬜ pending |
| 33-02-04 | 02 | 2 | D-04 | — | N/A | unit | `npx vitest run src/lib/tree` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/videoExport.test.ts` — stubs for D-01 (codec pre-flight) and D-04A (AudioContext pre-creation)
- [ ] `src/lib/__tests__/media.test.ts` — stubs for D-02 (detectAudioTrack branching)
- [ ] `src/Grid/__tests__/LeafNode.test.tsx` — stubs for D-03 (first-frame play trigger)
- [ ] `src/store/__tests__/gridStore.test.ts` — stubs for D-03 (captureVideoThumbnail) and D-04B (audioEnabled default)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari first-frame appears in LeafNode after file drop | D-03 | Requires real iOS Safari device or emulator; JSDOM cannot emulate seeked event timing | Open Safari on iOS 15+, drop a video, verify thumbnail appears immediately |
| iOS Safari export produces valid MP4 | D-01 | Requires real WebCodecs API with AVC encoder; cannot be mocked in vitest | Run export on iOS Safari 15+, verify downloaded MP4 plays |
| AudioContext is created within gesture window on iOS | D-04A | Requires real iOS Safari and user gesture interception; not testable in Node | Tap export on iOS Safari, verify audio export completes without "AudioContext was not allowed" error |

*All other behaviors have automated verification via vitest with mocked HTMLVideoElement.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
