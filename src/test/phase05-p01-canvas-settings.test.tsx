import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  useGridStore.setState(useGridStore.getInitialState(), true);
});

// ---------------------------------------------------------------------------
// editorStore canvas settings
// ---------------------------------------------------------------------------

describe('editorStore canvas settings', () => {
  it('gap initial value is 0', () => {
    expect(useEditorStore.getState().gap).toBe(0);
  });

  it('setGap(10) updates gap to 10', () => {
    useEditorStore.getState().setGap(10);
    expect(useEditorStore.getState().gap).toBe(10);
  });

  it('setGap clamps to 0 minimum', () => {
    useEditorStore.getState().setGap(-5);
    expect(useEditorStore.getState().gap).toBe(0);
  });

  it('setGap clamps to 20 maximum', () => {
    useEditorStore.getState().setGap(25);
    expect(useEditorStore.getState().gap).toBe(20);
  });

  it('borderRadius initial value is 0', () => {
    expect(useEditorStore.getState().borderRadius).toBe(0);
  });

  it('setBorderRadius(12) updates to 12', () => {
    useEditorStore.getState().setBorderRadius(12);
    expect(useEditorStore.getState().borderRadius).toBe(12);
  });

  it('setBorderRadius clamps to 0 minimum', () => {
    useEditorStore.getState().setBorderRadius(-1);
    expect(useEditorStore.getState().borderRadius).toBe(0);
  });

  it('setBorderRadius clamps to 24 maximum', () => {
    useEditorStore.getState().setBorderRadius(30);
    expect(useEditorStore.getState().borderRadius).toBe(24);
  });

  it('borderColor initial value is #000000', () => {
    expect(useEditorStore.getState().borderColor).toBe('#000000');
  });

  it('setBorderColor("#ff0000") updates to #ff0000', () => {
    useEditorStore.getState().setBorderColor('#ff0000');
    expect(useEditorStore.getState().borderColor).toBe('#ff0000');
  });

  it('backgroundMode initial value is "solid"', () => {
    expect(useEditorStore.getState().backgroundMode).toBe('solid');
  });

  it('setBackgroundMode("gradient") updates to gradient', () => {
    useEditorStore.getState().setBackgroundMode('gradient');
    expect(useEditorStore.getState().backgroundMode).toBe('gradient');
  });

  it('backgroundColor initial value is #ffffff', () => {
    expect(useEditorStore.getState().backgroundColor).toBe('#ffffff');
  });

  it('setBackgroundColor updates backgroundColor', () => {
    useEditorStore.getState().setBackgroundColor('#123456');
    expect(useEditorStore.getState().backgroundColor).toBe('#123456');
  });

  it('backgroundGradientFrom initial is #ffffff', () => {
    expect(useEditorStore.getState().backgroundGradientFrom).toBe('#ffffff');
  });

  it('setBackgroundGradientFrom updates field', () => {
    useEditorStore.getState().setBackgroundGradientFrom('#aabbcc');
    expect(useEditorStore.getState().backgroundGradientFrom).toBe('#aabbcc');
  });

  it('backgroundGradientTo initial is #000000', () => {
    expect(useEditorStore.getState().backgroundGradientTo).toBe('#000000');
  });

  it('setBackgroundGradientTo updates field', () => {
    useEditorStore.getState().setBackgroundGradientTo('#112233');
    expect(useEditorStore.getState().backgroundGradientTo).toBe('#112233');
  });

  it('backgroundGradientDir initial is "to-bottom"', () => {
    expect(useEditorStore.getState().backgroundGradientDir).toBe('to-bottom');
  });

  it('setBackgroundGradientDir updates direction', () => {
    useEditorStore.getState().setBackgroundGradientDir('to-right');
    expect(useEditorStore.getState().backgroundGradientDir).toBe('to-right');
  });

  it('panModeNodeId initial value is null', () => {
    expect(useEditorStore.getState().panModeNodeId).toBeNull();
  });

  it('setPanModeNodeId("abc") updates to "abc"', () => {
    useEditorStore.getState().setPanModeNodeId('abc');
    expect(useEditorStore.getState().panModeNodeId).toBe('abc');
  });

  it('setPanModeNodeId(null) resets to null', () => {
    useEditorStore.getState().setPanModeNodeId('abc');
    useEditorStore.getState().setPanModeNodeId(null);
    expect(useEditorStore.getState().panModeNodeId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LeafNode borderRadius and borderColor rendering
// ---------------------------------------------------------------------------

describe('LeafNode border styles from editorStore', () => {
  let leafId: string;

  beforeEach(async () => {
    // Import LeafNodeComponent lazily to avoid module resolution issues at top level
    const initialState = useGridStore.getInitialState();
    useGridStore.setState(initialState, true);
    // Get the first leaf id from initial store tree
    const { root } = useGridStore.getState();
    if (root.type === 'container') {
      leafId = root.children[0].id;
    } else {
      leafId = root.id;
    }
  });

  it('applies borderRadius style from editorStore', async () => {
    const { LeafNodeComponent } = await import('../Grid/LeafNode');
    useEditorStore.setState({ borderRadius: 12 });
    const { container } = render(<LeafNodeComponent id={leafId} />);
    const leafDiv = container.querySelector(`[data-testid="leaf-${leafId}"]`);
    expect(leafDiv).not.toBeNull();
    const style = (leafDiv as HTMLElement).style;
    expect(style.borderRadius).toBe('12px');
  });

  it('applies borderColor (outline) style from editorStore', async () => {
    const { LeafNodeComponent } = await import('../Grid/LeafNode');
    useEditorStore.setState({ borderColor: '#ff0000' });
    const { container } = render(<LeafNodeComponent id={leafId} />);
    const leafDiv = container.querySelector(`[data-testid="leaf-${leafId}"]`);
    expect(leafDiv).not.toBeNull();
    const style = (leafDiv as HTMLElement).style;
    // Outline color contains ff0000 (in some form)
    expect(style.outline).toContain('ff0000');
  });

  it('applies both borderRadius and borderColor simultaneously, overflow-hidden present', async () => {
    const { LeafNodeComponent } = await import('../Grid/LeafNode');
    useEditorStore.setState({ borderRadius: 12, borderColor: '#ff0000' });
    const { container } = render(<LeafNodeComponent id={leafId} />);
    const leafDiv = container.querySelector(`[data-testid="leaf-${leafId}"]`);
    expect(leafDiv).not.toBeNull();
    const style = (leafDiv as HTMLElement).style;
    expect(style.borderRadius).toBe('12px');
    expect(style.outline).toContain('ff0000');
    expect(leafDiv!.className).toContain('overflow-hidden');
  });
});
