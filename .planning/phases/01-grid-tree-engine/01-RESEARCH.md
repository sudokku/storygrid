# Phase 1: Grid Tree Engine - Research

**Researched:** 2026-04-01
**Domain:** Recursive tree data structures, Zustand 5 + Immer middleware, pure functions, Vitest unit testing
**Confidence:** HIGH

## Summary

Phase 1 is a pure logic/data layer: TypeScript types, pure tree manipulation functions, and two Zustand stores with undo/redo. There is no UI, no rendering, no external service calls. The entire phase is browser-agnostic code that can be exhaustively unit-tested with Vitest in jsdom.

The key architectural challenge is separating the undo-tracked tree (snapshot array of `root: GridNode`) from the media registry (`Record<string, string>`) which must persist across undo/redo and never bloat history snapshots with base64 data URIs. The second design challenge is the "same-direction append" behavior in `splitNode()` — calling split on a leaf whose parent is already a same-direction container must append a sibling rather than nest a new container.

All decisions are locked by CONTEXT.md (integer weights, D-01 through D-07). Research scope is implementation patterns and pitfalls — not alternatives.

**Primary recommendation:** Use Zustand's `create` with `immer` middleware for both stores; implement undo/redo manually in gridStore using a history snapshot array (no temporal middleware needed); keep all tree functions in `src/lib/` as plain TypeScript with zero dependencies except `nanoid`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `ContainerNode.sizes` is an array of integer weights (e.g. `[1, 1]`, `[1, 1, 1]`). Values are arbitrary positive numbers — NOT required to sum to 1.
- **D-02:** Rendering normalizes to flex values at display time: `flex = weight / sum(weights)`. `resizeSiblings()` adjusts the two adjacent weights by a delta; all other siblings are untouched.
- **D-03:** On append (GRID-04 same-direction split), push `1` to sizes — naturally maintains equal weighting with existing siblings.
- **D-04:** `mediaRegistry: Record<string, string>` lives inside gridStore as a top-level field but is excluded from undo/redo history snapshots. History snapshots contain only the tree (`root: GridNode`).
- **D-05:** `structuredClone` snapshots never include `mediaRegistry` — only the tree node hierarchy and `mediaId` strings.
- **D-06:** The app opens with a vertical container holding two empty leaf cells as the default tree state: `{ type: 'container', direction: 'vertical', sizes: [1, 1], children: [leafA, leafB] }`.
- **D-07:** Phase 1 tests go in `src/test/`: `tree-functions.test.ts`, `grid-store.test.ts`, `editor-store.test.ts`.

### Claude's Discretion

