import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasAudioEnabledVideoLeaf,
} from '@/lib/videoExport';
import type { LeafNode } from '@/types';

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
    hasAudioTrack: true,
    ...overrides,
  };
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
