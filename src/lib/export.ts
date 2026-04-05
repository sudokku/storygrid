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
  backgroundMode: 'solid' | 'gradient';
  backgroundColor: string;
  backgroundGradientFrom: string;
  backgroundGradientTo: string;
  backgroundGradientDir: 'to-bottom' | 'to-right' | 'diagonal';
};

const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  gap: 0,
  borderRadius: 0,
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

export function parseObjectPosition(pos: string): ObjPos {
  const DEFAULT: ObjPos = { x: 0.5, y: 0.5 };
  if (!pos || !pos.trim()) return DEFAULT;

  const parts = pos.trim().split(/\s+/);
  if (parts.length === 0) return DEFAULT;

  function parsePart(part: string): number {
    if (part in KEYWORD_MAP) return KEYWORD_MAP[part];
    if (part.endsWith('%')) return parseFloat(part) / 100;
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
// getSourceDimensions — unified width/height for image and video elements
// ---------------------------------------------------------------------------

export function getSourceDimensions(
  src: HTMLImageElement | HTMLVideoElement,
): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) {
    return { w: src.videoWidth, h: src.videoHeight };
  }
  return { w: src.naturalWidth, h: src.naturalHeight };
}

// ---------------------------------------------------------------------------
// drawCoverImage — source crop for object-fit: cover
// ---------------------------------------------------------------------------

export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  rect: Rect,
  objPos: ObjPos,
): void {
  const { w: srcW, h: srcH } = getSourceDimensions(img);
  const imgAspect = srcW / srcH;
  const cellAspect = rect.w / rect.h;

  let sx = 0, sy = 0, sw = srcW, sh = srcH;

  if (imgAspect > cellAspect) {
    sw = Math.round(srcH * cellAspect);
    sx = Math.round((srcW - sw) * objPos.x);
  } else if (imgAspect < cellAspect) {
    sh = Math.round(srcW / cellAspect);
    sy = Math.round((srcH - sh) * objPos.y);
  }

  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
}

// ---------------------------------------------------------------------------
// drawContainImage — letterbox fit, fill unused area with bgColor
// ---------------------------------------------------------------------------

export function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  rect: Rect,
  objPos: ObjPos,
  bgColor: string,
): void {
  ctx.fillStyle = bgColor;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const { w: srcW, h: srcH } = getSourceDimensions(img);
  const imgAspect = srcW / srcH;
  const cellAspect = rect.w / rect.h;

  let dw: number, dh: number;

  if (imgAspect > cellAspect) {
    dw = rect.w;
    dh = Math.round(rect.w / imgAspect);
  } else {
    dh = rect.h;
    dw = Math.round(rect.h * imgAspect);
  }

  const dx = rect.x + Math.round((rect.w - dw) * objPos.x);
  const dy = rect.y + Math.round((rect.h - dh) * objPos.y);

  ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, dw, dh);
}

// ---------------------------------------------------------------------------
// drawPannedCoverImage — canvas-transform approach matching CSS behavior
//
// Replicates CSS: transform-origin: center center;
//                 transform: translate(panX%, panY%) scale(panScale);
//
// panX/panY are percentages of cell width/height (same unit as CSS translate%).
// This correctly handles pan at panScale=1 (which the old source-crop math missed).
// ---------------------------------------------------------------------------

export function drawPannedCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  rect: Rect,
  objPos: ObjPos,
  panX: number,
  panY: number,
  panScale: number,
): void {
  ctx.save();

  // Clip to cell rect to prevent image bleed when panScale > 1
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // Move origin to cell center + CSS translate offset
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.translate(cx + (panX / 100) * rect.w, cy + (panY / 100) * rect.h);
  ctx.scale(panScale, panScale);

  // Draw cover image centered at the transformed origin
  const { w: srcW, h: srcH } = getSourceDimensions(img);
  const imgAspect = srcW / srcH;
  const cellAspect = rect.w / rect.h;

  let drawW: number, drawH: number;
  if (imgAspect > cellAspect) {
    drawH = rect.h;
    drawW = drawH * imgAspect;
  } else {
    drawW = rect.w;
    drawH = drawW / imgAspect;
  }

  // objPos controls where excess goes; origin is at cell center
  const drawX = -rect.w / 2 - (drawW - rect.w) * objPos.x;
  const drawY = -rect.h / 2 - (drawH - rect.h) * objPos.y;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// drawPannedContainImage — canvas-transform approach for contain mode with pan/zoom
//
// Replicates CSS: transform-origin: center center;
//                 transform: translate(panX%, panY%) scale(panScale);
//
// panX/panY are percentages of cell width/height (same unit as CSS translate%).
// ---------------------------------------------------------------------------

export function drawPannedContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  rect: Rect,
  objPos: ObjPos,
  bgColor: string,
  panX: number,
  panY: number,
  panScale: number,
): void {
  ctx.save();

  // Clip to cell rect to prevent image bleed
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // Fill background (letterbox)
  ctx.fillStyle = bgColor;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Move origin to cell center + CSS translate offset
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.translate(cx + (panX / 100) * rect.w, cy + (panY / 100) * rect.h);
  ctx.scale(panScale, panScale);

  // Compute contain dimensions
  const { w: srcW, h: srcH } = getSourceDimensions(img);
  const imgAspect = srcW / srcH;
  const cellAspect = rect.w / rect.h;

  let drawW: number, drawH: number;
  if (imgAspect > cellAspect) {
    drawW = rect.w;
    drawH = rect.w / imgAspect;
  } else {
    drawH = rect.h;
    drawW = rect.h * imgAspect;
  }

  // objPos controls alignment within the contain area; origin is at cell center
  const drawX = -rect.w / 2 + (rect.w - drawW) * objPos.x;
  const drawY = -rect.h / 2 + (rect.h - drawH) * objPos.y;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// drawLeafToCanvas — unified leaf draw dispatch for both preview and export
//
// Does NOT handle borderRadius clipping or empty-cell fill — caller handles those.
// ---------------------------------------------------------------------------

export function drawLeafToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  rect: Rect,
  leaf: Pick<LeafNode, 'fit' | 'objectPosition' | 'panX' | 'panY' | 'panScale' | 'backgroundColor'>,
): void {
  const objPos = parseObjectPosition(leaf.objectPosition ?? 'center center');
  const bgColor = leaf.backgroundColor ?? '#ffffff';
  const hasPan = (leaf.panX ?? 0) !== 0 || (leaf.panY ?? 0) !== 0 || (leaf.panScale ?? 1) !== 1;

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
    if (hasPan) {
      drawPannedContainImage(
        ctx, img, rect, objPos, bgColor,
        leaf.panX ?? 0, leaf.panY ?? 0, leaf.panScale ?? 1,
      );
    } else {
      drawContainImage(ctx, img, rect, objPos, bgColor);
    }
  }
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

    if (settings.borderRadius > 0) {
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, settings.borderRadius);
      ctx.clip();
    }

    if (!dataUri) {
      ctx.fillStyle = leaf.backgroundColor ?? '#ffffff';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      let img = imageCache.get(dataUri);
      if (!img) {
        img = await loadImage(dataUri);
        imageCache.set(dataUri, img);
      }

      drawLeafToCanvas(ctx, img, rect, leaf);
    }

    if (settings.borderRadius > 0) {
      ctx.restore();
    }
  } else {
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

export function hasVideoCell(
  root: GridNode,
  mediaTypeMap: Record<string, 'image' | 'video'>,
): boolean {
  const leaves = getAllLeaves(root);
  return leaves.some(
    leaf => leaf.mediaId != null && mediaTypeMap[leaf.mediaId] === 'video',
  );
}