- Minimum size clamp for `resizeSiblings()` (e.g. 0.05 minimum weight or pixel threshold) — implement a reasonable default.
- Exact TypeScript discriminated union structure for `GridNode = ContainerNode | LeafNode`.
- History snapshot timing: push on every mutating action (per GRID-12); rapid resize is debounced at the divider level in Phase 2, not here.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRID-01 | TypeScript types defined for GridNode, ContainerNode, LeafNode, MediaItem, SplitDirection | Discriminated union pattern with `type` literal discriminant; place in `src/types/index.ts` |
| GRID-02 | MediaItem stores a `mediaId` string reference; actual data URI lives in a separate `mediaRegistry` outside the undo-tracked tree | Two-field design: `mediaId: string \| null` on LeafNode, `mediaRegistry: Record<string,string>` in store state but excluded from snapshots |
| GRID-03 | Pure tree function `createLeaf()` creates an empty leaf node with a unique ID | nanoid() call; returns `{ type: 'leaf', id, mediaId: null, fit: 'cover' }` |
| GRID-04 | Pure tree function `splitNode()` replaces a leaf with a container holding the original + new empty leaf; if direction matches existing container, appends instead of nesting | Walk up to parent; check `parent.direction === splitDirection`; if match → push child + push `1` to sizes; else replace leaf with new container |
| GRID-05 | Pure tree function `mergeNode()` collapses a container back to a single leaf, preserving first child's media if present | Replace container with first-child leaf; carry `mediaId` if present |
| GRID-06 | Pure tree function `removeNode()` removes a leaf and collapses parent if left with one child | Remove leaf from parent.children + sizes; if parent now has one child, replace parent with that child in grandparent |
| GRID-07 | Pure tree function `resizeSiblings()` updates size fractions on a container's children | Accept `(root, containerId, indexA, delta)`; clamp min weight; return new tree with updated sizes array |
| GRID-08 | Pure tree function `updateLeaf()` immutably updates a leaf's properties | Return new tree with targeted leaf's fields merged |
| GRID-09 | Pure tree functions `findNode()`, `findParent()`, `getAllLeaves()` work correctly at any nesting depth | Recursive DFS traversal; `getAllLeaves` collects only `type === 'leaf'` nodes |
| GRID-10 | All pure tree functions return new tree — never mutate in place | Verified by: return values are new object references; input root reference unchanged after call |
| GRID-11 | Zustand gridStore exposes split/merge/remove/resize/setMedia/updateCell/undo/redo actions | Zustand `create` + `immer` middleware; each mutating action pushes snapshot to history before modifying |
| GRID-12 | Undo/redo uses history snapshot array (structuredClone, capped at 50); media registry excluded from snapshots | Snapshot = `structuredClone({ root })` only; `historyIndex` pointer pattern; `redo` stack cleared on new action |
| GRID-13 | Zustand editorStore manages selectedNodeId, zoom, showSafeZone, tool state | Separate `create` call; no Immer needed (flat state); `useShallow` for derived selectors |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Directive | Details |
|-----------|---------|
| Zustand pinned to ^5.0.12 | v5.0.9 had TypeScript middleware regression; 5.0.12 includes fix |
| `useShallow` not custom equality | Zustand v5 removed custom equality param from `create`; use `useShallow` from `zustand/react/shallow` |
| Immer must be direct dependency | `import { immer } from 'zustand/middleware/immer'` requires `immer` package installed separately |
| nanoid v5 is ESM-only | Use Vitest (ESM-native) — no CJS Jest config; already confirmed in Phase 0 |
| TypeScript pinned to ~5.9.3 | (Project installed 5.9.3; CLAUDE.md says 5.8.x — actual installed version takes precedence) |
| No `enableMapSet()` | State uses plain arrays and objects only; no Map/Set in tree |
| Tailwind v3.4.x only | Not relevant to Phase 1 (no UI) |

---

## Standard Stack

### Core (verified installed in project)

| Library | Installed Version | Purpose | Notes |
|---------|-------------------|---------|-------|
| zustand | 5.0.12 | State management for gridStore + editorStore | `create` from `zustand`; `immer` from `zustand/middleware/immer` |
| immer | 10.2.0 | Immutable update middleware for Zustand | Must be direct dep; already installed |
| nanoid | 5.1.7 | Unique IDs for GridNode.id | ESM-only; Vitest handles this correctly |
| vitest | 2.1.9 | Unit test runner | Already configured in vite.config.ts |
| typescript | ~5.9.3 | Type system | Discriminated unions for GridNode |

### Supporting (already installed, for testing only)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @testing-library/jest-dom | 6.9.1 | DOM matchers (optional for this phase) | Setup in src/test/setup.ts |
| jsdom | 29.0.1 | Vitest test environment | Phase 1 has no DOM usage but Vitest is configured for jsdom |

### No Additional Installs Needed

Phase 1 requires zero new npm installs — all dependencies are already present from Phase 0.

---

## Architecture Patterns

### Type Hierarchy

```typescript
// src/types/index.ts

type SplitDirection = 'horizontal' | 'vertical';

type MediaItem = {
  mediaId: string;           // reference key into mediaRegistry
};

type LeafNode = {
  type: 'leaf';
  id: string;
  mediaId: string | null;    // null = empty cell
  fit: 'cover' | 'contain';
};

type ContainerNode = {
  type: 'container';
  id: string;
  direction: SplitDirection;
  sizes: number[];           // integer weights, e.g. [1, 1, 2]
  children: GridNode[];
};

type GridNode = ContainerNode | LeafNode;
```

**Discriminant:** `node.type === 'leaf'` / `node.type === 'container'` — TypeScript narrows correctly.

### Store Architecture

Two separate stores — not a single monolithic store:

