---
phase: 33-ios-safari-video-compatibility-fix-export-codec-pre-flight-v
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/media.ts
  - src/lib/tree.ts
  - src/lib/videoExport.ts
  - src/Grid/LeafNode.tsx
  - src/store/gridStore.ts
  - src/test/media.test.ts
  - src/test/tree-functions.test.ts
  - src/test/phase07-02-gridstore-thumbnail.test.ts
  - src/test/videoExport-codec.test.ts
  - src/store/gridStore.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 33 introduces iOS Safari video compatibility fixes: `play().catch()` activation patterns for `seeked` events, an AudioContext pre-created synchronously before the first `await`, `shouldCloseCtx` ownership logic in `mixAudioForExport`, and a runtime codec pre-flight using `getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'])`. The implementation is architecturally correct.

Two type errors exist in test fixtures that TypeScript strict mode will flag: `objectPosition` is typed as `string | undefined` in `LeafNode` but an object `{ x: 0.5, y: 0.5 }` is used in `media.test.ts`, and `effects.preset` is typed as `PresetName | null` but the string literal `'none'` is used in the same fixture. Both only affect tests, not runtime code.

The `play().catch(() => {})` pattern in `LeafNode.tsx` is a minor concern: it silently swallows `NotAllowedError` (iOS policy block on unmuted video), which would prevent `seeked` from firing and leave the first frame blank with no user-visible feedback. The `captureVideoThumbnail` path in `gridStore.ts` uses `muted = true` so this concern does not apply there.

The AudioContext pre-creation placement, `shouldCloseCtx` ownership, codec priority order, and `audioEnabled: false` default are all implemented correctly.

---

## Warnings

### WR-01: `play().catch()` silently swallows `NotAllowedError` on unmuted video in LeafNode

**File:** `src/Grid/LeafNode.tsx:212`
**Issue:** `video.play().catch(() => {})` suppresses all rejection reasons, including `NotAllowedError` (browser policy block for unmuted autoplay). The video element is intentionally NOT muted (per the comment at lines 196-199 explaining the Web Audio API reason). On iOS Safari and some Chrome configurations, unmuted autoplay is blocked by policy; `play()` rejects with `NotAllowedError`, the decoder is never activated, `seeked` never fires, `firstSeekDone` stays `false`, and the first frame is never drawn. There is no fallback and no user notification.

**Fix:**
```typescript
video.play().catch((err: unknown) => {
  if (err instanceof DOMException && err.name === 'AbortError') {
    // Benign: interrupted by seek or page navigation
    return;
  }
  // NotAllowedError or other policy block — decoder not activated;
  // seeked may never fire. Mute and retry as a fallback.
  console.warn('[video] play() blocked by policy; retrying muted:', err);
  video.muted = true;
  video.play().catch(() => {
    // If muted retry also fails, seeked will time out; acceptable degradation.
  });
});
```

---

### WR-02: `objectPosition` type mismatch in `media.test.ts` test fixture

**File:** `src/test/media.test.ts:189`
**Issue:** The `singleLeaf` fixture uses `objectPosition: { x: 0.5, y: 0.5 }` (an object), but `LeafNode.objectPosition` is typed as `string | undefined` in `src/types/index.ts`. TypeScript strict mode will flag this as a type error. The test still exercises the correct split-alternation logic at runtime because `objectPosition` is not inspected by `autoFillCells`, but the fixture is incorrectly typed and will fail `tsc --noEmit`.

**Fix:**
```typescript
// Line 189 — replace objectPosition value with a valid string
const singleLeaf: GridNode = {
  type: 'leaf',
  id: 'root-leaf',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',  // was: { x: 0.5, y: 0.5 }
  backgroundColor: null,
  panX: 0,
  panY: 0,
  panScale: 1,
  effects: { brightness: 0, contrast: 0, saturation: 0, blur: 0, preset: null,
             sepia: 0, hueRotate: 0, grayscale: 0 },
  audioEnabled: false,   // D-04B: opt-in default
  hasAudioTrack: false,
};
```

