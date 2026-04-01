import { toPng, toJpeg } from 'html-to-image';
import { getAllLeaves } from './tree';
import type { GridNode } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'png' | 'jpeg';

// ---------------------------------------------------------------------------
// exportGrid — double-call pattern per D-14
// ---------------------------------------------------------------------------

/**
 * Captures a DOM element as a PNG or JPEG data URL.
 * Calls the capture function twice:
 *   1st call (discarded) — forces browser to paint all fonts/images into canvas
 *   2nd call (returned) — produces the real pixel-perfect output
 *
 * onStage callback:
 *   'preparing' — fired before 1st call
 *   'exporting'  — fired before 2nd call
 */
export async function exportGrid(
  node: HTMLElement,
  format: ExportFormat,
  quality: number,
  onStage: (stage: 'preparing' | 'exporting') => void,
): Promise<string> {
  const options = {
    width: 1080,
    height: 1920,
    pixelRatio: 1,
    backgroundColor: '#ffffff',
    // Reset off-screen positioning on the cloned root so content renders at 0,0
    // inside the SVG foreignObject (not at left:-9999px which clips to white).
    style: { position: 'relative' as const, left: '0', top: '0' },
    ...(format === 'jpeg' ? { quality } : {}),
  };
  const captureFn = format === 'jpeg' ? toJpeg : toPng;
  // First call — discarded (forces browser paint / font embed) per D-14
  onStage('preparing');
  await captureFn(node, options);
  // Second call — produces the real output per D-14
  onStage('exporting');
  return captureFn(node, options);
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
