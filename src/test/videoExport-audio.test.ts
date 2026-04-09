import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildAudioGraph,
  buildExportVideoElements,
  hasAudioEnabledVideoLeaf,
} from '@/lib/videoExport';
import type { GridNode, LeafNode } from '@/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let leafCounter = 0;
function makeLeaf(overrides: Partial<LeafNode> = {}): LeafNode {
  leafCounter += 1;
  return {
    type: 'leaf',
    id: `leaf-${leafCounter}`,
    mediaId: null,
    fit: 'cover',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      preset: null,
    },
    audioEnabled: true,
    ...overrides,
  };
}

function makeMockAudioCtx() {
  const connectSpy = vi.fn();
  const createMediaElementSource = vi.fn(() => ({ connect: connectSpy }));
  const mockDestination = {
    stream: { getAudioTracks: () => [{} as MediaStreamTrack] },
  };
  const createMediaStreamDestination = vi.fn(() => mockDestination);
  const close = vi.fn(() => Promise.resolve());
  const resume = vi.fn(() => Promise.resolve());
  const realDestination = { __marker: 'audioCtx.destination' };
  const ctx = {
    createMediaElementSource,
    createMediaStreamDestination,
    close,
    resume,
    state: 'running',
    destination: realDestination,
  } as unknown as AudioContext;
  return {
    ctx,
    connectSpy,
    createMediaElementSource,
    createMediaStreamDestination,
    mockDestination,
    realDestination,
    close,
  };
}

function makeVideoEl(tag = 'vid'): HTMLVideoElement {
  // jsdom video element — we don't actually play it, we just pass the reference.
  const el = document.createElement('video');
  (el as unknown as { __tag: string }).__tag = tag;
  return el;
}

beforeEach(() => {
  leafCounter = 0;
});

// ===========================================================================
// buildAudioGraph — null return (AUD-06)
// ===========================================================================

describe('buildAudioGraph — null return (AUD-06)', () => {
  it('returns null when zero audio-enabled video leaves exist (all muted)', () => {
    const { ctx, createMediaElementSource, createMediaStreamDestination } =
      makeMockAudioCtx();
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'm1', audioEnabled: false }),
      makeLeaf({ mediaId: 'm2', audioEnabled: false }),
    ];
    const elements = new Map<string, HTMLVideoElement>([
      ['m1', makeVideoEl('m1')],
      ['m2', makeVideoEl('m2')],
    ]);
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      m1: 'video',
      m2: 'video',
    };

    const result = buildAudioGraph(ctx, elements, leaves, mediaTypeMap);

    expect(result).toBeNull();
    expect(createMediaStreamDestination).not.toHaveBeenCalled();
    expect(createMediaElementSource).not.toHaveBeenCalled();
  });

  it('returns null when audioEnabled=true leaves are image-type only', () => {
    const { ctx, createMediaElementSource, createMediaStreamDestination } =
      makeMockAudioCtx();
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'img1', audioEnabled: true }),
      makeLeaf({ mediaId: 'img2', audioEnabled: true }),
    ];
    const elements = new Map<string, HTMLVideoElement>(); // no video elements at all
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      img1: 'image',
      img2: 'image',
    };

    const result = buildAudioGraph(ctx, elements, leaves, mediaTypeMap);

    expect(result).toBeNull();
    expect(createMediaStreamDestination).not.toHaveBeenCalled();
    expect(createMediaElementSource).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// buildAudioGraph — wiring (AUD-05)
// ===========================================================================

describe('buildAudioGraph — wiring (AUD-05)', () => {
  it('creates one source per unique audio-enabled video mediaId and connects each to the destination', () => {
    const {
      ctx,
      connectSpy,
      createMediaElementSource,
      createMediaStreamDestination,
      mockDestination,
    } = makeMockAudioCtx();

    const v1 = makeVideoEl('v1');
    const v2 = makeVideoEl('v2');
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
      makeLeaf({ mediaId: 'v2', audioEnabled: true }),
    ];
    const elements = new Map<string, HTMLVideoElement>([
      ['v1', v1],
      ['v2', v2],
    ]);
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      v1: 'video',
      v2: 'video',
    };

    const result = buildAudioGraph(ctx, elements, leaves, mediaTypeMap);

    expect(createMediaStreamDestination).toHaveBeenCalledTimes(1);
    expect(createMediaElementSource).toHaveBeenCalledTimes(2);
    expect(createMediaElementSource).toHaveBeenCalledWith(v1);
    expect(createMediaElementSource).toHaveBeenCalledWith(v2);
    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(result).toBe(mockDestination);
  });

  it('returns the exact MediaStreamAudioDestinationNode created by createMediaStreamDestination', () => {
    const { ctx, mockDestination } = makeMockAudioCtx();
    const v1 = makeVideoEl('v1');
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
    ];
    const elements = new Map<string, HTMLVideoElement>([['v1', v1]]);
    const mediaTypeMap: Record<string, 'image' | 'video'> = { v1: 'video' };

    const result = buildAudioGraph(ctx, elements, leaves, mediaTypeMap);

    expect(result).toBe(mockDestination);
  });

  it('D-18: source.connect is only called with destination node, never with audioCtx.destination', () => {
    const { ctx, connectSpy, mockDestination, realDestination } =
      makeMockAudioCtx();
    const v1 = makeVideoEl('v1');
    const v2 = makeVideoEl('v2');
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
      makeLeaf({ mediaId: 'v2', audioEnabled: true }),
    ];
    const elements = new Map<string, HTMLVideoElement>([
      ['v1', v1],
      ['v2', v2],
    ]);
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      v1: 'video',
      v2: 'video',
    };

    buildAudioGraph(ctx, elements, leaves, mediaTypeMap);

    // Every connect call must target the destination node, not audioCtx.destination.
    for (const call of connectSpy.mock.calls) {
      expect(call[0]).toBe(mockDestination);
      expect(call[0]).not.toBe(realDestination);
    }
  });
});

