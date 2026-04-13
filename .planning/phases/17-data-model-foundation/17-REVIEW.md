---
phase: 17-data-model-foundation
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/tree.ts
  - src/test/canvas-export.test.ts
  - src/test/phase17-has-audio-track.test.ts
  - src/test/videoExport-audio.test.ts
  - src/types/index.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The Phase 17 data model foundation adds `hasAudioTrack: boolean` to `LeafNode` and wires it into `createLeaf()`. The type definition, factory function, and tests are coherent. No security issues and no crashes were found.

Three warnings stand out:

1. `createLeaf()` hard-codes `hasAudioTrack: true` unconditionally, which is a semantic mismatch — a freshly created leaf carries no media and therefore cannot have an audio track. This is a logic error that will produce incorrect export decisions downstream.
2. `swapLeafContent` in `tree.ts` does not copy `audioEnabled` or `hasAudioTrack`, so a swap silently discards the audio state of both leaves.
3. `objectPosition` is declared `optional` (`?`) on `LeafNode` while every other field is required, creating an inconsistent defensive-read burden across the codebase.

---

## Warnings

### WR-01: `createLeaf()` sets `hasAudioTrack: true` on a leaf that has no media

**File:** `src/lib/tree.ts:83-98`

**Issue:** A newly created leaf has `mediaId: null`, meaning it holds no media. Setting `hasAudioTrack: true` is semantically wrong — a leaf with no media cannot have an audio track. Any downstream consumer that reads `leaf.hasAudioTrack` to decide whether to mix audio (e.g., `hasAudioEnabledVideoLeaf`) will receive an incorrect signal for empty cells if they are not separately guarded by a `mediaId != null` check. If `hasAudioTrack` is intended to mean "the media assigned to this cell has an audio track", its initial value should be `false` (no media assigned yet, so no audio track known).

**Fix:**
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
    audioEnabled: true,
    hasAudioTrack: false,   // no media assigned yet → no audio track
  };
}
```

If the intent is "default to true so that when media is later assigned the field is optimistically set", that semantic must be documented explicitly on the type and every consumer must null-check `mediaId` before trusting `hasAudioTrack`. Prefer the semantically correct `false` default and update the field when media is assigned.

---

### WR-02: `swapLeafContent` does not copy `audioEnabled` or `hasAudioTrack`

**File:** `src/lib/tree.ts:265-287`

**Issue:** The `contentA` / `contentB` objects assembled for the swap include `mediaId`, `fit`, `backgroundColor`, `panX`, `panY`, `panScale`, and `effects`, but omit `audioEnabled` and `hasAudioTrack`. After a swap the audio state of each cell stays bound to its original cell identity rather than moving with the media content. A user who mutes a video cell and then drags it to another position will find the muted flag stays behind — the destination cell unexpectedly plays audio.

**Fix:**
```typescript
const contentA = {
  mediaId: leafA.mediaId,
  fit: leafA.fit,
  backgroundColor: leafA.backgroundColor,
  panX: leafA.panX,
  panY: leafA.panY,
  panScale: leafA.panScale,
  effects: { ...leafA.effects },
  audioEnabled: leafA.audioEnabled,     // add
  hasAudioTrack: leafA.hasAudioTrack,   // add
};
const contentB = {
  mediaId: leafB.mediaId,
  fit: leafB.fit,
  backgroundColor: leafB.backgroundColor,
  panX: leafB.panX,
  panY: leafB.panY,
  panScale: leafB.panScale,
  effects: { ...leafB.effects },
  audioEnabled: leafB.audioEnabled,     // add
  hasAudioTrack: leafB.hasAudioTrack,   // add
};
```

---

### WR-03: `objectPosition` is optional on `LeafNode` but all other per-cell fields are required

**File:** `src/types/index.ts:14`

**Issue:** `objectPosition?: string` is the only optional field on `LeafNode`. Every other field (`panX`, `panY`, `panScale`, `audioEnabled`, `hasAudioTrack`, etc.) is required. This inconsistency means every reader of `objectPosition` either must null-check it or risks a runtime `undefined` value in a context that expects a string (e.g., CSS `object-position`). `createLeaf()` and `moveLeafToEdge` both set it unconditionally, so the optionality is not driven by construction — it appears to be an accidental leftover from an earlier migration.

**Fix:** Remove the `?` to make it required and consistent with the rest of the type:
```typescript
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition: string;   // was optional — make required, default 'center center'
  backgroundColor: string | null;
  panX: number;
  panY: number;
  panScale: number;
  effects: EffectSettings;
  audioEnabled: boolean;
  hasAudioTrack: boolean;
};
```

Any existing snapshots that lack the field will need the same `?? 'center center'` defensive read that already guards `hasAudioTrack`.

---

## Info

### IN-01: `makeLeaf` helper in `videoExport-audio.test.ts` omits `objectPosition`

**File:** `src/test/videoExport-audio.test.ts:12-34`

**Issue:** The `makeLeaf` factory does not set `objectPosition`. If `objectPosition` is made required (see WR-03), this helper will produce a TypeScript error and tests will fail to compile. The field should be added to the helper now.

**Fix:**
```typescript
function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  leafCounter += 1;
  return {
    type: 'leaf',
    id: `leaf-${leafCounter}`,
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',   // add
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: { ... },
    audioEnabled: true,
    hasAudioTrack: true,
    ...overrides,
  };
}
```

---

### IN-02: SC4 test in `phase17-has-audio-track.test.ts` uses `any` cast and `delete` on a typed object

**File:** `src/test/phase17-has-audio-track.test.ts:61-70`

**Issue:** The SC4 test casts a `LeafNode` to `any` and uses `delete` to simulate a legacy snapshot. While functionally valid, it is fragile: if TypeScript strict mode is ever raised to disallow `delete` on non-optional properties, or if the test runner optimises away the `delete`, the premise of the test breaks silently. A more robust approach is to construct the legacy object directly without going through `createLeaf()`.

**Fix:**
```typescript
it('SC4: leaf.hasAudioTrack ?? true returns true when field is missing (legacy defensive read)', () => {
  // Construct a pre-Phase-17 snapshot literal directly — no delete needed.
  const legacy = {
    type: 'leaf' as const,
    id: 'legacy-id',
    mediaId: null,
    fit: 'cover' as const,
    objectPosition: 'center center',
    backgroundColor: null,
    panX: 0, panY: 0, panScale: 1,
    effects: { preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 0 },
    audioEnabled: true,
    // hasAudioTrack deliberately absent
  } as unknown as LeafNode;

  expect(legacy.hasAudioTrack).toBeUndefined();
  expect(legacy.hasAudioTrack ?? true).toBe(true);
});
```

---

### IN-03: `MediaItem` type in `src/types/index.ts` is unused

**File:** `src/types/index.ts:5-7`

**Issue:** `export type MediaItem = { mediaId: string }` is declared but not referenced anywhere in the reviewed files or apparently in the wider codebase. Dead type exports add noise and may mislead future readers into thinking there is a distinct `MediaItem` abstraction separate from `LeafNode.mediaId`.

**Fix:** Either remove the type or, if it is intentionally reserved for a future phase, add a comment:
```typescript
/** Reserved for Phase N — not yet used. */
export type MediaItem = {
  mediaId: string;
};
```

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
