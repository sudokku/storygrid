# Phase 9: Improve Cell Movement and Swapping - Research

**Researched:** 2026-04-08
**Domain:** Tree mutation / drag-and-drop UX / React overlay rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Five drop zones per target cell — thin edge bands (~20% short dimension) + large center (~60%). Exact thresholds are Claude's discretion (must enforce minimum pixel band for small cells).
- **D-02:** Visual feedback — thick accent-blue insertion line (`#3b82f6`, ~4px) on active edge; swap overlay (swap icon + dimmed tint) on center. Only one zone highlighted at a time. Overlays render above media and respect canvas scale.
- **D-03:** Inserted cell size after edge-drop: 50/50 split. Dragged cell's original size weight is discarded.
- **D-04:** New atomic action `moveCell(fromId, toId, edge)` in `gridStore`. Single `pushSnapshot` → single undo entry. `edge === 'center'` short-circuits to `swapLeafContent`. Any other edge calls `moveLeafToEdge`. No-op if `fromId === toId`, either id is not a leaf, or move would produce same structure.
- **D-05:** `moveLeafToEdge(root, fromId, toId, edge)` is a pure function (no Immer). Must: (1) split target at edge direction; (2) remove source leaf; (3) collapse-upward if source parent left with 1 child (remaining child inherits parent's size weight in grandparent). Implementation hint: compute new subtree with target split first, then remap tree in one pass.
- **D-06:** Source leaf identity is discarded — new `nanoid()` id for the inserted cell. Content (mediaId, fit, backgroundColor, panX/Y/Scale) is what moves.
- **D-07:** Edge cases EC-01..EC-12 must be enumerated by research (see below).
- **D-08:** Research must produce: (1) tree primitive reuse matrix, (2) complete edge-case table.
- **D-09:** Phase 9 runs directly on `main` branch — no worktree, no feature branch.

### Claude's Discretion

- Exact pixel/percentage thresholds for edge band vs. center zone (D-01)
- Exact insertion-line thickness and inset (D-02)
- Mechanism for canvas-scale-stable insertion line (`scale(1/canvasScale)` transform vs. raw CSS pixels)
- Whether `moveLeafToEdge` is composition of existing primitives or single-pass `mapNode` rewrite
- Whether `selectedNodeId` follows moved cell's new id after `moveCell`

### Deferred Ideas (OUT OF SCOPE)

- Touch support for cell move/swap
- Drag-to-reorder siblings within a container without topology change
- Visual ghost/preview of dragged cell as floating thumbnail
- Multi-cell selection and bulk move
- Keyboard-based cell movement
</user_constraints>

---

## Summary

Phase 9 adds a "move cell" interaction on top of the existing cell-swap drag system. The user drags a cell via the ActionBar grip handle, hovers over another cell, and sees 5 drop zones: center (existing swap behavior) and 4 edges (split-insert + remove-from-source + collapse-upward). The core work is a new pure tree primitive `moveLeafToEdge` in `src/lib/tree.ts` and a new store action `moveCell` in `gridStore.ts`. The UI changes extend `LeafNode.tsx` to detect which zone the cursor is over during `dragover` and render the appropriate overlay.

The tree is **n-ary** — containers can have 2, 3, or more children (confirmed: `splitNode` Case B appends to existing parent when direction matches; `'3-row'` template has 3 children; `'mosaic'` template has a 3-child row). This matters critically for the collapse-upward rule and size normalization.

**Primary recommendation:** Implement `moveLeafToEdge` as a **single-pass tree rewrite** using a custom recursive walk (not a composition of `splitNode` + `removeNode`), because both operations touch potentially overlapping parts of the tree (source and target may share a parent), and the existing `splitNode` Case B appends to an existing parent rather than always wrapping — which creates an uncontrolled topology change that is not wanted here. The single-pass approach avoids double-traversal and stale-ref risks.

---

## Project Constraints (from CLAUDE.md)

- **Tech Stack (locked):** Vite 8 + React 18 + TypeScript 5.8 + Zustand 5 + Immer 10 + Tailwind v3
- **Pure tree functions** use spread+map recursion, no Immer — `moveLeafToEdge` must follow this convention
- **`mapNode` is the universal tree rewrite primitive** per Phase 1 decision
- **`current()` from Immer** must wrap Draft before calling pure tree functions in store actions
- **`pushSnapshot` helper** centralizes history management — `moveCell` uses it exactly once before mutation
- **`nanoid` v5** is ESM-only; used for new leaf ids via `createLeaf()` — no special handling needed in Vitest
- **Native HTML5 drag** (not dnd-kit) for cell-to-cell drag — no change to drag source side
- **Desktop-only** per `adr-cell-swap-touch.md` — touch deferred, still binding
- **`MIN_CELL_WEIGHT = 0.1`** — size floors must hold after any collapse/redistribution

---

## Tree Primitive Reuse Matrix (D-08.1)

Every structure-mutating function in `src/lib/tree.ts`, verified by direct code inspection:

| Function | Signature | What It Does | Invariants | Reusable for `moveLeafToEdge`? | How |
|----------|-----------|-------------|------------|-------------------------------|-----|
| `mapNode` | `(root, id, updater) => GridNode` | DFS walk; replaces node matching `id` with `updater(node)` result. Returns new tree. | Purely functional; does not recurse into the replacement node returned by updater. | YES — core primitive | Used to replace `toId` with its split result and to collapse source parent in a single traversal if combined carefully. Limitation: replaces only one node per call, so two separate calls are needed for the two mutations. |
| `findNode` | `(root, id) => GridNode \| null` | DFS find by id. | Read-only. | YES — query | Find source leaf to extract its content before mutation. |
| `findParent` | `(root, childId) => ContainerNode \| null` | DFS parent lookup. | Read-only. Returns null if root or not found. | YES — query | Find source parent to determine collapse-upward eligibility. |
| `getAllLeaves` | `(root) => LeafNode[]` | DFS collect all leaves. | Read-only. | NO | Not needed for move. |
| `createLeaf` | `() => LeafNode` | Constructs empty leaf with nanoid id. | Always new id. | YES — factory | The new leaf at the target edge is created via `createLeaf()` then `updateLeaf()`-style merge of source content. |
| `splitNode` | `(root, nodeId, direction) => GridNode` | 3-case split: A=wrap root, B=append to same-direction parent, C=wrap in new container. | CRITICAL: Case B appends a new empty leaf to the existing parent — it does NOT insert the dragged cell. Direction determines the case, not the caller. Sizes use raw `1` weights. | PARTIALLY — NOT directly composable | `splitNode` Case B changes tree topology in a way that doesn't control WHERE the dragged cell goes. `moveLeafToEdge` needs explicit 50/50 wrapping (always Case C semantics), so it must inline the container-wrap logic rather than calling `splitNode`. |
| `mergeNode` | `(root, containerId) => GridNode` | Collapses container to its first child only. | Discards all children except `children[0]`. | NO | `mergeNode` is a user-facing action (the "merge" button). The collapse-upward in `moveLeafToEdge` must preserve the single remaining child regardless of index — not necessarily index 0. Do NOT call `mergeNode`. |
| `removeNode` | `(root, nodeId) => GridNode` | Removes a leaf/node. If parent left with 1 child, collapses parent to that child (inheriting grandparent slot). If root is target, returns unchanged. | Correctly handles n-ary: removes by index, collapses only when 1 child remains. Size array filtered parallel to children array. | PARTIALLY reusable — see recommendation below | The collapse logic in `removeNode` is exactly what the "remove source + collapse-upward" step needs. However, calling `removeNode` on a result that already had the target split may fail to find `fromId` if source and target shared a parent that was restructured. Safe only if source and target are in disjoint subtrees. |
| `resizeSiblings` | `(root, containerId, index, delta) => GridNode` | Adjusts two adjacent sibling weights by delta; clamps to `MIN_CELL_WEIGHT`. | Only adjusts adjacent pair. | NO | Not needed for move. |
| `updateLeaf` | `(root, nodeId, updates) => GridNode` | Immutable partial update of leaf fields. Uses `mapNode`. | Applies only to leaf types. | YES — content copy | Copy source content fields onto the new leaf at the target edge. |
| `swapLeafContent` | `(root, idA, idB) => GridNode` | Swaps content between two leaves via two `updateLeaf` calls. | No-op if either not found or not leaf. | YES — verbatim for center edge | `moveCell` with `edge === 'center'` calls `swapLeafContent` unchanged. |
| `buildTemplate` | `(name) => GridNode` | Factory for preset trees. | — | NO | |
| `buildInitialTree` | `() => GridNode` | Factory for 2-leaf vertical root. | — | NO | |

### Recommendation: Single-Pass Custom Walk for `moveLeafToEdge`

**Reasoning against composition of `splitNode` + `removeNode`:**

1. `splitNode` Case B (same-direction append) would trigger when source and target share a same-direction parent — it appends a new empty leaf rather than inserting the source's content, and appends at the end rather than at the edge position. The move operation requires wrapping the target in a new container with controlled child order (source first or second based on top/left vs. bottom/right). Case B is categorically wrong.

2. `splitNode` always creates a `createLeaf()` (empty leaf) as the sibling. Content migration would require a subsequent `updateLeaf` call using the source content captured before removal.

3. After `splitNode` modifies the target's parent (Case B) or wraps the target in a new container (Case C), calling `removeNode(fromId)` is safe only if `fromId` still exists in the tree. If source and target share a parent, `splitNode` Case B already added a child to that parent — `fromId` is still there, so `removeNode` would find it. Case C wraps target into a new nested container — `fromId` still exists in its original location. This path could technically work.

4. However: `removeNode`'s collapse rule promotes the surviving child to the grandparent slot and inherits the parent's size weight in grandparent. This is exactly right for the move semantics. The risk is `removeNode` does not know the grandparent's sizes array index — it does a DFS parent lookup internally, which is correct.

5. **The real blocker for composition:** `splitNode` Case B must be avoided. The `moveLeafToEdge` function needs to ALWAYS use "wrap target in new container" semantics (like Case C), regardless of what direction the parent has. Otherwise the topology is wrong. But `splitNode` Case C only triggers when parent direction differs from split direction. If parent direction matches, Case B fires. There is no way to force Case C from the outside.

**Verdict:** Write `moveLeafToEdge` as a custom pure recursive function. It should:
1. Capture source content from `findNode(root, fromId)` before any mutation.
2. Do a single DFS tree walk (similar to `mapNode` but with two simultaneous replacements):
   - When visiting `toId`: replace with a new container wrapping `{newLeafWithSourceContent, toNode}` (ordered by edge: top/left puts source first, bottom/right puts source second). New container gets direction based on edge (top/bottom → vertical, left/right → horizontal) and sizes [1, 1].
   - When visiting `fromId`: remove it from its parent's children and sizes arrays. If the parent is left with 1 child, return the child directly (collapse-upward); the child inherits the parent's position in its grandparent (this is handled automatically because the recursive call returns the child as the replacement for the parent slot).
3. The implementation approach: a recursive helper `rewriteTree(node, fromId, toId, sourceContent, direction)` that returns `[newNode, sourceWasRemoved]` or similar signaling. Alternatively, do it in two named passes using `mapNode` twice — the split-insert pass and the remove-collapse pass — which is safe as long as we use the source content captured before the first pass.

**Safest two-pass approach using existing primitives:**
```
Pass 1: mapNode(root, toId, targetNode => newContainerWrappingTargetAndNewLeaf)
Pass 2: removeNode(pass1Result, fromId)  // removeNode handles collapse-upward correctly
```
This is safe because `fromId` is preserved through Pass 1 (Pass 1 only touches `toId`'s subtree). Pass 2's collapse logic in `removeNode` is verified correct for n-ary trees. **Recommended.**

The only wrinkle: the new leaf (inserted at the edge) must carry the source content, not be empty. So Pass 1 inserts `{...createLeaf(), ...sourceContentFields}` as the new sibling, not a blank `createLeaf()`.

---

## N-ary Tree Structure

**Confirmed n-ary (not binary):** `ContainerNode.children: GridNode[]` and `sizes: number[]` are arrays of arbitrary length. Evidence:
- `splitNode` Case B appends to existing parent: `children: [...p.children, createLeaf()], sizes: [...p.sizes, 1]` — supports 3+ children.
- `buildTemplate('3-row')` creates a container with 3 leaf children and `sizes: [1, 1, 1]`.
- `buildTemplate('mosaic')` creates a top-level container with a 3-child horizontal row.
- `removeNode` removes by index and filters `sizes` in parallel: `parent.children.filter(...)` + `parent.sizes.filter(...)` — correctly handles n-ary.

**Implication for collapse-upward rule:**
- "Exactly 1 child remaining" is the trigger. With n-ary trees, this happens only when the parent had exactly 2 children before the remove. A parent with 3+ children losing 1 child stays a container (EC-01 applies).
- `removeNode` already implements this correctly: `if (newChildren.length === 1)` → collapse to only child.
- No changes needed to the collapse rule — it's naturally n-ary correct.

**Implication for size normalization:**
- `removeNode` filters `sizes` by index in parallel with `children`. When a 3-child container loses 1 child, the resulting sizes array has 2 entries — no renormalization to sum-to-1 or sum-to-N is performed. The raw weight values of the remaining entries are preserved.
- `splitNode` Case B appends `1` to `sizes`, maintaining the "equal weight" default but not renormalizing existing entries.
- **Conclusion:** `moveLeafToEdge` should NOT renormalize the source parent's sizes after removal — just filter by index (same as `removeNode`). The new container at the target always gets `sizes: [1, 1]` (50/50 per D-03). MIN_CELL_WEIGHT floor does not apply to the new container's sizes (both start at 1). MIN_CELL_WEIGHT only binds during resize operations (`resizeSiblings`).

---

## Size Weight Handling

### After remove from source parent
- Filter `sizes` in parallel with `children` (same index). No renormalization.
- The remaining siblings' weights are preserved as-is. Total weight sum changes, but that's fine — the renderer normalizes via fractional layout.

### After insert at target
- New container at `toId`'s slot gets `sizes: [1, 1]` (50/50).
- The `toId`'s parent's sizes array is NOT changed — the new container occupies the same slot and inherits the same weight value from the grandparent's perspective.

### MIN_CELL_WEIGHT floor
- `MIN_CELL_WEIGHT = 0.1` is only enforced in `resizeSiblings`. It is NOT enforced in `splitNode`, `removeNode`, or any other structural mutation.
- After a move, the weights in the source parent may have values like `[0.3, 0.7]` remaining after filtering out a `[1.0]` sibling (in a 3-sibling context). These are valid as long as the user doesn't resize them below 0.1.
- EC-08 (MIN_CELL_WEIGHT must hold after collapse) is satisfied by the existing design: collapse-upward removes the container, so there's no size floor to violate. The remaining child inherits the grandparent slot's weight, which was already valid.

---

## `handleDragOver` Throttle / Debounce Analysis

**Current code** (`LeafNode.tsx:414-419`):
```typescript
const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  const isCellDrag = Array.from(e.dataTransfer.types).includes('text/cell-id');
  e.dataTransfer.dropEffect = isCellDrag ? 'move' : 'copy';
  setIsDragOver(true);
}, []);
```

**No throttle or debounce.** The handler fires on every `dragover` event (browser fires at ~50ms intervals during drag).

**Performance concern for 5-zone detection:**
- The 5-zone logic requires a `getBoundingClientRect()` call per `dragover` event to compute cursor position relative to the cell.
- `getBoundingClientRect()` is synchronous and causes layout but is cheap for a single element (~0.1ms).
- With max ~20 cells, at most 1 cell fires `dragover` at a time (the one under the cursor).
- **Verdict: No throttle needed.** 20 cells × 1 active dragover × trivial math = negligible. The current codebase has no debounce and does not need one.
- The `setIsDragOver(true)` call on every event is idempotent (no extra renders when state doesn't change in React). The new `setActiveZone` state will similarly be idempotent when the zone doesn't change.

---

## Canvas-Scale-Stable Overlay Rendering

### How ActionBar achieves scale stability (Phase 7 pattern)

From `LeafNode.tsx:608-618`:
```tsx
<div
  className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 z-50"
  data-testid={`action-bar-wrapper-${id}`}
>
  <ActionBar ... />
</div>
```

The ActionBar wrapper itself has no `transform: scale(...)` in `LeafNode`. Looking at the Phase 7 context and STATE.md:
> "ICON_SIZE kept at 16 in ActionBar — scale(1/canvasScale) transform handles physical stability"

From Phase 7 decisions, the `scale(1/canvasScale)` is applied to the **ActionBar container div** inside `LeafNode`. The `canvasScale` is read from `editorStore`. The canvas surface itself is scaled by `scale(${finalScale})` in `CanvasWrapper`. Children of the canvas surface inherit this scale. The `scale(1/canvasScale)` counter-transform on the ActionBar wrapper restores physical pixel size.

**The ActionBar wrapper in `LeafNode.tsx` currently does NOT have an explicit scale transform visible in the code.** Let me verify — the `data-testid="action-bar-wrapper-{id}"` div at line 609 has only `absolute top-2 left-1/2 -translate-x-1/2 z-50` classes. However, `canvasScale` is read in `LeafNode` via `useEditorStore(s => s.canvasScale)` — wait, it's NOT subscribed in the current `LeafNode.tsx`. The `canvasScale` is subscribed in `CanvasWrapper` and stored via `setCanvasScale`. The `LeafNode` does not currently read `canvasScale`.

**Actual mechanism for scale-stability:** The `CanvasWrapper` applies `transform: scale(${finalScale})` to the canvas surface div. Everything rendered inside (including ActionBar) is scaled. The ActionBar appears stable in physical size because the canvas surface is always fitted to the viewport — the user perceives it at a consistent size relative to the viewport. The `scale(1/canvasScale)` counter-transform mentioned in the decisions and STATE.md is the **intended pattern** for the ActionBar, but examining the current `LeafNode.tsx` code, this transform is applied inline via a `style` attribute — not via Tailwind class — on the action-bar-wrapper div. Wait: the STATE.md entry says:
> "ICON_SIZE kept at 16 in ActionBar — scale(1/canvasScale) transform handles physical stability; clamp() on button container is sufficient (D-05)"

This implies the ActionBar wrapper div DOES have the counter-transform. But looking at `LeafNode.tsx:608` the div only has Tailwind classes. The `style` attribute is not shown in these classes. The `clamp()` sizing in the ActionBar's `btnClass` (`w-16 h-16`) combined with the canvas scale means the buttons appear different sizes depending on zoom level.

**Resolution:** The `scale(1/canvasScale)` pattern described in STATE.md is the Phase 7 intended design. Looking at the actual `ActionBar.tsx`, there is no counter-transform on the ActionBar itself — `ICON_SIZE = 32` and `w-16 h-16` buttons. The canvas is scaled externally, so the ActionBar just renders at canvas-native size. Because the canvas fills the viewport at a ~constant perceived size, the ActionBar visually appears stable.

**Implication for Phase 9 overlays:**
- The insertion line and swap overlay render INSIDE the canvas surface (inside `LeafNode`), so they are subject to the canvas scale transform.
- If rendered as absolute `<div>` elements with fixed CSS pixel widths (e.g., `4px` thick line), they will appear thinner/thicker as the user zooms the canvas.
- **Recommended approach:** Render the insertion line as an absolutely positioned `<div>` with a `style={{ transform: `scale(${1/canvasScale})`, ... }}` counter-transform applied only to the line thickness dimension. Alternatively, express the line as a fraction of the cell (e.g., `min(4px, 0.5%)`) and accept minor visual variation — the insertion line only needs to be visible, not pixel-perfect.
- **Simplest viable approach:** Use `style={{ [isTop/Bottom ? 'height' : 'width']: `${4 / canvasScale}px` }}` to compute the physical pixel equivalent at runtime. This requires subscribing to `canvasScale` in `LeafNode`. Alternatively, use the same `scale(1/canvasScale)` wrapper approach as ActionBar.
- `canvasScale` is available from `useEditorStore(s => s.canvasScale)` — add this subscription to `LeafNode`.

---

## Drag Type Coexistence (Phase 8 D-15)

**Current `handleDrop`** (`LeafNode.tsx:425-452`):
```typescript
const fromId = e.dataTransfer.getData('text/cell-id');
if (fromId && fromId !== id) {
  swapCells(fromId, id);
  return;  // early return — file drop path not reached
}
// File drop fallback
const files = Array.from(e.dataTransfer.files);
```

**Current `handleDragOver`** (`LeafNode.tsx:414-419`):
```typescript
const isCellDrag = Array.from(e.dataTransfer.types).includes('text/cell-id');
e.dataTransfer.dropEffect = isCellDrag ? 'move' : 'copy';
setIsDragOver(true);
```

**Phase 8 workspace ring** activates only when `dataTransfer.types` includes `'Files'` (D-15). A `text/cell-id` drag does NOT include `'Files'`, so the workspace ring does NOT activate during cell-to-cell drags.

**Phase 9 5-zone logic activates only for `text/cell-id` drags.** The `dragover` handler must check for `text/cell-id` before computing zone, and only set `activeZone` state (for overlay rendering) when `isCellDrag === true`. File drags keep the existing `isDragOver` (full ring) behavior.

**Confirmed: no MIME type change needed.** `text/cell-id` is already the convention and is respected by Phase 8's workspace drop filter. Phase 9 extends the same convention.

---

## ActionBar `hasMedia` Gate (EC-06)

**Current behavior** (`ActionBar.tsx:61-75`):
```tsx
{hasMedia && (
  <button draggable onDragStart={...} aria-label="Drag to swap" ...>
    <GripVertical />
  </button>
)}
```

The drag handle only renders when `hasMedia=true`.

**EC-06 asks:** Should empty cells be movable in Phase 9?

**Analysis:**
- The existing test `phase05-p02-cell-swap.test.ts` explicitly tests "does NOT render drag handle button when hasMedia=false" and asserts `queryByTestId('drag-handle-leaf-1')` is `null`.
- If the gate is relaxed, this test must be updated or removed.
- No other test file references `drag-handle-*` directly.
- The `swapCells` action (center drop) works on empty cells — `swapLeafContent` has no media check. It just swaps `mediaId: null` with another `mediaId: null`, which is a no-op in terms of visible content but still pushes a history entry.
- **Recommended:** Relax the gate for Phase 9 (empty cells are movable). The ActionBar renders the drag handle regardless of `hasMedia`. Update `aria-label` from "Drag to swap" to "Drag to move" since Phase 9 is primarily about moving. The Phase 5 test that asserts no handle when `hasMedia=false` must be updated to expect the handle always present.
- **Side effects:** The keyboard handler tests do not reference the drag handle. The `action-bar.test.tsx` may reference it — planner must check and update.

---

## `selectedNodeId` Follow-Through (D-06 consequence)

**Current behavior:** `selectedNodeId` is set to a leaf's `id` when the user clicks it. After `moveCell`, the source leaf's id is discarded (a new id is created). The selection in `editorStore.selectedNodeId` now points to a non-existent node.

**Effect:** `LeafNode` renders `null` if `findNode(state.root, id)` returns null. The `SelectedCellPanel` in `Sidebar.tsx` reads `selectedNodeId` from `editorStore` and renders the selected cell's properties. If `selectedNodeId` is stale, it would show no panel (or the previous cell's panel if `findNode` returns null and the panel checks for null).

**Recommended:** After `moveCell`, the store action should call `useEditorStore.getState().setSelectedNode(newLeafId)` to follow the moved cell. The `newLeafId` is the id of the freshly created leaf at the target edge. However, `gridStore` actions do not normally call `editorStore` setters directly (separation of concerns). The recommended pattern is either:
1. Return the `newLeafId` from `moveCell` and have `LeafNode.handleDrop` call `setSelectedNode(newLeafId)` after the action.
2. Have `moveCell` call `useEditorStore.getState().setSelectedNode(newLeafId)` directly — this is how `LeafNode` handles pan mode currently (calls `useEditorStore.getState().setPanModeNodeId` from within Zustand subscribe callbacks).

Option 1 is cleaner (no cross-store call inside an action). `gridStore` actions currently return `void` (the `set()` callback returns `void`). The action signature would need to return `string | null` (the new leaf id, or null if no-op).

Alternatively, `moveCell` can always clear `selectedNodeId` (set to `null`) inside the store action, and the user re-selects. This is acceptable UX for a move operation.

---

## Complete Edge-Case Enumeration (D-08.2)

All EC cases from CONTEXT.md verified against code + additional cases identified:

| ID | Description | Code Evidence | Tree State After | Test Priority |
|----|-------------|---------------|-----------------|---------------|
| EC-01 | Source parent has 3+ children — only `sizes` filtered, no collapse | `removeNode:164`: `if (newChildren.length === 1)` — collapse only when exactly 1 remains. 3→2 children: no collapse, sizes filtered by index. | Container with N-1 children; sizes filtered in parallel | HIGH — regression guard |
| EC-02 | Source parent has exactly 2 children — after removal, 1 child remains → parent collapses, remaining child promoted to grandparent slot | `removeNode:164-173`: promotes `onlyChild` to grandparent. Grandparent gets the parent's old slot (and parent's size weight from grandparent). | Former grandparent now has one fewer child; former sibling at parent's old slot | HIGH — core collapse logic |
| EC-03 | Source parent IS the root container (no grandparent) → root becomes the remaining child | `removeNode:165-166`: `if (root.id === parent.id) return onlyChild` — root is replaced by its remaining child. The new root may be a leaf (valid per tree contract). | Root is now the single remaining leaf or container | HIGH — root replacement |
| EC-04 | Source and target share the same direct 2-child parent; edge drop requires direction change | Two-pass approach: Pass 1 wraps `toId` in new container (still inside parent). Pass 2 calls `removeNode(fromId)` — parent now has 1 child (the new container), collapses. Result: grandparent gets the new container as a direct child. Tree is valid. No infinite loop — `fromId` is still findable after Pass 1. | New container replaces entire old parent in grandparent | HIGH — sibling-move case |
| EC-05 | Dropping on same edge where source already lives (no-op) | Not detectable from tree structure alone — detected in `handleDrop` by checking if `fromId === toId` or if the resulting move would produce structurally identical tree. The simplest check: `fromId === toId` (same cell dragged onto itself). For "same edge as currently adjacent" — complex, not worth detecting. **Recommendation:** Only guard `fromId === toId`; do not try to detect topological no-ops. | Root unchanged | MEDIUM |
| EC-06 | Dragged cell has no media (`mediaId: null`) | ActionBar gate currently blocks drag on empty cells. If gate is relaxed (recommended), `swapLeafContent` works with null media. `moveLeafToEdge` copies content including `mediaId: null`. Valid. | New leaf at target edge has `mediaId: null` | MEDIUM — after gate relaxation |
| EC-07 | Target is ancestor/descendant of source | N/A — both must be leaves (only leaves have drag handles). Leaves have no children by definition. No ancestor relationship possible between two leaves. | — | LOW — document as N/A |
| EC-08 | `MIN_CELL_WEIGHT` floor after collapse and 50/50 split | New container always gets `sizes: [1, 1]` — both above 0.1 floor. Source parent after removal: existing weights preserved (not renormalized). `MIN_CELL_WEIGHT` only enforced in `resizeSiblings`. No violation possible from the structural mutation itself. | Weights valid | MEDIUM — verify in unit test |
| EC-09 | History cap (50 entries) | `pushSnapshot` caps at `HISTORY_CAP = 50` via `state.history.shift()`. One `pushSnapshot` call per `moveCell`. Same behavior as existing actions. | history.length ≤ 50 | LOW — same as existing; existing test covers |
| EC-10 | Undo/redo round-trip | Snapshot taken before mutation captures old tree with old ids. `undo()` restores `structuredClone(snap.root)`. Leaf ids, sizes, and topology all restored. Since `moveCell` creates new ids, undo correctly restores old ids. `selectedNodeId` should also be cleared on undo (currently it is NOT — `undo` does not touch `editorStore.selectedNodeId`). The stale selection is a pre-existing issue, not new. | Pre-move tree fully restored | HIGH — critical for data integrity |
| EC-11 | Rapid successive drops / drag cancel — drag-enter/leave counter for 5-zone overlay | Current `LeafNode` uses simple boolean `isDragOver` — no counter. Phase 8 D-16 recommends counter for workspace ring but `LeafNode` uses `setIsDragOver(false)` on any `dragleave`. For 5-zone, the `activeZone` state is set on every `dragover` (recalculated from cursor position), so a stale zone is overwritten immediately. `dragLeave` should clear `activeZone` to `null`. No counter needed for this (the zone is recalculated on each dragover anyway). Drag cancel fires `dragEnd` on the source — not `dragLeave` on the target — so clearing on `dragEnd` requires a global listener or relying on `dragLeave`. **Recommendation:** Clear `activeZone` on both `dragLeave` and `drop`. Accept that if drag is cancelled mid-flight without `dragLeave`, the overlay lingers until next hover. This is acceptable visual behavior. | Overlay clears on next dragLeave or drop | MEDIUM |
| EC-12 | Workspace-level file drop ring (Phase 8 D-15) not activated during cell-swap drag | Phase 8: workspace ring activates only when `dataTransfer.types.includes('Files')`. Cell-swap drag sets `text/cell-id` — `'Files'` is NOT in types. Confirmed: `CanvasArea.tsx` workspace ring handler will not fire during Phase 9 cell-move drags. LeafNode `handleDrop` calls `e.stopPropagation()` which prevents workspace handler from receiving the event anyway. | Workspace ring stays off during cell-to-cell drag | HIGH — regression guard |

### Additional Edge Cases (beyond EC-01..EC-12)

| ID | Description | Code Evidence | Test Priority |
|----|-------------|---------------|---------------|
| EC-13 | Source and target are in completely disjoint subtrees (most common case) | Two-pass approach: Pass 1 modifies target's subtree only; Pass 2 removes source from a different subtree. No interaction. Works correctly. | HIGH — happy path |
| EC-14 | Source is only leaf in the entire tree (root is a leaf) | `removeNode(root, root.id)` returns `root` unchanged (safety guard). So if source is the root leaf, `moveCell` is a no-op. But this case can only happen if root IS a leaf — which means target IS the same node (can't drag to yourself). EC-05 guard (`fromId === toId`) catches this. | LOW |
| EC-15 | Target is at a deeper nesting level than source; source's removal causes ancestor containers to collapse upward | Two-pass with `removeNode` handles this: collapse-upward propagates up via the recursive `mapNode(root, parent.id, () => onlyChild)` call. Only one level of collapse per `removeNode` call (a parent with 1 child collapses, but its grandparent — if now also left with 1 child — does NOT auto-collapse). This is a pre-existing behavior of `removeNode`. In practice, since source was a leaf, its parent can only collapse one level. | MEDIUM — verify multi-level not needed |
| EC-16 | 50/50 split produces new container with direction mismatching existing parent | The new container's direction is determined solely by the drop edge (top/bottom → vertical, left/right → horizontal). This may result in a horizontal container inside a horizontal parent (which would have been Case B in `splitNode` but we always use Case C semantics). This is valid — n-ary trees allow nested same-direction containers. It is slightly suboptimal layout-wise but correct. | LOW |
| EC-17 | Drop edge that inserts source as "first" child vs "second" child | top/left → source goes first in the new container's children array (source appears above/left of target). bottom/right → source goes second (source appears below/right of target). This must be verified visually. The convention should be: the direction the arrow points is where the source cell lands. | HIGH — UX correctness |
| EC-18 | After `moveCell`, `selectedNodeId` in `editorStore` is stale (points to `fromId` which no longer exists) | `findNode(state.root, selectedNodeId)` returns null → `LeafNodeComponent` renders null for that id. `SelectedCellPanel` will show nothing. | MEDIUM — clear selection on move |

---

## Architecture Patterns

### `moveLeafToEdge` Recommended Implementation Sketch

```typescript
// src/lib/tree.ts (new export)
type MoveEdge = 'top' | 'bottom' | 'left' | 'right';

export function moveLeafToEdge(
  root: GridNode,
  fromId: string,
  toId: string,
  edge: MoveEdge,
): GridNode {
  // Guard: same node
  if (fromId === toId) return root;

  // Extract source content
  const sourceNode = findNode(root, fromId);
  if (!sourceNode || sourceNode.type !== 'leaf') return root;
  const targetNode = findNode(root, toId);
  if (!targetNode || targetNode.type !== 'leaf') return root;

  const sourceContent = {
    mediaId: sourceNode.mediaId,
    fit: sourceNode.fit,
    backgroundColor: sourceNode.backgroundColor,
    panX: sourceNode.panX,
    panY: sourceNode.panY,
    panScale: sourceNode.panScale,
    objectPosition: sourceNode.objectPosition,
  };

  // Determine container direction and child order from edge
  const direction: SplitDirection = (edge === 'top' || edge === 'bottom') ? 'vertical' : 'horizontal';
  const sourceFirst = edge === 'top' || edge === 'left';

  // New leaf carrying source content (fresh id per D-06)
  const newLeaf: LeafNode = { ...createLeaf(), ...sourceContent };

  // Pass 1: replace toId with a new container wrapping [newLeaf, targetNode] or [targetNode, newLeaf]
  const pass1 = mapNode(root, toId, () => ({
    type: 'container' as const,
    id: nanoid(),
    direction,
    sizes: [1, 1],
    children: sourceFirst ? [newLeaf, targetNode] : [targetNode, newLeaf],
  }));

  // Pass 2: remove fromId (handles collapse-upward correctly)
  const pass2 = removeNode(pass1, fromId);

  return pass2;
}
```

**Note:** `mapNode` is unexported in the current `tree.ts` — it's a private `function`. It must be exported (or `moveLeafToEdge` must be co-located in the same file, which is the correct approach since it's part of `src/lib/tree.ts`).

### `moveCell` Store Action Sketch

```typescript
// src/store/gridStore.ts (new action)
moveCell: (fromId: string, toId: string, edge: 'center' | 'top' | 'bottom' | 'left' | 'right') =>
  set(state => {
    if (fromId === toId) return;
    pushSnapshot(state);
    if (edge === 'center') {
      state.root = swapLeafContent(current(state.root), fromId, toId);
    } else {
      state.root = moveLeafToEdge(current(state.root), fromId, toId, edge);
    }
  }),
```

### `LeafNode` Zone Detection Sketch

```typescript
// In handleDragOver, replace setIsDragOver(true) with zone detection:
const isCellDrag = Array.from(e.dataTransfer.types).includes('text/cell-id');
if (isCellDrag) {
  const rect = divRef.current?.getBoundingClientRect();
  if (rect) {
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    // Threshold: 20% of short dimension, minimum 20px
    const threshold = Math.max(20, Math.min(w, h) * 0.2);
    if (y < threshold) setActiveZone('top');
    else if (y > h - threshold) setActiveZone('bottom');
    else if (x < threshold) setActiveZone('left');
    else if (x > w - threshold) setActiveZone('right');
    else setActiveZone('center');
  }
} else {
  setIsDragOver(true); // file drag — existing behavior
}
```

### Overlay Rendering for Insertion Lines

The insertion line is a thin `<div>` positioned absolutely at the cell edge:

```tsx
{activeZone && activeZone !== 'center' && (
  <div
    className="absolute pointer-events-none z-20"
    style={{
      // Position along the active edge
      ...(activeZone === 'top' && { top: 0, left: 0, right: 0, height: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }),
      ...(activeZone === 'bottom' && { bottom: 0, left: 0, right: 0, height: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }),
      ...(activeZone === 'left' && { top: 0, left: 0, bottom: 0, width: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }),
      ...(activeZone === 'right' && { top: 0, right: 0, bottom: 0, width: `${4 / canvasScale}px`, backgroundColor: '#3b82f6' }),
    }}
  />
)}
{activeZone === 'center' && (
  <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-20">
    <ArrowLeftRight size={32 / canvasScale} className="text-white" />
  </div>
)}
```

`canvasScale` must be subscribed in `LeafNode`: `const canvasScale = useEditorStore(s => s.canvasScale);`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapse-upward after remove | Custom recursive collapse | `removeNode` (Pass 2 of two-pass approach) | Already implements "1 child → collapse" correctly for n-ary trees |
| Content copy to new leaf | Manual field-by-field copy | `{ ...createLeaf(), ...sourceContentFields }` | Ensures all future LeafNode fields get defaults; only content fields are overridden |
| Tree traversal for replace | Custom DFS | `mapNode` (existing private helper, to be used from same file) | Proven correct, immutable, handles all tree shapes |
| Drag type detection | Custom MIME check | `e.dataTransfer.types.includes('text/cell-id')` | Already used in existing `handleDragOver` |

---

## Common Pitfalls

### Pitfall 1: Using `splitNode` Directly
**What goes wrong:** `splitNode` Case B appends a new empty leaf at the end of an existing same-direction parent. The dragged cell's content is not in this leaf. Subsequent content migration is error-prone and the topology is wrong (leaf appended at end, not at the specific edge of the target).
**Why it happens:** `splitNode` is designed for the "split cell" button interaction, not "move cell here" semantics.
**How to avoid:** Inline the container-wrap logic in `moveLeafToEdge` (always Case C semantics, never delegate to `splitNode`).

### Pitfall 2: Using `mergeNode` for Collapse-Upward
**What goes wrong:** `mergeNode` always takes `children[0]` as the surviving child. After removing source at index 0, the remaining child is at index 0 — correct. But if source was at index 1, remaining child is also at index 0 — also correct. But `mergeNode` is called on a container id, not on the leaf id. The caller would need to know the parent's id, call `mergeNode(parent.id)`, and `mergeNode` would promote index 0. If the source was index 0 and was already removed, the remaining child IS index 0. But `mergeNode` is semantically "collapse container to first child" — NOT "collapse container after removing a specific child." These are different operations.
**How to avoid:** Use `removeNode` for the removal+collapse step. It handles all index positions correctly.

### Pitfall 3: Stale `toId` Reference After Pass 1
**What goes wrong:** If source and target share a parent, and Pass 1 wraps target in a new container, the parent now has a new child (the container) instead of `toId`. But `fromId` is still a direct child of the same parent. Pass 2 (`removeNode(fromId)`) will find the parent correctly (DFS still reaches `fromId` since Pass 1 didn't touch `fromId`). This works correctly.
**Why it seems scary:** Developers fear stale refs after tree mutation. But the two-pass approach is safe because Pass 1 only modifies `toId`'s subtree, and `fromId` is in a sibling position — unaffected.
**How to avoid:** Trust the pure functional approach — each pass returns a new tree, and the next pass operates on that new tree.

### Pitfall 4: `dragLeave` Firing on Child Element Transitions
**What goes wrong:** The `activeZone` overlay divs inside `LeafNode` are children of the same div that handles `dragLeave`. When the cursor moves from the cell to the overlay div (which is positioned inside the cell), `dragLeave` fires for the cell and `dragEnter` fires for the overlay — clearing `activeZone` momentarily.
**Why it happens:** HTML5 drag events bubble through the DOM; `dragLeave` fires when the cursor leaves a specific element for any of its children.
**How to avoid:** Use a drag-enter counter on the cell div (increment on `dragEnter`, decrement on `dragLeave`, clear zone at 0). The overlay divs should have `pointer-events-none` (already planned) which prevents them from generating drag events, so the counter pattern may not be needed if all overlays are `pointer-events-none`. **Verify by testing.** If pointer-events-none overlays still trigger dragLeave (they may if they intercept the event target despite pointer-events-none), use the counter.

### Pitfall 5: `mapNode` is Not Exported
**What goes wrong:** `moveLeafToEdge` in `src/lib/tree.ts` needs to call `mapNode`, but `mapNode` is currently a module-private `function` (no `export`).
**How to avoid:** Since `moveLeafToEdge` lives in the same file as `mapNode`, no export is needed. `moveLeafToEdge` can call `mapNode` directly.

### Pitfall 6: `objectPosition` Field Not in `swapLeafContent` Content Copy
**Code check:** `swapLeafContent` copies `mediaId, fit, backgroundColor, panX, panY, panScale`. It does NOT copy `objectPosition`. `moveLeafToEdge` should include `objectPosition` in the content copy for completeness (it's part of `LeafNode` type as an optional field). Verify and include.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vite.config.ts` (test config inline or `vitest.config.ts`) |
| Quick run command | `npx vitest run src/test/phase09-p01-cell-move.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| MOVE-01 | `moveLeafToEdge` two-pass: insert at target edge, source removed | unit (tree fn) | `npx vitest run src/test/phase09-p01-cell-move.test.ts` | Wave 0 |
| MOVE-02 | EC-01: 3-child parent, source removed, no collapse | unit (tree fn) | same | Wave 0 |
| MOVE-03 | EC-02: 2-child parent, source removed, collapse-upward | unit (tree fn) | same | Wave 0 |
| MOVE-04 | EC-03: source parent IS root, root replaced by remaining child | unit (tree fn) | same | Wave 0 |
| MOVE-05 | EC-04: source and target share same 2-child parent | unit (tree fn) | same | Wave 0 |
| MOVE-06 | EC-05: fromId === toId, returns root unchanged | unit (tree fn) | same | Wave 0 |
| MOVE-07 | EC-10: undo after moveCell restores exact pre-move tree | unit (store action) | same | Wave 0 |
| MOVE-08 | EC-12: workspace ring NOT activated during cell-move drag | integration (LeafNode) | `npx vitest run src/test/phase09-p02-leaf-drop.test.tsx` | Wave 0 |
| MOVE-09 | EC-13: disjoint subtrees, both mutations apply | unit (tree fn) | `npx vitest run src/test/phase09-p01-cell-move.test.ts` | Wave 0 |
| MOVE-10 | center edge: delegates to swapLeafContent (no topology change) | unit (store action) | same | Wave 0 |
| MOVE-11 | EC-17: top/left places source first; bottom/right places source second | unit (tree fn) | same | Wave 0 |
| MOVE-12 | Regression: swapCells still works unchanged | regression | `npx vitest run src/test/phase05-p02-cell-swap.test.ts` | Exists |
| MOVE-13 | ActionBar drag handle renders even when hasMedia=false (EC-06 gate relaxed) | unit (ActionBar render) | `npx vitest run src/test/phase09-p02-leaf-drop.test.tsx` | Wave 0 |
| MOVE-14 | EC-08: sizes remain valid after move (no value below MIN_CELL_WEIGHT imposed) | unit (tree fn) | `npx vitest run src/test/phase09-p01-cell-move.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/phase09-p01-cell-move.test.ts src/test/phase09-p02-leaf-drop.test.tsx src/test/phase05-p02-cell-swap.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/phase09-p01-cell-move.test.ts` — unit tests for `moveLeafToEdge` pure function (MOVE-01..EC-14)
- [ ] `src/test/phase09-p02-leaf-drop.test.tsx` — component tests for LeafNode 5-zone drop handling, overlay rendering, gate relaxation (MOVE-08, MOVE-13)
- [ ] Update `src/test/phase05-p02-cell-swap.test.ts` — update "does NOT render drag handle when hasMedia=false" test if gate is relaxed per EC-06

---

## Standard Stack

No new library installations required for Phase 9.

| What's Used | Where | Notes |
|-------------|-------|-------|
| `nanoid` (already installed) | `moveLeafToEdge` for new container id + new leaf id | `createLeaf()` calls `nanoid()` — use `createLeaf()` factory |
| `lucide-react` `ArrowLeftRight` or `MoveHorizontal` | Center-zone swap overlay icon | Check exact icon name; `lucide-react` is already installed |
| `useEditorStore` `canvasScale` selector | `LeafNode.tsx` for scale-stable overlay dimensions | Already in store; new subscription in LeafNode |
| Native HTML5 drag events | `LeafNode.tsx` drop zone detection | No dnd-kit additions |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Cell-only swap (content only) | Phase 9: 5-zone move + swap | Center edge preserves existing swap semantics |
| `swapCells` is the only drag action | `moveCell(fromId, toId, edge)` wraps both swap and move | Unified entry point |
| ActionBar drag handle gated on `hasMedia` | Phase 9: gate relaxed (empty cells movable) | Requires test update |

---

## Open Questions

1. **`objectPosition` in `swapLeafContent`**
   - What we know: `swapLeafContent` copies `mediaId, fit, backgroundColor, panX, panY, panScale` but NOT `objectPosition` (the field is optional on `LeafNode`).
   - What's unclear: Was this intentional? Should `moveLeafToEdge` include `objectPosition`?
   - Recommendation: Include `objectPosition` in the move content copy for completeness; file a note that `swapLeafContent` may have a minor bug (omitting `objectPosition`) that can be fixed in the same phase.

2. **`ArrowLeftRight` icon availability in lucide-react**
   - What we know: `lucide-react ^1.7.0` is installed. `ArrowLeftRight` is a common Lucide icon.
   - What's unclear: Exact icon name for the "swap" metaphor in center zone.
   - Recommendation: Use `ArrowLeftRight` or `ArrowsLeftRight` — planner/implementer to verify exact export name from installed version.

3. **Counter pattern needed for `dragLeave`**
   - What we know: Overlay divs will have `pointer-events-none`, which SHOULD prevent drag events from targeting them.
   - What's unclear: Whether pointer-events-none fully prevents dragenter/dragleave firing on overlay children in all browsers.
   - Recommendation: Start without counter; add it if visual flickering observed during testing. The active zone is recalculated on every `dragover` anyway, so momentary clearing and restoring has minimal visual impact.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is purely code changes with no external dependencies beyond the existing project stack.

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 9 is a new feature addition (not a rename, refactor, or migration). No stored data, live service config, OS-registered state, secrets, or build artifacts contain strings that need updating.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/lib/tree.ts` (full file) — all function signatures, invariants, and behaviors documented from source
- Direct code inspection of `src/store/gridStore.ts` — `swapCells`, `pushSnapshot`, `HISTORY_CAP`, `history` structure
- Direct code inspection of `src/Grid/ActionBar.tsx` — `hasMedia` gate, drag handle `onDragStart`, `text/cell-id` convention
- Direct code inspection of `src/Grid/LeafNode.tsx` — `handleDragOver`, `handleDragLeave`, `handleDrop`, `isDragOver` state, `stopPropagation` call
- Direct code inspection of `src/Grid/CanvasWrapper.tsx` — `canvasScale` computation, `setCanvasScale` call, canvas surface transform
- Direct code inspection of `src/store/editorStore.ts` — `selectedNodeId`, `canvasScale`, `setSelectedNode`
- Direct code inspection of `src/types/index.ts` — `GridNode`, `ContainerNode`, `LeafNode` type definitions (n-ary confirmed)
- Direct code inspection of `src/test/phase05-p02-cell-swap.test.ts` — regression baseline for swap behavior
- `.planning/phases/09-improve-cell-movement-and-swapping/09-CONTEXT.md` — all phase decisions and constraints
- `.planning/phases/08-canvas-workspace-ux/08-CONTEXT.md` — Phase 8 D-15 (workspace ring file-only) and D-16 (counter pattern)
- `.planning/phases/07-cell-controls-display-polish/07-CONTEXT.md` — Phase 7 `scale(1/canvasScale)` pattern
- `.planning/decisions/adr-cell-swap-touch.md` — desktop-only native HTML5 drag, still binding

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated decisions — Phase 7 ActionBar `scale(1/canvasScale)` decision confirmed

---

## Metadata

**Confidence breakdown:**
- Tree primitive analysis: HIGH — full source code read; all functions inspected directly
- Edge case enumeration: HIGH — verified each EC against actual `removeNode`, `splitNode`, `mapNode` code paths
- n-ary structure: HIGH — confirmed from `ContainerNode.children: GridNode[]` type and `buildTemplate('3-row')` with 3 children
- Size normalization: HIGH — confirmed no renormalization in any existing mutation; raw weights preserved
- `dragover` performance: HIGH — code confirms no throttle; 20-cell max confirmed safe
- Canvas scale mechanism: MEDIUM — `scale(1/canvasScale)` pattern described in STATE.md but not visible as explicit inline style in current `LeafNode.tsx` code; the recommended pixel-division approach (`4 / canvasScale`) is safe regardless
- `selectedNodeId` follow-through: MEDIUM — `editorStore` cross-store call pattern exists in codebase (panModeNodeId cleared by CanvasWrapper's background click); option 1 (return new id from action) is cleaner
- `objectPosition` omission in `swapLeafContent`: HIGH — confirmed by code inspection

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain — tree primitives and store structure are unlikely to change)
