/**
 * useAudioMix.test.ts
 * Unit tests for LAUD-01 through LAUD-05 — Web Audio API hook for live editor playback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { videoElementRegistry } from '../lib/videoRegistry';
import { useGridStore } from '../store/gridStore';
import { createLeaf } from '../lib/tree';
import type { GridNode } from '../types';

// ---------------------------------------------------------------------------
// AudioContext mock — must be set up before importing the hook
// ---------------------------------------------------------------------------

const mockGainNode = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() });
const mockSourceNode = () => ({ connect: vi.fn(), disconnect: vi.fn() });
let mockAudioContextInstance: {
  state: AudioContextState;
  destination: object;
  createGain: ReturnType<typeof vi.fn>;
  createMediaElementSource: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  suspend: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockAudioContextInstance = {
    state: 'running' as AudioContextState,
    destination: {},
    createGain: vi.fn(() => mockGainNode()),
    createMediaElementSource: vi.fn(() => mockSourceNode()),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContextInstance));

  // Reset store to clean state
  useGridStore.setState(useGridStore.getInitialState(), true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  videoElementRegistry.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: create a minimal HTMLVideoElement-like mock
// ---------------------------------------------------------------------------

function makeMockVideo(): HTMLVideoElement {
  return { currentTime: 0, muted: true } as unknown as HTMLVideoElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAudioMix', () => {
  it('LAUD-01: startAudio creates AudioContext and wires nodes for registered videos', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    // Set up grid store with 2 leaf nodes
    const leaf1 = createLeaf();
    const leaf2 = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [0.5, 0.5],
      children: [
        { ...leaf1, audioEnabled: true, hasAudioTrack: true },
        { ...leaf2, audioEnabled: true, hasAudioTrack: true },
      ],
    };
    useGridStore.setState({ root }, false);

    // Register 2 mock videos
    videoElementRegistry.set(leaf1.id, makeMockVideo());
    videoElementRegistry.set(leaf2.id, makeMockVideo());

    const { result } = renderHook(() => useAudioMix());

    act(() => {
      result.current.startAudio();
    });

    // AudioContext constructor called once
    expect(AudioContext).toHaveBeenCalledTimes(1);
    // createMediaElementSource called for each registered video
    expect(mockAudioContextInstance.createMediaElementSource).toHaveBeenCalledTimes(2);
    // createGain called for each video
    expect(mockAudioContextInstance.createGain).toHaveBeenCalledTimes(2);
  });

  it('LAUD-02: stopAudio suspends AudioContext', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    const leaf1 = createLeaf();
    const root: GridNode = { ...leaf1, audioEnabled: true, hasAudioTrack: true };
    useGridStore.setState({ root }, false);
    videoElementRegistry.set(leaf1.id, makeMockVideo());

    const { result } = renderHook(() => useAudioMix());

    act(() => {
      result.current.startAudio();
    });

    act(() => {
      result.current.stopAudio();
    });

    expect(mockAudioContextInstance.suspend).toHaveBeenCalledTimes(1);
  });

  it('LAUD-03: Muted cells get gain=0, active cells get 1/activeCount', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    const leafA = createLeaf();
    const leafB = createLeaf();
    const leafC = createLeaf();

    // leaf-a: audioEnabled=true, hasAudioTrack=true  -> active
    // leaf-b: audioEnabled=false, hasAudioTrack=true -> muted
    // leaf-c: audioEnabled=true, hasAudioTrack=false -> muted (no audio track)
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [1 / 3, 1 / 3, 1 / 3],
      children: [
        { ...leafA, audioEnabled: true, hasAudioTrack: true },
        { ...leafB, audioEnabled: false, hasAudioTrack: true },
        { ...leafC, audioEnabled: true, hasAudioTrack: false },
      ],
    };
    useGridStore.setState({ root }, false);

    const videoA = makeMockVideo();
    const videoB = makeMockVideo();
    const videoC = makeMockVideo();
    videoElementRegistry.set(leafA.id, videoA);
    videoElementRegistry.set(leafB.id, videoB);
    videoElementRegistry.set(leafC.id, videoC);

    // Capture gain node instances per call order
    const gainNodes: Array<{ gain: { value: number }; connect: ReturnType<typeof vi.fn> }> = [];
    mockAudioContextInstance.createGain.mockImplementation(() => {
      const gn = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
      gainNodes.push(gn);
      return gn;
    });

    const sourceCallOrder: HTMLVideoElement[] = [];
    mockAudioContextInstance.createMediaElementSource.mockImplementation((el: HTMLVideoElement) => {
      sourceCallOrder.push(el);
      return { connect: vi.fn(), disconnect: vi.fn() };
    });

    const { result } = renderHook(() => useAudioMix());

    act(() => {
      result.current.startAudio();
    });

    // Build map from video element to gain node
    const videoToGain = new Map<HTMLVideoElement, { gain: { value: number } }>();
    for (let i = 0; i < sourceCallOrder.length; i++) {
      videoToGain.set(sourceCallOrder[i], gainNodes[i]);
    }

    const gainA = videoToGain.get(videoA);
    const gainB = videoToGain.get(videoB);
    const gainC = videoToGain.get(videoC);

    expect(gainA).toBeDefined();
    expect(gainB).toBeDefined();
    expect(gainC).toBeDefined();

    // Only leafA is active (1/1 = 1)
    expect(gainA!.gain.value).toBe(1);
    // leafB muted (audioEnabled=false)
    expect(gainB!.gain.value).toBe(0);
    // leafC no audio track
    expect(gainC!.gain.value).toBe(0);
  });

  it('LAUD-04: AudioContext is created synchronously inside startAudio', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    const leaf = createLeaf();
    useGridStore.setState({ root: { ...leaf, audioEnabled: true, hasAudioTrack: true } }, false);
    videoElementRegistry.set(leaf.id, makeMockVideo());

    const { result } = renderHook(() => useAudioMix());

    // AudioContext not yet constructed
    expect(AudioContext).toHaveBeenCalledTimes(0);

    act(() => {
      result.current.startAudio();
    });

    // AudioContext constructed synchronously in startAudio
    expect(AudioContext).toHaveBeenCalledTimes(1);
  });

  it('LAUD-05: Second startAudio does not recreate AudioContext or rewire existing nodes', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    const leaf = createLeaf();
    useGridStore.setState({ root: { ...leaf, audioEnabled: true, hasAudioTrack: true } }, false);
    videoElementRegistry.set(leaf.id, makeMockVideo());

    const { result } = renderHook(() => useAudioMix());

    act(() => {
      result.current.startAudio();
    });

    // Set context state to suspended so resume is called on second startAudio
    mockAudioContextInstance.state = 'suspended';

    act(() => {
      result.current.startAudio();
    });

    // AudioContext constructor called only once
    expect(AudioContext).toHaveBeenCalledTimes(1);
    // createMediaElementSource not doubled
    expect(mockAudioContextInstance.createMediaElementSource).toHaveBeenCalledTimes(1);
    // resume called because context was suspended
    expect(mockAudioContextInstance.resume).toHaveBeenCalledTimes(1);
  });

  it('LAUD-05 supplement: Newly registered video gets wired on subsequent startAudio', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    const leaf1 = createLeaf();
    const leaf2 = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [0.5, 0.5],
      children: [
        { ...leaf1, audioEnabled: true, hasAudioTrack: true },
        { ...leaf2, audioEnabled: true, hasAudioTrack: true },
      ],
    };
    useGridStore.setState({ root }, false);

    // First call: 1 video registered
    videoElementRegistry.set(leaf1.id, makeMockVideo());

    const { result } = renderHook(() => useAudioMix());

    act(() => {
      result.current.startAudio();
    });

    expect(mockAudioContextInstance.createMediaElementSource).toHaveBeenCalledTimes(1);

    // Add second video between calls
    videoElementRegistry.set(leaf2.id, makeMockVideo());

    act(() => {
      result.current.startAudio();
    });

    // Second video wired on second startAudio call
    expect(mockAudioContextInstance.createMediaElementSource).toHaveBeenCalledTimes(2);
  });

  it('LAUD-03 reactivity: Mute toggle during playback updates gains', async () => {
    const { useAudioMix } = await import('./useAudioMix');

    const leaf1 = createLeaf();
    const leaf2 = createLeaf();
    const root: GridNode = {
      type: 'container',
      id: 'root',
      direction: 'horizontal',
      sizes: [0.5, 0.5],
      children: [
        { ...leaf1, audioEnabled: true, hasAudioTrack: true },
        { ...leaf2, audioEnabled: true, hasAudioTrack: true },
      ],
    };
    useGridStore.setState({ root }, false);

    const gainNodes: Array<{ gain: { value: number }; connect: ReturnType<typeof vi.fn> }> = [];
    mockAudioContextInstance.createGain.mockImplementation(() => {
      const gn = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
      gainNodes.push(gn);
      return gn;
    });

    const sourceCallOrder: HTMLVideoElement[] = [];
    const video1 = makeMockVideo();
    const video2 = makeMockVideo();
    mockAudioContextInstance.createMediaElementSource.mockImplementation((el: HTMLVideoElement) => {
      sourceCallOrder.push(el);
      return { connect: vi.fn(), disconnect: vi.fn() };
    });

    videoElementRegistry.set(leaf1.id, video1);
    videoElementRegistry.set(leaf2.id, video2);

    const { result } = renderHook(() => useAudioMix());

    act(() => {
      result.current.startAudio();
    });

    const videoToGain = new Map<HTMLVideoElement, { gain: { value: number } }>();
    for (let i = 0; i < sourceCallOrder.length; i++) {
      videoToGain.set(sourceCallOrder[i], gainNodes[i]);
    }

    const gain1 = videoToGain.get(video1)!;
    const gain2 = videoToGain.get(video2)!;

    // Both active: gain = 0.5 each
    expect(gain1.gain.value).toBeCloseTo(0.5);
    expect(gain2.gain.value).toBeCloseTo(0.5);

    // Mute leaf2 via store action — subscription should react
    act(() => {
      useGridStore.getState().toggleAudioEnabled(leaf2.id);
    });

    // leaf1 is now the only active cell: gain = 1
    expect(gain1.gain.value).toBe(1);
    expect(gain2.gain.value).toBe(0);
  });
});
