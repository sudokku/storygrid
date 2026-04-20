# Phase 33: iOS Safari Video Compatibility — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 5 modified files + 4 extended test files
**Analogs found:** 5 / 5 (all are self-analogs — reading the files to be edited)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/videoExport.ts` | service | streaming + event-driven | Self (lines 323-383 for audio, 506-508 for codec) | self |
| `src/lib/media.ts` | utility | event-driven | Self (lines 41-106, detectAudioTrack) | self |
| `src/Grid/LeafNode.tsx` | component | event-driven | Self (lines 193-234 video load effect) | self |
| `src/store/gridStore.ts` | store + utility | request-response | Self (lines 26-76 captureVideoThumbnail) | self |
| `src/lib/tree.ts` | utility | transform | Self (lines 107-122 createLeaf) | self |
| `src/test/videoExport-codec.test.ts` | test | — | `src/test/videoExport-audio.test.ts` | role-match |
| `src/test/media.test.ts` | test | — | Self (lines 230-293, mockVideo pattern) | self |
| `src/test/phase07-02-gridstore-thumbnail.test.ts` | test | — | Self (lines 178-212, captureVideoThumbnail helper tests) | self |
| `src/test/tree-functions.test.ts` | test | — | Self (lines 17-37, createLeaf tests) | self |

---

## Pattern Assignments

### `src/lib/tree.ts` — D-04B: audioEnabled default change

**Change location:** `createLeaf()`, line 119

**Before (exact current code, lines 107-122):**
```typescript
export function createLeaf(): LeafNode {
  return {
    type: 'leaf',
    id: nanoid(),
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: { ...DEFAULT_EFFECTS },
    audioEnabled: true,        // ← CHANGE THIS to false
    hasAudioTrack: false,
  };
}
```

**After:**
```typescript
    audioEnabled: false,       // D-04B: users must opt in; reduces iOS AudioContext surface
