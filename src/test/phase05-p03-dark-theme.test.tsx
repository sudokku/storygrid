/**
 * phase05-p03-dark-theme.test.tsx
 * Tests for dark theme color classes on EditorShell and CanvasArea (POLH-08).
 * Coverage: D-17 (outer bg #0a0a0a), D-18 (canvas area bg #0f0f0f).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EditorShell } from '../Editor/EditorShell';
import { CanvasArea } from '../Editor/CanvasArea';

describe('Dark theme (POLH-08)', () => {
  it('EditorShell outer div has bg-[#0a0a0a] class (D-17)', () => {
    const { container } = render(<EditorShell />);
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain('bg-[#0a0a0a]');
  });

  it('CanvasArea main element has bg-[#0f0f0f] class (D-18)', () => {
    const { container } = render(<CanvasArea />);
    const main = container.querySelector('main') as HTMLElement;
    expect(main).not.toBeNull();
    expect(main.className).toContain('bg-[#0f0f0f]');
  });
});