```
gridStore (src/store/index.ts or src/store/gridStore.ts)
  state:
    root: GridNode           -- the tree (snapshot-tracked)
    mediaRegistry: Record<string, string>  -- excluded from snapshots
    history: Array<{ root: GridNode }>     -- structuredClone snapshots
    historyIndex: number     -- points to current position in history
  actions:
    split(nodeId, direction)
    merge(nodeId)
    remove(nodeId)
    resize(containerId, indexA, delta)
    setMedia(nodeId, mediaId)
    updateCell(nodeId, updates)
    undo()
    redo()
    addMedia(mediaId, dataUri)  -- puts data into registry, not tree
    removeMedia(mediaId)

editorStore (src/store/index.ts or src/store/editorStore.ts)
  state:
    selectedNodeId: string | null
    zoom: number             -- 0.5 to 1.5
    showSafeZone: boolean
    activeTool: 'select' | 'split-h' | 'split-v'
  actions:
    setSelectedNode(id)
    setZoom(z)
    toggleSafeZone()
    setActiveTool(tool)
```

### Pattern 1: Zustand + Immer Store Setup

```typescript
// Source: zustand/middleware/immer.d.ts (verified installed)
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

type GridState = { ... };

export const useGridStore = create<GridState>()(
  immer((set, get) => ({
    root: createInitialTree(),
    mediaRegistry: {},
    history: [],
    historyIndex: -1,

    split: (nodeId, direction) => {
      set(state => {
        // push snapshot BEFORE mutation
        const snapshot = structuredClone({ root: state.root });
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(snapshot);
        if (state.history.length > 50) state.history.shift();
        state.historyIndex = state.history.length - 1;
        // now mutate via Immer draft
        state.root = splitNode(current(state.root), nodeId, direction);
      });
    },
    // ... other actions
  }))
);
```

**Critical:** When reading state for pure functions inside `set()`, use Immer's `current()` helper to get a plain object snapshot from the draft. Otherwise you pass an Immer Proxy to pure functions, which may cause unexpected behavior.

```typescript
import { current } from 'immer';
// inside set(state => { ... })
const plainRoot = current(state.root);
state.root = splitNode(plainRoot, nodeId, direction);
```

### Pattern 2: Undo/Redo with historyIndex Pointer

```
History array:    [snap0, snap1, snap2, snap3]
historyIndex:                          ^  (3)

After undo():
  root = history[2].root
  historyIndex = 2

After undo() again:
  root = history[1].root
  historyIndex = 1

After new action (clears redo):
  history = history.slice(0, historyIndex + 1)  // [snap0, snap1]
  push new snapshot
  historyIndex = history.length - 1
```

**Cap at 50:** Use `shift()` to remove oldest when array exceeds 50 after push.

**Initial state:** Push the initial state as `history[0]` at store creation so undo can return to "two empty cells".

### Pattern 3: Same-Direction Append in splitNode()

The core complexity of GRID-04:

```
CASE A: Splitting a leaf whose parent is a different direction (or no parent)
  leaf → container(direction, [original_leaf, new_leaf], [1, 1])

CASE B: Splitting a leaf whose parent is the SAME direction
  parent.children = [...existing, new_leaf]   // append
  parent.sizes = [...existing, 1]             // push 1

CASE C: Splitting the ROOT (which is a leaf, initial state handled differently)
  root = container(direction, [old_root_leaf, new_leaf], [1, 1])
```

Implementation requires `findParent()` before deciding which case applies.

### Pattern 4: Pure Functions in src/lib/

All functions are pure: `(root: GridNode, ...args) => GridNode`. They never mutate. They return new tree objects. Immer's `produce` can optionally be used inside them for ergonomic nested updates, but since they're called from within a Zustand/Immer `set()` callback, it's cleaner to keep them as plain recursive functions that return new objects via spread.

```typescript
// Pattern: recursive tree walk returning new references
function mapNode(root: GridNode, id: string, updater: (node: GridNode) => GridNode): GridNode {
  if (root.id === id) return updater(root);
  if (root.type === 'container') {
    return {
      ...root,
      children: root.children.map(child => mapNode(child, id, updater)),
    };
  }
  return root;
}
```

### Recommended Project Structure

The placeholders already exist. Fill in order:

```
src/
├── types/
│   └── index.ts        -- GridNode, ContainerNode, LeafNode, MediaItem, SplitDirection
├── lib/
│   └── index.ts        -- pure tree functions (all exported named functions)
├── store/
│   └── index.ts        -- useGridStore + useEditorStore (or split into two files)
└── test/
    ├── tree-functions.test.ts  -- pure function unit tests (GRID-03..10)
    ├── grid-store.test.ts      -- store actions + undo/redo (GRID-11, 12)
    └── editor-store.test.ts    -- editorStore state (GRID-13)
```

