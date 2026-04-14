# Phase 17: Data Model Foundation - Research

**Researched:** 2026-04-11
**Domain:** TypeScript type extension + Zustand/Immer snapshot compatibility
**Confidence:** HIGH

## Summary

Phase 17 is a surgical data model change: add `hasAudioTrack: boolean` as a required field on `LeafNode`, set its default in `createLeaf()`, update two test factories, and write tests that prove the field survives undo/redo snapshot round-trips. There are no new libraries, no store action additions, and no UI changes in scope.

The codebase already has a clear precedent for this pattern. `audioEnabled: boolean` was added in Phase 12 using exactly the same approach: required field on `LeafNode`, default `true` in `createLeaf()`, test factory updates. The snapshot mechanism (`pushSnapshot` + `structuredClone`) automatically captures any field present on `LeafNode` at the time of the snapshot — no changes to the history infrastructure are needed.

The only non-trivial concern is correctly placing `hasAudioTrack` relative to the existing `audioEnabled` field in the type definition and factory, and writing the SC4 legacy simulation test correctly using `as any` + `delete` to simulate a pre-Phase-17 snapshot object.

**Primary recommendation:** Copy the `audioEnabled` addition pattern from Phase 12 exactly. One type edit, one factory edit, two test factory edits, one new test file covering SC2 and SC4.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `hasAudioTrack` is a **required `boolean`** on `LeafNode` — not optional. TypeScript prevents `undefined` at compile time.
- **D-02:** `createLeaf()` must return `hasAudioTrack: true` as the default.
- **D-03:** Both test factories must be updated to include `hasAudioTrack: true`:
  - `makeLeaf()` in `src/test/videoExport-audio.test.ts:12`
  - `makeTestLeaf()` in `src/test/canvas-export.test.ts:13`
- **D-04:** No `setHasAudioTrack` store action in Phase 17. Test SC2 via snapshot round-trip: use an existing snapshot-pushing action (e.g. `splitNode` or `toggleAudioEnabled`), call `undo()`, assert the restored leaf still has `hasAudioTrack: true`.
- **D-05:** Include a runtime test that simulates a pre-Phase-17 object by constructing a leaf via `as any` and deleting `hasAudioTrack`, then asserting `leaf.hasAudioTrack ?? true === true`.

### Claude's Discretion
- Choice of which existing action to use for the SC2 undo/redo test (any snapshot-pushing action is acceptable — splitNode is simplest).
- Placement of the new `hasAudioTrack` field within `LeafNode` (after `audioEnabled` is natural).
- File for the SC4 legacy test (alongside the SC2 test in a new phase-17 test file, or appended to `videoExport-audio.test.ts` — either is fine).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MUTE-04 | The `hasAudioTrack` field on LeafNode is included in undo/redo snapshots and correctly restored after undo/redo | Verified: `pushSnapshot` uses `structuredClone` on the full `root` tree — any required field on `LeafNode` is automatically captured. SC2 test using `splitNode` + `undo()` proves restoration. SC4 test using `as any` + `delete` proves `?? true` defensive read pattern. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.8.0 | Required field enforcement at compile time | Pre-decided in CLAUDE.md; `required boolean` prevents `undefined` without optional chaining |
| Zustand + Immer | ^5.0.12 + ^10.1.x | State store + immutable updates | Pre-decided; `pushSnapshot` + `structuredClone` captures full `LeafNode` tree |
| Vitest | (existing) | Test runner for SC2 + SC4 tests | Already in use; all 56 test files pass |

No new packages needed. This phase is purely internal type + test work.

**Installation:** No new packages.

## Architecture Patterns

### Existing LeafNode Shape (verified)
```typescript
// Source: src/types/index.ts (current)
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  panX: number;
  panY: number;
  panScale: number;
  effects: EffectSettings;
  audioEnabled: boolean;
  // hasAudioTrack: boolean  <-- Phase 17 adds this here
};
```

### Target LeafNode Shape (after Phase 17)
```typescript
// After Phase 17 — field placed after audioEnabled
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  panX: number;
  panY: number;
  panScale: number;
  effects: EffectSettings;
  audioEnabled: boolean;
  hasAudioTrack: boolean;
};
```

