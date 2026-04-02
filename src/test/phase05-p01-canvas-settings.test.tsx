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

