/**
 * DropZoneIndicators tests (Phase 28 / Plan 06).
 *
 * Locks the 5-icon overlay contract (REQ: DROP-01, DROP-05):
 *   - Root div at `position: absolute; inset: 0; pointer-events: none; z-index: 20`
 *   - Exactly 5 zone children (center + 4 edges)
 *   - All 5 zones always render (D-15 — no active/inactive differentiation in Phase 28)
 *   - Every icon sized as `32 / canvasScale` (screen-constant visual)
 *   - All elements carry `pointer-events-none` (D-16 — drop passes through to LeafNode)
 *   - No insertion lines (DROP-05 — icons only)
 *   - lucide-react icons: ArrowLeftRight (center), ArrowUp, ArrowDown, ArrowLeft, ArrowRight
 *
 * Timing (250ms touch hold, 8px mouse distance) is not in scope here — this
 * component is a pure presentation; the hit-test for zones lives in
 * `computeDropZone`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DropZoneIndicators } from './DropZoneIndicators';
import { useEditorStore } from '../store/editorStore';

beforeEach(() => {
  // Reset canvasScale to 1 (identity) unless overridden in a test.
  useEditorStore.setState({ canvasScale: 1 });
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. Root container contract (D-13)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators root container (D-13)', () => {
  it('renders a root div with data-testid="drop-zones"', () => {
    render(<DropZoneIndicators zone={null} />);
    expect(screen.getByTestId('drop-zones')).toBeTruthy();
  });

  it('root is absolutely positioned at inset: 0 and z-index 20', () => {
    render(<DropZoneIndicators zone={null} />);
    const root = screen.getByTestId('drop-zones');
    expect(root.className).toContain('absolute');
    expect(root.className).toContain('inset-0');
    expect(root.className).toContain('pointer-events-none');
    expect((root as HTMLElement).style.zIndex).toBe('20');
  });
});

// ---------------------------------------------------------------------------
// 2. Five zones always render (D-15 — no active/inactive in Phase 28)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators renders 5 zones unconditionally (D-15)', () => {
  it.each([
    ['drop-zone-center'],
    ['drop-zone-top'],
    ['drop-zone-bottom'],
    ['drop-zone-left'],
    ['drop-zone-right'],
  ])('renders %s with zone={null}', (testid) => {
    render(<DropZoneIndicators zone={null} />);
    expect(screen.getByTestId(testid)).toBeTruthy();
  });

  it.each([
    ['center'],
    ['top'],
    ['bottom'],
    ['left'],
    ['right'],
  ] as const)('renders all 5 zones regardless of zone prop value (zone=%s)', (zoneVal) => {
    render(<DropZoneIndicators zone={zoneVal} />);
    expect(screen.getByTestId('drop-zone-center')).toBeTruthy();
    expect(screen.getByTestId('drop-zone-top')).toBeTruthy();
    expect(screen.getByTestId('drop-zone-bottom')).toBeTruthy();
    expect(screen.getByTestId('drop-zone-left')).toBeTruthy();
    expect(screen.getByTestId('drop-zone-right')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. lucide-react icons present — 5 SVGs inside root (D-14)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators contains 5 lucide SVG icons (D-14)', () => {
  it('root contains exactly 5 svg child elements', () => {
    render(<DropZoneIndicators zone={null} />);
    const root = screen.getByTestId('drop-zones');
    const svgs = root.querySelectorAll('svg');
    expect(svgs.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 4. Icon sizing is 32 / canvasScale (D-14 — screen-constant visual)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators icon sizing (D-14: 32 / canvasScale)', () => {
  it('at canvasScale=1, svg width/height is 32', () => {
    useEditorStore.setState({ canvasScale: 1 });
    render(<DropZoneIndicators zone={null} />);
    const root = screen.getByTestId('drop-zones');
    const svgs = root.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg.getAttribute('width')).toBe('32');
      expect(svg.getAttribute('height')).toBe('32');
    });
  });

  it('at canvasScale=0.5, svg width/height is 64 (32 / 0.5)', () => {
    useEditorStore.setState({ canvasScale: 0.5 });
    render(<DropZoneIndicators zone={null} />);
    const root = screen.getByTestId('drop-zones');
    const svgs = root.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg.getAttribute('width')).toBe('64');
      expect(svg.getAttribute('height')).toBe('64');
    });
  });

  it('at canvasScale=0.25, svg width/height is 128 (32 / 0.25)', () => {
    useEditorStore.setState({ canvasScale: 0.25 });
    render(<DropZoneIndicators zone={null} />);
    const root = screen.getByTestId('drop-zones');
    const svgs = root.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg.getAttribute('width')).toBe('128');
      expect(svg.getAttribute('height')).toBe('128');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Pointer-events-none on root (D-16)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators pointer-events-none (D-16)', () => {
  it('root has pointer-events-none class', () => {
    render(<DropZoneIndicators zone={null} />);
    const root = screen.getByTestId('drop-zones');
    expect(root.className).toContain('pointer-events-none');
  });
});

// ---------------------------------------------------------------------------
// 6. No insertion lines (DROP-05 — icons only)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators DROP-05 — no insertion lines', () => {
  it('renders no edge-line test-ids (Phase 25 pattern removed)', () => {
    render(<DropZoneIndicators zone="top" />);
    expect(screen.queryByTestId('edge-line-top')).toBeNull();
    expect(screen.queryByTestId('edge-line-bottom')).toBeNull();
    expect(screen.queryByTestId('edge-line-left')).toBeNull();
    expect(screen.queryByTestId('edge-line-right')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. No active/inactive differentiation (D-15 — Phase 29 polish NOT added)
// ---------------------------------------------------------------------------

describe('DropZoneIndicators D-15 — Phase 28 base state only', () => {
  it('does NOT apply text-white/30 or scale-110 utilities (reserved for Phase 29)', () => {
    render(<DropZoneIndicators zone="center" />);
    const root = screen.getByTestId('drop-zones');
    const allClasses: string[] = [];
    root.querySelectorAll('*').forEach((el) => {
      allClasses.push((el as HTMLElement).className?.toString?.() ?? '');
    });
    allClasses.push(root.className);
    const combined = allClasses.join(' ');
    expect(combined).not.toMatch(/text-white\/30/);
    expect(combined).not.toMatch(/scale-110/);
  });
});