### createLeaf() Pattern (verified)
```typescript
// Source: src/lib/tree.ts:83 (current)
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
    hasAudioTrack: true,  // <-- Phase 17 adds this
  };
}
```

### Test Factory Pattern (verified — makeLeaf in videoExport-audio.test.ts)
```typescript
// Current (src/test/videoExport-audio.test.ts:12) — needs hasAudioTrack: true added
function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  leafCounter += 1;
  return {
    type: 'leaf',
    id: `leaf-${leafCounter}`,
    mediaId: null,
    fit: 'cover',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: { brightness: 0, contrast: 0, saturation: 0, blur: 0, preset: null },
    audioEnabled: true,
    hasAudioTrack: true,  // <-- add this
    ...overrides,
  };
}
```

### Test Factory Pattern (verified — makeTestLeaf in canvas-export.test.ts)
```typescript
// Current (src/test/canvas-export.test.ts:13) — needs hasAudioTrack: true added
function makeTestLeaf(overrides: Partial<LeafNode> & { id: string }): LeafNode {
  return {
    type: 'leaf',
    mediaId: null,
    fit: 'cover',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: { ...DEFAULT_EFFECTS },
    audioEnabled: true,
    hasAudioTrack: true,  // <-- add this
    ...overrides,
  };
}
```

### SC2 Undo/Redo Test Pattern
```typescript
// New test file: src/test/phase17-has-audio-track.test.ts
// SC2: hasAudioTrack survives undo/redo snapshot round-trip
it('undo restores hasAudioTrack:true on leaf after splitNode', () => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  const { root } = useGridStore.getState();
  const container = root as ContainerNode;
  const leafId = container.children[0].id;

  // splitNode is a snapshot-pushing action (D-04)
  useGridStore.getState().split(leafId, 'horizontal');
  useGridStore.getState().undo();

  const restoredRoot = useGridStore.getState().root;
  const restoredLeaves = getAllLeaves(restoredRoot);
  restoredLeaves.forEach(leaf => {
    expect(leaf.hasAudioTrack).toBe(true);
  });
});
```

### SC4 Legacy Snapshot Simulation Pattern
```typescript
// SC4: defensive read pattern works on pre-Phase-17 objects (D-05)
it('leaf.hasAudioTrack ?? true is true when field is absent (legacy snapshot)', () => {
  const leaf: LeafNode = createLeaf();
  // Simulate a pre-Phase-17 snapshot by removing the field at runtime
  const legacy = leaf as any;
  delete legacy.hasAudioTrack;

  expect(legacy.hasAudioTrack).toBeUndefined();
  expect(legacy.hasAudioTrack ?? true).toBe(true);
});
```

### Snapshot Mechanism (verified — no changes needed)
```typescript
// Source: src/store/gridStore.ts:132-154
function pushSnapshot(state: { root: GridNode; history: ...; historyIndex: number }): void {
  const plainRoot = current(state.root);          // unwrap Immer Draft
  const overlays = useOverlayStore.getState().overlays;
  const snap = structuredClone({ root: plainRoot, overlays });
  // structuredClone captures all enumerable properties including hasAudioTrack
  state.history.push(snap);
  state.historyIndex = state.history.length - 1;
}
```

The `structuredClone` call captures the full `root` tree including every `LeafNode` field. Once `hasAudioTrack` is added to `LeafNode` and `createLeaf()`, all new snapshots automatically include it. No changes to `pushSnapshot`, `undo()`, or `redo()` are needed. [VERIFIED: src/store/gridStore.ts:132-154]

### Anti-Patterns to Avoid
- **Optional field (`hasAudioTrack?: boolean`):** D-01 explicitly requires a required field. Optional fields allow `undefined` at runtime and require `?? true` everywhere. TypeScript will enforce completeness at compile time only if the field is required.
- **Adding `setHasAudioTrack` action in Phase 17:** D-04 defers this to Phase 19. Adding it now creates surface area that Phase 19 will either duplicate or contradict.
- **Using `toggleAudioEnabled` for SC2 test:** `toggleAudioEnabled` pushes a snapshot, so it works — but `splitNode` is simpler and cleaner per the CONTEXT.md guidance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot inclusion of new fields | Custom snapshot serializer | Existing `pushSnapshot` + `structuredClone` | `structuredClone` copies all enumerable own properties automatically |
| Legacy snapshot migration | Runtime migration on `undo()` | `?? true` defensive read at point of use | History is in-memory only; no persisted snapshots to migrate; `?? true` is the established pattern (Phase 12 precedent) |
| TypeScript exhaustiveness | Custom runtime type guard | Required field on `LeafNode` | Compile-time enforcement is sufficient; no guard needed |

