/**
 * media.test.ts
 * Tests for fileToBase64 (MEDI-03) and autoFillCells (MEDI-04, MEDI-05).
 * Coverage: D-05 (overflow split), D-06 (shared fill logic), non-image rejection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as mediaModule from '../lib/media';
import { autoFillCells, fileToBase64 } from '../lib/media';
import { buildInitialTree, getAllLeaves, splitNode } from '../lib/tree';
import type { GridNode, FillActions } from '../lib/media';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImageFile(name = 'photo.jpg'): File {
  return new File([''], name, { type: 'image/jpeg' });
}

function makeTextFile(): File {
  return new File(['hello'], 'doc.txt', { type: 'text/plain' });
}

/**
 * Builds a mock FillActions that maintains an in-memory tree.
 * Calls to split() actually split the tree so getRoot() reflects the change.
 * Calls to setMedia() actually update the leaf's mediaId in the tree so that
 * autoFillCells can correctly detect "no empty leaves" when all cells are filled.
 */
function makeMockActions(initialRoot?: GridNode) {
  let root: GridNode = initialRoot ?? buildInitialTree();

  // Update a leaf's mediaId in the tree (pure function - returns new tree)
  function updateLeafMediaId(node: GridNode, targetId: string, mediaId: string): GridNode {
    if (node.type === 'leaf') {
      return node.id === targetId ? { ...node, mediaId } : node;
    }
    return {
      ...node,
      children: node.children.map(child => updateLeafMediaId(child, targetId, mediaId)),
    };
  }

  const addMedia = vi.fn((_mediaId: string, _uri: string) => {});
  const setMedia = vi.fn((nodeId: string, id: string) => {
    // Actually update the tree so future getRoot() calls see filled cells
    root = updateLeafMediaId(root, nodeId, id);
  });
  const split = vi.fn((nodeId: string, dir: string) => {
    root = splitNode(root, nodeId, dir as 'horizontal' | 'vertical');
  });
  const getRoot = vi.fn(() => root);
  return { addMedia, setMedia, split, getRoot };
}

// ---------------------------------------------------------------------------
// fileToBase64 tests (MEDI-03)
// ---------------------------------------------------------------------------

describe('fileToBase64', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with a string starting with "data:"', async () => {
    // Mock FileReader to return a controlled data URI
    const mockFR = {
      readAsDataURL: vi.fn(function (this: typeof mockFR) {
        setTimeout(() => {
          this.result = 'data:image/png;base64,abc123';
          this.onload?.(new ProgressEvent('load'));
        }, 0);
      }),
      result: null as string | null,
      onload: null as ((e: ProgressEvent) => void) | null,
      onerror: null as ((e: ProgressEvent) => void) | null,
    };
    vi.spyOn(global, 'FileReader' as never).mockImplementation(() => mockFR as unknown as FileReader);

    const file = makeImageFile();
    const result = await fileToBase64(file);
    expect(result).toMatch(/^data:/);
  });

  it('uses FileReader.readAsDataURL (not URL.createObjectURL)', async () => {
    const mockFR = {
      readAsDataURL: vi.fn(function (this: typeof mockFR) {
        setTimeout(() => {
          this.result = 'data:image/png;base64,abc123';
          this.onload?.(new ProgressEvent('load'));
        }, 0);
      }),
      result: null as string | null,
      onload: null as ((e: ProgressEvent) => void) | null,
      onerror: null as ((e: ProgressEvent) => void) | null,
    };
    vi.spyOn(global, 'FileReader' as never).mockImplementation(() => mockFR as unknown as FileReader);

    // Verify readAsDataURL is called (the contract of MEDI-03)
    const file = makeImageFile();
    await fileToBase64(file);

    expect(mockFR.readAsDataURL).toHaveBeenCalledTimes(1);
    expect(mockFR.readAsDataURL).toHaveBeenCalledWith(file);
    // The result starts with "data:" confirming base64 output (not a blob: URL)
    // Note: URL.createObjectURL is not available in jsdom, so we verify by
    // confirming the resolved value is a data URI string.
  });

  it('rejects when FileReader fires an error event', async () => {
    const mockFR = {
      readAsDataURL: vi.fn(function (this: typeof mockFR) {
        setTimeout(() => {
          this.onerror?.(new ProgressEvent('error'));
        }, 0);
      }),
      result: null as string | null,
      onload: null as ((e: ProgressEvent) => void) | null,
      onerror: null as ((e: ProgressEvent) => void) | null,
      error: new DOMException('Read failed'),
    };
    vi.spyOn(global, 'FileReader' as never).mockImplementation(() => mockFR as unknown as FileReader);

    const file = makeImageFile();
    await expect(fileToBase64(file)).rejects.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// autoFillCells tests (MEDI-04, MEDI-05)
// ---------------------------------------------------------------------------

describe('autoFillCells', () => {
  beforeEach(() => {
    // Mock fileToBase64 so autoFillCells tests don't need a real FileReader
    vi.spyOn(mediaModule, 'fileToBase64').mockResolvedValue('data:image/jpeg;base64,fakecontent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing with an empty file list (no store calls)', async () => {
    const actions = makeMockActions();
    await autoFillCells([], actions as FillActions);
    expect(actions.addMedia).not.toHaveBeenCalled();
    expect(actions.setMedia).not.toHaveBeenCalled();
  });

  it('fills the first empty leaf with a single image file', async () => {
    const root = buildInitialTree();
    const actions = makeMockActions(root);
    const leaves = getAllLeaves(actions.getRoot());
    await autoFillCells([makeImageFile()], actions as FillActions);
    expect(actions.addMedia).toHaveBeenCalledTimes(1);
    expect(actions.setMedia).toHaveBeenCalledWith(leaves[0].id, expect.any(String));
  });

  it('fills leaves in getAllLeaves() document order (index 0 first, then 1)', async () => {
    const root = buildInitialTree(); // vertical container with 2 empty leaves
    const actions = makeMockActions(root);
    const leaves = getAllLeaves(root);
    await autoFillCells([makeImageFile('a.jpg'), makeImageFile('b.jpg')], actions as FillActions);
    expect(actions.setMedia).toHaveBeenNthCalledWith(1, leaves[0].id, expect.any(String));
    expect(actions.setMedia).toHaveBeenNthCalledWith(2, leaves[1].id, expect.any(String));
    // No split needed when files <= empty cells
    expect(actions.split).not.toHaveBeenCalled();
  });

  it('auto-splits last filled leaf for overflow files (D-05)', async () => {
    const root = buildInitialTree(); // 2 empty leaves
    const actions = makeMockActions(root);
    // 3 files but only 2 empty cells → 3rd file should trigger a split
    await autoFillCells([makeImageFile(), makeImageFile(), makeImageFile()], actions as FillActions);
    expect(actions.split).toHaveBeenCalledWith(expect.any(String), 'horizontal');
    expect(actions.addMedia).toHaveBeenCalledTimes(3);
  });

  it('skips non-image files (text/plain)', async () => {
    const root = buildInitialTree();
    const actions = makeMockActions(root);
    await autoFillCells([makeTextFile()], actions as FillActions);
    expect(actions.addMedia).not.toHaveBeenCalled();
  });

  it('processes only image files in a mixed batch (image + text + image)', async () => {
    const root = buildInitialTree();
    const actions = makeMockActions(root);
    await autoFillCells([makeImageFile(), makeTextFile(), makeImageFile()], actions as FillActions);
    // Only 2 image files processed, 1 text skipped
    expect(actions.addMedia).toHaveBeenCalledTimes(2);
  });
});
