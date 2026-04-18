/**
 * Unit tests for computeDropZone — the pure 5-zone drop-zone resolver.
 *
 * Per-axis threshold semantics (aligned with DropZoneIndicators.tsx band geometry):
 *   yThreshold = max(20, h * 0.2)   — matches height: 20% on top/bottom indicators
 *   xThreshold = max(20, w * 0.2)   — matches width: 20% on left/right indicators
 *
 * 20px floor preserves CANCEL-05 on degenerate small cells.
 *
 * Coverage:
 *   1-3. Zone table at canvas scales 1.0, 0.5, 0.2
 *   4.   Boundary pixel transitions (±1px around threshold) — strict </>
 *   5.   Non-origin rect (rect.left / rect.top != 0)
 *   6.   Property-based no-dead-space sweep (CANCEL-05 proof)
 *   7.   Per-axis threshold (indicator-aligned, gap-closure 28-12)
 *   8.   Degenerate small 20x20 cell (threshold floor = 20)
 *   9.   Exact geometric center → 'center' across multiple sizes
 */
import { describe, it, expect } from 'vitest';
import { computeDropZone } from './computeDropZone';
import type { DropZone } from './dragStore';

/**
 * Mint a DOMRect-shaped object for tests. jsdom's DOMRect constructor is
 * fiddly; a literal is sufficient because computeDropZone only reads
 * rect.left, rect.top, rect.width, rect.height.
 */
function makeRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

const ALL_ZONES: ReadonlySet<DropZone> = new Set<DropZone>([
  'center',
  'top',
  'bottom',
  'left',
  'right',
]);

describe('computeDropZone — zone lookup at canvasScale 1.0', () => {
  // Cell 300x600 viewport px (simulates 1.0 scale on a 300x600 canvas).
  // yThreshold = max(20, 600*0.2) = max(20, 120) = 120
  // xThreshold = max(20, 300*0.2) = max(20, 60) = 60
  const rect = makeRect(0, 0, 300, 600);

  it('returns "center" at exact cell center (150, 300)', () => {
    expect(computeDropZone(rect, { x: 150, y: 300 })).toBe('center');
  });

  it('returns "top" for pointer in top band (150, 10)', () => {
    expect(computeDropZone(rect, { x: 150, y: 10 })).toBe('top');
  });

  it('returns "bottom" for pointer in bottom band (150, 590)', () => {
    expect(computeDropZone(rect, { x: 150, y: 590 })).toBe('bottom');
  });

  it('returns "left" for pointer in left band (10, 300)', () => {
    expect(computeDropZone(rect, { x: 10, y: 300 })).toBe('left');
  });

  it('returns "right" for pointer in right band (290, 300)', () => {
    expect(computeDropZone(rect, { x: 290, y: 300 })).toBe('right');
  });

  it('returns "top" just inside the top threshold (y=100, threshold=120)', () => {
    expect(computeDropZone(rect, { x: 150, y: 100 })).toBe('top');
  });

  it('returns "center" at y === threshold (strict-less-than semantics: y=120 NOT < 120)', () => {
    expect(computeDropZone(rect, { x: 150, y: 120 })).toBe('center');
  });

  it('returns "center" at y === h - threshold (strict-greater-than semantics: y=480 NOT > 480)', () => {
    expect(computeDropZone(rect, { x: 150, y: 480 })).toBe('center');
  });
});

describe('computeDropZone — zone lookup at canvasScale 0.5', () => {
  // Cell 150x300 viewport px (simulates 0.5 scale of 300x600 canvas-space).
  // yThreshold = max(20, 300*0.2) = max(20, 60) = 60
  // xThreshold = max(20, 150*0.2) = max(20, 30) = 30
  const rect = makeRect(0, 0, 150, 300);

  it('returns "center" at (75, 150)', () => {
    expect(computeDropZone(rect, { x: 75, y: 150 })).toBe('center');
  });

  it('returns "top" at (75, 10) — y < 60', () => {
    expect(computeDropZone(rect, { x: 75, y: 10 })).toBe('top');
  });

  it('returns "bottom" at (75, 290) — y > 240', () => {
    expect(computeDropZone(rect, { x: 75, y: 290 })).toBe('bottom');
  });

  it('returns "left" at (10, 150)', () => {
    expect(computeDropZone(rect, { x: 10, y: 150 })).toBe('left');
  });

  it('returns "right" at (140, 150)', () => {
    expect(computeDropZone(rect, { x: 140, y: 150 })).toBe('right');
  });
});

