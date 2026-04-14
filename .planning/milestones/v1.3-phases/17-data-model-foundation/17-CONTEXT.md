# Phase 17: Data Model Foundation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `hasAudioTrack: boolean` to `LeafNode`, set the default in `createLeaf()`, update both test factories, and verify the field survives undo/redo snapshot round-trips. This phase delivers the data model foundation that unblocks Phases 18–21. No detection logic, no UI changes, no store actions beyond what is needed for type safety.

</domain>

<decisions>
## Implementation Decisions

### LeafNode Type Shape
- **D-01:** `hasAudioTrack` is a **required `boolean`** on `LeafNode` — not optional. TypeScript prevents `undefined` at compile time.
- **D-02:** `createLeaf()` must return `hasAudioTrack: true` as the default.
- **D-03:** Both test factories must be updated to include `hasAudioTrack: true`:
  - `makeLeaf()` in `src/test/videoExport-audio.test.ts:12`
  - `makeTestLeaf()` in `src/test/canvas-export.test.ts:13`

### SC2: Undo/Redo Verification
- **D-04:** No `setHasAudioTrack` store action in Phase 17. Test SC2 via snapshot round-trip: use an existing snapshot-pushing action (e.g. `splitNode` or `toggleAudioEnabled`), call `undo()`, assert the restored leaf still has `hasAudioTrack: true`. This proves the field is captured and restored by the history mechanism without adding premature store surface area.

### SC4: Legacy Snapshot Test
- **D-05:** Include a runtime test that simulates a pre-Phase-17 object by constructing a leaf via `as any` and deleting `hasAudioTrack`, then asserting `leaf.hasAudioTrack ?? true === true`. This validates the `?? true` defensive read pattern works at runtime for any future persist migration, even though the required type prevents it in normal TypeScript code.

### Claude's Discretion
- Choice of which existing action to use for the SC2 undo/redo test (any snapshot-pushing action is acceptable — splitNode is simplest).
- Placement of the new `hasAudioTrack` field within `LeafNode` (after `audioEnabled` is natural).
- File for the SC4 legacy test (alongside the SC2 test in a new phase-17 test file, or appended to `videoExport-audio.test.ts` — either is fine).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MUTE-04 — The `hasAudioTrack` field must be included in undo/redo snapshots and correctly restored

### Source Files to Modify
- `src/types/index.ts` — `LeafNode` type definition
- `src/lib/tree.ts:83` — `createLeaf()` factory
- `src/test/videoExport-audio.test.ts:12` — `makeLeaf()` test factory
- `src/test/canvas-export.test.ts:13` — `makeTestLeaf()` test factory

### Undo/Redo Architecture
- `src/store/gridStore.ts:94` — history shape: `Array<{ root: GridNode; overlays: Overlay[] }>`
- `src/store/gridStore.ts:132–154` — `pushSnapshot()` helper
- `src/store/gridStore.ts:354–357` — `undo()` implementation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createLeaf()` (`src/lib/tree.ts:83`): the single source of truth for new leaf defaults — add `hasAudioTrack: true` here
- `pushSnapshot()` (`src/store/gridStore.ts:132`): internal helper that captures full tree state — no changes needed, snapshots automatically include new fields once added to the type

### Established Patterns
- Required fields pattern: all prior `LeafNode` additions (`effects`, `audioEnabled`, `panX/Y/Scale`) were added as required fields with defaults in `createLeaf()` and corresponding updates to test factories
- Test factories use spread + defaults (`Partial<LeafNode>` + overrides): adding `hasAudioTrack: true` to the base object in each factory is the established fix

### Integration Points
- History snapshots: in-memory only (no `zustand/persist`) — snapshot compatibility is verified via tests, not data migration
- Phase 19 will add `setHasAudioTrack(nodeId, value)` store action and detection logic; Phase 17 only adds the type + default

</code_context>

<specifics>
## Specific Ideas

- The SC4 test simulates the legacy scenario by constructing a leaf `as any` and deleting `hasAudioTrack` before asserting the `?? true` fallback. This is intentionally a runtime proof, not just a TypeScript guarantee.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-data-model-foundation*
*Context gathered: 2026-04-11*
