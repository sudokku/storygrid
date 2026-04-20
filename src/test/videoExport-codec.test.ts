/**
 * videoExport-codec.test.ts
 * Tests for D-01 (runtime codec pre-flight) and D-04A (AudioContext pre-creation).
 * RED phase: written before implementation in src/lib/videoExport.ts (Task 2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mediabunny mock — prevents actual WebCodecs calls in jsdom
// ---------------------------------------------------------------------------

vi.mock('mediabunny', async () => {
  return {
    Output: vi.fn().mockImplementation(() => ({
      addVideoTrack: vi.fn(),
      addAudioTrack: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      finalize: vi.fn().mockResolvedValue(undefined),
    })),
    Mp4OutputFormat: vi.fn(),
    BufferTarget: vi.fn().mockImplementation(() => ({ buffer: new ArrayBuffer(0) })),
    CanvasSource: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue(undefined),
    })),
    AudioBufferSource: vi.fn(),
    QUALITY_HIGH: 8_000_000,
    canEncodeAudio: vi.fn().mockResolvedValue(true),
    getFirstEncodableVideoCodec: vi.fn().mockResolvedValue('avc'),
    BlobSource: vi.fn(),
    Input: vi.fn(),
    VideoSampleSink: vi.fn(),
    ALL_FORMATS: [],
  };
});

vi.mock('@mediabunny/aac-encoder', () => ({ registerAacEncoder: vi.fn() }));
vi.mock('../store/overlayStore', () => ({
  useOverlayStore: {
    getState: vi.fn().mockReturnValue({ overlays: [], stickerRegistry: {} }),
  },
}));
vi.mock('../lib/overlayExport', () => ({
  drawOverlaysToCanvas: vi.fn().mockResolvedValue(undefined),
}));

import { exportVideoGrid } from '../lib/videoExport';
import { getFirstEncodableVideoCodec } from 'mediabunny';
import type { CanvasSettings } from '../lib/export';
import { createLeaf } from '../lib/tree';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSettings(): CanvasSettings {
  return {
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: '#ffffff',
    cornerRadius: 0,
  };
}

function makeRoot() {
  return createLeaf();
}

/**
 * Install a stub canvas so that document.createElement('canvas').getContext('2d')
 * returns a non-null context. jsdom does not implement canvas rendering without
 * the optional 'canvas' npm package; this stub is enough to pass the guard in
 * exportVideoGrid and allow the codec pre-flight to run.
 */
function stubCanvas() {
  const fakeCtx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    putImageData: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray() }),
    canvas: {} as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;

  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...rest: unknown[]) => {
    if (tag === 'canvas') {
      const el = origCreateElement(tag) as HTMLCanvasElement;
      vi.spyOn(el, 'getContext').mockReturnValue(fakeCtx as unknown as null);
      return el;
    }
    return origCreateElement(tag, ...(rest as [ElementCreationOptions?]));
  });
}

// ---------------------------------------------------------------------------
// D-01: Runtime codec pre-flight
// ---------------------------------------------------------------------------

describe('D-01: exportVideoGrid codec pre-flight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFirstEncodableVideoCodec).mockResolvedValue('avc');

    // VideoEncoder must be defined for the guard to pass
    if (typeof (globalThis as Record<string, unknown>).VideoEncoder === 'undefined') {
      Object.defineProperty(globalThis, 'VideoEncoder', {
        value: {},
        configurable: true,
        writable: true,
      });
    }

    stubCanvas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws user-visible error when getFirstEncodableVideoCodec returns null', async () => {
    vi.mocked(getFirstEncodableVideoCodec).mockResolvedValue(null);

    const root = makeRoot();
    const onProgress = vi.fn();

    await expect(
      exportVideoGrid(root, {}, {}, makeSettings(), 1, onProgress)
    ).rejects.toThrow('No supported video encoder found in this browser.');
  });

  it('calls getFirstEncodableVideoCodec with avc/vp9/av1 priority order', async () => {
    vi.mocked(getFirstEncodableVideoCodec).mockResolvedValue('avc');

    const root = makeRoot();
    const onProgress = vi.fn();

    // Will likely throw later in the pipeline (no real canvas/media) — we only care
    // that getFirstEncodableVideoCodec was called with the right arguments.
    try {
      await exportVideoGrid(root, {}, {}, makeSettings(), 1, onProgress);
    } catch {
      // Expected — export pipeline not fully mocked; codec call is what we test
    }

    expect(getFirstEncodableVideoCodec).toHaveBeenCalledWith(
      ['avc', 'vp9', 'av1'],
      expect.objectContaining({ width: 1080, height: 1920 })
    );
  });
});

// ---------------------------------------------------------------------------
// D-04A: AudioContext pre-creation order
// ---------------------------------------------------------------------------

describe('D-04A: AudioContext pre-creation before first await', () => {
  let audioContextConstructorCallOrder: number;
  let getCodecCallOrder: number;
  let callCounter: number;

  beforeEach(() => {
    callCounter = 0;
    audioContextConstructorCallOrder = -1;
    getCodecCallOrder = -1;

    vi.clearAllMocks();

    if (typeof (globalThis as Record<string, unknown>).VideoEncoder === 'undefined') {
      Object.defineProperty(globalThis, 'VideoEncoder', {
        value: {},
        configurable: true,
        writable: true,
      });
    }

    stubCanvas();

    // Track AudioContext construction order.
    // jsdom does not expose AudioContext natively, so use Object.defineProperty
    // to install a mock constructor rather than vi.spyOn (which requires the
    // property to already exist on the target).
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: function MockAudioContext(this: unknown) {
        audioContextConstructorCallOrder = ++callCounter;
        return { close: vi.fn().mockResolvedValue(undefined), state: 'suspended', decodeAudioData: vi.fn() } as unknown as AudioContext;
      },
    });

    // Track getFirstEncodableVideoCodec call order (it is the first await)
    vi.mocked(getFirstEncodableVideoCodec).mockImplementation(async (..._args: unknown[]) => {
      getCodecCallOrder = ++callCounter;
      return 'avc';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates AudioContext (sync) before getFirstEncodableVideoCodec (first await)', async () => {
    const root = makeRoot();
    const onProgress = vi.fn();

    try {
      await exportVideoGrid(root, {}, {}, makeSettings(), 1, onProgress);
    } catch {
      // Export pipeline will throw after codec; we only care about call order
    }

    expect(audioContextConstructorCallOrder).toBeGreaterThan(0);
    expect(getCodecCallOrder).toBeGreaterThan(0);
    // AudioContext must be constructed BEFORE the codec await resolves
    expect(audioContextConstructorCallOrder).toBeLessThan(getCodecCallOrder);
  });
});