describe('computeDropZone — zone lookup at canvasScale 0.2', () => {
  // Cell 60x120 viewport px.
  // yThreshold = max(20, 120*0.2) = max(20, 24) = 24
  // xThreshold = max(20, 60*0.2) = max(20, 12) = 20 (floor engaged on x)
  const rect = makeRect(0, 0, 60, 120);

  it('returns "center" at (30, 60)', () => {
    expect(computeDropZone(rect, { x: 30, y: 60 })).toBe('center');
  });

  it('returns "top" at (30, 5) — y < 24', () => {
    expect(computeDropZone(rect, { x: 30, y: 5 })).toBe('top');
  });

  it('returns "bottom" at (30, 115) — y > 96', () => {
    expect(computeDropZone(rect, { x: 30, y: 115 })).toBe('bottom');
  });

  it('returns "left" at (5, 60) — x < 20', () => {
    expect(computeDropZone(rect, { x: 5, y: 60 })).toBe('left');
  });

  it('returns "right" at (55, 60) — x > 40', () => {
    expect(computeDropZone(rect, { x: 55, y: 60 })).toBe('right');
  });
});

describe('computeDropZone — boundary pixel transitions (±1px around threshold)', () => {
  // Cell 300x600, yThreshold=120, xThreshold=60
  const rect = makeRect(0, 0, 300, 600);

  it('y=119 → "top" (strict less-than: 119 < 120)', () => {
    expect(computeDropZone(rect, { x: 150, y: 119 })).toBe('top');
  });

  it('y=120 → "center" (NOT "top": 120 is not < 120)', () => {
    expect(computeDropZone(rect, { x: 150, y: 120 })).toBe('center');
  });

  it('y=121 → "center"', () => {
    expect(computeDropZone(rect, { x: 150, y: 121 })).toBe('center');
  });

  it('y=479 → "center"', () => {
    expect(computeDropZone(rect, { x: 150, y: 479 })).toBe('center');
  });

  it('y=480 → "center" (NOT "bottom": 480 is not > 480)', () => {
    expect(computeDropZone(rect, { x: 150, y: 480 })).toBe('center');
  });

  it('y=481 → "bottom" (strict greater-than: 481 > 480)', () => {
    expect(computeDropZone(rect, { x: 150, y: 481 })).toBe('bottom');
  });
});

describe('computeDropZone — rect not at origin (rect.left/top non-zero)', () => {
  // Cell at viewport (100, 200), size 300x600.
  // yThreshold = max(20, 600*0.2) = 120; xThreshold = max(20, 300*0.2) = 60
  const rect = makeRect(100, 200, 300, 600);

  it('pointer (250, 500) → relative (150, 300) → "center"', () => {
    expect(computeDropZone(rect, { x: 250, y: 500 })).toBe('center');
  });

  it('pointer (110, 500) → relative (10, 300) → "left"', () => {
    expect(computeDropZone(rect, { x: 110, y: 500 })).toBe('left');
  });

  it('pointer (250, 210) → relative (150, 10) → "top"', () => {
    expect(computeDropZone(rect, { x: 250, y: 210 })).toBe('top');
  });

  it('pointer (390, 500) → relative (290, 300) → "right"', () => {
    expect(computeDropZone(rect, { x: 390, y: 500 })).toBe('right');
  });

  it('pointer (250, 790) → relative (150, 590) → "bottom"', () => {
    expect(computeDropZone(rect, { x: 250, y: 790 })).toBe('bottom');
  });
});

describe('computeDropZone — CANCEL-05 no-dead-space property sweep', () => {
  // For each simulated canvas scale, prove every integer-ish pointer inside
  // the rect resolves to exactly one of the 5 zones and is deterministic.
  const scales = [
    { label: '0.2', w: 60, h: 120 },
    { label: '0.5', w: 150, h: 300 },
    { label: '1.0', w: 300, h: 600 },
  ];

  for (const { label, w, h } of scales) {
    it(`every sample in a ${w}x${h} (scale ${label}) cell resolves to exactly one zone`, () => {
      const rect = makeRect(0, 0, w, h);
      const step = 5;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const zone = computeDropZone(rect, { x, y });
          expect(ALL_ZONES.has(zone)).toBe(true);
          // Determinism: same input → same output.
          expect(computeDropZone(rect, { x, y })).toBe(zone);
        }
      }
    });
  }

  it('rect-corner samples still resolve to a zone (no throw, no undefined)', () => {
    const rect = makeRect(0, 0, 300, 600);
    const corners = [
      { x: 0, y: 0 },
      { x: 299, y: 0 },
      { x: 0, y: 599 },
      { x: 299, y: 599 },
    ];
    for (const p of corners) {
      const zone = computeDropZone(rect, p);
      expect(ALL_ZONES.has(zone)).toBe(true);
    }
  });
});

