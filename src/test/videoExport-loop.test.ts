import { describe, it, expect } from 'vitest';
import { computeLoopedTime } from '../lib/videoExport';

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
