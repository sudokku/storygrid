import { getAllLeaves } from './tree';
import type { GridNode } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'png' | 'jpeg';

type Rect = { x: number; y: number; w: number; h: number };
type ObjPos = { x: number; y: number };

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
// renderNode — recursive renderer walking the GridNode tree
// ---------------------------------------------------------------------------

async function renderNode(
  ctx: CanvasRenderingContext2D,
  node: GridNode,
  rect: Rect,
  mediaRegistry: Record<string, string>,
  imageCache: Map<string, HTMLImageElement>,
): Promise<void> {
  if (node.type === 'leaf') {
    const dataUri = node.mediaId ? (mediaRegistry[node.mediaId] ?? null) : null;

    if (!dataUri) {
      // No media — fill with solid color
      ctx.fillStyle = node.backgroundColor ?? '#ffffff';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      return;
    }

    // Has media — load image (with cache) and draw
    let img = imageCache.get(dataUri);
    if (!img) {
      img = await loadImage(dataUri);
      imageCache.set(dataUri, img);
    }

    const objPos = parseObjectPosition(node.objectPosition ?? 'center center');
    const bgColor = node.backgroundColor ?? '#ffffff';

    if (node.fit === 'cover') {
      drawCoverImage(ctx, img, rect, objPos);
    } else {
      drawContainImage(ctx, img, rect, objPos, bgColor);
    }
  } else {
    // Container — subdivide rect and recurse
    const totalWeight = node.sizes.reduce((a, b) => a + b, 0);
    let offset = 0;

    for (let i = 0; i < node.children.length; i++) {
      const weight = node.sizes[i];
      const fraction = weight / totalWeight;
      let childRect: Rect;

      if (node.direction === 'horizontal') {
        const childW = rect.w * fraction;
        childRect = { x: rect.x + offset, y: rect.y, w: childW, h: rect.h };
        offset += childW;
      } else {
        const childH = rect.h * fraction;
        childRect = { x: rect.x, y: rect.y + offset, w: rect.w, h: childH };
        offset += childH;
      }

      await renderNode(ctx, node.children[i], childRect, mediaRegistry, imageCache);
    }
  }
}

// ---------------------------------------------------------------------------
// renderGridToCanvas — main canvas renderer
// ---------------------------------------------------------------------------

/**
 * Walks the grid tree and draws all cells onto a Canvas element.
 * Returns a resolved HTMLCanvasElement ready for toDataURL.
 */
export async function renderGridToCanvas(
  root: GridNode,
  mediaRegistry: Record<string, string>,
  width = 1080,
  height = 1920,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Fill entire canvas with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const imageCache = new Map<string, HTMLImageElement>();
  await renderNode(ctx, root, { x: 0, y: 0, w: width, h: height }, mediaRegistry, imageCache);

  return canvas;
}

// ---------------------------------------------------------------------------
// exportGrid — main entry point: tree → data URL
// ---------------------------------------------------------------------------

/**
 * Renders the grid tree to a Canvas and converts to a data URL.
 * Replaces the html-to-image DOM-capture approach.
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
): Promise<string> {
  onStage('preparing');
  const canvas = await renderGridToCanvas(root, mediaRegistry);
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