```

**Single-line surgical edit.** No other changes in this file.

---

### `src/lib/media.ts` — D-02: detectAudioTrack comment accuracy fix

**Change location:** `detectAudioTrack()`, lines 56-89

**Before (exact current code, lines 56-89):**
```typescript
        if (audioTracks !== undefined) {
          // Chrome/Safari: AudioTrackList API available
          if (audioTracks.length > 0) {
            resolve(true);
          } else if (mozHasAudio === true) {
            // Belt-and-suspenders: Firefox also has audioTracks in newer versions
            resolve(true);
          } else {
            resolve(false);
          }
        } else if (mozHasAudio !== undefined) {
          // Firefox: mozHasAudio available, audioTracks not
          resolve(mozHasAudio === true);
        } else {
          // Chrome: neither audioTracks nor mozHasAudio — try captureStream()
          // Chrome supports captureStream() and getAudioTracks() reflects the
          // video's actual audio track structure before playback starts.
          const captureStream =
            (video as unknown as { captureStream?: () => MediaStream }).captureStream ??
            (video as unknown as { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
          if (captureStream) {
            try {
              const stream = captureStream.call(video);
              const hasAudio = stream.getAudioTracks().length > 0;
              stream.getTracks().forEach(t => t.stop());
              resolve(hasAudio);
            } catch {
              // captureStream failed — fail-open
              resolve(true);
            }
          } else {
            // No detection API available — fail-open
            resolve(true);
          }
        }
```

**After (comment-only changes, branching logic unchanged):**
- Line 57: `// Chrome/Safari: AudioTrackList API available` → `// Desktop Safari / newer Chrome: AudioTrackList API available`
- Line 70: `// Chrome: neither audioTracks nor mozHasAudio — try captureStream()` → `// Chrome-only: when both audioTracks AND mozHasAudio are undefined, try captureStream().`
- Add comment before `else { // No detection API available — fail-open`:
  ```
  // iOS Safari: lacks audioTracks, mozHasAudio, and captureStream — falls through to fail-open.
  ```

**No logic changes.** The branching structure is already correct for iOS Safari. The fix is comment accuracy only, plus the explicit iOS Safari comment on the final `resolve(true)`.

**Established pattern preserved:**
- Fail-open (`resolve(true)`) on any unknown condition — MUST NOT be changed
- `captureStream` guard (`if (captureStream)`) prevents execution on iOS — MUST NOT be changed

---

### `src/store/gridStore.ts` — D-03: captureVideoThumbnail first-frame + video.load()

**Change location:** `captureVideoThumbnail()`, lines 26-76 (specifically onMeta handler lines 47-53, and src assignment line 74)

**Before (exact current code, lines 47-53 + 72-75):**
```typescript
    const onMeta = () => {
      try {
        video.currentTime = 0;
      } catch {
        finish(null);
      }
    };
    // ... (other event listeners)
    video.src = blobUrl;
  });
}
```

**After:**
```typescript
    const onMeta = () => {
      try {
        video.currentTime = 0;
        // iOS Safari: seeked does not fire on muted video unless decoder is activated.
        // play() activates the decoder; AbortError from implicit pause is benign.
        video.play().catch(() => { /* AbortError from immediate pause is benign */ });
      } catch {
        finish(null);
      }
    };
    // ... (other event listeners)
    video.src = blobUrl;
    video.load(); // D-03: explicit load() for iOS Safari reliability (mirrors media.ts:99)
  });
}
```

**Two changes:**
1. Add `video.play().catch(() => {})` inside `onMeta` after `video.currentTime = 0`
2. Add `video.load()` after `video.src = blobUrl` (line 74)

**Established pattern to preserve:**
- `video.muted = true` (line 29) and `video.playsInline = true` (line 30) are already set — prerequisites for `play()` on iOS; do NOT remove
- `finish(null)` pattern for error cases — preserve
- `settled` guard and `cleanup()` pattern — do NOT change

---

### `src/Grid/LeafNode.tsx` — D-03: onLoadedMetadata play trigger

**Change location:** `onLoadedMetadata` handler, lines 204-209

**Before (exact current code, lines 204-209):**
```typescript
    const onLoadedMetadata = () => {
      // Report duration to editor store
      recomputeTotalDuration();
      // Seek to time 0 to get first frame
      video.currentTime = 0;
    };
```

**After:**
```typescript
    const onLoadedMetadata = () => {
      // Report duration to editor store
      recomputeTotalDuration();
      // Seek to time 0 to get first frame
      video.currentTime = 0;
      // iOS Safari: seeked does not fire unless the decoder has been activated by play().
      // File drop is a user gesture — play() is allowed even on unmuted video.
      // Do NOT await — seeked fires as a side effect; catching AbortError is correct.
      video.play().catch(() => { /* AbortError from seek-triggered pause is benign */ });
    };
```

**Single addition inside the existing handler. No other changes.**

**Critical context (lines 193-198):**
```typescript
    // NOTE: do NOT set video.muted here. The Web Audio API wires this element
    // as a MediaElementAudioSourceNode source; muting it silences audio before
    // it can reach the GainNode graph (Bug: phase-21-no-audio-preview).
    const video = document.createElement('video');
    video.playsInline = true;
```
LeafNode intentionally does NOT set `video.muted = true`. The `play()` call works here because file drop is a user gesture. This is different from `captureVideoThumbnail` where `muted = true` is required.

---

### `src/lib/videoExport.ts` — D-01: Codec selection + D-04A: AudioContext pre-creation

#### D-01: Replace UA-sniff codec selection

**Import change (lines 1-15):**
Add `getFirstEncodableVideoCodec` to the existing mediabunny import. `QUALITY_HIGH` is already imported.

**Before (line 7-8):**
```typescript
  QUALITY_HIGH,
  canEncodeAudio,
```

**After:**
```typescript
  QUALITY_HIGH,
  canEncodeAudio,
  getFirstEncodableVideoCodec,
```

**Before (codec selection, lines 506-508):**
```typescript
  // D-12: Codec selection — VP9 on Firefox, AVC on all other browsers.
  const isFirefox = navigator.userAgent.includes('Firefox');
  const videoCodec = isFirefox ? 'vp9' : 'avc';
```

**After:**
```typescript
  // D-01: Runtime codec pre-flight — replaces UA sniff. iOS Safari resolves 'avc'.
  // Throws user-visible error if no encoder found (no codec can be UA-sniffed around).
  const videoCodec = await getFirstEncodableVideoCodec(
    ['avc', 'vp9', 'av1'],
    { width: 1080, height: 1920, bitrate: QUALITY_HIGH }
  );
  if (!videoCodec) {
    throw new Error('No supported video encoder found in this browser.');
  }
```

**IMPORTANT:** This `await` call is the first `await` in `exportVideoGrid()`. AudioContext (D-04A) MUST be created BEFORE this line.

#### D-04A: AudioContext pre-creation before first await

**Current AudioContext location (lines 323-337, inside mixAudioForExport):**
```typescript
async function mixAudioForExport(
  mediaRegistry: Record<string, string>,
  audioEnabledMediaIds: Set<string>,
  totalDurationSeconds: number,
): Promise<AudioBuffer | null> {
  // ...
  const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
```

**Current mixAudioForExport call site (line 653):**
```typescript
        const mixedBuffer = await mixAudioForExport(mediaRegistry, audioEnabledIds, totalDuration);
```

**Changes required:**

1. Add AudioContext pre-creation in `exportVideoGrid()` BEFORE the `await getFirstEncodableVideoCodec(...)` call (which will be the new first await):
```typescript
  // D-04A: Pre-create AudioContext in gesture handler, before any await.
  // iOS Safari invalidates the user gesture window after the first await completes.
  let gestureAudioContext: AudioContext | null = null;
  try {
    gestureAudioContext = new AudioContext({ sampleRate: 48000 });
  } catch {
    // AudioContext unavailable — audio mixing will be skipped
  }
```

2. Change `mixAudioForExport` signature to accept `providedCtx`:
```typescript
async function mixAudioForExport(
  mediaRegistry: Record<string, string>,
  audioEnabledMediaIds: Set<string>,
  totalDurationSeconds: number,
  providedCtx: AudioContext | null,  // D-04A: pre-created in gesture handler
): Promise<AudioBuffer | null> {
```

3. Inside `mixAudioForExport`, replace:
```typescript
  const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
```
with:
```typescript
  // Use pre-created context if provided (stays within iOS Safari gesture window).
  // Fall back to new AudioContext only when caller did not provide one.
  const tempCtx = providedCtx ?? new AudioContext({ sampleRate: SAMPLE_RATE });
  const shouldCloseCtx = !providedCtx; // only close what we created
```

4. In the `finally` block of `mixAudioForExport` (currently `await tempCtx.close()`), change to:
```typescript
  } finally {
    if (shouldCloseCtx) await tempCtx.close();
  }
```

5. Update call site (line 653) to pass `gestureAudioContext`:
```typescript
        const mixedBuffer = await mixAudioForExport(mediaRegistry, audioEnabledIds, totalDuration, gestureAudioContext);
```

6. In `exportVideoGrid()`'s own `finally` block, close `gestureAudioContext`:
```typescript
  } finally {
    // ... existing cleanup ...
    if (gestureAudioContext) {
      try { gestureAudioContext.close(); } catch { /* ignore */ }
    }
  }
```

**Existing pattern to copy — `canEncodeAudio` usage (lines 528-531):**
```typescript
      if (!(await canEncodeAudio('aac'))) {
        registerAacEncoder();
      }
      if (await canEncodeAudio('aac')) {
```
`getFirstEncodableVideoCodec` follows the same async capability-check pattern.

---

## Shared Patterns

### Fail-Open Pattern
**Source:** `src/lib/media.ts` lines 82-89
**Apply to:** detectAudioTrack fix (D-02) — MUST be preserved
```typescript
          } else {
            // captureStream failed — fail-open
            resolve(true);
          }
        } else {
          // No detection API available — fail-open
          resolve(true);
        }
```
Never change a `resolve(true)` fail-open to an error throw. Audio detection is non-critical.

### Async Play with Silent Catch
**Source:** RESEARCH.md pattern, D-03
**Apply to:** `captureVideoThumbnail` onMeta and `LeafNode` onLoadedMetadata
```typescript
video.play().catch(() => { /* AbortError from immediate pause is benign */ });
```
Do NOT `await` the play() call. Do NOT chain `.then(() => video.pause())`. The `seeked` event fires as a side effect of starting playback.

### Video Element Setup (muted + playsInline)
**Source:** `src/store/gridStore.ts` lines 29-30
**Apply to:** `captureVideoThumbnail` (already correct — do not remove)
```typescript
    video.muted = true;
    video.playsInline = true;
```
These are prerequisites for `play()` on iOS without user gesture. `captureVideoThumbnail` already has them. LeafNode intentionally does NOT mute (Web Audio wiring).

### Test Mock Pattern for HTMLVideoElement
**Source:** `src/test/media.test.ts` lines 237-253
**Apply to:** New tests for D-03 (video.play() mock verification)
```typescript
    const handlers: Record<string, () => void> = {};
    const mockVideo = {
      preload: '',
      audioTracks: { length: 1 },
      addEventListener: vi.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      }),
    };
    Object.defineProperty(mockVideo, 'src', {
      set(_val: string) { setTimeout(() => handlers['loadedmetadata']?.(), 0); },
      get() { return ''; },
    });
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return mockVideo as unknown as HTMLVideoElement;
      return origCreateElement(tag);
    });
```
For D-03 tests: add `play: vi.fn().mockResolvedValue(undefined)` to the mockVideo object, then assert `mockVideo.play` was called.

### _capture indirection pattern (test override)
**Source:** `src/store/gridStore.ts` lines 81-83 + `src/test/phase07-02-gridstore-thumbnail.test.ts` lines 36-37
```typescript
// In gridStore.ts:
export const _capture = { fn: captureVideoThumbnail };

// In tests:
_capture.fn = vi.fn().mockResolvedValue(mockThumb);
// Always reset in afterEach:
_capture.fn = captureVideoThumbnail;
```
Tests that need to verify `captureVideoThumbnail` internal behavior should mock `document.createElement('video')` directly, not override `_capture.fn`.

---

## Test File Patterns

### `src/test/tree-functions.test.ts` — extend for D-04B

**Existing test to update (lines 33-36):**
```typescript
  it('initializes audioEnabled to true', () => {
    const leaf = createLeaf();
    expect(leaf.audioEnabled).toBe(true);
  });
```
**Change to:**
```typescript
  it('initializes audioEnabled to false', () => {
    const leaf = createLeaf();
    expect(leaf.audioEnabled).toBe(false);
  });
```

### `src/test/media.test.ts` — extend for D-02

Add three new tests in the `detectAudioTrack` describe block (new block, following the `autoFillCells` block pattern). Mock pattern from lines 237-253.

**Test 1:** `audioTracks` defined with length > 0 → resolves true; captureStream never called.
**Test 2:** `audioTracks` undefined, `mozHasAudio` undefined, `captureStream` defined → calls captureStream; resolves based on getAudioTracks().
**Test 3:** iOS-like (all undefined, no captureStream) → resolves true (fail-open).

### `src/test/phase07-02-gridstore-thumbnail.test.ts` — extend for D-03

Add to `captureVideoThumbnail helper` describe block (line 178). New test: mock video element with `play: vi.fn().mockResolvedValue(undefined)`, fire `loadedmetadata` event, then `seeked` event. Assert `play` was called once. Assert `load` was called once.

Pattern to follow (lines 183-210): `vi.spyOn(document, 'createElement')` with full mock video object.

### `src/test/videoExport-codec.test.ts` — new file

**Import pattern** (from `src/test/videoExport-audio.test.ts` or `videoExport-loop.test.ts`):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

**Tests required:**
1. `getFirstEncodableVideoCodec` returns `null` → `exportVideoGrid` throws `'No supported video encoder found in this browser.'`
2. Resolved codec is passed to `CanvasSource` constructor
3. `gestureAudioContext` is created before any `await` in exportVideoGrid (structural test — assert AudioContext constructor call order relative to first await)

Mock mediabunny imports via `vi.mock('mediabunny', ...)`.

---

## No Analog Found

None — all files are self-analogs (editing existing functions in-place). The new test file `videoExport-codec.test.ts` follows the same vitest + vi.mock pattern used in `videoExport-audio.test.ts` and `videoExport-loop.test.ts`.

---

## Metadata

**Analog search scope:** `src/lib/`, `src/store/`, `src/Grid/`, `src/test/`
**Files read:** 7 source files + 3 test files
**Pattern extraction date:** 2026-04-20
