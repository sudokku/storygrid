import { describe, it, expect } from 'vitest';
import { computeDropZone } from './computeDropZone';

// Helper: mint a DOMRect-shaped object for tests.
function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left, top, width, height,
    right: left + width, bottom: top + height,
    x: left, y: top,
    toJSON() { return this; },
  } as DOMRect;
}

// ---------------------------------------------------------------------------
// 1. Zone lookup at canvasScale 1.0 — cell 300×600 viewport px
// ---------------------------------------------------------------------------
describe('computeDropZone — zone lookup at canvasScale 1.0', () => {
  const rect = makeRect(0, 0, 300, 600);
  // threshold = max(20, min(300,600)*0.2) = max(20, 60) = 60

  it('pointer at exact center → center', () => {
    expect(computeDropZone(rect, { x: 150, y: 300 })).toBe('center');
  });

  it('pointer at (150, 10) inside top band → top', () => {
    expect(computeDropZone(rect, { x: 150, y: 10 })).toBe('top');
  });

  it('pointer at (150, 590) inside bottom band → bottom', () => {
    expect(computeDropZone(rect, { x: 150, y: 590 })).toBe('bottom');
  });

  it('pointer at (10, 300) inside left band → left', () => {
    expect(computeDropZone(rect, { x: 10, y: 300 })).toBe('left');
  });

  it('pointer at (290, 300) inside right band → right', () => {
    expect(computeDropZone(rect, { x: 290, y: 300 })).toBe('right');
  });

  it('pointer at (150, 30) — y < 60 = threshold → top', () => {
    expect(computeDropZone(rect, { x: 150, y: 30 })).toBe('top');
  });

  it('pointer at (150, 60) — y === threshold, strict-less-than semantics → center', () => {
    expect(computeDropZone(rect, { x: 150, y: 60 })).toBe('center');
  });

  it('pointer at (150, 540) — y === h - threshold = 540, strict-greater-than semantics → center', () => {
    expect(computeDropZone(rect, { x: 150, y: 540 })).toBe('center');
  });
});

