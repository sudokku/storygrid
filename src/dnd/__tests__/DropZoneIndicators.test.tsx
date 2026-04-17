/**
 * src/dnd/__tests__/DropZoneIndicators.test.tsx
 *
 * Isolated component tests for DropZoneIndicators (Phase 28 Plan 06).
 * Covers: DROP-01 (5-zone indicator rendering), DROP-05 (visual feedback).
 *
 * DropZoneIndicators is a pure presentational component driven by the
 * `zone` prop (`DropZone | null`). It reads `canvasScale` from the
 * `editorStore` for icon sizing; it does NOT subscribe to dragStore —
 * LeafNode wires the store-driven props.
 *
 * DEVIATION NOTE (Rule 1 — align test with real component contract):
 * The plan's `<action>` block uses `<DropZoneIndicators zone="..." scale={1} />`,
 * but the component's real Props interface is `{ zone: DropZone | null }` —
 * `scale` is NOT a prop. canvasScale is read from editorStore. Rather than
 * modify production in this plan (DropZoneIndicators.tsx is not in
 * Plan 10b's files_modified), the tests assert the contract as shipped:
 * `zone` prop only, with editorStore canvasScale controlling icon sizing.
 * This honors the plan's intent (isolated component coverage of the 5-zone
 * render contract) while respecting the real component signature.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { DropZoneIndicators } from '../DropZoneIndicators';
import { useEditorStore } from '../../store/editorStore';

beforeEach(() => {
  // Normalize canvasScale so icon-size assertions are deterministic.
  useEditorStore.setState({ canvasScale: 1 });
});

afterEach(() => {
  cleanup();
});

describe('DropZoneIndicators props-driven rendering (DROP-01, DROP-05)', () => {
  it('renders data-testid="drop-zones" when zone is non-null', () => {
    render(<DropZoneIndicators zone="center" />);
    expect(screen.queryByTestId('drop-zones')).not.toBeNull();
  });

  it('renders data-testid="drop-zones" even when zone is null (D-15 — all 5 render regardless)', () => {
    // Phase 28 base state: icons always render. Phase 29 polish adds
    // active/inactive differentiation (DROP-02/03) — not covered here.
    render(<DropZoneIndicators zone={null} />);
    expect(screen.queryByTestId('drop-zones')).not.toBeNull();
  });

  it('accepts editorStore canvasScale without throwing at typical canvas scales (analogue of the plan\'s "scale prop" acceptance criterion)', () => {
    useEditorStore.setState({ canvasScale: 0.5 });
    render(<DropZoneIndicators zone="top" />);
    const root = screen.queryByTestId('drop-zones');
    expect(root).not.toBeNull();
    // canvasScale=0.5 => icons rendered at 64 (32 / 0.5)
    const svgs = root?.querySelectorAll('svg') ?? [];
    expect(svgs.length).toBe(5);
    svgs.forEach((svg) => {
      expect(svg.getAttribute('width')).toBe('64');
    });
  });

  it('renders for all 5 zones without error', () => {
    for (const zone of ['center', 'top', 'bottom', 'left', 'right'] as const) {
      cleanup();
      render(<DropZoneIndicators zone={zone} />);
      expect(screen.queryByTestId('drop-zones')).not.toBeNull();
    }
  });
});

describe('DropZoneIndicators renders 5 individual zone elements (D-14)', () => {
  it('contains drop-zone-center, drop-zone-top, drop-zone-bottom, drop-zone-left, drop-zone-right', () => {
    render(<DropZoneIndicators zone="center" />);
    expect(screen.queryByTestId('drop-zone-center')).not.toBeNull();
    expect(screen.queryByTestId('drop-zone-top')).not.toBeNull();
    expect(screen.queryByTestId('drop-zone-bottom')).not.toBeNull();
    expect(screen.queryByTestId('drop-zone-left')).not.toBeNull();
    expect(screen.queryByTestId('drop-zone-right')).not.toBeNull();
  });
});