**Key insight:** The snapshot system is already correct for this pattern. No infrastructure changes are needed — only the type definition and factory need updating.

## Common Pitfalls

### Pitfall 1: Forgetting objectPosition is optional on LeafNode but required in createLeaf
**What goes wrong:** When constructing a `LeafNode` literal directly in tests (not via `createLeaf()`), forgetting that `objectPosition` is declared as `objectPosition?: string` (optional) while `hasAudioTrack` will be `hasAudioTrack: boolean` (required) — this is an asymmetry to be aware of.
**How to avoid:** Test factories use spread + `overrides` pattern. Adding `hasAudioTrack: true` to the base object before the spread ensures overrides can change the value without TypeScript errors.
**Warning signs:** TypeScript error "Property 'hasAudioTrack' is missing in type '...' but required in type 'LeafNode'" — means a test factory was missed.

### Pitfall 2: Snapshot taken before createLeaf() is updated
**What goes wrong:** If the SC2 test is written before the factory update, `createLeaf()` returns a `LeafNode` that TypeScript would reject (missing required field). This is a compile-time error, not a subtle runtime bug — TypeScript will catch it immediately.
**How to avoid:** Update `src/types/index.ts` and `src/lib/tree.ts` first; test factory updates and new test file second.

### Pitfall 3: moveLeafToEdge and swapLeafContent don't copy hasAudioTrack
**What goes wrong:** `moveLeafToEdge` captures `sourceContent` as a partial of specific fields. After Phase 17, it does NOT include `hasAudioTrack` in the content copy — meaning a moved leaf will get `createLeaf()`'s default `true` regardless of the source.
**Why it matters:** Phase 17 doesn't add `setHasAudioTrack`, so all values are `true` in Phase 17. But Phase 19 will set `hasAudioTrack: false` for silent videos. At that point, `moveLeafToEdge` would silently lose `hasAudioTrack: false` during a move operation.
**Recommendation (Claude's Discretion):** Phase 17 should add `hasAudioTrack` to the `sourceContent` capture in `moveLeafToEdge` — it's a 1-line addition and prevents a Phase 19 regression. [ASSUMED — not explicitly discussed in CONTEXT.md, but consistent with the established pattern in swapLeafContent which copies all content fields]
**Warning signs:** A moved video-with-no-audio would regain its audio toggle after Phase 19 without this fix.

### Pitfall 4: TypeScript compiler not re-run after type change
**What goes wrong:** Editor shows no errors but `tsc --noEmit` finds missing `hasAudioTrack` in an inline leaf literal elsewhere in the codebase.
**How to avoid:** Run `npx tsc --noEmit` after the type change and before writing tests. Fix all compiler errors before proceeding.
**Warning signs:** CI failure on TypeScript build step.

## Code Examples

### Verified: undo() implementation
```typescript
// Source: src/store/gridStore.ts:352-361
undo: () =>
  set(state => {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    const plainSnap = current(state.history[state.historyIndex]);
    state.root = structuredClone(plainSnap.root);
    useOverlayStore.getState().replaceAll(structuredClone(plainSnap.overlays ?? []));
  }),
```

The `overlays ?? []` guard is the established pattern for handling snapshots taken before Phase 13 that lack the `overlays` field. The same `?? true` pattern for `hasAudioTrack` mirrors this approach — graceful degradation on pre-Phase-17 objects.

### Verified: toggleAudioEnabled (alternative SC2 action)
`toggleAudioEnabled` calls `pushSnapshot` internally — confirmed by its presence in the store action list at `src/store/gridStore.ts:103`. It is a valid SC2 test trigger, but `split` is simpler.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Optional field with `?? default` throughout codebase | Required field, default in factory | Phase 12 (audioEnabled) | Compile-time safety; `undefined` impossible in new code |
| Separate persist middleware for snapshot compat | In-memory history only, `?? fallback` guards | Phase 1 design decision | No migration needed; `?? true` is sufficient for legacy snapshots |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `hasAudioTrack` to `moveLeafToEdge`'s `sourceContent` capture is in scope for Phase 17 | Common Pitfalls §3 | Low risk in Phase 17 (all values are `true`); high risk in Phase 19 if not fixed — a Phase 19 task can address it instead |

## Open Questions (RESOLVED)

1. **Should moveLeafToEdge copy hasAudioTrack?** (RESOLVED: out of scope for Phase 17)
   - What we know: Currently copies `mediaId, fit, backgroundColor, panX, panY, panScale, objectPosition, effects`. All these are content fields. `audioEnabled` is NOT copied (noted in Phase 9 decisions). `hasAudioTrack` is a detection result, not user-set content.
   - What's unclear: Is `hasAudioTrack` "content" (should follow the media) or "structural" (set at upload time, independent of position)? Phase 19 sets it at upload time — it is tied to the media, not the cell position.
   - Recommendation: `hasAudioTrack` SHOULD follow the media (like `audioEnabled`). But since `audioEnabled` itself is not copied in `moveLeafToEdge`, consistency argues for not copying it in Phase 17 either. Phase 19 can address both when it adds detection logic. Treat this as out of scope for Phase 17.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is purely code/config/test changes within the existing Vite + TypeScript + Vitest environment).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing, all 56 test files passing) |
