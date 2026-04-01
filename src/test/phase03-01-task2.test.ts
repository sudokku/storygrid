/**
 * Phase 03-01 Task 2 Tests
 * - fileToBase64: converts File to base64 data URI using FileReader
 * - autoFillCells: fills empty leaves in order, splits on overflow, skips non-image files
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileToBase64, autoFillCells } from '../lib/media';
import type { FillActions } from '../lib/media';
import { useGridStore } from '../store/gridStore';
import type { ContainerNode, LeafNode } from '../types';

function getInitialState() {
  return useGridStore.getInitialState();
}

beforeEach(() => {
  useGridStore.setState(getInitialState(), true);
});

// Helper: create a mock File with a specific MIME type
function makeFile(name: string, type: string): File {
  return new File(['fake-content'], name, { type });
}

// Mock FileReader for jsdom environment
function mockFileReader(result: string) {
  const originalFileReader = global.FileReader;
  const MockFileReader = vi.fn().mockImplementation(() => ({
    readAsDataURL: vi.fn().mockImplementation(function (this: { onload: ((e: ProgressEvent) => void) | null; result: string }) {
      this.result = result;
      // Trigger onload synchronously in mock
      setTimeout(() => {
        if (this.onload) {
          this.onload({} as ProgressEvent);
        }
      }, 0);
    }),
    onload: null as ((e: ProgressEvent) => void) | null,
    onerror: null,
    result: null as string | null,
  }));
  global.FileReader = MockFileReader as unknown as typeof FileReader;
  return () => { global.FileReader = originalFileReader; };
}

describe('Phase 03-01 Task 2: fileToBase64 + autoFillCells', () => {
  describe('fileToBase64', () => {
    it('resolves with a string starting with "data:"', async () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
      const restore = mockFileReader(dataUri);
      try {
        const file = makeFile('test.png', 'image/png');
        const result = await fileToBase64(file);
        expect(result).toBe(dataUri);
        expect(result.startsWith('data:')).toBe(true);
      } finally {
        restore();
      }
    });

    it('uses FileReader.readAsDataURL (not URL.createObjectURL)', async () => {
      const dataUri = 'data:image/jpeg;base64,abc123';
      const restore = mockFileReader(dataUri);
      const readAsDataURLSpy = vi.fn().mockImplementation(function (this: { onload: ((e: ProgressEvent) => void) | null; result: string }) {
        this.result = dataUri;
        setTimeout(() => {
          if (this.onload) this.onload({} as ProgressEvent);
        }, 0);
      });

      const MockFileReader2 = vi.fn().mockImplementation(() => ({
        readAsDataURL: readAsDataURLSpy,
        onload: null as ((e: ProgressEvent) => void) | null,
        onerror: null,
        result: null as string | null,
      }));
      global.FileReader = MockFileReader2 as unknown as typeof FileReader;

      try {
        const file = makeFile('photo.jpg', 'image/jpeg');
        await fileToBase64(file);
        expect(readAsDataURLSpy).toHaveBeenCalledWith(file);
      } finally {
        restore();
      }
    });
  });

  describe('autoFillCells', () => {
    // Helper: build mock FillActions backed by the real store
    function makeActions(): FillActions {
      return {
        addMedia: (mediaId, dataUri) => useGridStore.getState().addMedia(mediaId, dataUri),
        setMedia: (nodeId, mediaId) => useGridStore.getState().setMedia(nodeId, mediaId),
        split: (nodeId, direction) => useGridStore.getState().split(nodeId, direction),
        getRoot: () => useGridStore.getState().root,
      };
    }

    it('does nothing when files array is empty', async () => {
      const { root: rootBefore } = useGridStore.getState();
      await autoFillCells([], makeActions());
      const { root: rootAfter } = useGridStore.getState();
      expect(rootAfter).toBe(rootBefore);
    });

    it('skips non-image files', async () => {
      const restore = mockFileReader('data:text/plain;base64,aGVsbG8=');
      try {
        const { root: rootBefore } = useGridStore.getState();
        const textFile = makeFile('doc.txt', 'text/plain');
        await autoFillCells([textFile], makeActions());
        const { root: rootAfter } = useGridStore.getState();
        expect(rootAfter).toBe(rootBefore);
      } finally {
        restore();
      }
    });

    it('fills empty cells in document order', async () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
      const restore = mockFileReader(dataUri);
      try {
        const imageFile = makeFile('photo.png', 'image/png');
        await autoFillCells([imageFile], makeActions());

        const { root } = useGridStore.getState();
        // Initial tree: vertical container with 2 leaves — first leaf should be filled
        const container = root as ContainerNode;
        const firstLeaf = container.children[0] as LeafNode;
        expect(firstLeaf.mediaId).not.toBeNull();
        // Second leaf should still be empty
        const secondLeaf = container.children[1] as LeafNode;
        expect(secondLeaf.mediaId).toBeNull();
      } finally {
        restore();
      }
    });

    it('fills multiple empty cells in order with multiple files', async () => {
      let callCount = 0;
      const dataUris = ['data:image/png;base64,first=', 'data:image/png;base64,second='];

      const originalFileReader = global.FileReader;
      const MockFileReader = vi.fn().mockImplementation(() => {
        const idx = callCount++;
        return {
          readAsDataURL: vi.fn().mockImplementation(function (this: { onload: ((e: ProgressEvent) => void) | null; result: string }) {
            this.result = dataUris[idx] ?? dataUris[dataUris.length - 1];
            setTimeout(() => {
              if (this.onload) this.onload({} as ProgressEvent);
            }, 0);
          }),
          onload: null as ((e: ProgressEvent) => void) | null,
          onerror: null,
          result: null as string | null,
        };
      });
      global.FileReader = MockFileReader as unknown as typeof FileReader;

      try {
        const files = [
          makeFile('a.png', 'image/png'),
          makeFile('b.png', 'image/png'),
        ];
        await autoFillCells(files, makeActions());

        const { root, mediaRegistry } = useGridStore.getState();
        const container = root as ContainerNode;
        const firstLeaf = container.children[0] as LeafNode;
        const secondLeaf = container.children[1] as LeafNode;

        expect(firstLeaf.mediaId).not.toBeNull();
        expect(secondLeaf.mediaId).not.toBeNull();
        // Both media entries should be base64 data URIs
        expect(mediaRegistry[firstLeaf.mediaId!]).toMatch(/^data:/);
        expect(mediaRegistry[secondLeaf.mediaId!]).toMatch(/^data:/);
      } finally {
        global.FileReader = originalFileReader;
      }
    });

    it('splits when no empty cells remain (overflow)', async () => {
      const dataUri = 'data:image/png;base64,overflow=';
      let callCount = 0;

      const originalFileReader = global.FileReader;
      const MockFileReader = vi.fn().mockImplementation(() => {
        callCount++;
        return {
          readAsDataURL: vi.fn().mockImplementation(function (this: { onload: ((e: ProgressEvent) => void) | null; result: string }) {
            this.result = dataUri;
            setTimeout(() => {
              if (this.onload) this.onload({} as ProgressEvent);
            }, 0);
          }),
          onload: null as ((e: ProgressEvent) => void) | null,
          onerror: null,
          result: null as string | null,
        };
      });
      global.FileReader = MockFileReader as unknown as typeof FileReader;

      try {
        // Fill both initial empty leaves first
        const files = [
          makeFile('a.png', 'image/png'),
          makeFile('b.png', 'image/png'),
          makeFile('c.png', 'image/png'), // overflow — should trigger a split
        ];
        await autoFillCells(files, makeActions());

        const { root } = useGridStore.getState();
        // After filling 2 leaves and splitting for 1 overflow, we should have 3+ leaves
        // The tree should have grown beyond the initial 2 leaves
        expect(root.type).toBe('container');
        // All leaves that were filled should have mediaId set
        const countFilledLeaves = (node: typeof root): number => {
          if (node.type === 'leaf') return node.mediaId ? 1 : 0;
          return node.children.reduce((sum, child) => sum + countFilledLeaves(child), 0);
        };
        const filledCount = countFilledLeaves(root);
        expect(filledCount).toBe(3);
      } finally {
        global.FileReader = originalFileReader;
      }
    });

    it('only puts base64 data URIs in mediaRegistry (no blob URLs)', async () => {
      const dataUri = 'data:image/png;base64,abc123=';
      const restore = mockFileReader(dataUri);
      try {
        const file = makeFile('photo.png', 'image/png');
        await autoFillCells([file], makeActions());

        const { mediaRegistry } = useGridStore.getState();
        Object.values(mediaRegistry).forEach(value => {
          expect(value).toMatch(/^data:/);
          expect(value).not.toMatch(/^blob:/);
        });
      } finally {
        restore();
      }
    });
  });
});
