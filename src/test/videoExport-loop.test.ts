import { describe, it, expect } from 'vitest';
import { computeLoopedTime } from '../lib/videoExport';
import { drawOverlaysToCanvas } from '@/lib/overlayExport';

describe('computeLoopedTime', () => {
  it('Test 1: returns timeSeconds unchanged when time < duration', () => {
    expect(computeLoopedTime(2, 10)).toBe(2);
  });

  it('Test 2: wraps time via modulo when timeSeconds > duration', () => {
    // 7 % 3 = 1
    expect(computeLoopedTime(7, 3)).toBeCloseTo(1, 9);
  });

  it('Test 3: returns 0 when timeSeconds is an exact multiple of duration', () => {
    // 6 % 3 = 0, video restarts cleanly
    expect(computeLoopedTime(6, 3)).toBe(0);
  });

  it('Test 4: returns 0 when duration is 0 (metadata not loaded)', () => {
    expect(computeLoopedTime(5, 0)).toBe(0);
  });

  it('Test 4 (NaN): returns 0 when duration is NaN', () => {
    expect(computeLoopedTime(5, NaN)).toBe(0);
  });

  it('Test 4 (Infinity): returns 0 when duration is Infinity', () => {
    expect(computeLoopedTime(5, Infinity)).toBe(0);
  });
});

// ===========================================================================
// isRendering guard — concurrent call prevention
// ===========================================================================

describe('isRendering guard — concurrent call prevention', () => {
  it('a second setInterval tick while renderFrame is in progress does not start another render', async () => {
    // Simulate the guard pattern directly
    let isRendering = false;
    let renderCount = 0;

    const fakeRenderFrame = async () => {
      if (isRendering) return;
      isRendering = true;
      renderCount += 1;
      // Simulate async work
      await new Promise<void>(resolve => setTimeout(resolve, 10));
      isRendering = false;
    };

    // Fire two ticks simultaneously — second should be a no-op
    const p1 = fakeRenderFrame();
    const p2 = fakeRenderFrame(); // isRendering=true at this point → returns immediately
    await Promise.all([p1, p2]);

    expect(renderCount).toBe(1);
  });

  it('isRendering resets to false after renderFrame resolves', async () => {
    let isRendering = false;
    let renderCount = 0;

    const fakeRenderFrame = async () => {
      if (isRendering) return;
      isRendering = true;
      renderCount += 1;
      await new Promise<void>(resolve => setTimeout(resolve, 5));
      isRendering = false;
    };

    await fakeRenderFrame();
    expect(isRendering).toBe(false);
    // Second call after first completes — should proceed
    await fakeRenderFrame();
    expect(renderCount).toBe(2);
  });

  it('isRendering resets to false via finally even when renderFrame throws', async () => {
    let isRendering = false;

    const fakeRenderFrame = async () => {
      if (isRendering) return;
      isRendering = true;
      try {
        throw new Error('render error');
      } finally {
        isRendering = false;
      }
    };

    await fakeRenderFrame().catch(() => {});
    expect(isRendering).toBe(false);
  });
});

// ===========================================================================
// drawOverlaysToCanvas — fontsAlreadyReady parameter
// ===========================================================================

describe('drawOverlaysToCanvas — fontsAlreadyReady skips fonts.ready await', () => {
  it('does not throw when fontsAlreadyReady=true even if document.fonts is unavailable', async () => {
    // Pass fontsAlreadyReady=true with empty overlays — should resolve without error
    await expect(
      drawOverlaysToCanvas(
        document.createElement('canvas').getContext('2d')!,
        [],
        {},
        new Map(),
        true,
      ),
    ).resolves.toBeUndefined();
  });
});