// ---------------------------------------------------------------------------
// 2. Zone lookup at canvasScale 0.5 — cell 150×300 viewport px
// ---------------------------------------------------------------------------
describe('computeDropZone — zone lookup at canvasScale 0.5', () => {
  const rect = makeRect(0, 0, 150, 300);
  // threshold = max(20, min(150,300)*0.2) = max(20, 30) = 30

  it('pointer at (75, 150) → center', () => {
    expect(computeDropZone(rect, { x: 75, y: 150 })).toBe('center');
  });

  it('pointer at (75, 10) — y < 30 → top', () => {
    expect(computeDropZone(rect, { x: 75, y: 10 })).toBe('top');
  });

  it('pointer at (75, 290) — y > 270 → bottom', () => {
    expect(computeDropZone(rect, { x: 75, y: 290 })).toBe('bottom');
  });

  it('pointer at (10, 150) → left', () => {
    expect(computeDropZone(rect, { x: 10, y: 150 })).toBe('left');
  });

  it('pointer at (140, 150) → right', () => {
    expect(computeDropZone(rect, { x: 140, y: 150 })).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// 3. Zone lookup at canvasScale 0.2 — cell 60×120 viewport px
// ---------------------------------------------------------------------------
describe('computeDropZone — zone lookup at canvasScale 0.2', () => {
  const rect = makeRect(0, 0, 60, 120);
  // threshold = max(20, min(60,120)*0.2) = max(20, 12) = 20

  it('pointer at (30, 60) → center', () => {
    expect(computeDropZone(rect, { x: 30, y: 60 })).toBe('center');
  });

  it('pointer at (30, 5) — y < 20 → top', () => {
    expect(computeDropZone(rect, { x: 30, y: 5 })).toBe('top');
  });

  it('pointer at (30, 115) — y > 100 → bottom', () => {
    expect(computeDropZone(rect, { x: 30, y: 115 })).toBe('bottom');
  });

  it('pointer at (5, 60) → left', () => {
    expect(computeDropZone(rect, { x: 5, y: 60 })).toBe('left');
  });

  it('pointer at (55, 60) → right', () => {
    expect(computeDropZone(rect, { x: 55, y: 60 })).toBe('right');
  });
});

// ---------------------------------------------------------------------------
// 4. Boundary pixel transitions ±1px around threshold (300×600 cell, thresh=60)
// ---------------------------------------------------------------------------
describe('computeDropZone — boundary pixel transitions (±1px around threshold)', () => {
  const rect = makeRect(0, 0, 300, 600);

  it('y=59 → top', () => {
    expect(computeDropZone(rect, { x: 150, y: 59 })).toBe('top');
  });

  it('y=60 → center (NOT top — strict <)', () => {
    expect(computeDropZone(rect, { x: 150, y: 60 })).toBe('center');
  });

  it('y=61 → center', () => {
    expect(computeDropZone(rect, { x: 150, y: 61 })).toBe('center');
  });

  it('y=539 → center', () => {
    expect(computeDropZone(rect, { x: 150, y: 539 })).toBe('center');
  });

  it('y=540 → center (NOT bottom — strict >)', () => {
    expect(computeDropZone(rect, { x: 150, y: 540 })).toBe('center');
  });

  it('y=541 → bottom', () => {
    expect(computeDropZone(rect, { x: 150, y: 541 })).toBe('bottom');
  });
});

// ---------------------------------------------------------------------------
// 5. Rect not at origin (rect.left/top non-zero)
// ---------------------------------------------------------------------------
describe('computeDropZone — rect not at origin (rect.left/top non-zero)', () => {
  // cell at viewport position (100, 200), size 300×600; threshold=60
  const rect = makeRect(100, 200, 300, 600);

  it('pointer at viewport (250, 500) [relative (150, 300)] → center', () => {
    expect(computeDropZone(rect, { x: 250, y: 500 })).toBe('center');
  });

  it('pointer at viewport (110, 500) [relative (10, 300)] → left', () => {
    expect(computeDropZone(rect, { x: 110, y: 500 })).toBe('left');
  });

  it('pointer at viewport (250, 210) [relative (150, 10)] → top', () => {
    expect(computeDropZone(rect, { x: 250, y: 210 })).toBe('top');
  });
});

// ---------------------------------------------------------------------------
// 6. CANCEL-05 no-dead-space property sweep
// ---------------------------------------------------------------------------
describe('computeDropZone — CANCEL-05 no-dead-space property sweep', () => {
  const VALID_ZONES = new Set(['center', 'top', 'bottom', 'left', 'right']);

  const scenarios: Array<{ label: string; width: number; height: number }> = [
    { label: 'scale 0.2 (60×120)', width: 60, height: 120 },
    { label: 'scale 0.5 (150×300)', width: 150, height: 300 },
    { label: 'scale 1.0 (300×600)', width: 300, height: 600 },
  ];

  for (const { label, width, height } of scenarios) {
    it(`every grid sample resolves to a valid zone — ${label}`, () => {
      const rect = makeRect(0, 0, width, height);
      const step = 5;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const zone = computeDropZone(rect, { x, y });
          expect(VALID_ZONES.has(zone)).toBe(true);
        }
      }
    });

    it(`zone is deterministic (same result on two calls) — ${label}`, () => {
      const rect = makeRect(0, 0, width, height);
      const step = 7;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const ptr = { x, y };
          expect(computeDropZone(rect, ptr)).toBe(computeDropZone(rect, ptr));
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Degenerate small cell — 20×20 (threshold = max(20, 4) = 20)
// ---------------------------------------------------------------------------
describe('computeDropZone — degenerate small cell (20×20)', () => {
  const rect = makeRect(0, 0, 20, 20);
  const VALID_ZONES = new Set(['center', 'top', 'bottom', 'left', 'right']);

  it('every integer pointer in range returns exactly one valid zone without throwing', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        expect(() => computeDropZone(rect, { x, y })).not.toThrow();
        const zone = computeDropZone(rect, { x, y });
        expect(VALID_ZONES.has(zone)).toBe(true);
      }
    }
  });

  it('returns a stable value for every point', () => {
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const ptr = { x, y };
        expect(computeDropZone(rect, ptr)).toBe(computeDropZone(rect, ptr));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Exact geometric center is always 'center' zone
// ---------------------------------------------------------------------------
describe('computeDropZone — exact geometric center is always center zone', () => {
  const sizes: Array<[number, number]> = [
    [100, 100],
    [200, 400],
    [800, 1600],
    [300, 600],
  ];

  for (const [w, h] of sizes) {
    it(`${w}×${h} cell center → 'center'`, () => {
      const rect = makeRect(0, 0, w, h);
      expect(
        computeDropZone(rect, { x: rect.left + w / 2, y: rect.top + h / 2 }),
      ).toBe('center');
    });
  }
});
