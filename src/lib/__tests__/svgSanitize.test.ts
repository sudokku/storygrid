import { describe, it, expect } from 'vitest';
import { sanitizeSvgString } from '../svgSanitize';

describe('sanitizeSvgString', () => {
  it('strips <script> tags from SVG', () => {
    const raw = '<svg><script>alert(1)</script></svg>';
    const result = sanitizeSvgString(raw);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert(1)');
  });

  it('strips event handlers (onclick) from SVG elements', () => {
    const raw = '<svg><circle onclick="alert(1)" /></svg>';
    const result = sanitizeSvgString(raw);
    expect(result).not.toContain('onclick');
  });

  it('preserves safe SVG elements and attributes (circle with fill)', () => {
    const raw = '<svg><circle cx="50" cy="50" r="40" fill="red"/></svg>';
    const result = sanitizeSvgString(raw);
    expect(result).toContain('circle');
    expect(result).toContain('fill');
  });

  it('preserves path d attribute in nested groups', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg"><g><path d="M0 0"/></g></svg>';
    const result = sanitizeSvgString(raw);
    expect(result).toContain('path');
    expect(result).toContain('d=');
  });

  it('strips script embedded inside foreignObject (T-13-09)', () => {
    const raw = '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>';
    const result = sanitizeSvgString(raw);
    expect(result).not.toContain('alert');
  });
});