### Anti-Patterns to Avoid

- **Snapshot inside Immer draft without `current()`:** Passing an Immer Draft proxy to `structuredClone()` will throw or produce proxy artifacts. Always call `current(state.root)` before cloning.
- **Including `mediaRegistry` in snapshots:** Snapshots must be `structuredClone({ root: state.root })` only — never `structuredClone(state)`.
- **Mutating input in pure functions:** Each function must return a new reference. Verify in tests: `const newRoot = fn(root, ...); expect(newRoot).not.toBe(root)`.
- **Functions on the store state object:** `structuredClone` throws on functions. Store state must be strictly serializable (plain data + Immer handles mutations via `set`).
- **`enableMapSet()` without need:** Adds bundle weight. State uses arrays and plain objects only.
- **Storing data URIs as `mediaId`:** `mediaId` is a nanoid string key. The URI lives only in `mediaRegistry`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique node IDs | Custom ID generator | `nanoid()` | Collision-free, URL-safe, 21-char, ESM-native |
| Immutable draft updates inside store | Manual spread all the way down | Immer middleware `set(draft => { draft.root... })` | Deep tree mutations are error-prone without Immer |
| Shallow comparison for store selectors | Custom equality function | `useShallow` from `zustand/react/shallow` | Zustand v5 removed custom equality from `create`; `useShallow` is the official replacement |

**Key insight:** The tree manipulation functions themselves should NOT use Immer internally. They are pure functions called from within the store's `set()` callback, which is already inside an Immer produce context. Mixing produce contexts adds complexity.

---

## Common Pitfalls

### Pitfall 1: Passing Immer Draft to structuredClone()

**What goes wrong:** Inside `set(state => { ... })`, `state.root` is an Immer Proxy (Draft). Calling `structuredClone(state.root)` on a Draft may throw or silently produce wrong results depending on the Immer version.

**Why it happens:** Immer wraps the state in a Proxy for change tracking. `structuredClone` doesn't know how to serialize Proxy objects.

**How to avoid:** Call `import { current } from 'immer'` and use `current(state.root)` to get a plain object snapshot before cloning:
```typescript
const plainRoot = current(state.root);
const snapshot = structuredClone({ root: plainRoot });
```

**Warning signs:** `DataCloneError` thrown in tests, or history snapshots containing empty objects.

### Pitfall 2: structuredClone Throws on Non-Serializable Values

**What goes wrong:** If the store state ever has a function, Symbol, or class instance, `structuredClone` throws `DataCloneError`.

**Why it happens:** `structuredClone` only handles structured-serializable types.

**How to avoid:** Keep all tree node properties to plain serializable types: string, number, boolean, null, arrays, plain objects. No methods on node objects.

**Warning signs:** `DataCloneError: ... could not be cloned` in test output.

### Pitfall 3: Redo Stack Not Cleared on New Action

**What goes wrong:** After undo, user makes a new action, then presses redo — reaching a "future" state that should no longer exist.

**Why it happens:** History array not trimmed to `historyIndex + 1` before pushing new snapshot.

**How to avoid:** At the start of every mutating action:
```typescript
state.history = state.history.slice(0, state.historyIndex + 1);
```

### Pitfall 4: splitNode() Nesting Instead of Appending

**What goes wrong:** Splitting a leaf that's already a child of a same-direction container creates a nested container instead of appending a sibling. Result: `[1, 1]` weights but the user expected three equal columns.

**Why it happens:** `splitNode` checks only the leaf itself, not its parent.

**How to avoid:** `splitNode` must receive `root` (to traverse) and call `findParent(root, nodeId)` to check parent direction before deciding case A vs B.

### Pitfall 5: getAllLeaves() Missing Deep Nodes

**What goes wrong:** `getAllLeaves` returns leaves at depth 1 but misses leaves inside nested containers.

**Why it happens:** Non-recursive traversal or early return in recursion.

**How to avoid:** Use a recursive DFS that never returns early from a container node. Test with a tree at 3+ levels of nesting.

### Pitfall 6: Snapshot at Wrong Time (After Mutation)

**What goes wrong:** History snapshot is taken after the mutation, so undo restores the already-mutated state.

**Why it happens:** `structuredClone` called after `state.root = splitNode(...)`.

**How to avoid:** Snapshot is always taken BEFORE any mutation inside the `set()` callback.

