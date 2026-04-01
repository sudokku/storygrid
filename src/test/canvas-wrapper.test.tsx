import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CanvasWrapper } from '../Grid/CanvasWrapper';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { buildInitialTree } from '../lib/tree';

// ---------------------------------------------------------------------------
// MockResizeObserver — fires callback synchronously on observe()
// ---------------------------------------------------------------------------

type ResizeCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

class MockResizeObserver {
  callback: ResizeCallback;
  static lastInstance: MockResizeObserver | null = null;

  constructor(cb: ResizeCallback) {
    this.callback = cb;
    MockResizeObserver.lastInstance = this;
  }

  observe() {
    // Simulate an initial observation with a known size
    this.callback(
      [
        {
          contentRect: { width: 800, height: 900 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }

  unobserve() {}
  disconnect() {}
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setupStore() {
  const initialTree = buildInitialTree();
  useGridStore.setState({
    root: initialTree,
    mediaRegistry: {},
    history: [{ root: initialTree }],
    historyIndex: 0,
  });
  useEditorStore.setState({ selectedNodeId: null, zoom: 1, showSafeZone: false });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  setupStore();
});

afterEach(() => {
  vi.useRealTimers();
  MockResizeObserver.lastInstance = null;
});

// ---------------------------------------------------------------------------
// CanvasWrapper scaling (REND-07)
// ---------------------------------------------------------------------------

describe('CanvasWrapper scaling (REND-07)', () => {
  it('renders a 1080x1920 inner div (canvas-surface)', () => {
    render(<CanvasWrapper />);
    // Advance timers so debounce fires
    act(() => { vi.advanceTimersByTime(100); });
    const surface = screen.getByTestId('canvas-surface');
    expect(surface).toBeTruthy();
    // style.width / height are set via the style prop as numbers, rendered as px
    expect(surface.style.width).toBe('1080px');
    expect(surface.style.height).toBe('1920px');
  });

  it('applies transform: scale() based on container size', () => {
    render(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });
    const surface = screen.getByTestId('canvas-surface');
    // After ResizeObserver fires with 800x900, scale should be calculated
    expect(surface.style.transform).toContain('scale(');
  });

  it('uses Math.min(scaleByH, scaleByW) for scale calculation', () => {
    render(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });
    const surface = screen.getByTestId('canvas-surface');
    // scaleByH = (900 * 0.9) / 1920 = 0.421875
    // scaleByW = (800 * 0.9) / 1080 = 0.6667
    // Math.min = 0.421875 — with zoom=1 final scale should be ~0.421875
    const expectedScale = Math.min((900 * 0.9) / 1920, (800 * 0.9) / 1080);
    expect(surface.style.transform).toContain(`scale(${expectedScale})`);
  });

  it('multiplies autoFitScale by zoom from editorStore', () => {
    useEditorStore.setState({ zoom: 1.5 });
    render(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });
    const surface = screen.getByTestId('canvas-surface');
    // autoFitScale = 0.421875, zoom = 1.5 => finalScale = 0.6328125
    const autoFitScale = Math.min((900 * 0.9) / 1920, (800 * 0.9) / 1080);
    const expectedScale = autoFitScale * 1.5;
    expect(surface.style.transform).toContain(`scale(${expectedScale})`);
  });

  it('uses transform-origin: top center', () => {
    render(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });
    const surface = screen.getByTestId('canvas-surface');
    expect(surface.style.transformOrigin).toBe('top center');
  });

  it('shows SafeZoneOverlay when showSafeZone is true, hides when false', () => {
    act(() => { useEditorStore.setState({ showSafeZone: true }); });
    const { rerender } = render(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.queryByTestId('safe-zone-overlay')).toBeTruthy();

    act(() => { useEditorStore.setState({ showSafeZone: false }); });
    rerender(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.queryByTestId('safe-zone-overlay')).toBeNull();
  });

  it('deselects node when clicking canvas background (not a child)', () => {
    useEditorStore.setState({ selectedNodeId: 'some-leaf-id' });
    render(<CanvasWrapper />);
    act(() => { vi.advanceTimersByTime(100); });

    const surface = screen.getByTestId('canvas-surface');
    // Fire a click where target === currentTarget (background click)
    // We dispatch a synthetic click directly on the element
    act(() => {
      // Simulate a click event where target is the surface element itself
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      Object.defineProperty(clickEvent, 'target', { value: surface, writable: false });
      Object.defineProperty(clickEvent, 'currentTarget', { value: surface, writable: false });
      surface.dispatchEvent(clickEvent);
    });

    expect(useEditorStore.getState().selectedNodeId).toBeNull();
  });
});
