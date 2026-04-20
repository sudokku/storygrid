/**
 * Phase 07-02 Task 1 Tests — gridStore thumbnailMap + captureVideoThumbnail
 * Covers: initial state, addMedia image (no capture), addMedia video (triggers capture),
 *         removeMedia cleanup, clearGrid reset, applyTemplate reset, timeout null behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGridStore, captureVideoThumbnail, _capture } from '../store/gridStore';
import type { GridNode } from '../types';

// ---------------------------------------------------------------------------
// jsdom compatibility: mock URL.revokeObjectURL
// ---------------------------------------------------------------------------

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

const initialRoot: GridNode = {
  type: 'leaf',
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
  audioEnabled: true,
};

beforeEach(() => {
  useGridStore.setState(useGridStore.getInitialState(), true);
  vi.clearAllMocks();
  // Reset _capture.fn to real implementation after any test overrides
  _capture.fn = captureVideoThumbnail;
});

afterEach(() => {
  // Restore _capture.fn to real implementation
  _capture.fn = captureVideoThumbnail;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 07-02 gridStore thumbnailMap', () => {

  it('Test 1: initial state contains thumbnailMap: {}', () => {
    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap).toEqual({});
  });

  it('Test 2: addMedia(id, blobUrl, "image") does NOT trigger thumbnail capture; thumbnailMap remains empty', async () => {
    const mockFn = vi.fn().mockResolvedValue(null);
    _capture.fn = mockFn;

    useGridStore.getState().addMedia('img-1', 'data:image/png;base64,abc', 'image');

    // Flush microtasks
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockFn).not.toHaveBeenCalled();

    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap).toEqual({});
  });

  it('Test 3: addMedia(id, blobUrl, "video") eventually populates thumbnailMap[id] with a data:image/jpeg string', async () => {
    const mockThumb = 'data:image/jpeg;base64,/9j/MOCK';
    _capture.fn = vi.fn().mockResolvedValue(mockThumb);

    useGridStore.getState().addMedia('vid-1', 'blob:http://localhost/vid', 'video');

    // Wait for the async thumbnail capture to complete
    await vi.waitFor(() => {
      const { thumbnailMap } = useGridStore.getState();
      expect(thumbnailMap['vid-1']).toBe(mockThumb);
    });
  });

  it('Test 4: removeMedia(id) deletes thumbnailMap[id]', () => {
    // Mock revokeObjectURL so jsdom doesn't throw
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Pre-seed thumbnail map
    useGridStore.setState({
      mediaRegistry: { 'vid-1': 'blob:http://localhost/vid' },
      mediaTypeMap: { 'vid-1': 'video' },
      thumbnailMap: { 'vid-1': 'data:image/jpeg;base64,/9j/MOCK' },
    });

    useGridStore.getState().removeMedia('vid-1');

    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap['vid-1']).toBeUndefined();

    revokeSpy.mockRestore();
  });

  it('Test 5: clearGrid() resets thumbnailMap to {}', () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useGridStore.setState({
      thumbnailMap: { 'vid-1': 'data:image/jpeg;base64,/9j/MOCK' },
    });

    useGridStore.getState().clearGrid();

    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap).toEqual({});
  });

  it('Test 6: applyTemplate() prunes thumbnailMap entries for dropped media (surplus)', async () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Use the real applyTemplate semantics: apply a 2x2 template, fill all 4
    // leaves with media (including a video that populates thumbnailMap), then
    // apply a 1x2 template so leaves 3 and 4 are surplus and must be pruned.
    const { buildTemplate, getAllLeaves } = await import('../lib/tree');

    useGridStore.getState().applyTemplate(buildTemplate('2x2'));
    const leaves4 = getAllLeaves(useGridStore.getState().root);

    // Seed mediaRegistry, mediaTypeMap, and thumbnailMap for 4 media ids.
    useGridStore.setState({
      mediaRegistry: {
        'img-1': 'data:image/png;base64,a',
        'img-2': 'data:image/png;base64,b',
        'vid-1': 'blob:http://localhost/vid1',
        'vid-2': 'blob:http://localhost/vid2',
      },
      mediaTypeMap: {
        'img-1': 'image',
        'img-2': 'image',
        'vid-1': 'video',
        'vid-2': 'video',
      },
      thumbnailMap: {
        'vid-1': 'data:image/jpeg;base64,/9j/MOCK1',
        'vid-2': 'data:image/jpeg;base64,/9j/MOCK2',
      },
    });
    useGridStore.getState().setMedia(leaves4[0].id, 'img-1');
    useGridStore.getState().setMedia(leaves4[1].id, 'img-2');
    useGridStore.getState().setMedia(leaves4[2].id, 'vid-1');
    useGridStore.getState().setMedia(leaves4[3].id, 'vid-2');

    // Apply a 2-leaf template — vid-1 and vid-2 become surplus.
    useGridStore.getState().applyTemplate(buildTemplate('1x2'));

    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap['vid-1']).toBeUndefined();
    expect(thumbnailMap['vid-2']).toBeUndefined();
  });

  it('Test 7: captureVideoThumbnail returns null (timeout) — thumbnailMap[id] stays undefined', async () => {
    // Mock capture to return null (simulates timeout)
    _capture.fn = vi.fn().mockResolvedValue(null);

    useGridStore.getState().addMedia('vid-timeout', 'blob:http://localhost/vid-timeout', 'video');

    // Flush microtasks
    await new Promise(resolve => setTimeout(resolve, 10));

    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap['vid-timeout']).toBeUndefined();
  });

});

// ---------------------------------------------------------------------------
// captureVideoThumbnail unit tests
// ---------------------------------------------------------------------------

describe('captureVideoThumbnail helper', () => {

  it('returns null when video element fires error event', async () => {
    // In jsdom, video elements don't actually load. We simulate error firing.
    const origCreateElement = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') {
        const fakeVideo = origCreateElement('div') as unknown as HTMLVideoElement;
        // Override addEventListener to fire 'error' immediately when 'src' is set
        const listeners: Record<string, (e: Event) => void> = {};
        fakeVideo.addEventListener = (type: string, handler: EventListenerOrEventListenerObject) => {
          listeners[type] = typeof handler === 'function' ? handler : handler.handleEvent.bind(handler);
        };
        fakeVideo.removeEventListener = () => {};
        // D-03: load() is now called after src assignment; add noop so the mock doesn't throw
        (fakeVideo as unknown as { load: () => void }).load = () => {};
        Object.defineProperty(fakeVideo, 'src', {
          set(_val: string) {
            setTimeout(() => {
              if (listeners['error']) listeners['error'](new Event('error'));
            }, 0);
          },
          get() { return ''; },
          configurable: true,
        });
        return fakeVideo as unknown as HTMLElement;
      }
      return origCreateElement(tag);
    });

    const result = await captureVideoThumbnail('blob:http://localhost/fake');
    expect(result).toBeNull();

    createSpy.mockRestore();
  });

  it('calls video.play() and video.load() during first-frame capture (D-03)', async () => {
    const origCreateElement = document.createElement.bind(document);
    const handlers: Record<string, () => void> = {};
    const playMock = vi.fn().mockResolvedValue(undefined);
    const loadMock = vi.fn();
    let srcWasSet = false;
    const fakeVideo = {
      muted: false,
      playsInline: false,
      crossOrigin: '',
      videoWidth: 320,
      videoHeight: 240,
      currentTime: 0,
      play: playMock,
      load: loadMock,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(fakeVideo, 'src', {
      set(val: string) {
        if (val && !srcWasSet) {
          srcWasSet = true;
          // Simulate loadedmetadata firing after src is set
          setTimeout(() => handlers['loadedmetadata']?.(), 0);
        }
      },
      get() { return srcWasSet ? 'blob:fake' : ''; },
      configurable: true,
    });
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return fakeVideo as unknown as HTMLVideoElement;
      if (tag === 'canvas') {
        // Return a real canvas so toDataURL works
        return origCreateElement('canvas');
      }
      return origCreateElement(tag);
    });

    // Fire loadedmetadata → onMeta sets currentTime → play() called
    // Fire seeked → onSeeked draws thumbnail
    const capturePromise = captureVideoThumbnail('blob:http://localhost/test');

    // Allow loadedmetadata to fire (set by src setter above)
    await new Promise(r => setTimeout(r, 10));
    // Fire seeked to complete the thumbnail capture
    handlers['seeked']?.();

    await capturePromise;

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(loadMock).toHaveBeenCalledTimes(1);

    createSpy.mockRestore();
  });

});