// ===========================================================================
// buildAudioGraph — de-duplication
// ===========================================================================

describe('buildAudioGraph — de-duplication', () => {
  it('calls createMediaElementSource once per unique mediaId even when multiple leaves share it', () => {
    const { ctx, createMediaElementSource, connectSpy } = makeMockAudioCtx();
    const vShared = makeVideoEl('shared');
    const vOther = makeVideoEl('other');

    // Three audio-enabled leaves; two share mediaId 'shared'.
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
      makeLeaf({ mediaId: 'other', audioEnabled: true }),
    ];
    const elements = new Map<string, HTMLVideoElement>([
      ['shared', vShared],
      ['other', vOther],
    ]);
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      shared: 'video',
      other: 'video',
    };

    buildAudioGraph(ctx, elements, leaves, mediaTypeMap);

    expect(createMediaElementSource).toHaveBeenCalledTimes(2);
    expect(connectSpy).toHaveBeenCalledTimes(2);

    // Ensure each underlying video element was only passed once.
    const elementArgs = createMediaElementSource.mock.calls.map((c) => c[0]);
    expect(elementArgs).toContain(vShared);
    expect(elementArgs).toContain(vOther);
    expect(new Set(elementArgs).size).toBe(2);
  });
});

// ===========================================================================
// buildExportVideoElements — conditional muted (AUD-05)
// ===========================================================================

describe('buildExportVideoElements — conditional muted', () => {
  // Stub jsdom's HTMLMediaElement.load / .play which are unimplemented, and
  // force readyState >= 2 so buildExportVideoElements resolves immediately.
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get() {
        return 4; // HAVE_ENOUGH_DATA
      },
    });
  });

  function rootOf(...leaves: LeafNode[]): GridNode {
    if (leaves.length === 1) return leaves[0];
    return {
      type: 'container',
      id: 'c-root',
      direction: 'horizontal',
      sizes: leaves.map(() => 1),
      children: leaves,
    };
  }

  it('sets video.muted = false for mediaIds whose leaf has audioEnabled=true', async () => {
    const root = rootOf(
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
    );
    const mediaRegistry = { v1: 'blob:fake-v1' };
    const mediaTypeMap: Record<string, 'image' | 'video'> = { v1: 'video' };

    const result = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

    const videoEl = result.get('v1');
    expect(videoEl).toBeDefined();
    expect(videoEl!.muted).toBe(false);
  });

  it('sets video.muted = true for mediaIds whose leaf has audioEnabled=false', async () => {
    const root = rootOf(
      makeLeaf({ mediaId: 'v1', audioEnabled: false }),
    );
    const mediaRegistry = { v1: 'blob:fake-v1' };
    const mediaTypeMap: Record<string, 'image' | 'video'> = { v1: 'video' };

    const result = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

    const videoEl = result.get('v1');
    expect(videoEl).toBeDefined();
    expect(videoEl!.muted).toBe(true);
  });

  it('unmutes shared mediaId when ANY leaf using it wants audio', async () => {
    const root = rootOf(
      makeLeaf({ mediaId: 'shared', audioEnabled: false }),
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
    );
    const mediaRegistry = { shared: 'blob:fake-shared' };
    const mediaTypeMap: Record<string, 'image' | 'video'> = { shared: 'video' };

    const result = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

    // De-duped to one element; because ONE leaf wants audio, unmute it.
    expect(result.size).toBe(1);
    const videoEl = result.get('shared');
    expect(videoEl).toBeDefined();
    expect(videoEl!.muted).toBe(false);
  });

  it('hasAudioEnabledVideoLeaf returns true for mixed tree with one enabled video', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'img', audioEnabled: true }),
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      img: 'image',
      v1: 'video',
    };
    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(true);
  });

  it('hasAudioEnabledVideoLeaf returns false for tree of only images', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'img1', audioEnabled: true }),
      makeLeaf({ mediaId: 'img2', audioEnabled: true }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      img1: 'image',
      img2: 'image',
    };
    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(false);
  });

  it('hasAudioEnabledVideoLeaf returns false when all video leaves are muted', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'v1', audioEnabled: false }),
      makeLeaf({ mediaId: 'v2', audioEnabled: false }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      v1: 'video',
      v2: 'video',
    };
    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(false);
  });

  it('hasAudioEnabledVideoLeaf returns false for empty leaves array', () => {
    expect(hasAudioEnabledVideoLeaf([], {})).toBe(false);
  });

  it('image mediaIds do not appear in exportVideoElements map', async () => {
    const root = rootOf(
      makeLeaf({ mediaId: 'img1', audioEnabled: true }),
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
    );
    const mediaRegistry = { img1: 'data:image/png;base64,xxx', v1: 'blob:fake-v1' };
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      img1: 'image',
      v1: 'video',
    };

    const result = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

    expect(result.has('img1')).toBe(false);
    expect(result.has('v1')).toBe(true);
  });
});
