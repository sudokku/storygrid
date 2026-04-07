---
phase: quick-260407-vth
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/TemplatesPopover.tsx
  - src/store/gridStore.ts
  - src/test/phase05-p01-templates.test.tsx
autonomous: true
requirements:
  - QUICK-260407-VTH-01
must_haves:
  truths:
    - "Clicking a template thumbnail applies the new structure immediately with no window.confirm() prompt"
    - "If the existing grid had no media, the new template renders empty (current behavior preserved)"
    - "If the existing grid had N media-bearing leaves and the new template has M leaves, min(N, M) media references are migrated to the new leaves in depth-first order"
    - "Surplus media (when N > M) is dropped from the leaves AND removed from mediaRegistry/mediaTypeMap/thumbnailMap so no orphan registry entries leak"
    - "Only the raw mediaId is copied — the new leaves keep their default fit:'cover', objectPosition:'center center', backgroundColor:null, panX:0, panY:0, panScale:1 (no pan/zoom/styling carries over)"
    - "applyTemplate still pushes one history snapshot so undo restores the previous tree AND its media binding"
  artifacts:
    - path: "src/components/TemplatesPopover.tsx"
      provides: "Template picker that calls applyTemplate(buildTemplate(name)) silently — window.confirm and isNonEmpty branch removed"
    - path: "src/store/gridStore.ts"
      provides: "applyTemplate action that walks old leaves DFS, walks new template leaves DFS, assigns oldLeaves[i].mediaId onto newLeaves[i] up to min(N,M), and prunes mediaRegistry entries no longer referenced"
  key_links:
    - from: "TemplatesPopover.handleApply"
      to: "gridStore.applyTemplate"
      via: "direct call with no confirm()"
      pattern: "applyTemplate\\(buildTemplate"
    - from: "gridStore.applyTemplate"
      to: "tree.getAllLeaves"
      via: "DFS traversal of both old root and new template root for index-aligned media migration"
      pattern: "getAllLeaves"
---

<objective>
Make the template picker apply silently and migrate existing media into the new template structure (up to min(oldMediaCount, newLeafCount)), copying only the raw mediaId reference — never pan, zoom, fit, objectPosition, or backgroundColor.

Purpose: Users currently lose all their work whenever they try a template because (a) a confirm dialog interrupts every apply and (b) applyTemplate wipes the entire mediaRegistry. We want template-switching to be a non-destructive layout swap.

Output: Updated TemplatesPopover.tsx (no confirm), updated gridStore.applyTemplate (media migration + registry pruning), updated test file covering both empty-grid and media-migration paths.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/types/index.ts
@src/store/gridStore.ts
@src/components/TemplatesPopover.tsx
@src/lib/tree.ts
@src/test/phase05-p01-templates.test.tsx

<interfaces>
<!-- Extracted from the codebase. Use these directly — do not re-explore. -->

From src/types/index.ts:
```typescript
export type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;          // <-- THIS is the only field to migrate
  fit: 'cover' | 'contain';
  objectPosition?: string;
  backgroundColor: string | null;
  panX: number;
  panY: number;
  panScale: number;
};

export type GridNode = ContainerNode | LeafNode;
```

From src/lib/tree.ts:
```typescript
// Depth-first, left-to-right traversal — already deterministic. Use it for both
// the old tree AND the freshly built template tree.
export function getAllLeaves(root: GridNode): LeafNode[];

export function buildTemplate(name: TemplateName): GridNode;
export function updateLeaf(
  root: GridNode,
  nodeId: string,
  updates: Partial<Omit<LeafNode, 'type' | 'id'>>,
): GridNode;
```

From src/store/gridStore.ts (current applyTemplate — to be replaced):
```typescript
applyTemplate: (templateRoot: GridNode) =>
  set(state => {
    revokeRegistryBlobUrls(current(state.mediaRegistry));
    pushSnapshot(state);
    state.root = templateRoot;
    state.mediaRegistry = {};
    state.mediaTypeMap = {};
    state.thumbnailMap = {};
  }),
```