---

## Code Examples

Verified patterns from installed packages and official APIs:

### Zustand v5 Store with Immer Middleware

```typescript
// Source: verified against node_modules/zustand/middleware/immer.d.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';

export const useGridStore = create<GridStoreState>()(
  immer((set, get) => ({
    root: buildInitialTree(),
    mediaRegistry: {} as Record<string, string>,
    history: [] as Array<{ root: GridNode }>,
    historyIndex: -1,

    split: (nodeId: string, direction: SplitDirection) =>
      set(state => {
        // 1. snapshot BEFORE mutation (use current() to unwrap Draft)
        const snap = structuredClone({ root: current(state.root) });
        // 2. clear redo stack
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(snap);
        if (state.history.length > 50) state.history.shift();
        state.historyIndex = state.history.length - 1;
        // 3. apply mutation (pure fn returns new tree; assign to draft prop)
        state.root = splitNode(current(state.root), nodeId, direction);
      }),

    undo: () =>
      set(state => {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        state.root = structuredClone(state.history[state.historyIndex].root);
      }),

    redo: () =>
      set(state => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        state.root = structuredClone(state.history[state.historyIndex].root);
      }),
  }))
);
```

### editorStore (flat state, no Immer needed)

```typescript
// Source: zustand/react.d.ts (verified installed)
import { create } from 'zustand';

type EditorState = {
  selectedNodeId: string | null;
  zoom: number;
  showSafeZone: boolean;
  activeTool: 'select' | 'split-h' | 'split-v';
  setSelectedNode: (id: string | null) => void;
  setZoom: (z: number) => void;
  toggleSafeZone: () => void;
  setActiveTool: (tool: EditorState['activeTool']) => void;
};

export const useEditorStore = create<EditorState>()(set => ({
  selectedNodeId: null,
  zoom: 1,
  showSafeZone: false,
  activeTool: 'select',
  setSelectedNode: id => set({ selectedNodeId: id }),
  setZoom: z => set({ zoom: Math.min(1.5, Math.max(0.5, z)) }),
  toggleSafeZone: () => set(s => ({ showSafeZone: !s.showSafeZone })),
  setActiveTool: tool => set({ activeTool: tool }),
}));
```

### useShallow for Derived Selectors (Phase 2 reference)

```typescript
// Source: verified node_modules/zustand/react/shallow.d.ts
import { useShallow } from 'zustand/react/shallow';

// Select multiple fields without triggering re-render for unrelated changes:
const { zoom, showSafeZone } = useEditorStore(
  useShallow(s => ({ zoom: s.zoom, showSafeZone: s.showSafeZone }))
);
```

### Recursive Tree Walk Pattern (pure function)

```typescript
// Pure function — no Immer, no side effects
function findNode(root: GridNode, id: string): GridNode | null {
  if (root.id === id) return root;
  if (root.type === 'container') {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function getAllLeaves(root: GridNode): LeafNode[] {
  if (root.type === 'leaf') return [root];
  return root.children.flatMap(getAllLeaves);
}
```

### Initial Tree Builder (D-06)

