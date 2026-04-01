import { getAllLeaves } from './tree';
import type { GridNode, LeafNode } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'png' | 'jpeg';

type Rect = { x: number; y: number; w: number; h: number };
type ObjPos = { x: number; y: number };

export type CanvasSettings = {
  gap: number;
  borderRadius: number;
  borderColor: string;
  backgroundMode: 'solid' | 'gradient';
  backgroundColor: string;
  backgroundGradientFrom: string;
  backgroundGradientTo: string;
  backgroundGradientDir: 'to-bottom' | 'to-right' | 'diagonal';
};

const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  gap: 0,
  borderRadius: 0,
  borderColor: '',
  backgroundMode: 'solid',
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#000000',
  backgroundGradientDir: 'to-bottom',
};

// ---------------------------------------------------------------------------
// parseObjectPosition — converts CSS object-position to 0-1 fractions
// ---------------------------------------------------------------------------

const KEYWORD_MAP: Record<string, number> = {
  left: 0,
  center: 0.5,
  right: 1,
  top: 0,
  bottom: 1,
};

/**
 * Parses a CSS object-position string to { x, y } fractions in [0, 1].
 * Examples:
 *   'center center' → { x: 0.5, y: 0.5 }
 *   'left top'      → { x: 0, y: 0 }
 *   '25% 75%'       → { x: 0.25, y: 0.75 }
 */
export function parseObjectPosition(pos: string): ObjPos {
  const DEFAULT: ObjPos = { x: 0.5, y: 0.5 };
  if (!pos || !pos.trim()) return DEFAULT;

  const parts = pos.trim().split(/\s+/);
  if (parts.length === 0) return DEFAULT;

  function parsePart(part: string): number {
    if (part in KEYWORD_MAP) return KEYWORD_MAP[part];
    if (part.endsWith('%')) return parseFloat(part) / 100;
    // Pixel values not expected but handle gracefully
    return 0.5;
  }

  if (parts.length === 1) {
    const v = parsePart(parts[0]);
    return { x: v, y: v };
  }

  return { x: parsePart(parts[0]), y: parsePart(parts[1]) };
}

// ---------------------------------------------------------------------------
// loadImage — creates HTMLImageElement from a data URI
// ---------------------------------------------------------------------------

