import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorShell } from '../Editor/EditorShell';

describe('EditorShell (SCAF-05)', () => {
  it('renders the toolbar region', () => {
    render(<EditorShell />);
    expect(screen.getByText('[Undo]')).toBeInTheDocument();
    expect(screen.getByText('[Export]')).toBeInTheDocument();
  });

  it('renders the canvas area', () => {
    render(<EditorShell />);
    expect(screen.getByText('1080 x 1920')).toBeInTheDocument();
  });

  it('renders the sidebar', () => {
    render(<EditorShell />);
    expect(screen.getByText('Properties')).toBeInTheDocument();
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
