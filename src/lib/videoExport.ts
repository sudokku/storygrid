import type { GridNode } from '../types';
import type { CanvasSettings } from './export';

// Stub — implementation replaced by WebCodecs + Mediabunny
// See quick task 260405-s9u
export async function exportVideoGrid(
  _root: GridNode,
  _mediaRegistry: Record<string, string>,
  _settings: CanvasSettings,
  _totalDuration: number,
  _onProgress: (stage: 'encoding', percent?: number) => void,
): Promise<Blob> {
  throw new Error('Video export not yet implemented. WebCodecs implementation pending.');
}
