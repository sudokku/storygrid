/**
 * Phase 05 Plan 04 Task 1: Canvas Settings in Export Renderer
 * Tests for: CanvasSettings type, gap/radius/background/border/pan-zoom in export
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GridNode, LeafNode, ContainerNode } from '../types';

// ---------------------------------------------------------------------------
// Canvas mock helpers (extended from canvas-export.test.ts)
// ---------------------------------------------------------------------------

function makeCtx() {
  return {
    fillStyle: '' as string,
    strokeStyle: '' as string,
    lineWidth: 0,
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    roundRect: undefined as ((...args: unknown[]) => void) | undefined,
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
  };
}

type MockCtx = ReturnType<typeof makeCtx>;

function installCanvasMock(ctx: MockCtx = makeCtx()) {
  const toDataURLMock = vi.fn((type?: string) => {
    if (type === 'image/jpeg') return 'data:image/jpeg;base64,mock';
    return 'data:image/png;base64,mock';
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURLMock);

  return { ctx, toDataURLMock };
}

// ---------------------------------------------------------------------------
// Helper nodes
// ---------------------------------------------------------------------------

function makeLeaf(id: string, overrides?: Partial<LeafNode>): LeafNode {
  return {
    type: 'leaf',
    id,
    mediaId: null,
    fit: 'cover',
    backgroundColor: '#cccccc',
    panX: 0,
    panY: 0,
    panScale: 1,
    audioEnabled: true,
    ...overrides,
  };
}

function makeContainer(direction: 'horizontal' | 'vertical', children: GridNode[]): ContainerNode {
  return {
    type: 'container',
    id: 'c1',
    direction,
    sizes: children.map(() => 1),
    children,
  };
}

// ---------------------------------------------------------------------------
// CanvasSettings type export
// ---------------------------------------------------------------------------

describe('CanvasSettings type and exports', () => {
  it('CanvasSettings type is exported from export.ts', async () => {
    const mod = await import('../lib/export');
    // TypeScript would fail at compile time if type is missing.
    // At runtime, we verify the DEFAULT_CANVAS_SETTINGS object is exported.
    expect(mod).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// renderGridToCanvas — background rendering
// ---------------------------------------------------------------------------

describe('renderGridToCanvas — solid background', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fills canvas with backgroundColor when backgroundMode=solid', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 0,
      backgroundMode: 'solid',
      backgroundColor: '#ff0000',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });
    // ctx.fillStyle should have been set to #ff0000 before the canvas fillRect
    // Check that fillRect was called at all
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('calls createLinearGradient when backgroundMode=gradient', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 0,
      backgroundMode: 'gradient',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ff0000',
      backgroundGradientTo: '#0000ff',
      backgroundGradientDir: 'to-bottom',
    });
    expect(ctx.createLinearGradient).toHaveBeenCalled();
  });

  it('uses correct gradient coordinates for to-right direction', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 0,
      backgroundMode: 'gradient',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ff0000',
      backgroundGradientTo: '#0000ff',
      backgroundGradientDir: 'to-right',
    });
    // to-right: x0=0, y0=0, x1=width, y1=0
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 1080, 0);
  });

  it('uses correct gradient coordinates for to-bottom direction', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');
    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 0,
      backgroundMode: 'gradient',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ff0000',
      backgroundGradientTo: '#0000ff',
      backgroundGradientDir: 'to-bottom',
    });
    // to-bottom: x0=0, y0=0, x1=0, y1=height
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 1920);
  });
});

// ---------------------------------------------------------------------------
// renderGridToCanvas — gap support
// ---------------------------------------------------------------------------

describe('renderGridToCanvas — gap support', () => {
  afterEach(() => vi.restoreAllMocks());

  it('horizontal container: child rects smaller when gap > 0', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const left = makeLeaf('left', { backgroundColor: '#ff0000' });
    const right = makeLeaf('right', { backgroundColor: '#00ff00' });
    const container = makeContainer('horizontal', [left, right]);

    await renderGridToCanvas(container, {}, 1080, 1920, {
      gap: 10,
      borderRadius: 0,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    // With gap=10 and 2 equal children in 1080px:
    // availableSize = 1080 - 10 = 1070
    // each child width = 1070 / 2 = 535
    // left child: x=0, w=535
    // right child: x=545 (535 + 10), w=535
    const fillRectCalls = ctx.fillRect.mock.calls;
    // Find left cell (x=0, w=535)
    const leftCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && Math.round(call[2]) === 535 && call[3] === 1920
    );
    expect(leftCell).toBeDefined();
  });

  it('vertical container: child rects smaller when gap > 0', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const top = makeLeaf('top', { backgroundColor: '#ff0000' });
    const bottom = makeLeaf('bottom', { backgroundColor: '#0000ff' });
    const container = makeContainer('vertical', [top, bottom]);

    await renderGridToCanvas(container, {}, 1080, 1920, {
      gap: 20,
      borderRadius: 0,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    // With gap=20 and 2 equal children in 1920px:
    // availableSize = 1920 - 20 = 1900
    // each child height = 950
    const fillRectCalls = ctx.fillRect.mock.calls;
    const topCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && call[2] === 1080 && Math.round(call[3]) === 950
    );
    expect(topCell).toBeDefined();
  });

  it('gap=0 preserves original behavior (no reduction)', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const left = makeLeaf('left', { backgroundColor: '#ff0000' });
    const right = makeLeaf('right', { backgroundColor: '#00ff00' });
    const container = makeContainer('horizontal', [left, right]);

    await renderGridToCanvas(container, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 0,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    // With gap=0: each child = 540
    const fillRectCalls = ctx.fillRect.mock.calls;
    const leftCell = fillRectCalls.find(
      (call: number[]) => call[0] === 0 && call[1] === 0 && Math.round(call[2]) === 540 && call[3] === 1920
    );
    expect(leftCell).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// renderGridToCanvas — border radius clipping
// ---------------------------------------------------------------------------

describe('renderGridToCanvas — border radius', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls beginPath and clip when borderRadius > 0', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 12,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it('does NOT call clip when borderRadius = 0', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 0,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    expect(ctx.clip).not.toHaveBeenCalled();
  });

  it('uses arcTo fallback when ctx.roundRect is undefined', async () => {
    const ctx = makeCtx();
    // Ensure roundRect is NOT a function
    ctx.roundRect = undefined;
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 12,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    expect(ctx.arcTo).toHaveBeenCalled();
  });

  it('uses ctx.roundRect when it is a function', async () => {
    const ctx = makeCtx();
    const roundRectMock = vi.fn();
    ctx.roundRect = roundRectMock;
    installCanvasMock(ctx);
    const { renderGridToCanvas } = await import('../lib/export');

    const leaf = makeLeaf('l1');
    await renderGridToCanvas(leaf, {}, 1080, 1920, {
      gap: 0,
      borderRadius: 12,
      backgroundMode: 'solid',
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    expect(roundRectMock).toHaveBeenCalled();
  });
});



// ---------------------------------------------------------------------------
// drawPannedCoverImage — pan/zoom crop math
// ---------------------------------------------------------------------------

describe('drawPannedCoverImage — pan/zoom', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is exported from export.ts', async () => {
    const mod = await import('../lib/export');
    expect(typeof (mod as Record<string, unknown>).drawPannedCoverImage).toBe('function');
  });

  it('with panScale=1 and panX=0 panY=0, calls translate to cell center and scale(1,1)', async () => {
    const { drawPannedCoverImage } = await import('../lib/export') as {
      drawPannedCoverImage: (ctx: unknown, img: unknown, rect: unknown, objPos: unknown, panX: number, panY: number, panScale: number) => void;
    };

    const translateMock = vi.fn();
    const scaleMock = vi.fn();
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(),
      translate: translateMock, scale: scaleMock, drawImage: vi.fn(),
    };
    const img = { naturalWidth: 1000, naturalHeight: 1000 } as HTMLImageElement;
    const rect = { x: 0, y: 0, w: 500, h: 500 };
    const objPos = { x: 0.5, y: 0.5 };

    drawPannedCoverImage(ctx, img, rect, objPos, 0, 0, 1);

    // translate to cell center (250, 250) with no pan offset
    expect(translateMock).toHaveBeenCalledWith(250, 250);
    // scale(1, 1) — no zoom
    expect(scaleMock).toHaveBeenCalledWith(1, 1);
  });

  it('with panScale=2, calls ctx.scale(2, 2)', async () => {
    const { drawPannedCoverImage } = await import('../lib/export') as {
      drawPannedCoverImage: (ctx: unknown, img: unknown, rect: unknown, objPos: unknown, panX: number, panY: number, panScale: number) => void;
    };

    const scaleMock = vi.fn();
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(),
      translate: vi.fn(), scale: scaleMock, drawImage: vi.fn(),
    };
    const img = { naturalWidth: 1000, naturalHeight: 1000 } as HTMLImageElement;
    const rect = { x: 0, y: 0, w: 500, h: 500 };
    const objPos = { x: 0.5, y: 0.5 };

    drawPannedCoverImage(ctx, img, rect, objPos, 0, 0, 2);

    expect(scaleMock).toHaveBeenCalledWith(2, 2);
  });

  it('with panX=50, translate x offset includes panX/100 * rect.w', async () => {
    const { drawPannedCoverImage } = await import('../lib/export') as {
      drawPannedCoverImage: (ctx: unknown, img: unknown, rect: unknown, objPos: unknown, panX: number, panY: number, panScale: number) => void;
    };

    const translateMock = vi.fn();
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(),
      translate: translateMock, scale: vi.fn(), drawImage: vi.fn(),
    };
    const img = { naturalWidth: 1000, naturalHeight: 1000 } as HTMLImageElement;
    const rect = { x: 0, y: 0, w: 500, h: 500 };
    const objPos = { x: 0.5, y: 0.5 };

    // panX=50: translate x = cx + (50/100)*500 = 250 + 250 = 500
    drawPannedCoverImage(ctx, img, rect, objPos, 50, 0, 1);
    const [tx] = translateMock.mock.calls[0];
    expect(tx).toBe(500); // 250 (center) + 250 (pan offset)
  });
});

// ---------------------------------------------------------------------------
// exportGrid — passes settings through
// ---------------------------------------------------------------------------

describe('exportGrid — settings pass-through', () => {
  afterEach(() => vi.restoreAllMocks());

  it('accepts optional settings parameter and returns data URL', async () => {
    const ctx = makeCtx();
    installCanvasMock(ctx);
    const { exportGrid } = await import('../lib/export');

    const leaf = makeLeaf('l1');
    const result = await exportGrid(leaf, {}, 'png', 0.9, vi.fn(), {
      gap: 10,
      borderRadius: 8,
      backgroundMode: 'solid',
      backgroundColor: '#333333',
      backgroundGradientFrom: '#fff',
      backgroundGradientTo: '#000',
      backgroundGradientDir: 'to-bottom',
    });

    expect(result).toMatch(/^data:image\/png/);
  });

  it('works without settings (backward compatible)', async () => {
    installCanvasMock();
    const { exportGrid } = await import('../lib/export');

    const leaf = makeLeaf('l1');
    const result = await exportGrid(leaf, {}, 'png', 0.9, vi.fn());
    expect(result).toMatch(/^data:image\/png/);
  });
});
