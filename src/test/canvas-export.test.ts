/**
 * Canvas API export engine tests (Task 1)
 * Tests for: parseObjectPosition, renderGridToCanvas, exportGrid,
 *             hasVideoCell, downloadDataUrl
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GridNode, LeafNode, ContainerNode } from '../types';
import { DEFAULT_EFFECTS } from '../lib/effects';

// Helper: factory for LeafNode literals in tests. Keeps test shape focused on
// the fields under test while guaranteeing the required `effects` field is
// present after Phase 11 extended LeafNode.
function makeTestLeaf(overrides: Partial<LeafNode> & { id: string }): LeafNode {
  return {
    type: 'leaf',
    mediaId: null,
    fit: 'cover',
    backgroundColor: null,
    panX: 0,
    panY: 0,
    panScale: 1,
    effects: { ...DEFAULT_EFFECTS },
    audioEnabled: true,
    hasAudioTrack: true,
    ...overrides,
  };
}

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
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    const canvas = await renderGridToCanvas(leaf, {});
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
  });

  it('accepts custom width and height', async () => {
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    const canvas = await renderGridToCanvas(leaf, {}, 540, 960);
    expect(canvas.width).toBe(540);
    expect(canvas.height).toBe(960);
  });

  it('fills the canvas with white background on start', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    await renderGridToCanvas(leaf, {});
    // Should have fillRect call for white background
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('fills leaf with no media using white (#ffffff)', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    await renderGridToCanvas(leaf, {});
    // fillRect should be called to paint cell
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920);
  });

  it('fills leaf with backgroundColor when set', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1', backgroundColor: '#ff0000' });
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
    const left: LeafNode = makeTestLeaf({ id: 'left', backgroundColor: '#ff0000' });
    const right: LeafNode = makeTestLeaf({ id: 'right', backgroundColor: '#00ff00' });
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
    const top: LeafNode = makeTestLeaf({ id: 'top', backgroundColor: '#ff0000' });
    const bottom: LeafNode = makeTestLeaf({ id: 'bottom', backgroundColor: '#00ff00' });
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
    const topLeaf: LeafNode = makeTestLeaf({ id: 'top', backgroundColor: '#ff0000' });
    const bottomLeft: LeafNode = makeTestLeaf({ id: 'bl', backgroundColor: '#00ff00' });
    const bottomRight: LeafNode = makeTestLeaf({ id: 'br', backgroundColor: '#0000ff' });
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
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    const result = await exportGrid(leaf, {}, 'png', 0.9, vi.fn());
    expect(result).toMatch(/^data:image\/png/);
  });

  it('returns a data URL string starting with "data:image/jpeg" when format is jpeg', async () => {
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    const result = await exportGrid(leaf, {}, 'jpeg', 0.8, vi.fn());
    expect(result).toMatch(/^data:image\/jpeg/);
  });

  it('calls onStage("preparing") then onStage("exporting") in order', async () => {
    const { exportGrid } = await import('../lib/export');
    const stages: string[] = [];
    const onStage = (s: string) => { stages.push(s); };
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    await exportGrid(leaf, {}, 'png', 0.9, onStage as (s: 'preparing' | 'exporting') => void);
    expect(stages).toEqual(['preparing', 'exporting']);
  });

  it('calls toDataURL with "image/jpeg" and quality when format is jpeg', async () => {
    const { ctx: _ctx, toDataURLMock } = installCanvasMock();
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    await exportGrid(leaf, {}, 'jpeg', 0.85, vi.fn());
    expect(toDataURLMock).toHaveBeenCalledWith('image/jpeg', 0.85);
  });

  it('calls toDataURL with "image/png" when format is png', async () => {
    const { ctx: _ctx, toDataURLMock } = installCanvasMock();
    const { exportGrid } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
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
    const leaf: LeafNode = makeTestLeaf({ id: 'l1', mediaId: 'img1' });
    expect(hasVideoCell(leaf, { img1: 'image' })).toBe(false);
  });

  it('returns true when any media entry has type "video"', async () => {
    const { hasVideoCell } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1', mediaId: 'vid1' });
    expect(hasVideoCell(leaf, { vid1: 'video' })).toBe(true);
  });

  it('returns false when tree has no media at all', async () => {
    const { hasVideoCell } = await import('../lib/export');
    const leaf: LeafNode = makeTestLeaf({ id: 'l1' });
    expect(hasVideoCell(leaf, {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// drawLeafToCanvas effects hook (Phase 11 — Plan 02)
// ---------------------------------------------------------------------------

function makeFilterCtx() {
  const filterAssignments: string[] = [];
  let filter = '';
  const ctx = {
    get filter() {
      return filter;
    },
    set filter(v: string) {
      filter = v;
      filterAssignments.push(v);
    },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  return { ctx, filterAssignments };
}

describe('drawLeafToCanvas effects hook', () => {
  it('no filter assignment / save / restore when effects are DEFAULT', async () => {
    const { drawLeafToCanvas } = await import('../lib/export');
    const { ctx, filterAssignments } = makeFilterCtx();
    const leaf = makeTestLeaf({ id: 'l1' });
    const fakeImg = {} as HTMLImageElement;
    drawLeafToCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      fakeImg,
      { x: 0, y: 0, w: 200, h: 200 },
      leaf,
    );
    expect(filterAssignments).toHaveLength(0);
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.restore).not.toHaveBeenCalled();
    expect(ctx.clip).not.toHaveBeenCalled();
  });

  it('sets ctx.filter to brightness(1.5) for brightness:50', async () => {
    const { drawLeafToCanvas } = await import('../lib/export');
    const { ctx, filterAssignments } = makeFilterCtx();
    const leaf = makeTestLeaf({
      id: 'l1',
      effects: { preset: null, brightness: 50, contrast: 0, saturation: 0, blur: 0 },
    });
    drawLeafToCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      {} as HTMLImageElement,
      { x: 0, y: 0, w: 200, h: 200 },
      leaf,
    );
    expect(filterAssignments).toEqual(['brightness(1.5)']);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.clip).not.toHaveBeenCalled();
  });

  it('blur=10 expands draw rect to 240x240 and clips to original 200x200', async () => {
    const { drawLeafToCanvas } = await import('../lib/export');
    const { ctx } = makeFilterCtx();
    const leaf = makeTestLeaf({
      id: 'l1',
      mediaId: 'm',
      effects: { preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 10 },
    });
    const fakeImg = { width: 100, height: 100 } as HTMLImageElement;
    drawLeafToCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      fakeImg,
      { x: 0, y: 0, w: 200, h: 200 },
      leaf,
    );
    // Clip rect uses ORIGINAL cell dimensions
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 200, 200);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
    // drawImage destination dimensions reflect the expanded draw rect (200 + 2*20 = 240)
    const lastCall = ctx.drawImage.mock.calls[ctx.drawImage.mock.calls.length - 1];
    // Cover-fit dispatch goes through drawCoverImage which uses drawImage with
    // signature (img, sx, sy, sw, sh, dx, dy, dw, dh). dw/dh are last two.
    const dw = lastCall[lastCall.length - 2] as number;
    const dh = lastCall[lastCall.length - 1] as number;
    expect(dw).toBe(240);
    expect(dh).toBe(240);
  });

  it('blur=5 on 100x100 cell expands draw rect to 120x120', async () => {
    const { drawLeafToCanvas } = await import('../lib/export');
    const { ctx } = makeFilterCtx();
    const leaf = makeTestLeaf({
      id: 'l1',
      mediaId: 'm',
      effects: { preset: null, brightness: 0, contrast: 0, saturation: 0, blur: 5 },
    });
    drawLeafToCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      { width: 50, height: 50 } as HTMLImageElement,
      { x: 0, y: 0, w: 100, h: 100 },
      leaf,
    );
    const lastCall = ctx.drawImage.mock.calls[ctx.drawImage.mock.calls.length - 1];
    const dw = lastCall[lastCall.length - 2] as number;
    const dh = lastCall[lastCall.length - 1] as number;
    expect(dw).toBe(120);
    expect(dh).toBe(120);
  });

  it('combined brightness + blur composes filter string and applies overdraw', async () => {
    const { drawLeafToCanvas } = await import('../lib/export');
    const { ctx, filterAssignments } = makeFilterCtx();
    const leaf = makeTestLeaf({
      id: 'l1',
      mediaId: 'm',
      effects: { preset: null, brightness: 50, contrast: 0, saturation: 0, blur: 5 },
    });
    drawLeafToCanvas(
      ctx as unknown as CanvasRenderingContext2D,
      { width: 100, height: 100 } as HTMLImageElement,
      { x: 0, y: 0, w: 100, h: 100 },
      leaf,
    );
    expect(filterAssignments).toEqual(['brightness(1.5) blur(5px)']);
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
  });

  it('three-path parity: renderGridIntoContext forwards effects through to drawLeafToCanvas', async () => {
    const { renderGridIntoContext } = await import('../lib/export');
    const { ctx, filterAssignments } = makeFilterCtx();
    const leaf: LeafNode = makeTestLeaf({
      id: 'leaf-1',
      mediaId: 'm1',
      effects: { preset: null, brightness: 50, contrast: 0, saturation: 0, blur: 0 },
    });
    // Provide a fake image cache so renderNode does NOT call loadImage.
    const imageCache = new Map<string, HTMLImageElement>();
    imageCache.set('data:image/png;base64,abc', { width: 10, height: 10 } as HTMLImageElement);

    await renderGridIntoContext(
      ctx as unknown as CanvasRenderingContext2D,
      leaf as unknown as GridNode,
      { m1: 'data:image/png;base64,abc' },
      1080,
      1920,
      undefined,
      undefined,
      imageCache,
    );

    expect(filterAssignments).toContain('brightness(1.5)');
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
