/**
 * Phase 05 Plan 04 Task 2: Onboarding Overlay
 * Tests for: localStorage gate, step progression, skip, dismiss, content
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Onboarding } from '../Editor/Onboarding';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock document.querySelector to return a fake element with getBoundingClientRect
const fakeBoundingRect: DOMRect = {
  top: 100,
  left: 100,
  width: 200,
  height: 300,
  bottom: 400,
  right: 300,
  x: 100,
  y: 100,
  toJSON: () => ({}),
};

function mockQuerySelector() {
  vi.spyOn(document, 'querySelector').mockReturnValue({
    getBoundingClientRect: () => fakeBoundingRect,
  } as unknown as Element);
}

// Mock localStorage
let storageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storageStore[key]; }),
  clear: vi.fn(() => { storageStore = {}; }),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  storageStore = {};
  vi.clearAllMocks();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  mockQuerySelector();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Onboarding — localStorage gate', () => {
  it('renders overlay when localStorage does NOT have storygrid_onboarding_done', () => {
    // storageStore is empty, so getItem returns null
    render(<Onboarding />);
    expect(screen.getByTestId('onboarding-overlay')).toBeInTheDocument();
  });

  it('does NOT render overlay when localStorage HAS storygrid_onboarding_done=true', () => {
    storageStore['storygrid_onboarding_done'] = 'true';
    render(<Onboarding />);
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
  });
});

describe('Onboarding — skip button', () => {
  it('clicking Skip removes overlay from DOM', () => {
    render(<Onboarding />);
    const skipBtn = screen.getByTestId('onboarding-skip');
    fireEvent.click(skipBtn);
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
  });

  it('clicking Skip sets localStorage storygrid_onboarding_done=true', () => {
    render(<Onboarding />);
    const skipBtn = screen.getByTestId('onboarding-skip');
    fireEvent.click(skipBtn);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('storygrid_onboarding_done', 'true');
  });
});

describe('Onboarding — next button progression', () => {
  it('shows "Next" on steps 1 and 2, "Done" on step 3', () => {
    render(<Onboarding />);
    // Step 1
    expect(screen.getByTestId('onboarding-next')).toHaveTextContent('Next');

    // Advance to step 2
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-next')).toHaveTextContent('Next');

    // Advance to step 3
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-next')).toHaveTextContent('Done');
  });

  it('clicking Done on step 3 dismisses overlay permanently', () => {
    render(<Onboarding />);
    // Click through all 3 steps
    fireEvent.click(screen.getByTestId('onboarding-next')); // step 2
    fireEvent.click(screen.getByTestId('onboarding-next')); // step 3
    fireEvent.click(screen.getByTestId('onboarding-next')); // Done
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('storygrid_onboarding_done', 'true');
  });
});

describe('Onboarding — step content', () => {
  it('step 1 description contains "Click a cell to select"', () => {
    render(<Onboarding />);
    expect(screen.getByText(/Click a cell to select/)).toBeInTheDocument();
  });

  it('step 2 description contains "Drop images or click a cell"', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByTestId('onboarding-next'));
    expect(screen.getByText(/Drop images or click a cell/)).toBeInTheDocument();
  });

  it('step 3 description contains "Export your collage"', () => {
    render(<Onboarding />);
    fireEvent.click(screen.getByTestId('onboarding-next')); // step 2
    fireEvent.click(screen.getByTestId('onboarding-next')); // step 3
    expect(screen.getByText(/Export your collage/)).toBeInTheDocument();
  });
});

describe('Onboarding — spotlight rendering', () => {
  it('renders tooltip when target element is found', () => {
    render(<Onboarding />);
    expect(screen.getByTestId('onboarding-tooltip')).toBeInTheDocument();
  });

  it('does not render when target element is not found', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(null);
    render(<Onboarding />);
    // spotlightRect will be null, so overlay does not render
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
  });
});

describe('Onboarding — resize recalculation', () => {
  it('recalculates spotlight on window resize', () => {
    const getBoundingRectSpy = vi.fn().mockReturnValue(fakeBoundingRect);
    vi.spyOn(document, 'querySelector').mockReturnValue({
      getBoundingClientRect: getBoundingRectSpy,
    } as unknown as Element);

    render(<Onboarding />);
    const initialCallCount = getBoundingRectSpy.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Should have been called again on resize
    expect(getBoundingRectSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
