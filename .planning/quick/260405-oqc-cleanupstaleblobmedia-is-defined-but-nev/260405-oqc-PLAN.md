---
phase: quick
plan: 260405-oqc
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Editor/EditorShell.tsx
  - src/test/gridStore.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Stale blob media entries are cleaned up on app startup"
    - "Leaf cells referencing stale blob URLs are nulled out after reload"
  artifacts:
    - path: "src/Editor/EditorShell.tsx"
      provides: "Startup call to cleanupStaleBlobMedia"
      contains: "cleanupStaleBlobMedia"
    - path: "src/test/gridStore.test.ts"
      provides: "Test coverage for cleanupStaleBlobMedia"
      contains: "cleanupStaleBlobMedia"
  key_links:
    - from: "src/Editor/EditorShell.tsx"
      to: "src/store/gridStore.ts"
      via: "useEffect on mount calling cleanupStaleBlobMedia"
      pattern: "cleanupStaleBlobMedia"
---

<objective>
Wire the existing `cleanupStaleBlobMedia` store action to run on app startup and add test coverage.

Purpose: Blob URLs (used for video media) do not survive page reloads. The cleanup function already exists in gridStore (added in Phase 06-01) but was never called. After reload, stale blob entries persist in the persisted store, leaving leaf cells pointing at dead URLs.

Output: EditorShell calls cleanup on mount; test verifies the action works correctly.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/store/gridStore.ts
@src/Editor/EditorShell.tsx
@src/test/gridStore.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add test and wire cleanupStaleBlobMedia on mount</name>
  <files>src/test/gridStore.test.ts, src/Editor/EditorShell.tsx</files>
  <behavior>
    - Test: cleanupStaleBlobMedia removes blob: entries from mediaRegistry and mediaTypeMap
    - Test: cleanupStaleBlobMedia nulls out leaf mediaId values that reference stale blob entries
    - Test: cleanupStaleBlobMedia is a no-op when no blob entries exist (base64 images left alone)
  </behavior>
  <action>
1. In `src/test/gridStore.test.ts`, add a describe block for `cleanupStaleBlobMedia`:
   - Seed the store with a root containing 2 leaves, one with a base64 mediaId and one with a blob mediaId. Set mediaRegistry to have matching entries (one `data:image/png;base64,...` and one `blob:http://...`). Set mediaTypeMap accordingly.
   - Call `useGridStore.getState().cleanupStaleBlobMedia()`.
   - Assert: blob entry removed from mediaRegistry and mediaTypeMap, base64 entry untouched.
   - Assert: leaf referencing blob mediaId now has mediaId === null.
   - Assert: leaf referencing base64 mediaId is unchanged.
   - Add a second test: store with only base64 entries, call cleanup, assert nothing changes.

2. In `src/Editor/EditorShell.tsx`:
   - Add `cleanupStaleBlobMedia` to the existing `useGridStore` selector destructuring (or call `useGridStore.getState().cleanupStaleBlobMedia` directly).
   - Add a new `useEffect` with empty dependency array `[]` that calls `cleanupStaleBlobMedia()` once on mount. Place it before the existing keyboard shortcut useEffect.
   - Use `useGridStore.getState().cleanupStaleBlobMedia()` inside the effect (no selector needed — this is a fire-once action, not reactive).
  </action>
  <verify>
    <automated>cd /Users/radu/Developer/storygrid && npx vitest run src/test/gridStore.test.ts --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>cleanupStaleBlobMedia runs on app mount, stale blob entries and their leaf references are cleaned up, tests pass</done>
</task>

</tasks>

<verification>
- `npx vitest run src/test/gridStore.test.ts` passes with new cleanupStaleBlobMedia tests
- `npx vitest run` full suite passes (no regressions)
- EditorShell.tsx contains a useEffect calling cleanupStaleBlobMedia on mount
</verification>

<success_criteria>
- Stale blob media entries are removed from mediaRegistry and mediaTypeMap on app startup
- Leaf cells referencing stale blob URLs have their mediaId set to null
- Base64 image entries are unaffected
- All existing tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/260405-oqc-cleanupstaleblobmedia-is-defined-but-nev/260405-oqc-SUMMARY.md`
</output>
