/**
 * Unit tests for computeDropZone — the pure 5-zone drop-zone resolver.
 *
 * Satisfies REQ: DROP-06 (live recompute per pointermove) and CANCEL-05
 * (zones fully tile each cell — no dead space).
 *
 * Coverage:
 *   1-3. Zone table at canvas scales 1.0, 0.5, 0.2
 *   4.   Boundary pixel transitions (±1px around threshold) — strict </>
 *   5.   Non-origin rect (rect.left / rect.top != 0)
 *   6.   Property-based no-dead-space sweep (CANCEL-05 proof)
 *   7.   Degenerate small 20x20 cell (threshold floor = 20)
 *   8.   Exact geometric center → 'center' across multiple sizes
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
  // threshold = max(20, min(300, 600) * 0.2) = max(20, 60) = 60
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

  it('returns "top" just inside the top threshold (y=30, threshold=60)', () => {
    expect(computeDropZone(rect, { x: 150, y: 30 })).toBe('top');
  });

  it('returns "center" at y === threshold (strict-less-than semantics: y=60 NOT < 60)', () => {
    expect(computeDropZone(rect, { x: 150, y: 60 })).toBe('center');
  });

  it('returns "center" at y === h - threshold (strict-greater-than semantics: y=540 NOT > 540)', () => {
    expect(computeDropZone(rect, { x: 150, y: 540 })).toBe('center');
  });
});

describe('computeDropZone — zone lookup at canvasScale 0.5', () => {
  // Cell 150x300 viewport px (simulates 0.5 scale of 300x600 canvas-space).
  // threshold = max(20, min(150, 300) * 0.2) = max(20, 30) = 30
  const rect = makeRect(0, 0, 150, 300);

  it('returns "center" at (75, 150)', () => {
    expect(computeDropZone(rect, { x: 75, y: 150 })).toBe('center');
  });

  it('returns "top" at (75, 10) — y < 30', () => {
    expect(computeDropZone(rect, { x: 75, y: 10 })).toBe('top');
  });

  it('returns "bottom" at (75, 290) — y > 270', () => {
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
  // threshold = max(20, min(60, 120) * 0.2) = max(20, 12) = 20
  const rect = makeRect(0, 0, 60, 120);

  it('returns "center" at (30, 60)', () => {
    expect(computeDropZone(rect, { x: 30, y: 60 })).toBe('center');
  });

  it('returns "top" at (30, 5) — y < 20', () => {
    expect(computeDropZone(rect, { x: 30, y: 5 })).toBe('top');
  });

  it('returns "bottom" at (30, 115) — y > 100', () => {
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
  // Cell 300x600, threshold = 60
  const rect = makeRect(0, 0, 300, 600);

  it('y=59 → "top" (strict less-than: 59 < 60)', () => {
    expect(computeDropZone(rect, { x: 150, y: 59 })).toBe('top');
  });

  it('y=60 → "center" (NOT "top": 60 is not < 60)', () => {
    expect(computeDropZone(rect, { x: 150, y: 60 })).toBe('center');
  });

  it('y=61 → "center"', () => {
    expect(computeDropZone(rect, { x: 150, y: 61 })).toBe('center');
  });

  it('y=539 → "center"', () => {
    expect(computeDropZone(rect, { x: 150, y: 539 })).toBe('center');
  });

  it('y=540 → "center" (NOT "bottom": 540 is not > 540)', () => {
    expect(computeDropZone(rect, { x: 150, y: 540 })).toBe('center');
  });

  it('y=541 → "bottom" (strict greater-than: 541 > 540)', () => {
    expect(computeDropZone(rect, { x: 150, y: 541 })).toBe('bottom');
  });
});

describe('computeDropZone — rect not at origin (rect.left/top non-zero)', () => {
  // Cell at viewport (100, 200), size 300x600, threshold = 60.
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

describe('computeDropZone — degenerate small cell (20x20, threshold floor)', () => {
  // w=h=20, threshold = max(20, min(20,20)*0.2) = max(20, 4) = 20.
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
