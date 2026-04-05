/**
 * Phase 04 Plan 02 Task 1 — updated tests
 * Toast component and ExportSplitButton with popover
 * exportRef removed — ExportSplitButton reads from store directly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import type { LeafNode } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStores() {
  const leaf: LeafNode = {
    type: 'leaf',
    id: 'root-leaf',
    mediaId: null,
    fit: 'cover',
    objectPosition: 'center center',
    backgroundColor: null,
  };
  useGridStore.setState({
    root: leaf,
    mediaRegistry: {},
    history: [{ root: leaf }],
    historyIndex: 0,
  });
  useEditorStore.setState({
    selectedNodeId: null,
    zoom: 1,
    canvasScale: 1,
    showSafeZone: false,
    activeTool: 'select',
    isExporting: false,
    exportFormat: 'png',
    exportQuality: 0.9,
  });
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

describe('Toast', () => {
  it('returns null when state is null', async () => {
    const { Toast } = await import('../Editor/Toast');
    const { container } = render(
      <Toast state={null} onRetry={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with role="status" when state is "preparing"', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="preparing" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays "Preparing..." text when state is preparing', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="preparing" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Preparing\.\.\./)).toBeInTheDocument();
  });

  it('renders with role="status" when state is "exporting"', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="exporting" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays "Exporting..." text when state is exporting', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="exporting" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Exporting\.\.\./)).toBeInTheDocument();
  });

  it('renders with role="alert" when state is "error"', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="error" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays "Export failed." when state is error', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="error" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Export failed\./)).toBeInTheDocument();
  });

  it('renders "Try again" button in error state', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="error" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('"Try again" button calls onRetry callback', async () => {
    const { Toast } = await import('../Editor/Toast');
    const onRetry = vi.fn();
    render(<Toast state="error" onRetry={onRetry} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders with role="alert" when state is "video-blocked"', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(<Toast state="video-blocked" onRetry={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays "Export not available: remove video cells first." when state is video-blocked', async () => {
    const { Toast } = await import('../Editor/Toast');
    render(
      <Toast state="video-blocked" onRetry={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(
      screen.getByText(/Export not available: remove video cells first\./),
    ).toBeInTheDocument();
  });

  it('calls onDismiss after 4 seconds when state is video-blocked', async () => {
    vi.useFakeTimers();
    const { Toast } = await import('../Editor/Toast');
    const onDismiss = vi.fn();
    render(
      <Toast state="video-blocked" onRetry={vi.fn()} onDismiss={onDismiss} />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ExportSplitButton
// ---------------------------------------------------------------------------

describe('ExportSplitButton', () => {
  beforeEach(() => {
    resetStores();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders two button segments: left export and right chevron', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    render(<ExportSplitButton />);
    expect(screen.getByRole('button', { name: /export png/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export settings/i })).toBeInTheDocument();
  });

  it('left segment shows "Export PNG" text when format is png', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    useEditorStore.setState({ exportFormat: 'png' });
    render(<ExportSplitButton />);
    expect(screen.getByText('Export PNG')).toBeInTheDocument();
  });

  it('left segment shows "Export JPEG" text when format is jpeg', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    useEditorStore.setState({ exportFormat: 'jpeg' });
    render(<ExportSplitButton />);
    expect(screen.getByText('Export JPEG')).toBeInTheDocument();
  });

  it('both segments are disabled when isExporting is true', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    useEditorStore.setState({ isExporting: true });
    render(<ExportSplitButton />);
    const exportBtn = screen.getByRole('button', { name: /export png/i });
    const settingsBtn = screen.getByRole('button', { name: /export settings/i });
    expect(exportBtn).toBeDisabled();
    expect(settingsBtn).toBeDisabled();
  });

  it('clicking right segment (chevron) opens popover', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    render(<ExportSplitButton />);
    const chevronBtn = screen.getByRole('button', { name: /export settings/i });
    fireEvent.click(chevronBtn);
    expect(screen.getByRole('dialog', { name: /export settings/i })).toBeInTheDocument();
  });

  it('popover contains format toggle with PNG and JPEG options', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    render(<ExportSplitButton />);
    fireEvent.click(screen.getByRole('button', { name: /export settings/i }));
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^PNG$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^JPEG$/i })).toBeInTheDocument();
  });

  it('selecting JPEG in popover shows quality slider', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    useEditorStore.setState({ exportFormat: 'jpeg' });
    render(<ExportSplitButton />);
    fireEvent.click(screen.getByRole('button', { name: /export settings/i }));
    const slider = screen.getByRole('slider', { name: /export quality/i });
    expect(slider).toBeVisible();
  });

  it('selecting PNG in popover hides quality slider', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    useEditorStore.setState({ exportFormat: 'png' });
    render(<ExportSplitButton />);
    fireEvent.click(screen.getByRole('button', { name: /export settings/i }));
    const slider = screen.getByRole('slider', { name: /export quality/i });
    // slider is in a div with class 'hidden'
    expect(slider.parentElement).toHaveClass('hidden');
  });

  it('quality slider has min 0.7, max 1.0, step 0.05', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    useEditorStore.setState({ exportFormat: 'jpeg' });
    render(<ExportSplitButton />);
    fireEvent.click(screen.getByRole('button', { name: /export settings/i }));
    const slider = screen.getByRole('slider', { name: /export quality/i });
    expect(slider).toHaveAttribute('min', '0.7');
    expect(slider).toHaveAttribute('max', '1');
    expect(slider).toHaveAttribute('step', '0.05');
  });

  it('chevron button has aria-expanded reflecting popover state', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    render(<ExportSplitButton />);
    const chevronBtn = screen.getByRole('button', { name: /export settings/i });
    expect(chevronBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chevronBtn);
    expect(chevronBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('left segment click calls exportGrid with root and mediaRegistry from store', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    const exportModule = await import('../lib/export');
    const exportGridSpy = vi.spyOn(exportModule, 'exportGrid').mockResolvedValue('data:image/png;base64,test');

    // Render before mocking DOM body operations to avoid intercepting React's own appendChild
    const { unmount } = render(<ExportSplitButton />);
    const leftBtn = screen.getByRole('button', { name: /export png/i });

    // Mock anchor download to avoid jsdom navigation errors
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      (el as HTMLAnchorElement).click = vi.fn();
      return el;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);

    await act(async () => {
      fireEvent.click(leftBtn);
    });

    expect(exportGridSpy).toHaveBeenCalledWith(
      expect.anything(), // root
      expect.anything(), // mediaRegistry
      'png',
      0.9,
      expect.any(Function),
      expect.any(Object), // canvasSettings
    );
    appendSpy.mockRestore();
    unmount();
  });

  it('export is blocked with video-blocked toast when hasVideoCell returns true', async () => {
    const { ExportSplitButton } = await import('../Editor/ExportSplitButton');
    const leafWithVideo: LeafNode = {
      type: 'leaf',
      id: 'root-leaf',
      mediaId: 'vid1',
      fit: 'cover',
      objectPosition: 'center center',
      backgroundColor: null,
    };
    useGridStore.setState({
      root: leafWithVideo,
      mediaRegistry: { vid1: 'data:video/mp4;base64,abc' },
      mediaTypeMap: { vid1: 'video' },
      history: [{ root: leafWithVideo }],
      historyIndex: 0,
    });

    render(<ExportSplitButton />);
    const leftBtn = screen.getByRole('button', { name: /export png/i });
    fireEvent.click(leftBtn);

    expect(
      await screen.findByText(/Export not available: remove video cells first\./),
    ).toBeInTheDocument();
  });
});
