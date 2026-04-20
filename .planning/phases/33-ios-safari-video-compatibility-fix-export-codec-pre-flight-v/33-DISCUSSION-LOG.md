# Phase 33: iOS Safari video compatibility — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 33-ios-safari-video-compatibility
**Areas discussed:** Codec pre-flight, detectAudioTrack iOS fix, First-frame reliability, AudioContext on iOS

---

## Codec pre-flight

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime isTypeSupported() / getFirstEncodableVideoCodec | Call VideoEncoder.isConfigSupported() via mediabunny API; returns first encodable codec from priority list | ✓ |
| Mediabunny ALL_FORMATS query | Use ALL_FORMATS export to query supported codecs | |
| UA-based Safari detection | Add isSafari UA check alongside isFirefox | |

**User's choice:** Runtime `getFirstEncodableVideoCodec` via mediabunny
**Notes:** User asked whether ALL_FORMATS could provide a universal solution. A research agent was spawned to investigate. Finding: ALL_FORMATS is input-only (demuxer hint, `InputFormat[]`) — not relevant to codec selection. Mediabunny exposes `getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height })` which calls `VideoEncoder.isConfigSupported()` under the hood. Priority order `['avc', 'vp9', 'av1']` resolves to AVC on iOS Safari, VP9 on Firefox, AVC on Chrome — no UA sniffing required.

---

## detectAudioTrack iOS fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the branching logic | audioTracks branch resolves immediately; captureStream only when both audioTracks and mozHasAudio are undefined | ✓ |
| Fail-open on iOS Safari | Detect iOS Safari via UA and always return true | |

**User's choice:** Fix the branching logic
**Notes:** On iOS Safari, `audioTracks`, `mozHasAudio`, and `captureStream` are all unavailable — the function falls to the final else and resolves `true` (fail-open). This is already the correct behavior. The fix is about branching correctness (captureStream not attempted from inside the audioTracks branch) and comment accuracy. Chrome path (captureStream) must not be regressed — quick task 260414-rv0 added that path specifically.

---

## First-frame reliability

| Option | Description | Selected |
|--------|-------------|----------|
| play().then(pause()) trigger | Call play() on loadedmetadata to force iOS frame decode; draw on seeked | ✓ |
| Use 'canplay' event instead | Listen for canplay rather than seeked | |
| Add 'timeupdate' as fallback | 500ms timeout fallback to timeupdate if seeked doesn't fire | |

**User's choice:** play().then(pause()) trigger
**Notes:** Applies to both LeafNode.tsx and captureVideoThumbnail in gridStore.ts. Both already set muted + playsInline, which is required for play() to work on iOS without a user gesture.

---

## AudioContext on iOS

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-create + default audio off | Pre-create AudioContext before any await in exportVideoGrid(); change audioEnabled default to false | ✓ |
| Pre-create only | Pre-create AudioContext; keep audioEnabled defaulting to true | |
| Default audio off only | Change default to false; no AudioContext pre-creation | |

**User's choice:** Pre-create + default audio off
**Notes:** User proposed a different approach first — default audio to false so the Audio toggle button acts as the user gesture. Clarification: this reduces the surface area but doesn't fix the gesture timing issue for users who DO enable audio. The pre-create approach (creating AudioContext before any await in the export button handler call stack) is required for correctness. Both together: pre-create handles the gesture timing; default-off reduces the problem surface and is a better UX default (silent is safer).

---

## Claude's Discretion

- Test strategy for iOS-specific event sequences
- Whether captureVideoThumbnail should call video.load() explicitly

## Deferred Ideas

None
