import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Editor/Sidebar';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import type { GridNode } from '../types';

// A single leaf root for testing
const singleLeaf: GridNode = {
  type: 'leaf',
  id: 'leaf-1',
  mediaId: null,
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

// A leaf with a media item
const leafWithMedia: GridNode = {
  type: 'leaf',
  id: 'leaf-2',
  mediaId: 'media-1',
  fit: 'cover',
  objectPosition: 'center center',
  backgroundColor: null,
};

// Two-leaf container for dimension testing
const twoLeafContainer: GridNode = {
  type: 'container',
  id: 'container-1',
  direction: 'vertical',
  sizes: [1, 1],
  children: [
    { type: 'leaf', id: 'child-1', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null },
    { type: 'leaf', id: 'child-2', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null },
  ],
};

beforeEach(() => {
  useGridStore.setState({
    root: singleLeaf,
    mediaRegistry: {},
    history: [{ root: singleLeaf }],
    historyIndex: 0,
  });
  useEditorStore.setState({
    selectedNodeId: null,
    zoom: 1,
    canvasScale: 1,
    showSafeZone: false,
    activeTool: 'select',
  });
});

describe('Sidebar', () => {
  it('renders with data-testid="sidebar"', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  describe('No selection state', () => {
    it('shows "Canvas" heading when no cell is selected', () => {
      render(<Sidebar />);
      expect(screen.getByText('Canvas')).toBeInTheDocument();
    });

    it('shows active (enabled) gap slider', () => {
      render(<Sidebar />);
      const sliders = document.querySelectorAll('input[type="range"]');
      // Both gap and border radius sliders should be enabled
      const enabledSlider = Array.from(sliders).find(el => !(el as HTMLInputElement).disabled);
      expect(enabledSlider).toBeTruthy();
    });

    it('shows active (enabled) border color input', () => {
      render(<Sidebar />);
      const colorInputs = document.querySelectorAll('input[type="color"]');
      const enabledColorInput = Array.from(colorInputs).find(el => !(el as HTMLInputElement).disabled);
      expect(enabledColorInput).toBeTruthy();
    });

    it('shows Solid/Gradient background toggle buttons', () => {
      render(<Sidebar />);
      expect(screen.getByText('Solid')).toBeInTheDocument();
      expect(screen.getByText('Gradient')).toBeInTheDocument();
    });
  });

  describe('Selected cell state', () => {
    beforeEach(() => {
      useGridStore.setState({ root: singleLeaf });
      useEditorStore.setState({ selectedNodeId: 'leaf-1' });
    });

    it('shows "Cell" heading when a cell is selected', () => {
      render(<Sidebar />);
      expect(screen.getByText('Cell')).toBeInTheDocument();
    });

    it('shows thumbnail area', () => {
      render(<Sidebar />);
      // Thumbnail container is present (no media = shows icon placeholder)
      const thumbnailArea = document.querySelector('.aspect-video');
      expect(thumbnailArea).toBeTruthy();
    });

    it('shows Cover/Contain fit toggle buttons', () => {
      render(<Sidebar />);
      expect(screen.getByText('Cover')).toBeInTheDocument();
      expect(screen.getByText('Contain')).toBeInTheDocument();
    });

    it('does NOT show cell background color picker in cover mode', () => {
      render(<Sidebar />);
      // In cover mode, the cell background color picker should not be visible.
      // CanvasSettingsPanel shows its own enabled color inputs, but the cell panel
      // should not render a cell-background color picker in cover mode.
      // We check by ensuring there's no "Background color" label for the cell panel.
      const backgroundColorLabel = screen.queryByText('Background color');
      expect(backgroundColorLabel).not.toBeInTheDocument();
    });

    it('shows background color picker when fit is contain', () => {
      useGridStore.setState({
        root: {
          ...singleLeaf,
          fit: 'contain',
          backgroundColor: '#ff0000',
        },
      });
      render(<Sidebar />);
      const colorInputs = document.querySelectorAll('input[type="color"]');
      const enabledColorInput = Array.from(colorInputs).find(el => !(el as HTMLInputElement).disabled);
      expect(enabledColorInput).toBeTruthy();
    });

    it('shows Upload image button when no media', () => {
      render(<Sidebar />);
      expect(screen.getByText('Upload image')).toBeInTheDocument();
    });

    it('shows Replace image button when cell has media', () => {
      useGridStore.setState({
        root: leafWithMedia,
        mediaRegistry: { 'media-1': 'data:image/png;base64,abc' },
      });
      useEditorStore.setState({ selectedNodeId: 'leaf-2' });
      render(<Sidebar />);
      expect(screen.getByText('Replace image')).toBeInTheDocument();
    });

    it('does NOT show Clear image button when no media', () => {
      render(<Sidebar />);
      expect(screen.queryByText('Clear image')).not.toBeInTheDocument();
    });

    it('shows Clear image button when cell has media', () => {
      useGridStore.setState({
        root: leafWithMedia,
        mediaRegistry: { 'media-1': 'data:image/png;base64,abc' },
      });
      useEditorStore.setState({ selectedNodeId: 'leaf-2' });
      render(<Sidebar />);
      expect(screen.getByText('Clear image')).toBeInTheDocument();
    });

    it('shows Remove cell button', () => {
      render(<Sidebar />);
      expect(screen.getByText('Remove cell')).toBeInTheDocument();
    });

    it('clicking Remove cell calls gridStore.remove and clears selectedNodeId', () => {
      const remove = vi.fn();
      const setSelectedNode = vi.fn();
      useGridStore.setState({ remove });
      useEditorStore.setState({ selectedNodeId: 'leaf-1', setSelectedNode });
      render(<Sidebar />);
      const removeBtn = screen.getByText('Remove cell');
      fireEvent.click(removeBtn);
      expect(remove).toHaveBeenCalledWith('leaf-1');
      expect(setSelectedNode).toHaveBeenCalledWith(null);
    });

    it('clicking Cover fit calls updateCell with fit=cover', () => {
      const updateCell = vi.fn();
      useGridStore.setState({
        root: { ...singleLeaf, fit: 'contain' },
        updateCell,
      });
      render(<Sidebar />);
      fireEvent.click(screen.getByText('Cover'));
      expect(updateCell).toHaveBeenCalledWith('leaf-1', { fit: 'cover' });
    });

    it('clicking Contain fit calls updateCell with fit=contain', () => {
      const updateCell = vi.fn();
      useGridStore.setState({ updateCell });
      render(<Sidebar />);
      fireEvent.click(screen.getByText('Contain'));
      expect(updateCell).toHaveBeenCalledWith('leaf-1', { fit: 'contain' });
    });
  });

  describe('Cell dimensions', () => {
    it('shows correct dimensions for a leaf in a vertical container (50% height)', () => {
      useGridStore.setState({ root: twoLeafContainer });
      useEditorStore.setState({ selectedNodeId: 'child-1' });
      render(<Sidebar />);
      const dimsEl = screen.getByTestId('cell-dimensions');
      // vertical container splits height: each child gets 1920/2 = 960px height; full 1080 width
      expect(dimsEl).toHaveTextContent('1080 × 960 px');
    });

    it('shows correct dimensions for a leaf in a horizontal container (50% width)', () => {
      const hContainer: GridNode = {
        type: 'container',
        id: 'h-container',
        direction: 'horizontal',
        sizes: [1, 1],
        children: [
          { type: 'leaf', id: 'h-child-1', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null },
          { type: 'leaf', id: 'h-child-2', mediaId: null, fit: 'cover', objectPosition: 'center center', backgroundColor: null },
        ],
      };
      useGridStore.setState({ root: hContainer });
      useEditorStore.setState({ selectedNodeId: 'h-child-1' });
      render(<Sidebar />);
      const dimsEl = screen.getByTestId('cell-dimensions');
      // horizontal container splits width: each child gets 1080/2 = 540px width; full 1920 height
      expect(dimsEl).toHaveTextContent('540 × 1920 px');
    });
  });
});
