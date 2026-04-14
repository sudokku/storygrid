# Phase 14: Migrate Video Export from MediaRecorder+ffmpeg.wasm to Mediabunny — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 14-migrate-video-export-from-mediarecorder-ffmpeg-wasm-to-media
**Areas discussed:** Audio encoding, Scope, Fallback strategy, Cleanup

---

## Audio Encoding

| Option | Description | Selected |
|--------|-------------|----------|
| AudioEncoder (WebCodecs) | Decode audio, mix via OfflineAudioContext, encode with AudioEncoder + Mediabunny audio track. Zero WASM. | ✓ |
| OfflineAudioContext → WAV → ffmpeg mux | Render mixed audio to WAV, use ffmpeg.wasm to add audio to Mediabunny video MP4. Keeps WASM. | |
| No audio in Phase 14 | Ship video-only Mediabunny, audio in follow-up phase. | |

**User's choice:** AudioEncoder (WebCodecs)

### Audio Codec

| Option | Description | Selected |
|--------|-------------|----------|
| AAC (mp4a.40.2) | Best MP4 + QuickTime compatibility. Chrome 96+. | ✓ |
| Opus | Better quality at low bitrates but non-standard in MP4. | |

**User's choice:** AAC (mp4a.40.2)

### Audio Encoding Failure Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Export video-only, warn user | Toast: "Audio not supported in this browser — exporting video only." | ✓ |
| Block export with browser message | Hard error if audio encoding fails. | |
| Fall back to MediaRecorder+ffmpeg | Full pipeline fallback for audio — keeps ffmpeg.wasm. | |

**User's choice:** Export video-only, warn user

---

## Scope: Full vs Video-Only

| Option | Description | Selected |
|--------|-------------|----------|
| Full migration: video + audio | Phase 14 delivers complete replacement, no ffmpeg.wasm remaining. | ✓ |
| Video-only first, audio in 14.1 | Smaller Phase 14, audio follow-up phase; temporary regression for audio users. | |

**User's choice:** Full migration: video + audio

---

## Fallback Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block with browser upgrade message | Disable export button if VideoEncoder unavailable. | ✓ |
| Keep MediaRecorder+ffmpeg as fallback | Runtime detection, two pipelines maintained. | |
| Silent fallback to MediaRecorder+ffmpeg | Same as above without user visibility. | |

**User's choice:** Hard block with browser upgrade message

---

## Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full removal | Remove @ffmpeg packages, transcodeToMp4.ts, COOP/COEP headers. | ✓ |
| Remove packages, keep headers | Remove ffmpeg packages but leave COOP/COEP in place. | |

**User's choice:** Full removal

### COOP/COEP Headers

| Option | Description | Selected |
|--------|-------------|----------|
| No, remove them | WebCodecs doesn't need SharedArrayBuffer — clean up headers. | ✓ |
| Keep them just in case | Leave in vercel.json + public/_headers for potential future WASM. | |

**User's choice:** Remove COOP/COEP headers

---

## Claude's Discretion

- Audio bitrate selection (128kbps vs Mediabunny QUALITY constant)
- Mediabunny audio source API pattern (researcher to verify)
- OfflineAudioContext sample rate and channel layout

## Deferred Ideas

None.