| Config file | `vite.config.ts` (test block) |
| Quick run command | `npx vitest run src/test/phase17-has-audio-track.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MUTE-04 (SC1) | `LeafNode.hasAudioTrack` is required boolean, `createLeaf()` returns `true` | unit | `npx vitest run src/test/phase17-has-audio-track.test.ts` | ❌ Wave 0 |
| MUTE-04 (SC2) | undo restores `hasAudioTrack` after snapshot-pushing action | unit | `npx vitest run src/test/phase17-has-audio-track.test.ts` | ❌ Wave 0 |
| MUTE-04 (SC3) | All existing tests pass (no regressions from type change) | regression | `npx vitest run` | ✅ existing suite |
| MUTE-04 (SC4) | `leaf.hasAudioTrack ?? true` is `true` when field absent | unit | `npx vitest run src/test/phase17-has-audio-track.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/phase17-has-audio-track.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/phase17-has-audio-track.test.ts` — covers MUTE-04 SC1, SC2, SC4

## Security Domain

Not applicable. This phase adds a boolean field to an internal data model with no security-sensitive surface area (no auth, no network, no user input validation). ASVS V5 (Input Validation) does not apply — the field is set programmatically by `createLeaf()` and later by upload detection logic (Phase 19).

## Sources

### Primary (HIGH confidence)
- `src/types/index.ts` — verified current `LeafNode` shape (no `hasAudioTrack` present)
- `src/lib/tree.ts:83` — verified `createLeaf()` implementation and current field list
- `src/store/gridStore.ts:132-154` — verified `pushSnapshot` uses `structuredClone` on full `root`
- `src/store/gridStore.ts:352-372` — verified `undo()` and `redo()` restore from `structuredClone`
- `src/test/videoExport-audio.test.ts:12` — verified `makeLeaf()` factory current shape
- `src/test/canvas-export.test.ts:13` — verified `makeTestLeaf()` factory current shape
- Vitest run — verified all 56 test files pass (632 passing, 2 skipped, 4 todo)

### Secondary (MEDIUM confidence)
- `.planning/phases/17-data-model-foundation/17-CONTEXT.md` — locked decisions D-01 through D-05
- `.planning/REQUIREMENTS.md` §MUTE-04 — requirement definition

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing stack fully verified
- Architecture patterns: HIGH — all code read directly from source; pattern is a verified repeat of Phase 12's `audioEnabled` addition
- Pitfalls: HIGH (P1-P2, P4) / MEDIUM (P3) — P3 involves a design judgment about content copy semantics that is not explicitly locked

**Research date:** 2026-04-11
**Valid until:** Stable (pure internal type change; no external dependencies to drift)
