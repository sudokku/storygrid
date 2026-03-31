import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, '..', 'index.css'), 'utf-8');

describe('CSS variables (SCAF-03)', () => {
  it('defines --canvas-width: 1080px', () => {
    expect(css).toContain('--canvas-width: 1080px');
  });

  it('defines --canvas-height: 1920px', () => {
    expect(css).toContain('--canvas-height: 1920px');
  });

  it('defines --safe-zone-top: 250px', () => {
    expect(css).toContain('--safe-zone-top: 250px');
  });

  it('defines --safe-zone-bottom: 250px', () => {
    expect(css).toContain('--safe-zone-bottom: 250px');
  });

  it('includes Tailwind directives', () => {
    expect(css).toContain('@tailwind base');
    expect(css).toContain('@tailwind components');
    expect(css).toContain('@tailwind utilities');
  });
});