describe('computeDropZone — per-axis threshold (indicator-aligned, gap-closure 28-12)', () => {
  // Non-square cell (100w × 300h) — the worst-case dead-band under the old
  // shorter-axis formula (threshold=20). With per-axis thresholds:
  //   yThreshold = max(20, 300*0.2) = 60
  //   xThreshold = max(20, 100*0.2) = 20
  // The visible top-band indicator (20% of 300 = 60px tall) is now covered by
  // the compute function's 'top' region — no dead-band between indicator and
  // compute. Regression lock for 28-HUMAN-UAT Gap 2 "extend zones very buggy".
  const nonSquare = makeRect(0, 0, 100, 300);

  it('100x300 cell: y=40 resolves to "top" (covers the visible top-band indicator)', () => {
    expect(computeDropZone(nonSquare, { x: 50, y: 40 })).toBe('top');
  });

  it('100x300 cell: y=59 resolves to "top" (still inside yThreshold=60)', () => {
    expect(computeDropZone(nonSquare, { x: 50, y: 59 })).toBe('top');
  });

  it('100x300 cell: y=60 resolves to "center" (strict: 60 NOT < 60)', () => {
    expect(computeDropZone(nonSquare, { x: 50, y: 60 })).toBe('center');
  });

  it('100x300 cell: y=241 resolves to "bottom" (241 > 300-60=240)', () => {
    expect(computeDropZone(nonSquare, { x: 50, y: 241 })).toBe('bottom');
  });

  it('100x300 cell: x=19 resolves to "left" (xThreshold=20, 19 < 20)', () => {
    expect(computeDropZone(nonSquare, { x: 19, y: 150 })).toBe('left');
  });

  it('100x300 cell: x=20 resolves to "center" (20 NOT < 20)', () => {
    expect(computeDropZone(nonSquare, { x: 20, y: 150 })).toBe('center');
  });

  // Extreme wide cell: 300w × 40h — yThreshold floor engages.
  it('300x40 extreme cell: yThreshold floor of 20 preserved; y=19 → "top"', () => {
    const wide = makeRect(0, 0, 300, 40);
    expect(computeDropZone(wide, { x: 150, y: 19 })).toBe('top');
  });

  it('300x40 extreme cell: y=20 → "center" (floor strict)', () => {
    const wide = makeRect(0, 0, 300, 40);
    expect(computeDropZone(wide, { x: 150, y: 20 })).toBe('center');
  });
});

describe('computeDropZone — degenerate small cell (20x20, threshold floor)', () => {
  // w=h=20, yThreshold = max(20, 20*0.2) = max(20, 4) = 20
  //         xThreshold = max(20, 20*0.2) = max(20, 4) = 20
  // Center zone collapses — must still return exactly one zone for every
  // integer pointer, and must be deterministic.
  const rect = makeRect(0, 0, 20, 20);

  it('never throws, always returns a valid zone across integer pointer grid', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const zone = computeDropZone(rect, { x, y });
        expect(ALL_ZONES.has(zone)).toBe(true);
      }
    }
  });

  it('is deterministic (same call returns same zone)', () => {
    const zone1 = computeDropZone(rect, { x: 10, y: 10 });
    const zone2 = computeDropZone(rect, { x: 10, y: 10 });
    expect(zone1).toBe(zone2);
  });
});

describe('computeDropZone — exact geometric center is always "center" zone', () => {
  const sizes = [
    { w: 100, h: 100 },
    { w: 200, h: 400 },
    { w: 800, h: 1600 },
    { w: 300, h: 600 },
  ];

  for (const { w, h } of sizes) {
    it(`${w}x${h} cell: pointer at geometric center resolves to "center"`, () => {
      const rect = makeRect(50, 50, w, h);
      const pointer = { x: rect.left + w / 2, y: rect.top + h / 2 };
      expect(computeDropZone(rect, pointer)).toBe('center');
    });
  }
});

describe('computeDropZone — NaN inputs (gap-closure 28-14 regression lock for touch defect)', () => {
  // Regression lock for 28-UAT Gap 1 DEFECT 2: the old CanvasWrapper.handleDragOver
  // cast activatorEvent to PointerEvent and read clientX/Y. On touch, the activator
  // is a TouchEvent — top-level clientX/Y is `undefined`. Undefined + delta = NaN.
  // NaN comparisons in computeDropZone (y < yThreshold etc.) all evaluate false, so
  // the function falls through to 'center'. Result: on touch, edge-drops were
  // physically unreachable — zone was ALWAYS 'center'.
  //
  // This test PINS that fallthrough behavior so:
  //   (a) the symptom is documented in-code (touch=always-center was a real bug),
  //   (b) a future 'fix' that makes computeDropZone throw or return null on NaN
  //       cannot silently change behavior without also updating this test.
  //
  // The FIX for DEFECT 2 lives at the PRODUCER (CanvasWrapper — gap-closure 28-14
  // uses active.rect.current.initial + delta instead of activatorEvent.clientX),
  // NOT at the consumer. computeDropZone stays pure and NaN-fallthrough is correct
  // per its contract.
  const rect = makeRect(0, 0, 300, 600);

  it('returns "center" when both pointer coordinates are NaN (pure fallthrough)', () => {
    expect(computeDropZone(rect, { x: NaN, y: NaN })).toBe('center');
  });

  it('returns "center" when only pointer.y is NaN (partial-NaN still falls through)', () => {
    expect(computeDropZone(rect, { x: 100, y: NaN })).toBe('center');
  });

  it('returns "center" when only pointer.x is NaN', () => {
    expect(computeDropZone(rect, { x: NaN, y: 300 })).toBe('center');
  });
});
