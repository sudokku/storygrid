import type { Overlay, TextOverlay } from '../types';

// ---------------------------------------------------------------------------
// loadImage — creates HTMLImageElement from a data URI or URL
// ---------------------------------------------------------------------------

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// estimateHeight — approximate rendered height for an overlay
//
// Used to convert center-Y to top-left drawY for ctx.fillText.
// ---------------------------------------------------------------------------

function estimateHeight(overlay: Overlay): number {
  if (overlay.type === 'text') return (overlay as TextOverlay).fontSize * 1.2;
  return overlay.width; // emoji and sticker: square-ish aspect
}

// ---------------------------------------------------------------------------
// drawOverlaysToCanvas
//
// Renders all overlays onto a 2D canvas context in ascending zIndex order.
//
// COORDINATE SEMANTICS:
//   overlay.x / overlay.y are VISUAL CENTER coordinates (canvas pixel space).
//   This matches the DOM layer's translate(-50%, -50%) transform in OverlayLayer.
//   This function converts center → top-left for ctx.fillText / ctx.drawImage.
//
// FONT LOADING (D-18):
//   document.fonts.ready is awaited before any ctx.fillText call to ensure
//   Google Fonts (Playfair Display, Dancing Script) are loaded.
//
// IMAGE CACHE (T-13-07):
//   imageCache is allocated ONCE per export run by the caller. Repeated sticker
//   draws within one export reuse the same HTMLImageElement — no per-frame reload.
// ---------------------------------------------------------------------------

export async function drawOverlaysToCanvas(
  ctx: CanvasRenderingContext2D,
  overlays: Overlay[],
  stickerRegistry: Record<string, string>,
  imageCache: Map<string, HTMLImageElement>,
): Promise<void> {
  if (overlays.length === 0) return;

  // D-18: ensure Google Fonts are loaded before any fillText call
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Sort ascending by zIndex so highest zIndex renders on top
  const sorted = [...overlays].sort((a, b) => a.zIndex - b.zIndex);

  for (const overlay of sorted) {
    ctx.save();

    // Rotation around visual center
    const cx = overlay.x;
    const cy = overlay.y;
    if (overlay.rotation !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (overlay.type === 'text') {
      const weight = overlay.fontWeight === 'bold' ? 'bold ' : '';
      ctx.font = `${weight}${overlay.fontSize}px "${overlay.fontFamily}"`;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = overlay.textAlign;
      ctx.textBaseline = 'top';

      // overlay.x / overlay.y represent VISUAL CENTER (matches DOM translate(-50%,-50%))
      // Convert to top-left for fillText
      const drawX = overlay.x - overlay.width / 2;
      const drawY = overlay.y - (overlay.fontSize * 0.6);

      // textAlign resolves from the anchor point:
      //   'center': anchor is center → use overlay.x directly
      //   'right':  anchor is right edge → use drawX + width
      //   'left':   anchor is left edge → use drawX
      const alignX =
        overlay.textAlign === 'center'
          ? overlay.x
          : overlay.textAlign === 'right'
            ? drawX + overlay.width
            : drawX;

      ctx.fillText(overlay.content, alignX, drawY);
    } else if (overlay.type === 'emoji') {
      ctx.font = `${overlay.width}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(overlay.char, overlay.x, overlay.y);
    } else if (overlay.type === 'sticker') {
      const dataUri = stickerRegistry[overlay.stickerRegistryId];
      if (dataUri) {
        let img = imageCache.get(dataUri);
        if (!img) {
          img = await loadImage(dataUri);
          imageCache.set(dataUri, img);
        }
        const w = overlay.width;
        const h = (img.naturalHeight / img.naturalWidth) * w;
        ctx.drawImage(img, overlay.x - w / 2, overlay.y - h / 2, w, h);
      }
    }

    ctx.restore();
  }
}