export function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${dataUri.slice(0, 40)}`));
    img.src = dataUri;
  });
}

// ---------------------------------------------------------------------------
// roundedRect — Safari 15.0-15.3 fallback for ctx.roundRect
// ---------------------------------------------------------------------------

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
    (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// ---------------------------------------------------------------------------
// drawCoverImage — 9-arg drawImage with source crop for object-fit: cover
// ---------------------------------------------------------------------------

export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: Rect,
  objPos: ObjPos,
): void {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const cellAspect = rect.w / rect.h;

  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  if (imgAspect > cellAspect) {
    // Image is wider — crop horizontally
    sw = Math.round(img.naturalHeight * cellAspect);
    sx = Math.round((img.naturalWidth - sw) * objPos.x);
  } else if (imgAspect < cellAspect) {
    // Image is taller — crop vertically
    sh = Math.round(img.naturalWidth / cellAspect);
    sy = Math.round((img.naturalHeight - sh) * objPos.y);
  }

  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
}

// ---------------------------------------------------------------------------
// drawContainImage — letterbox fit, fill unused area with bgColor
// ---------------------------------------------------------------------------

export function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: Rect,
  objPos: ObjPos,
  bgColor: string,
): void {
  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const cellAspect = rect.w / rect.h;

  let dw: number, dh: number;

  if (imgAspect > cellAspect) {
    // Image is wider — letterbox vertically
    dw = rect.w;
    dh = Math.round(rect.w / imgAspect);
  } else {
    // Image is taller — pillarbox horizontally
    dh = rect.h;
    dw = Math.round(rect.h * imgAspect);
  }

  const dx = rect.x + Math.round((rect.w - dw) * objPos.x);
  const dy = rect.y + Math.round((rect.h - dh) * objPos.y);

  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh);
}

// ---------------------------------------------------------------------------
// drawPannedCoverImage — pan-aware version of drawCoverImage
// ---------------------------------------------------------------------------

export function drawPannedCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: Rect,
  objPos: ObjPos,
  panX: number,
  panY: number,
  panScale: number,
): void {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const cellAspect = rect.w / rect.h;

  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

  if (imgAspect > cellAspect) {
    sw = Math.round(img.naturalHeight * cellAspect);
    sx = Math.round((img.naturalWidth - sw) * objPos.x);
  } else if (imgAspect < cellAspect) {
    sh = Math.round(img.naturalWidth / cellAspect);
    sy = Math.round((img.naturalHeight - sh) * objPos.y);
  }

  // Apply panScale: shrink source crop by 1/panScale
  const scaledSw = Math.round(sw / panScale);
  const scaledSh = Math.round(sh / panScale);

  // Apply pan offset: shift crop center by panX/panY percentage of remaining headroom
  const maxOffsetX = (sw - scaledSw) / 2;
  const maxOffsetY = (sh - scaledSh) / 2;
  const offsetX = Math.round((panX / 100) * maxOffsetX);
  const offsetY = Math.round((panY / 100) * maxOffsetY);

  const finalSx = sx + (sw - scaledSw) / 2 + offsetX;
  const finalSy = sy + (sh - scaledSh) / 2 + offsetY;

  // Clamp to image bounds
  const clampedSx = Math.max(0, Math.min(img.naturalWidth - scaledSw, finalSx));
  const clampedSy = Math.max(0, Math.min(img.naturalHeight - scaledSh, finalSy));

  ctx.drawImage(img, clampedSx, clampedSy, scaledSw, scaledSh, rect.x, rect.y, rect.w, rect.h);
}

// ---------------------------------------------------------------------------
// renderNode — recursive renderer walking the GridNode tree
// ---------------------------------------------------------------------------

async function renderNode(
  ctx: CanvasRenderingContext2D,
  node: GridNode,
  rect: Rect,
  mediaRegistry: Record<string, string>,
  imageCache: Map<string, HTMLImageElement>,
  settings: CanvasSettings,
): Promise<void> {
  if (node.type === 'leaf') {
    const leaf = node as LeafNode;
    const dataUri = leaf.mediaId ? (mediaRegistry[leaf.mediaId] ?? null) : null;

    // Apply border radius clipping
    if (settings.borderRadius > 0) {
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, settings.borderRadius);
      ctx.clip();
    }

    if (!dataUri) {
      // No media — fill with solid color
      ctx.fillStyle = leaf.backgroundColor ?? '#ffffff';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      // Has media — load image (with cache) and draw
      let img = imageCache.get(dataUri);
      if (!img) {
        img = await loadImage(dataUri);
        imageCache.set(dataUri, img);
      }

      const objPos = parseObjectPosition(leaf.objectPosition ?? 'center center');
      const bgColor = leaf.backgroundColor ?? '#ffffff';
      const hasPan = leaf.panX !== 0 || leaf.panY !== 0 || leaf.panScale !== 1;

      if (leaf.fit === 'cover') {
        if (hasPan) {
          drawPannedCoverImage(
            ctx, img, rect, objPos,
            leaf.panX ?? 0, leaf.panY ?? 0, leaf.panScale ?? 1,
          );
        } else {
          drawCoverImage(ctx, img, rect, objPos);
        }
      } else {
        drawContainImage(ctx, img, rect, objPos, bgColor);
      }
    }

    if (settings.borderRadius > 0) {
      ctx.restore();
    }

    // Draw border stroke
    if (settings.borderColor) {
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, settings.borderRadius);
      ctx.strokeStyle = settings.borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Container — subdivide rect with gap and recurse
    const totalWeight = node.sizes.reduce((a, b) => a + b, 0);
    const gapCount = node.children.length - 1;
    const totalGap = settings.gap * gapCount;
    const isHorizontal = node.direction === 'horizontal';
    const availableSize = (isHorizontal ? rect.w : rect.h) - totalGap;
    let offset = 0;

    for (let i = 0; i < node.children.length; i++) {
      const fraction = node.sizes[i] / totalWeight;
      let childRect: Rect;

      if (isHorizontal) {
        const childW = availableSize * fraction;
        childRect = { x: rect.x + offset, y: rect.y, w: childW, h: rect.h };
        offset += childW + settings.gap;
      } else {
        const childH = availableSize * fraction;
        childRect = { x: rect.x, y: rect.y + offset, w: rect.w, h: childH };
        offset += childH + settings.gap;
      }

      await renderNode(ctx, node.children[i], childRect, mediaRegistry, imageCache, settings);
    }
  }
}

// ---------------------------------------------------------------------------
// renderGridToCanvas — main canvas renderer
// ---------------------------------------------------------------------------

/**
 * Walks the grid tree and draws all cells onto a Canvas element.
 * Accepts CanvasSettings for gap, border radius, border color, and background.
 * Returns a resolved HTMLCanvasElement ready for toDataURL.
 */
export async function renderGridToCanvas(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  width = 1080,
  height = 1920,
  settings: CanvasSettings = DEFAULT_CANVAS_SETTINGS,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Draw background
  if (settings.backgroundMode === 'gradient') {
    const dirMap: Record<string, [number, number, number, number]> = {
      'to-bottom': [0, 0, 0, height],
      'to-right': [0, 0, width, 0],
      'diagonal': [0, 0, width, height],
    };
    const [x0, y0, x1, y1] = dirMap[settings.backgroundGradientDir] ?? [0, 0, 0, height];
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, settings.backgroundGradientFrom);
    grad.addColorStop(1, settings.backgroundGradientTo);
    ctx.fillStyle = grad as unknown as string;
  } else {
    ctx.fillStyle = settings.backgroundColor;
  }
  ctx.fillRect(0, 0, width, height);

  const imageCache = new Map<string, HTMLImageElement>();
  await renderNode(ctx, root, { x: 0, y: 0, w: width, h: height }, mediaRegistry, imageCache, settings);

  return canvas;
}

// ---------------------------------------------------------------------------
// exportGrid — main entry point: tree → data URL
// ---------------------------------------------------------------------------

/**
 * Renders the grid tree to a Canvas and converts to a data URL.
 * Replaces the previous DOM-capture approach with a zero-dependency Canvas API renderer.
 *
 * onStage callback:
 *   'preparing' — fired before canvas render begins
 *   'exporting'  — fired before toDataURL conversion
 */
export async function exportGrid(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  format: ExportFormat,
  quality: number,
  onStage: (stage: 'preparing' | 'exporting') => void,
  settings?: CanvasSettings,
): Promise<string> {
  onStage('preparing');
  const canvas = await renderGridToCanvas(root, mediaRegistry, 1080, 1920, settings);
  onStage('exporting');

  if (format === 'jpeg') {
    return canvas.toDataURL('image/jpeg', quality);
  }
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// downloadDataUrl — anchor-click download trigger
// ---------------------------------------------------------------------------

/**
 * Triggers a file download of the given data URL using an invisible anchor click.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---------------------------------------------------------------------------
// hasVideoCell — video guard for export format selection
// ---------------------------------------------------------------------------

/**
 * Returns true if any leaf in the tree has a mediaId whose data URI
 * starts with 'data:video/', indicating video content is present.
 */
export function hasVideoCell(
  root: GridNode,
  mediaRegistry: Record<string, string>,
): boolean {
  const leaves = getAllLeaves(root);
  return leaves.some(
    leaf =>
      leaf.mediaId != null &&
      mediaRegistry[leaf.mediaId]?.startsWith('data:video/'),
  );
}
