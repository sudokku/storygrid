import { describe, it } from 'vitest';

describe('CanvasWrapper scaling (REND-07)', () => {
  it.todo('renders a 1080x1920 inner div');
  it.todo('applies transform: scale() based on container size');
  it.todo('uses Math.min(scaleByH, scaleByW) for scale calculation');
  it.todo('multiplies autoFitScale by zoom from editorStore');
  it.todo('uses transform-origin: top center');
  it.todo('deselects node when clicking canvas background');
});
