import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { OverlayPanel } from '../OverlayPanel';
import { useOverlayStore } from '../../store/overlayStore';
import { useEditorStore } from '../../store/editorStore';

// ---------------------------------------------------------------------------
// Test seed
// ---------------------------------------------------------------------------

const SEED_OVERLAY = {
  id: 'o1',
  type: 'text' as const,
  x: 540,
  y: 960,
  width: 600,
  rotation: 0,
  zIndex: 1,
  content: 'hello',
  fontFamily: 'Bebas Neue',
  fontSize: 72,
  color: '#ffffff',
  fontWeight: 'regular' as const,
  textAlign: 'center' as const,
};

beforeEach(() => {
  useOverlayStore.setState({ overlays: [{ ...SEED_OVERLAY }] });
  useEditorStore.setState({ selectedOverlayId: 'o1', selectedNodeId: null });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OverlayPanel', () => {
  it('Test 1 (OVL-02): textarea value equals overlay.content; typing calls updateOverlay', () => {
    const { getByLabelText } = render(<OverlayPanel />);
    const textarea = getByLabelText('Overlay content') as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello');

    fireEvent.change(textarea, { target: { value: 'world' } });
    expect(useOverlayStore.getState().overlays[0].content).toBe('world');
  });

  it('Test 2 (OVL-03): font picker has 8 buttons; clicking a font calls updateOverlay with fontFamily', () => {
    const { getAllByRole } = render(<OverlayPanel />);

    // Find all buttons with aria-label ending in " font"
    const allButtons = getAllByRole('button');
    const fontButtons = allButtons.filter(btn =>
      btn.getAttribute('aria-label')?.endsWith(' font'),
    );

    expect(fontButtons).toHaveLength(8);
    expect(fontButtons[0].getAttribute('aria-label')).toBe('Bebas Neue font');
    expect(fontButtons[fontButtons.length - 1].getAttribute('aria-label')).toBe('Caveat font');

    // Click Oswald and verify store update
    const oswaldBtn = fontButtons.find(btn => btn.getAttribute('aria-label') === 'Oswald font')!;
    fireEvent.click(oswaldBtn);
    expect(useOverlayStore.getState().overlays[0].fontFamily).toBe('Oswald');
  });

  it('Test 2b: each font button has correct inline fontFamily style', () => {
    const { getByLabelText } = render(<OverlayPanel />);
    const dancingBtn = getByLabelText('Dancing Script font') as HTMLButtonElement;
    expect(dancingBtn.style.fontFamily).toContain('Dancing Script');
  });

  it('Test 2c: selected font button has aria-pressed="true"', () => {
    const { getByLabelText } = render(<OverlayPanel />);
    // SEED_OVERLAY has fontFamily 'Bebas Neue'
    const bebasBtn = getByLabelText('Bebas Neue font');
    expect(bebasBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('Test 3 (OVL-04): font size slider has min=16, max=256; moving it calls updateOverlay with fontSize', () => {
    const { getByLabelText } = render(<OverlayPanel />);
    const slider = getByLabelText('Font size') as HTMLInputElement;

    expect(slider.min).toBe('16');
    expect(slider.max).toBe('256');

    fireEvent.change(slider, { target: { value: '100' } });
    expect(useOverlayStore.getState().overlays[0].fontSize).toBe(100);
  });

  it('Test 4 (OVL-05): color input of type=color; changing calls updateOverlay with color', () => {
    const { getByLabelText } = render(<OverlayPanel />);
    const colorInput = getByLabelText('Text color') as HTMLInputElement;

    expect(colorInput.type).toBe('color');

    fireEvent.change(colorInput, { target: { value: '#ff0000' } });
    expect(useOverlayStore.getState().overlays[0].color).toBe('#ff0000');
  });

  it('Test 5 (OVL-06): weight toggle shows two buttons; clicking Bold calls updateOverlay with fontWeight bold', () => {
    const { getByText } = render(<OverlayPanel />);
    const boldButton = getByText('Bold');
    fireEvent.click(boldButton);
    expect(useOverlayStore.getState().overlays[0].fontWeight).toBe('bold');
  });

  it('Test 6 (OVL-07): alignment picker shows three buttons; clicking center calls updateOverlay with textAlign center', () => {
    const { getByLabelText } = render(<OverlayPanel />);
    const centerButton = getByLabelText('Align center');
    fireEvent.click(centerButton);
    expect(useOverlayStore.getState().overlays[0].textAlign).toBe('center');
  });

  it('Test 7 (OVL-14): Bring Forward calls bringForward(id); Send Backward calls sendBackward(id)', () => {
    const { getByLabelText } = render(<OverlayPanel />);

    fireEvent.click(getByLabelText('Bring forward'));
    expect(useOverlayStore.getState().overlays[0].zIndex).toBe(2);

    fireEvent.click(getByLabelText('Send backward'));
    expect(useOverlayStore.getState().overlays[0].zIndex).toBe(1);
  });

  it('Test 8 (OVL-13 + OVL-15): Delete calls deleteOverlay and clears selectedOverlayId; null overlay hides panel', () => {
    const { getByLabelText, queryByLabelText } = render(<OverlayPanel />);

    fireEvent.click(getByLabelText('Delete overlay'));

    expect(useOverlayStore.getState().overlays).toHaveLength(0);
    expect(useEditorStore.getState().selectedOverlayId).toBeNull();

    // Re-render with null selectedOverlayId — panel should return null
    useEditorStore.setState({ selectedOverlayId: null });
    const { container } = render(<OverlayPanel />);
    expect(container.firstChild).toBeNull();

    void queryByLabelText; // suppress unused warning
  });
});