---

### WR-03: `effects.preset: 'none'` is not a valid `PresetName` in `media.test.ts` test fixture

**File:** `src/test/media.test.ts:189`
**Issue:** The same `singleLeaf` fixture uses `effects: { ..., preset: 'none' }`. `EffectSettings.preset` is typed as `PresetName | null` where `PresetName = 'clarendon' | 'lark' | 'juno' | 'reyes' | 'moon' | 'inkwell'`. The literal `'none'` is not a member of `PresetName` and is not `null`. TypeScript will reject this assignment. The runtime value of `preset` does not affect the split-direction logic being tested, but the compilation error must be resolved.

**Fix:** Use `null` instead of `'none'`:
```typescript
effects: { brightness: 0, contrast: 0, saturation: 0, blur: 0, preset: null,
           sepia: 0, hueRotate: 0, grayscale: 0 },
```

---

## Info

### IN-01: `initialRoot` fixture in `phase07-02-gridstore-thumbnail.test.ts` is dead code with a D-04B violation

**File:** `src/test/phase07-02-gridstore-thumbnail.test.ts:22-31`
**Issue:** The `initialRoot` constant is declared but never used in any test — it is not passed to `setState` or any helper. As dead code it has no runtime impact. However, it sets `audioEnabled: true`, which contradicts the D-04B opt-in default (`false`). If this fixture is wired into a future test, it would silently violate the contract being verified. It also omits required `LeafNode` fields (`hasAudioTrack`, `panX`, `panY`, `panScale`, `effects`, `backgroundColor`), which TypeScript will flag.

**Fix:** Remove the unused constant, or if intended for a future test, correct it:
```typescript
// Remove lines 22-31 entirely, or correct to:
const initialRoot: LeafNode = {
  type: 'leaf',
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
  panX: 0,
  panY: 0,
  panScale: 1,
  effects: { brightness: 0, contrast: 0, saturation: 0, blur: 0, preset: null,
             sepia: 0, hueRotate: 0, grayscale: 0 },
  audioEnabled: false,   // D-04B: opt-in
  hasAudioTrack: false,
};
```

---

### IN-02: `detectAudioTrack` comment is ambiguous about Chrome's `audioTracks` support (D-02)

**File:** `src/lib/media.ts:56-57`
**Issue:** The comment at line 56 reads "Desktop Safari / newer Chrome: AudioTrackList API available", but the comment at line 70 says "Chrome-only: when both audioTracks AND mozHasAudio are undefined, try captureStream()". The two comments together imply Chrome both has and lacks `audioTracks` without explaining that older Chrome versions lack it. The logic is correct; only the comment is ambiguous and could mislead future maintainers.

**Fix:**
```typescript
// Desktop Safari: AudioTrackList API available.
// Chrome 87+ also exposes audioTracks; older Chrome lacks it and falls through to captureStream below.
if (audioTracks !== undefined) {
```

---

### IN-03: `videoExport-codec.test.ts` does not verify AudioContext is closed in the `finally` block

**File:** `src/test/videoExport-codec.test.ts:213-227`
**Issue:** The D-04A test verifies that `AudioContext` is constructed before the first `await`. It does not verify that `gestureAudioContext.close()` is called in the `finally` block of `exportVideoGrid`. If the `close()` call were accidentally removed, no test would detect the resource leak.

**Fix:** Add a test case asserting `close` is called:
```typescript
it('closes the pre-created AudioContext in the finally block', async () => {
  const closeMock = vi.fn().mockResolvedValue(undefined);
  let capturedCtx: { close: typeof closeMock } | undefined;
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: function MockAudioContext() {
      capturedCtx = {
        close: closeMock,
        state: 'suspended',
        decodeAudioData: vi.fn(),
      };
      return capturedCtx;
    },
  });

  try {
    await exportVideoGrid(makeRoot(), {}, {}, makeSettings(), 1, vi.fn());
  } catch { /* pipeline not fully mocked */ }

  expect(closeMock).toHaveBeenCalledTimes(1);
});
```

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