```typescript
import { nanoid } from 'nanoid';

function createLeaf(): LeafNode {
  return { type: 'leaf', id: nanoid(), mediaId: null, fit: 'cover' };
}

function buildInitialTree(): GridNode {
  return {
    type: 'container',
    id: nanoid(),
    direction: 'vertical',
    sizes: [1, 1],
    children: [createLeaf(), createLeaf()],
  };
}
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 1 is pure TypeScript code + Zustand stores. No external services, CLI tools, databases, or runtimes beyond Node.js (v22.22.2, confirmed). All dependencies are already installed in node_modules.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vite.config.ts` (test section present, verified) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |
| Watch mode | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRID-01 | Types export correctly (GridNode, ContainerNode, LeafNode, MediaItem, SplitDirection) | unit/type | `npm test -- --run src/test/tree-functions.test.ts` | Wave 0 |
| GRID-02 | LeafNode.mediaId is string or null; no data URI in tree | unit | same | Wave 0 |
| GRID-03 | `createLeaf()` returns leaf with unique id, null mediaId | unit | same | Wave 0 |
| GRID-04 | `splitNode()` creates container on cross-direction split; appends on same-direction | unit | same | Wave 0 |
| GRID-05 | `mergeNode()` collapses container; first child mediaId preserved | unit | same | Wave 0 |
| GRID-06 | `removeNode()` removes leaf; collapses parent with one child | unit | same | Wave 0 |
| GRID-07 | `resizeSiblings()` updates weights; clamps minimum | unit | same | Wave 0 |
| GRID-08 | `updateLeaf()` returns new tree with updated leaf; input unchanged | unit | same | Wave 0 |
| GRID-09 | `getAllLeaves()` returns all leaves at any depth, no duplicates | unit | same | Wave 0 |
| GRID-10 | All pure functions: input root reference unchanged after call | unit | same | Wave 0 |
| GRID-11 | gridStore: split/merge/remove/resize/setMedia/updateCell/undo/redo actions exist and work | unit | `npm test -- --run src/test/grid-store.test.ts` | Wave 0 |
| GRID-12 | Undo/redo: history capped at 50; mediaRegistry excluded from snapshots; redo cleared on new action | unit | same | Wave 0 |
| GRID-13 | editorStore: selectedNodeId, zoom, showSafeZone, activeTool managed correctly | unit | `npm test -- --run src/test/editor-store.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All three test files are new — none exist yet:

- [ ] `src/test/tree-functions.test.ts` — covers GRID-01 through GRID-10 (pure function tests)
- [ ] `src/test/grid-store.test.ts` — covers GRID-11, GRID-12 (store + undo/redo)
- [ ] `src/test/editor-store.test.ts` — covers GRID-13 (editor state)

Note: `src/test/setup.ts` already exists and is configured in Vitest. No framework changes needed.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Zustand v4 custom equality in `create` | Zustand v5 `useShallow` from `zustand/react/shallow` | Must import `useShallow` explicitly; no `create(fn, eq)` signature |
| `temporal` middleware (zundo) for undo/redo | Manual history snapshot array in store state | Simpler; no extra dependency; full control over snapshot timing and what's included |
| Immer `produce` inside pure functions | Spread + map inside pure functions (Immer-free) | Cleaner separation: Immer is the store's tool, pure functions are framework-agnostic |

---

## Open Questions

1. **Minimum resize clamp value (Claude's discretion)**
   - What we know: D-02 says `resizeSiblings()` adjusts two adjacent weights; no minimum specified.
   - What's unclear: Whether 0.05 (5% of parent) or a pixel-threshold minimum is more appropriate for Phase 2 rendering.
   - Recommendation: Implement a minimum weight of `0.1` (10% of sum). This prevents cells from becoming invisibly thin and is safely overrideable by Phase 2 if needed. Document as a named constant `MIN_CELL_WEIGHT = 0.1`.

2. **Vitest store isolation between tests**
   - What we know: Zustand stores are module-level singletons.
   - What's unclear: Whether Vitest test isolation resets the store between tests automatically.
   - Recommendation: Call `useGridStore.setState(initialState, true)` in a `beforeEach()` to force-reset the store to the initial state before each test. The second argument `true` replaces the entire state (not merge). This is the Zustand-documented approach for test isolation.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/zustand/middleware/immer.d.ts` — Immer middleware type signature verified locally
- `node_modules/zustand/react.d.ts` — `create`, `UseBoundStore` API verified locally
- `node_modules/zustand/react/shallow.d.ts` — `useShallow` signature verified locally
- `node_modules/immer/package.json` — version 10.2.0 confirmed installed
- `node_modules/nanoid/package.json` — version 5.1.7, ESM-only confirmed
- `node_modules/vitest/package.json` — version 2.1.9 confirmed
- `vite.config.ts` — Vitest jsdom environment + globals confirmed

### Secondary (MEDIUM confidence)
- CLAUDE.md §Zustand 5.0.x — `useShallow` note, TypeScript regression in v5.0.9
- CLAUDE.md §Immer 10.x — direct dep required, snapshot timing guidance
- Runtime verification: `node -e "structuredClone({fn: ()=>{}}"` → confirmed throws on functions

### Tertiary (LOW confidence)
- None — all claims verified against installed packages or official project documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified locally as installed
- Architecture: HIGH — patterns derived from actual type signatures in node_modules
- Pitfalls: HIGH — structuredClone behavior verified by running Node.js directly; Immer Draft/current() pattern is documented Immer behavior

**Research date:** 2026-04-01
**Valid until:** 2026-07-01 (stable libraries; Zustand/Immer APIs are stable)
