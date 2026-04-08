import { nanoid } from 'nanoid';
import type { GridNode, ContainerNode, LeafNode, SplitDirection } from '../types';

// ---------------------------------------------------------------------------
// Template type
// ---------------------------------------------------------------------------

export type TemplateName = '2x1' | '1x2' | '2x2' | '3-row' | 'l-shape' | 'mosaic';

export const MIN_CELL_WEIGHT = 0.1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively walk the tree, replacing the node with the given id using
 * the updater function. Returns a new tree (never mutates input).
 */
function mapNode(
  root: GridNode,
  id: string,
  updater: (node: GridNode) => GridNode,
): GridNode {
  if (root.id === id) return updater(root);
  if (root.type === 'container') {
    return {
      ...root,
      children: root.children.map(child => mapNode(child, id, updater)),
    };
  }
  return root;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * DFS search for a node by id. Returns null if not found.
 */
export function findNode(root: GridNode, id: string): GridNode | null {
  if (root.id === id) return root;
  if (root.type === 'container') {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns the parent ContainerNode of the child with the given id.
 * Returns null if childId is the root or not found.
 */
export function findParent(root: GridNode, childId: string): ContainerNode | null {
  if (root.type !== 'container') return null;
  for (const child of root.children) {
    if (child.id === childId) return root;
    const found = findParent(child, childId);
    if (found) return found;
  }
  return null;
}

/**
 * Collects all leaf nodes at any depth.
 */
export function getAllLeaves(root: GridNode): LeafNode[] {
  if (root.type === 'leaf') return [root];
  return root.children.flatMap(getAllLeaves);
}

// ---------------------------------------------------------------------------
// Mutation functions (all pure — return new tree)
// ---------------------------------------------------------------------------

/**
 * Creates a new empty leaf node with a unique nanoid id.
 */
export function createLeaf(): LeafNode {
  return { type: 'leaf', id: nanoid(), mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null, panX: 0, panY: 0, panScale: 1 };
}

/**
 * Splits a leaf node into a container + new sibling.
 *
 * Three cases:
 *   A. root itself is the leaf being split — wrap in new container
 *   B. parent direction === split direction — append sibling to parent
 *   C. parent direction !== split direction — replace leaf with new container
 */
export function splitNode(root: GridNode, nodeId: string, direction: SplitDirection): GridNode {
  const parent = findParent(root, nodeId);

  // Case A: root is the leaf being split (no parent)
  if (!parent) {
    const node = findNode(root, nodeId);
    if (!node) return root; // nodeId not found — return unchanged
    return {
      type: 'container',
      id: nanoid(),
      direction,
      sizes: [1, 1],
      children: [node, createLeaf()],
    };
  }

  // Case B: parent direction matches — append sibling
  if (parent.direction === direction) {
    return mapNode(root, parent.id, existingParent => {
      const p = existingParent as ContainerNode;
      return {
        ...p,
        children: [...p.children, createLeaf()],
        sizes: [...p.sizes, 1],
      };
    });
  }

  // Case C: cross-direction — wrap leaf in new container
  return mapNode(root, nodeId, leaf => ({
    type: 'container' as const,
    id: nanoid(),
    direction,
    sizes: [1, 1],
    children: [leaf, createLeaf()],
  }));
}

/**
 * Collapses a container to its first child. If the first child is a leaf,
 * its mediaId and fit are preserved.
 */
export function mergeNode(root: GridNode, containerId: string): GridNode {
  const container = findNode(root, containerId);
  if (!container || container.type !== 'container') return root;
  const firstChild = container.children[0];
  // Replace the container with its first child in the tree
  if (root.id === containerId) return firstChild;
  return mapNode(root, containerId, () => firstChild);
}

/**
 * Removes a leaf node. If the parent is left with only one child after
 * removal, the parent is replaced by that remaining child (collapse).
 * If the target node is the root (and the only node), returns root unchanged.
 */
export function removeNode(root: GridNode, nodeId: string): GridNode {
  // Cannot remove the root itself if it's the only node
  if (root.id === nodeId) return root;

  const parent = findParent(root, nodeId);
  if (!parent) return root; // not found

  const nodeIndex = parent.children.findIndex(c => c.id === nodeId);
  if (nodeIndex === -1) return root;

  const newChildren = parent.children.filter(c => c.id !== nodeId);
  const newSizes = parent.sizes.filter((_, i) => i !== nodeIndex);

  // If parent would be left with 1 child, collapse parent → that child
  if (newChildren.length === 1) {
    const onlyChild = newChildren[0];
    if (root.id === parent.id) return onlyChild;
    return mapNode(root, parent.id, () => onlyChild);
  }

  // Otherwise just update the parent
  const updatedParent: ContainerNode = { ...parent, children: newChildren, sizes: newSizes };
  if (root.id === parent.id) return updatedParent;
  return mapNode(root, parent.id, () => updatedParent);
}

/**
 * Adjusts two adjacent sibling weights by delta.
 * sizes[index] += delta; sizes[index+1] -= delta.
 * Clamps both to MIN_CELL_WEIGHT minimum.
 */
export function resizeSiblings(
  root: GridNode,
  containerId: string,
  index: number,
  delta: number,
): GridNode {
  return mapNode(root, containerId, node => {
    if (node.type !== 'container') return node;
    const newSizes = [...node.sizes];
    newSizes[index] += delta;
    newSizes[index + 1] -= delta;

    // Clamp: neither weight should drop below MIN_CELL_WEIGHT
    if (newSizes[index] < MIN_CELL_WEIGHT) {
      const excess = MIN_CELL_WEIGHT - newSizes[index];
      newSizes[index] = MIN_CELL_WEIGHT;
      newSizes[index + 1] -= excess;
    }
    if (newSizes[index + 1] < MIN_CELL_WEIGHT) {
      const excess = MIN_CELL_WEIGHT - newSizes[index + 1];
      newSizes[index + 1] = MIN_CELL_WEIGHT;
      newSizes[index] -= excess;
    }

    return { ...node, sizes: newSizes };
  });
}

/**
 * Immutably updates properties on a leaf node.
 */
export function updateLeaf(
  root: GridNode,
  nodeId: string,
  updates: Partial<Omit<LeafNode, 'type' | 'id'>>,
): GridNode {
  return mapNode(root, nodeId, node => {
    if (node.type !== 'leaf') return node;
    return { ...node, ...updates };
  });
}

/**
 * Builds the default initial tree: vertical container with two empty leaves.
 * Per D-06.
 */
export function buildInitialTree(): GridNode {
  return {
    type: 'container',
    id: nanoid(),
    direction: 'vertical',
    sizes: [1, 1],
    children: [createLeaf(), createLeaf()],
  };
}

/**
 * Swaps the content (mediaId, fit, backgroundColor, panX, panY, panScale)
 * between two leaf nodes identified by idA and idB.
 * Returns root unchanged if either id is not found or is not a leaf.
 */
export function swapLeafContent(root: GridNode, idA: string, idB: string): GridNode {
  const nodeA = findNode(root, idA);
  const nodeB = findNode(root, idB);
  if (!nodeA || !nodeB || nodeA.type !== 'leaf' || nodeB.type !== 'leaf') {
    return root;
  }
  const leafA = nodeA as LeafNode;
  const leafB = nodeB as LeafNode;

  const contentA = {
    mediaId: leafA.mediaId,
    fit: leafA.fit,
    backgroundColor: leafA.backgroundColor,
    panX: leafA.panX,
    panY: leafA.panY,
    panScale: leafA.panScale,
  };
  const contentB = {
    mediaId: leafB.mediaId,
    fit: leafB.fit,
    backgroundColor: leafB.backgroundColor,
    panX: leafB.panX,
    panY: leafB.panY,
    panScale: leafB.panScale,
  };

  let result = updateLeaf(root, idA, contentB);
  result = updateLeaf(result, idB, contentA);
  return result;
}

// ---------------------------------------------------------------------------
// Phase 9: moveLeafToEdge — pure two-pass move primitive
// ---------------------------------------------------------------------------

export type MoveEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Pure two-pass move of a leaf's content into a new 50/50 container at the
 * target cell's edge.
 *   Pass 1: wrap `toId` in a new container holding [newLeaf(sourceContent), toNode]
 *           (or reversed per edge).
 *   Pass 2: remove `fromId` — removeNode handles collapse-upward when the source
 *           parent is left with a single child.
 *
 * No-ops (returns root reference unchanged) when:
 *   - fromId === toId
 *   - either id is not found in the tree
 *   - either referenced node is not a leaf
 *
 * Per D-06, source leaf identity is discarded — the inserted leaf gets a fresh id.
 * Per Pitfall 6 in 09-RESEARCH.md, objectPosition MUST be copied along with the
 * other content fields.
 */
export function moveLeafToEdge(
  root: GridNode,
  fromId: string,
  toId: string,
  edge: MoveEdge,
): GridNode {
  if (fromId === toId) return root;

  const sourceNode = findNode(root, fromId);
  if (!sourceNode || sourceNode.type !== 'leaf') return root;
  const targetNode = findNode(root, toId);
  if (!targetNode || targetNode.type !== 'leaf') return root;

  // Capture source content. Identity is discarded; content moves.
  const sourceContent: Partial<LeafNode> = {
    mediaId: sourceNode.mediaId,
    fit: sourceNode.fit,
    backgroundColor: sourceNode.backgroundColor,
    panX: sourceNode.panX,
    panY: sourceNode.panY,
    panScale: sourceNode.panScale,
    objectPosition: sourceNode.objectPosition,
  };

  const direction: SplitDirection =
    edge === 'top' || edge === 'bottom' ? 'vertical' : 'horizontal';
  const sourceFirst = edge === 'top' || edge === 'left';

  // New leaf carrying source content (fresh nanoid id via createLeaf).
  const newLeaf: LeafNode = { ...createLeaf(), ...sourceContent };

  // Pass 1: replace toId with a new 50/50 container wrapping target + new leaf.
  const pass1 = mapNode(root, toId, (targetLeaf): ContainerNode => ({
    type: 'container',
    id: nanoid(),
    direction,
    sizes: [1, 1],
    children: sourceFirst ? [newLeaf, targetLeaf] : [targetLeaf, newLeaf],
  }));

  // Pass 2: remove the original source leaf. removeNode handles collapse-upward.
  const pass2 = removeNode(pass1, fromId);

  return pass2;
}

/**
 * Builds a preset template tree by name.
 */
export function buildTemplate(name: TemplateName): GridNode {
  switch (name) {
    case '2x1':
      return {
        type: 'container',
        id: nanoid(),
        direction: 'vertical',
        sizes: [1, 1],
        children: [createLeaf(), createLeaf()],
      };

    case '1x2':
      return {
        type: 'container',
        id: nanoid(),
        direction: 'horizontal',
        sizes: [1, 1],
        children: [createLeaf(), createLeaf()],
      };

    case '2x2':
      return {
        type: 'container',
        id: nanoid(),
        direction: 'vertical',
        sizes: [1, 1],
        children: [
          {
            type: 'container',
            id: nanoid(),
            direction: 'horizontal',
            sizes: [1, 1],
            children: [createLeaf(), createLeaf()],
          },
          {
            type: 'container',
            id: nanoid(),
            direction: 'horizontal',
            sizes: [1, 1],
            children: [createLeaf(), createLeaf()],
          },
        ],
      };

    case '3-row':
      return {
        type: 'container',
        id: nanoid(),
        direction: 'vertical',
        sizes: [1, 1, 1],
        children: [createLeaf(), createLeaf(), createLeaf()],
      };

    case 'l-shape':
      return {
        type: 'container',
        id: nanoid(),
        direction: 'horizontal',
        sizes: [2, 1],
        children: [
          createLeaf(),
          {
            type: 'container',
            id: nanoid(),
            direction: 'vertical',
            sizes: [1, 1],
            children: [createLeaf(), createLeaf()],
          },
        ],
      };

    case 'mosaic':
      return {
        type: 'container',
        id: nanoid(),
        direction: 'vertical',
        sizes: [1, 1],
        children: [
          {
            type: 'container',
            id: nanoid(),
            direction: 'horizontal',
            sizes: [1, 1, 1],
            children: [createLeaf(), createLeaf(), createLeaf()],
          },
          {
            type: 'container',
            id: nanoid(),
            direction: 'horizontal',
            sizes: [1, 1],
            children: [createLeaf(), createLeaf()],
          },
        ],
      };
  }
}
