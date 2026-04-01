import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorShell } from '../Editor/EditorShell';

describe('EditorShell', () => {
  it('renders the toolbar region (header)', () => {
    render(<EditorShell />);
    const header = document.querySelector('header');
    expect(header).not.toBeNull();
  });

  it('renders the canvas area', () => {
    render(<EditorShell />);
    expect(screen.getByTestId('canvas-surface')).toBeInTheDocument();
  });

  it('renders the sidebar', () => {
    render(<EditorShell />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('has three distinct regions', () => {
    const { container } = render(<EditorShell />);
    const header = container.querySelector('header');
    const main = container.querySelector('main');
    const aside = container.querySelector('aside');
    expect(header).not.toBeNull();
    expect(main).not.toBeNull();
    expect(aside).not.toBeNull();
  });
});
