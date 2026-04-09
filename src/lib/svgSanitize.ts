import DOMPurify from 'dompurify';

/**
 * Sanitizes an SVG string using DOMPurify with SVG + svgFilters profiles.
 *
 * Applied BEFORE storing SVG content in the stickerRegistry (D-07, T-13-09).
 * Strips script tags, event handlers, and foreignObject-embedded scripts.
 *
 * @param raw - Raw SVG string from file.text()
 * @returns Sanitized SVG string safe for storage and rendering
 */
export function sanitizeSvgString(raw: string): string {
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
