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

  it('Test 6: applyTemplate() resets thumbnailMap to {}', () => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useGridStore.setState({
      mediaRegistry: {},
      thumbnailMap: { 'vid-1': 'data:image/jpeg;base64,/9j/MOCK' },
    });

    useGridStore.getState().applyTemplate(initialRoot);

    const { thumbnailMap } = useGridStore.getState();
    expect(thumbnailMap).toEqual({});
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

});