Note: The store keeps three parallel maps keyed by mediaId — `mediaRegistry`
(URL/dataURI), `mediaTypeMap` ('image' | 'video'), and `thumbnailMap` (video
poster). All three must be pruned in lockstep when a media is dropped.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite gridStore.applyTemplate to migrate media + prune registry</name>
  <files>src/store/gridStore.ts, src/test/phase05-p01-templates.test.tsx</files>
  <behavior>
    Update the existing `gridStore.applyTemplate` describe block in
    src/test/phase05-p01-templates.test.tsx. Replace the current
    "replaces root with template tree and clears mediaRegistry" test (the
    semantics change — the registry is no longer unconditionally cleared)
    with the following cases. The "pushes snapshot — undo restores previous
    tree" test stays as-is.

    - Test A "empty grid -> empty template":
        Starting from initial state (single empty leaf, no media), apply
        buildTemplate('2x2'). Expect: root.id === template.id, all 4 new
        leaves have mediaId === null, mediaRegistry is still {}.

    - Test B "grid with fewer media than template leaves":
        Setup: split root into 2 leaves, addMedia('m1', 'data:img/...'),
        addMedia('m2', 'data:img/...'), setMedia(leafA.id, 'm1'),
        setMedia(leafB.id, 'm2'). Apply buildTemplate('2x2') (4 leaves).
        Expect: getAllLeaves(newRoot)[0].mediaId === 'm1',
        getAllLeaves(newRoot)[1].mediaId === 'm2',
        getAllLeaves(newRoot)[2].mediaId === null,
        getAllLeaves(newRoot)[3].mediaId === null.
        Expect mediaRegistry still contains both 'm1' and 'm2'
        (nothing was dropped).

    - Test C "grid with more media than template leaves — surplus pruned":
        Setup: starting from buildTemplate('2x2') applied as root, addMedia
        'm1','m2','m3','m4' and setMedia each onto the 4 leaves. Apply
        buildTemplate('1x2') (only 2 leaves). Expect:
        getAllLeaves(newRoot).map(l => l.mediaId) === ['m1', 'm2'].
        Expect Object.keys(mediaRegistry).sort() === ['m1', 'm2']
        ('m3' and 'm4' are removed from mediaRegistry, mediaTypeMap, and
        thumbnailMap).

    - Test D "only raw mediaId is migrated — no pan/zoom/fit/bg carries over":
        Setup: split root, addMedia('m1','data:...'), setMedia(leafA.id,'m1'),
        then updateCell(leafA.id, { fit: 'contain', backgroundColor: '#ff0000',
        panX: 50, panY: 25, panScale: 2 }). Apply buildTemplate('2x1').
        Expect getAllLeaves(newRoot)[0].mediaId === 'm1' AND
        fit === 'cover' AND backgroundColor === null AND panX === 0 AND
        panY === 0 AND panScale === 1.

    - Test E "blob: mediaRegistry entries that ARE migrated are NOT revoked":
        (Smoke check — no need to mock URL.revokeObjectURL beyond default.)
        Setup: addMedia('m1', 'blob:http://localhost/abc'), setMedia(leaf,'m1'),
        apply buildTemplate('2x1'). Expect mediaRegistry['m1'] still equals
        'blob:http://localhost/abc'. (Surplus blobs in test C should still be
        revoked — extend test C to assert URL.revokeObjectURL was called for
        the dropped media if their URL starts with 'blob:'. Use vi.spyOn on
        URL.revokeObjectURL inside that test.)
  </behavior>
  <action>
    Implement the new `applyTemplate(templateRoot: GridNode)` action in
    src/store/gridStore.ts. Replace the current body. Algorithm:

    1. Snapshot history FIRST via `pushSnapshot(state)` (preserves undo).
    2. Read current leaves DFS:
         `const oldLeaves = getAllLeaves(current(state.root));`
       Filter to those that actually carry media:
         `const carriedMediaIds = oldLeaves.map(l => l.mediaId).filter((id): id is string => id !== null);`
       This is the deterministic, depth-first ordered list of mediaIds to
       migrate.
    3. Read new template leaves DFS:
         `const newLeaves = getAllLeaves(templateRoot);`
    4. Build a mutated new tree by walking the new leaves in order and, for
       each `i < min(carriedMediaIds.length, newLeaves.length)`, calling
       `updateLeaf(nextRoot, newLeaves[i].id, { mediaId: carriedMediaIds[i] })`.
       Start from `let nextRoot: GridNode = templateRoot;` and reassign on
       each iteration. Do NOT touch `fit`, `objectPosition`, `backgroundColor`,
       `panX`, `panY`, or `panScale` — they stay at the defaults set by
       `createLeaf()` inside `buildTemplate`. (This is what guarantees the
       "raw reference only" requirement.)
    5. Determine which mediaIds to drop:
         `const keptIds = new Set(carriedMediaIds.slice(0, newLeaves.length));`
         `const droppedIds = carriedMediaIds.filter(id => !keptIds.has(id));`
       Note: use slice(0, newLeaves.length), NOT a Set diff against
       carriedMediaIds, so duplicates are handled correctly.
    6. For each dropped id: if `state.mediaRegistry[id]` is a blob URL,
       call `URL.revokeObjectURL(...)`. Then `delete state.mediaRegistry[id]`,
       `delete state.mediaTypeMap[id]`, `delete state.thumbnailMap[id]`.
       (Do NOT revoke or delete kept ids — that's the whole point.)
       Do NOT call the existing `revokeRegistryBlobUrls(...)` helper here;
       it indiscriminately revokes everything. Inline the per-id logic.
    7. Assign `state.root = nextRoot;`

    Imports: `getAllLeaves` is already imported from '../lib/tree' at the top
    of gridStore.ts. No new imports needed.

    Why we mutate via `updateLeaf` instead of mutating the draft: keeps
    consistency with the rest of the file (every other action calls a pure
    tree function and reassigns `state.root`), and `updateLeaf` already
    handles the immutable spread + path traversal correctly.

    Note on order: `getAllLeaves` recurses children left-to-right
    (`root.children.flatMap(getAllLeaves)`), which matches the visual
    top-left -> bottom-right reading order for both rows and columns. This
    is the deterministic order the spec requires.
  </action>
  <verify>
    <automated>npx vitest run src/test/phase05-p01-templates.test.tsx</automated>
  </verify>
  <done>
    All five new test cases (A-E) plus the existing "pushes snapshot" test
    pass. No other test files regress (`npx vitest run` clean).
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove confirm() dialog from TemplatesPopover</name>
  <files>src/components/TemplatesPopover.tsx</files>
  <action>
    Edit `handleApply` in src/components/TemplatesPopover.tsx. Delete the
    `getAllLeaves(root)` / `hasMedia` / `isNonEmpty` / `window.confirm(...)`
    block entirely. The new body is exactly:

    ```ts
    const handleApply = useCallback((entry: TemplateEntry) => {
      applyTemplate(buildTemplate(entry.name));
      setOpen(false);
    }, [applyTemplate]);
    ```

    Also:
    - Remove `getAllLeaves` from the import on line 3 (it's no longer used).
    - Remove `root` from the dependency array (no longer referenced).
    - Remove the `const root = useGridStore(s => s.root);` line — it was
      only used for the confirm check and is now dead. This eliminates an
      unnecessary re-render subscription on every tree mutation.

    Final imports for that file should be:
    ```ts
    import { buildTemplate } from '../lib/tree';
    import type { TemplateName } from '../lib/tree';
    import { useGridStore } from '../store/gridStore';
    ```

    Do not change anything else in this file (thumbnails, popover open/close,
    styling all stay identical).
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>
    Vitest suite is green, `tsc --noEmit` reports zero errors, and grepping
    `window.confirm` in src/components/TemplatesPopover.tsx returns nothing.
    Clicking a template in the running app no longer raises a browser
    confirm dialog (manual smoke during execution is fine, not required
    for completion).
  </done>
</task>

</tasks>

<verification>
1. `npx vitest run` — all tests green, including the rewritten
   `gridStore.applyTemplate` describe block.
2. `npx tsc --noEmit` — clean.
3. Grep guard: `grep -n "window.confirm" src/components/TemplatesPopover.tsx`
   must return nothing.
4. Grep guard: `grep -n "getAllLeaves" src/components/TemplatesPopover.tsx`
   must return nothing.
</verification>

<success_criteria>
- Template picker applies silently (no confirm dialog).
- Empty grid + template -> still empty (regression-free).
- Grid with K media + template with N leaves -> first min(K,N) leaves get
  the media in DFS order; remaining new leaves stay empty.
- Surplus media (K > N) is fully removed from `mediaRegistry`,
  `mediaTypeMap`, and `thumbnailMap`; blob URLs among the surplus are
  revoked. Kept media URLs are NOT revoked.
- Migrated leaves carry ONLY the `mediaId`. They use the default
  `fit:'cover'`, `objectPosition:'center center'`, `backgroundColor:null`,
  `panX:0`, `panY:0`, `panScale:1` from `createLeaf()`.
- `undo` after `applyTemplate` restores the previous tree (snapshot still
  pushed).
- All vitest tests pass; tsc clean.
</success_criteria>

<output>
After completion, create
`.planning/quick/260407-vth-template-picker-silent-apply-with-media-/260407-vth-SUMMARY.md`
following the standard quick-task summary template.
</output>
