import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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
// hasAudioEnabledVideoLeaf (AUD-06 skip-path decision helper)
// ===========================================================================

describe('hasAudioEnabledVideoLeaf', () => {
  it('returns false when leaves array is empty', () => {
    expect(hasAudioEnabledVideoLeaf([], {})).toBe(false);
  });

  it('returns false when all video leaves have audioEnabled=false', () => {
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

  it('returns false when audioEnabled=true leaves are image-type only', () => {
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

  it('returns true when at least one leaf has audioEnabled=true and is a video', () => {
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

  it('returns true when all leaves are audio-enabled videos', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'v1', audioEnabled: true }),
      makeLeaf({ mediaId: 'v2', audioEnabled: true }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      v1: 'video',
      v2: 'video',
    };
    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(true);
  });

  it('returns false when leaf has audioEnabled=true but no mediaId', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: null, audioEnabled: true }),
    ];
    expect(hasAudioEnabledVideoLeaf(leaves, {})).toBe(false);
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

  it('only creates one video element per unique mediaId (de-duplication)', async () => {
    const root = rootOf(
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
    );
    const mediaRegistry = { shared: 'blob:fake-shared' };
    const mediaTypeMap: Record<string, 'image' | 'video'> = { shared: 'video' };

    const result = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

    expect(result.size).toBe(1);
    expect(result.has('shared')).toBe(true);
  });

  it('returns empty map when root has no video leaves', async () => {
    const root = rootOf(
      makeLeaf({ mediaId: 'img1', audioEnabled: true }),
    );
    const mediaRegistry = { img1: 'data:image/png;base64,xxx' };
    const mediaTypeMap: Record<string, 'image' | 'video'> = { img1: 'image' };

    const result = await buildExportVideoElements(root, mediaRegistry, mediaTypeMap);

    expect(result.size).toBe(0);
  });
});

// ===========================================================================
// Audio-enabled mediaId collection (AUD-05, AUD-06)
// ===========================================================================

describe('hasAudioEnabledVideoLeaf — AUD-06 skip path', () => {
  it('returns false when no leaves have audio-enabled video (all muted)', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'm1', audioEnabled: false }),
      makeLeaf({ mediaId: 'm2', audioEnabled: false }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      m1: 'video',
      m2: 'video',
    };

    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(false);
  });

  it('returns false when audio-enabled leaves are all images (no video)', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'img1', audioEnabled: true }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      img1: 'image',
    };

    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(false);
  });

  it('returns true when at least one audio-enabled video leaf exists', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'm1', audioEnabled: false }),
      makeLeaf({ mediaId: 'm2', audioEnabled: true }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      m1: 'video',
      m2: 'video',
    };

    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(true);
  });

  it('de-duplicates: two leaves sharing same audio-enabled video mediaId returns true', () => {
    const leaves: LeafNode[] = [
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
      makeLeaf({ mediaId: 'shared', audioEnabled: true }),
    ];
    const mediaTypeMap: Record<string, 'image' | 'video'> = {
      shared: 'video',
    };

    // Two leaves share the same video — at least one is audio-enabled
    expect(hasAudioEnabledVideoLeaf(leaves, mediaTypeMap)).toBe(true);
  });
});

// ===========================================================================
// objectPosition field on makeLeaf (baseline shape test)
// ===========================================================================
describe('makeLeaf helper', () => {
  it('creates a valid LeafNode with expected defaults', () => {
    const leaf = makeLeaf();
    expect(leaf.type).toBe('leaf');
    expect(leaf.audioEnabled).toBe(true);
    expect(leaf.fit).toBe('cover');
  });
});

// ===========================================================================
// Unused import guard — ensure makeVideoEl is used in at least one test
// ===========================================================================
describe('makeVideoEl helper', () => {
  it('creates a video element with a custom tag marker', () => {
    const el = makeVideoEl('test-tag');
    expect(el.tagName.toLowerCase()).toBe('video');
    expect((el as unknown as { __tag: string }).__tag).toBe('test-tag');
  });
});
