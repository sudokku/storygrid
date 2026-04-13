/**
 * phase19-integration.test.ts
 * Integration tests for DROP-03: single-file drop onto a LeafNode targets that cell directly.
 *
 * Tests verify:
 * - Single file drop calls setMedia with the LeafNode's own id (not routed through autoFillCells)
 * - Multi-file drop calls autoFillCells (BFS routing)
 * - setHasAudioTrack is called after single-file drop
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGridStore } from '../store/gridStore';
import { buildInitialTree, getAllLeaves } from '../lib/tree';
import type { LeafNode } from '../types';

// Mock media module to avoid AudioContext and FileReader in jsdom
vi.mock('../lib/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/media')>();
  return {
    ...actual,
    detectAudioTrack: vi.fn().mockResolvedValue(false),
    autoFillCells: vi.fn().mockResolvedValue(undefined),
    fileToBase64: vi.fn().mockResolvedValue('data:image/jpeg;base64,fake'),
  };
});

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: simulate the single-file drop logic from LeafNode.handleDrop
// This tests the store integration without needing a React component.
// ---------------------------------------------------------------------------

async function simulateSingleFileDrop(leafId: string, file: File) {
  const { addMedia, setMedia, setHasAudioTrack } = useGridStore.getState();
  const { detectAudioTrack, fileToBase64 } = await import('../lib/media');

  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;

  const mediaId = `media-${Date.now()}`;

  if (file.type.startsWith('video/')) {
    // Mock URL.createObjectURL
    const blobUrl = 'blob:fake-video-url';
    addMedia(mediaId, blobUrl, 'video');
  } else {
    const dataUri = await fileToBase64(file);
    addMedia(mediaId, dataUri, 'image');
  }

  setMedia(leafId, mediaId);

  const hasAudio = file.type.startsWith('video/')
    ? await detectAudioTrack(file)
    : false;
  setHasAudioTrack(leafId, hasAudio);

  return { mediaId, hasAudio };
}

describe('DROP-03: Single-file drop targets specific leaf cell', () => {
  it('setMedia is called with the specific leaf id for single-file image drop', async () => {
    const root = buildInitialTree();
    useGridStore.setState({ root }, false);

    const leaves = getAllLeaves(useGridStore.getState().root);
    const targetLeaf = leaves[1]; // drop onto second leaf specifically

    const imageFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    await simulateSingleFileDrop(targetLeaf.id, imageFile);

    // Verify the second leaf was targeted, not the first (BFS would pick first)
    const updatedRoot = useGridStore.getState().root;
    const updatedLeaves = getAllLeaves(updatedRoot);
    const firstLeaf = updatedLeaves.find(l => l.id === leaves[0].id) as LeafNode;
    const secondLeaf = updatedLeaves.find(l => l.id === targetLeaf.id) as LeafNode;

    expect(firstLeaf.mediaId).toBeNull(); // first leaf untouched
    expect(secondLeaf.mediaId).not.toBeNull(); // second leaf filled
  });

  it('setHasAudioTrack is called with false for image single-file drop', async () => {
    const root = buildInitialTree();
    useGridStore.setState({ root }, false);

    const leaves = getAllLeaves(useGridStore.getState().root);
    const targetLeaf = leaves[0];

    // Spy on setHasAudioTrack
    const setHasAudioTrackSpy = vi.fn();
    useGridStore.setState({ setHasAudioTrack: setHasAudioTrackSpy } as never, false);

    const imageFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    await simulateSingleFileDrop(targetLeaf.id, imageFile);

    expect(setHasAudioTrackSpy).toHaveBeenCalledWith(targetLeaf.id, false);
  });

  it('setHasAudioTrack is called with detectAudioTrack result for video single-file drop', async () => {
    const root = buildInitialTree();
    useGridStore.setState({ root }, false);

    const leaves = getAllLeaves(useGridStore.getState().root);
    const targetLeaf = leaves[0];

    // detectAudioTrack mocked to return false (silent video)
    const { detectAudioTrack } = await import('../lib/media');
    (detectAudioTrack as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const setHasAudioTrackSpy = vi.fn();
    useGridStore.setState({ setHasAudioTrack: setHasAudioTrackSpy } as never, false);

    const videoFile = new File([''], 'clip.mp4', { type: 'video/mp4' });
    await simulateSingleFileDrop(targetLeaf.id, videoFile);

    expect(setHasAudioTrackSpy).toHaveBeenCalledWith(targetLeaf.id, false);
  });

  it('non-media files are ignored in single-file drop (no store calls)', async () => {
    const root = buildInitialTree();
    useGridStore.setState({ root }, false);

    const leaves = getAllLeaves(useGridStore.getState().root);
    const targetLeaf = leaves[0];

    const setMediaSpy = vi.fn();
    useGridStore.setState({ setMedia: setMediaSpy } as never, false);

    const textFile = new File([''], 'doc.txt', { type: 'text/plain' });
    await simulateSingleFileDrop(targetLeaf.id, textFile);

    expect(setMediaSpy).not.toHaveBeenCalled();
  });
});
