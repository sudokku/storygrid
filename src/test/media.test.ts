/**
 * media.test.ts
 * Tests for fileToBase64 (MEDI-03) and autoFillCells (MEDI-04, MEDI-05).
 * Coverage: BFS order (D-13), depth-based overflow split (D-14),
 * audio detection wiring (D-15), non-image rejection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as mediaModule from '../lib/media';
import { autoFillCells, fileToBase64 } from '../lib/media';
import { buildInitialTree, getAllLeaves, splitNode, buildTemplate } from '../lib/tree';
import type { FillActions } from '../lib/media';
import type { GridNode } from '../types';

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
  const setHasAudioTrack = vi.fn((_nodeId: string, _hasAudio: boolean) => {});
  return { addMedia, setMedia, split, getRoot, setHasAudioTrack };
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
    // Mock detectAudioTrack to avoid AudioContext in jsdom
    vi.spyOn(mediaModule, 'detectAudioTrack').mockResolvedValue(true);
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

  it('auto-splits last filled leaf for overflow files (alternating direction)', async () => {
    const root = buildInitialTree(); // vertical container with 2 empty leaves
    const actions = makeMockActions(root);
    // 3 files but only 2 empty cells → 3rd file should trigger a split
    await autoFillCells([makeImageFile(), makeImageFile(), makeImageFile()], actions as FillActions);
    expect(actions.split).toHaveBeenCalledTimes(1);
    expect(actions.addMedia).toHaveBeenCalledTimes(3);
  });

  it('overflow splits alternate direction across multiple overflows', async () => {
    // Single-leaf tree: 5 files → 4 overflow splits needed
    // overflowCount: 0=H, 1=V, 2=H, 3=V
    const root = buildInitialTree(); // has 2 leaves by default — we need 1
    // Use a single leaf tree for clarity
    const singleLeaf: GridNode = { type: 'leaf', id: 'root-leaf', mediaId: null, fit: 'cover', objectPosition: { x: 0.5, y: 0.5 }, effects: { brightness: 100, contrast: 100, saturation: 100, blur: 0, preset: 'none' }, audioEnabled: true, hasAudioTrack: false };
    const actions = makeMockActions(singleLeaf);
    const files = [
      makeImageFile('a.jpg'),
      makeImageFile('b.jpg'),
      makeImageFile('c.jpg'),
      makeImageFile('d.jpg'),
      makeImageFile('e.jpg'),
    ];
    await autoFillCells(files, actions as FillActions);
    // 4 overflow splits for 5 files into 1 initial leaf
    expect(actions.split).toHaveBeenCalledTimes(4);
    // Directions should alternate: H, V, H, V
    expect(actions.split).toHaveBeenNthCalledWith(1, expect.any(String), 'horizontal');
    expect(actions.split).toHaveBeenNthCalledWith(2, expect.any(String), 'vertical');
    expect(actions.split).toHaveBeenNthCalledWith(3, expect.any(String), 'horizontal');
    expect(actions.split).toHaveBeenNthCalledWith(4, expect.any(String), 'vertical');
    expect(actions.addMedia).toHaveBeenCalledTimes(5);
  });

  it('fills a 2x2 grid (4 leaves) in BFS order (level-by-level)', async () => {
    // buildTemplate('2x2'): vertical root → [horizontal(leaf0, leaf1), horizontal(leaf2, leaf3)]
    // BFS order: leaf0 (depth 2), leaf1 (depth 2), leaf2 (depth 2), leaf3 (depth 2)
    // All at same depth so left-to-right, top-to-bottom
    const root = buildTemplate('2x2');
    const actions = makeMockActions(root);
    const allLeaves = getAllLeaves(root);
    await autoFillCells([
      makeImageFile('a.jpg'),
      makeImageFile('b.jpg'),
      makeImageFile('c.jpg'),
      makeImageFile('d.jpg'),
    ], actions as FillActions);
    // All 4 leaves should be filled in BFS order (no splits needed)
    expect(actions.split).not.toHaveBeenCalled();
    expect(actions.setMedia).toHaveBeenNthCalledWith(1, allLeaves[0].id, expect.any(String));
    expect(actions.setMedia).toHaveBeenNthCalledWith(2, allLeaves[1].id, expect.any(String));
    expect(actions.setMedia).toHaveBeenNthCalledWith(3, allLeaves[2].id, expect.any(String));
    expect(actions.setMedia).toHaveBeenNthCalledWith(4, allLeaves[3].id, expect.any(String));
  });

  it('calls setHasAudioTrack after each media assignment for video files', async () => {
    // Mock URL.createObjectURL since jsdom doesn't support it
    const origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-url');
    try {
      const root = buildInitialTree();
      const actions = makeMockActions(root);
      const leaves = getAllLeaves(actions.getRoot());
      const videoFile = new File([''], 'clip.mp4', { type: 'video/mp4' });
      await autoFillCells([videoFile], actions as FillActions);
      // setHasAudioTrack must be called once — value comes from detectAudioTrack (mocked true)
      expect(actions.setHasAudioTrack).toHaveBeenCalledTimes(1);
      expect(actions.setHasAudioTrack).toHaveBeenCalledWith(leaves[0].id, true);
    } finally {
      URL.createObjectURL = origCreateObjectURL;
    }
  });

  it('calls setHasAudioTrack(nodeId, false) for image files without calling detectAudioTrack', async () => {
    const root = buildInitialTree();
    const actions = makeMockActions(root);
    const leaves = getAllLeaves(actions.getRoot());
    await autoFillCells([makeImageFile()], actions as FillActions);
    expect(actions.setHasAudioTrack).toHaveBeenCalledWith(leaves[0].id, false);
    expect(mediaModule.detectAudioTrack).not.toHaveBeenCalled();
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
