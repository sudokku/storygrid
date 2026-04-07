/**
 * Canvas API export engine tests (Task 1)
 * Tests for: parseObjectPosition, renderGridToCanvas, exportGrid,
 *             hasVideoCell, downloadDataUrl
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GridNode, LeafNode, ContainerNode } from '../types';

// ---------------------------------------------------------------------------
// Canvas mock helpers
// ---------------------------------------------------------------------------

function makeCtx() {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
}

function installCanvasMock(ctx = makeCtx()) {
  const toDataURLMock = vi.fn((type?: string) => {
    if (type === 'image/jpeg') return 'data:image/jpeg;base64,mock';
    return 'data:image/png;base64,mock';
  });

  // Mock HTMLCanvasElement.prototype.getContext
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // Mock toDataURL
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURLMock);

  return { ctx, toDataURLMock };
}

// ---------------------------------------------------------------------------
// parseObjectPosition
// ---------------------------------------------------------------------------

describe('parseObjectPosition', () => {
  it('parses "center center" to { x: 0.5, y: 0.5 }', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('center center')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('parses "left top" to { x: 0, y: 0 }', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('left top')).toEqual({ x: 0, y: 0 });
  });

  it('parses "right bottom" to { x: 1, y: 1 }', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('right bottom')).toEqual({ x: 1, y: 1 });
  });

  it('parses "25% 75%" to { x: 0.25, y: 0.75 }', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('25% 75%')).toEqual({ x: 0.25, y: 0.75 });
  });

  it('parses "0% 100%" to { x: 0, y: 1 }', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('0% 100%')).toEqual({ x: 0, y: 1 });
  });

  it('parses "center" (single keyword) to { x: 0.5, y: 0.5 }', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('center')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('returns { x: 0.5, y: 0.5 } for empty string', async () => {
    const { parseObjectPosition } = await import('../lib/export');
    expect(parseObjectPosition('')).toEqual({ x: 0.5, y: 0.5 });
  });
});

// ---------------------------------------------------------------------------
// renderGridToCanvas
// ---------------------------------------------------------------------------

describe('renderGridToCanvas', () => {
  beforeEach(() => {
    installCanvasMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a canvas with 1080x1920 dimensions', async () => {
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    const canvas = await renderGridToCanvas(leaf, {});
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
  });

  it('accepts custom width and height', async () => {
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    const canvas = await renderGridToCanvas(leaf, {}, 540, 960);
    expect(canvas.width).toBe(540);
    expect(canvas.height).toBe(960);
  });

  it('fills the canvas with white background on start', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    await renderGridToCanvas(leaf, {});
    // Should have fillRect call for white background
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('fills leaf with no media using white (#ffffff)', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    await renderGridToCanvas(leaf, {});
    // fillRect should be called to paint cell
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920);
  });

  it('fills leaf with backgroundColor when set', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: '#ff0000' };
    await renderGridToCanvas(leaf, {});
    // The leaf cell should be painted red
    const fillRectCalls = ctx.fillRect.mock.calls;
    // Some fillRect call should paint the full canvas cell
    const cellFill = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && call[2] === 1080 && call[3] === 1920
    );
    expect(cellFill).toBeDefined();
  });

  it('horizontal container splits width by sizes weights', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const left: LeafNode = { type: 'leaf', id: 'left', mediaId: null, fit: 'cover', backgroundColor: '#ff0000' };
    const right: LeafNode = { type: 'leaf', id: 'right', mediaId: null, fit: 'cover', backgroundColor: '#00ff00' };
    const container: ContainerNode = {
      type: 'container',
      id: 'c1',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [left, right],
    };
    await renderGridToCanvas(container, {});
    // Left cell: x=0, y=0, w=540, h=1920
    // Right cell: x=540, y=0, w=540, h=1920
    const fillRectCalls = ctx.fillRect.mock.calls;
    const leftCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && Math.round(call[2]) === 540 && call[3] === 1920
    );
    const rightCell = fillRectCalls.find(
      (call: number[]) => Math.round(call[0]) === 540 && call[1] === 0 && Math.round(call[2]) === 540 && call[3] === 1920
    );
    expect(leftCell).toBeDefined();
    expect(rightCell).toBeDefined();
  });

  it('vertical container splits height by sizes weights', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const top: LeafNode = { type: 'leaf', id: 'top', mediaId: null, fit: 'cover', backgroundColor: '#ff0000' };
    const bottom: LeafNode = { type: 'leaf', id: 'bottom', mediaId: null, fit: 'cover', backgroundColor: '#00ff00' };
    const container: ContainerNode = {
      type: 'container',
      id: 'c1',
      direction: 'vertical',
      sizes: [1, 3],
      children: [top, bottom],
    };
    await renderGridToCanvas(container, {});
    const fillRectCalls = ctx.fillRect.mock.calls;
    // Total weight=4, top=1/4*1920=480, bottom=3/4*1920=1440
    const topCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && call[2] === 1080 && Math.round(call[3]) === 480
    );
    const bottomCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && Math.round(call[1]) === 480 && call[2] === 1080 && Math.round(call[3]) === 1440
    );
    expect(topCell).toBeDefined();
    expect(bottomCell).toBeDefined();
  });

  it('nested containers subdivide inner rect correctly', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    // Outer vertical: top=1/2, bottom=1/2
    // Inner (bottom) horizontal: left=1/2, right=1/2
    const topLeaf: LeafNode = { type: 'leaf', id: 'top', mediaId: null, fit: 'cover', backgroundColor: '#ff0000' };
    const bottomLeft: LeafNode = { type: 'leaf', id: 'bl', mediaId: null, fit: 'cover', backgroundColor: '#00ff00' };
    const bottomRight: LeafNode = { type: 'leaf', id: 'br', mediaId: null, fit: 'cover', backgroundColor: '#0000ff' };
    const innerContainer: ContainerNode = {
      type: 'container',
      id: 'inner',
      direction: 'horizontal',
      sizes: [1, 1],
      children: [bottomLeft, bottomRight],
    };
    const outerContainer: ContainerNode = {
      type: 'container',
      id: 'outer',
      direction: 'vertical',
      sizes: [1, 1],
      children: [topLeaf, innerContainer],
    };
    await renderGridToCanvas(outerContainer, {});
    const fillRectCalls = ctx.fillRect.mock.calls;
    // Bottom half starts at y=960 (1920/2), height=960
    // bottomLeft: x=0, y=960, w=540, h=960
    const blCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && Math.round(call[1]) === 960 && Math.round(call[2]) === 540 && Math.round(call[3]) === 960
    );
    expect(blCell).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// exportGrid
// ---------------------------------------------------------------------------

describe('exportGrid', () => {
  beforeEach(() => {
    installCanvasMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a data URL string starting with "data:image/png"', async () => {
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    const result = await exportGrid(leaf, {}, 'png', 0.9, vi.fn());
    expect(result).toMatch(/^data:image\/png/);
  });

  it('returns a data URL string starting with "data:image/jpeg" when format is jpeg', async () => {
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    const result = await exportGrid(leaf, {}, 'jpeg', 0.8, vi.fn());
    expect(result).toMatch(/^data:image\/jpeg/);
  });

  it('calls onStage("preparing") then onStage("exporting") in order', async () => {
    const { exportGrid } = await import('../lib/export');
    const stages: string[] = [];
    const onStage = (s: string) => { stages.push(s); };
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    await exportGrid(leaf, {}, 'png', 0.9, onStage as (s: 'preparing' | 'exporting') => void);
    expect(stages).toEqual(['preparing', 'exporting']);
  });

  it('calls toDataURL with "image/jpeg" and quality when format is jpeg', async () => {
    const { ctx: _ctx, toDataURLMock } = installCanvasMock();
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    await exportGrid(leaf, {}, 'jpeg', 0.85, vi.fn());
    expect(toDataURLMock).toHaveBeenCalledWith('image/jpeg', 0.85);
  });

  it('calls toDataURL with "image/png" when format is png', async () => {
    const { ctx: _ctx, toDataURLMock } = installCanvasMock();
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    await exportGrid(leaf, {}, 'png', 0.9, vi.fn());
    expect(toDataURLMock).toHaveBeenCalledWith('image/png');
  });
});

// ---------------------------------------------------------------------------
// hasVideoCell (updated to use mediaTypeMap)
// ---------------------------------------------------------------------------

describe('hasVideoCell', () => {
  it('returns false when all media entries are image type', async () => {
    const { hasVideoCell } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: 'img1', fit: 'cover', backgroundColor: null };
    expect(hasVideoCell(leaf, { img1: 'image' })).toBe(false);
  });

  it('returns true when any media entry has type "video"', async () => {
    const { hasVideoCell } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: 'vid1', fit: 'cover', backgroundColor: null };
    expect(hasVideoCell(leaf, { vid1: 'video' })).toBe(true);
  });

  it('returns false when tree has no media at all', async () => {
    const { hasVideoCell } = await import('../lib/export');
    const leaf: LeafNode = { type: 'leaf', id: 'l1', mediaId: null, fit: 'cover', backgroundColor: null };
    expect(hasVideoCell(leaf, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// downloadDataUrl (unchanged function — still passes)
// ---------------------------------------------------------------------------

describe('downloadDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor element with download attribute and correct filename', async () => {
    const { downloadDataUrl } = await import('../lib/export');
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      (el as HTMLAnchorElement).click = clickSpy;
      return el;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

    downloadDataUrl('data:image/png;base64,abc', 'storygrid-test.png');

    expect(appendSpy).toHaveBeenCalled();
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.download).toBe('storygrid-test.png');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('sets href to the provided dataUrl', async () => {
    const { downloadDataUrl } = await import('../lib/export');
    let capturedAnchor: HTMLAnchorElement | null = null;
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      capturedAnchor = el as HTMLAnchorElement;
      (capturedAnchor as HTMLAnchorElement).click = vi.fn();
      return el;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

    downloadDataUrl('data:image/png;base64,xyz', 'test.png');
    expect(capturedAnchor).not.toBeNull();
    expect((capturedAnchor as unknown as HTMLAnchorElement).href).toContain('data:image/png');
  });
});
