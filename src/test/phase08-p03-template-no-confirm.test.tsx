import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { TemplatesPopover } from '../components/TemplatesPopover';
import { useGridStore } from '../store/gridStore';

const TEMPLATE_NAMES = ['2x1', '1x2', '2x2', '3-row', 'l-shape', 'mosaic'] as const;

let confirmSpy: ReturnType<typeof vi.spyOn>;
let applyTemplateMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cleanup();
  // Spy on window.confirm — default returns false (would block apply if called)
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  // Replace the store action with a mock (Zustand v5 pattern from project conventions)
  applyTemplateMock = vi.fn();
  useGridStore.setState({ applyTemplate: applyTemplateMock });
});

afterEach(() => {
  confirmSpy.mockRestore();
});

const openPopover = () => {
  const trigger = screen.getByLabelText('Templates');
  fireEvent.click(trigger);
};

describe('TemplatesPopover silent apply (Phase 8 / TPL-01 regression)', () => {
  it('does not call window.confirm when opening the popover', () => {
    render(<TemplatesPopover />);
    openPopover();
    expect(screen.getByTestId('templates-popover')).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  for (const name of TEMPLATE_NAMES) {
    it(`applies template "${name}" without invoking window.confirm`, () => {
      render(<TemplatesPopover />);
      openPopover();
      const button = document.querySelector(`button[data-template="${name}"]`) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      fireEvent.click(button!);
      expect(applyTemplateMock).toHaveBeenCalledTimes(1);
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  }

  it('applies all templates across multiple clicks with zero confirm prompts', () => {
    render(<TemplatesPopover />);
    for (const name of TEMPLATE_NAMES) {
      // Re-open popover before each click (it auto-closes on apply per handleApply)
      openPopover();
      const button = document.querySelector(`button[data-template="${name}"]`) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      fireEvent.click(button!);
    }
    expect(applyTemplateMock).toHaveBeenCalledTimes(TEMPLATE_NAMES.length);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
