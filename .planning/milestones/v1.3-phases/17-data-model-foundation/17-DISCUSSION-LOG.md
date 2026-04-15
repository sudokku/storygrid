# Phase 17: Data Model Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 17-data-model-foundation
**Areas discussed:** Type shape, SC2 undo/redo test, SC4 legacy snapshot test

---

## Type shape

| Option | Description | Selected |
|--------|-------------|----------|
| Required boolean | `hasAudioTrack: boolean` — TypeScript prevents undefined. All factories need updating. Clean downstream type. | ✓ |
| Optional boolean | `hasAudioTrack?: boolean` — backward compat, every read site needs `?? true`. | |

**User's choice:** Required boolean
**Notes:** Downstream phases (19, 21) get a clean type with no null guards needed for type safety.

---

## SC2 undo/redo test

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot round-trip | Use existing snapshot-pushing action (e.g. splitNode), undo, assert field intact. No new store action. | ✓ |
| Add setHasAudioTrack now | Add a minimal store action in Phase 17 to enable isolated undo test. Adds store surface area early. | |

**User's choice:** Snapshot round-trip
**Notes:** Avoids premature store surface area; Phase 19 will add the real action when detection logic lands.

---

## SC4 legacy snapshot test

| Option | Description | Selected |
|--------|-------------|----------|
| Type-cast legacy object test | Construct leaf `as any`, delete `hasAudioTrack`, assert `?? true` fallback. Runtime proof. | ✓ |
| TypeScript-only guarantee | Required type prevents undefined at compile time; skip the runtime test. | |

**User's choice:** Type-cast legacy object test
**Notes:** Belt-and-suspenders — proves the `?? true` pattern works at runtime for any future persist migration scenario.

---

## Claude's Discretion

- Which existing action to use for SC2 undo test (splitNode or similar)
- Placement of `hasAudioTrack` within `LeafNode` (after `audioEnabled`)
- File location for the new SC2/SC4 tests

## Deferred Ideas

None — discussion stayed within phase scope.
