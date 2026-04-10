import { describe, it, expect, vi } from 'vitest';
import { computeLoopedTime, findSampleForTime } from '@/lib/videoExport';

// ---------------------------------------------------------------------------
// Mock VideoSample shape (mimics mediabunny VideoSample for unit testing)
// ---------------------------------------------------------------------------

interface MockVideoSample {
  timestamp: number;    // seconds (per mediabunny.d.ts line 3023)
  duration: number;     // seconds
  close: () => void;
  toCanvasImageSource: () => OffscreenCanvas;
}

function makeSample(timestamp: number, duration: number = 1 / 30): MockVideoSample {
  return {
    timestamp,
    duration,
    close: vi.fn(),
    toCanvasImageSource: vi.fn(() => new OffscreenCanvas(1080, 1920)),
  };
}

// ===========================================================================
// findSampleForTime — frame lookup using computeLoopedTime
// ===========================================================================

describe('findSampleForTime', () => {
  it('returns null for empty samples array', () => {
    expect(findSampleForTime([] as any, 1.0, 3.0)).toBeNull();
  });

  it('returns the only frame when samples has one element', () => {
    const samples = [makeSample(0, 1 / 30)] as any;
    const result = findSampleForTime(samples, 0.5, 3.0);
    expect(result).toBe(samples[0]);
  });

  it('returns the frame with timestamp <= target time (nearest floor)', () => {
    const samples = [
      makeSample(0),
      makeSample(0.5),
      makeSample(1.0),
      makeSample(1.5),
    ] as any;
    // Target 0.7s — should return frame at 0.5s (not 1.0s)
    const result = findSampleForTime(samples, 0.7, 3.0);
    expect(result!.timestamp).toBe(0.5);
  });

  it('handles looped time correctly for videos shorter than export duration', () => {
    const samples = [
      makeSample(0),
      makeSample(1.0),
      makeSample(2.0),
    ] as any;
    // Video is 3s, export time is 5.5s => looped time = 2.5s
    const result = findSampleForTime(samples, 5.5, 3.0);
    expect(result!.timestamp).toBe(2.0);
  });

  it('returns last frame when target time exactly equals video duration', () => {
    const samples = [
      makeSample(0),
      makeSample(1.0),
      makeSample(2.0),
    ] as any;
    // At exactly 3.0s with 3.0s duration => loopedTime = 0 (modulo)
    const result = findSampleForTime(samples, 3.0, 3.0);
    expect(result!.timestamp).toBe(0);
  });

  it('returns first frame when target time is 0', () => {
    const samples = [
      makeSample(0),
      makeSample(1.0),
    ] as any;
    const result = findSampleForTime(samples, 0, 3.0);
    expect(result!.timestamp).toBe(0);
  });
});

// ===========================================================================
// decodeVideoToSamples — Mediabunny VideoSampleSink pipeline
// ===========================================================================

describe('decodeVideoToSamples', () => {
  // decodeVideoToSamples requires mocking BlobSource, Input, and VideoSampleSink.
  // These stubs define the expected behavior; full integration testing is done manually.

  it.todo('returns sorted VideoSample[] for a valid blob URL');

  it.todo('returns empty array when input has no video track');

  it.todo('calls input.dispose() after generator exhausts');

  it.todo('propagates errors from VideoSampleSink (D-07: hard error, no fallback)');
});

// ===========================================================================
// computeLoopedTime — verify seconds-based operation (no unit conversion)
// ===========================================================================

describe('computeLoopedTime — seconds sanity (Phase 15)', () => {
  // Verify computeLoopedTime works in seconds without any conversion.
  // VideoSample.timestamp is in seconds [VERIFIED: mediabunny.d.ts line 3023].

  it('returns time modulo duration for time > duration', () => {
    // 5.5s into a 3s video => 5.5 % 3 = 2.5s
    expect(computeLoopedTime(5.5, 3)).toBeCloseTo(2.5);
  });

  it('returns time as-is when time < duration', () => {
    expect(computeLoopedTime(1.0, 3.0)).toBeCloseTo(1.0);
  });

  it('returns 0 for zero duration', () => {
    expect(computeLoopedTime(2.5, 0)).toBe(0);
  });

  it('returns 0 for NaN duration', () => {
    expect(computeLoopedTime(2.5, NaN)).toBe(0);
  });

  it('returns 0 for Infinity duration', () => {
    expect(computeLoopedTime(2.5, Infinity)).toBe(0);
  });
});
