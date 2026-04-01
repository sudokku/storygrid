/**
 * Phase 04 Plan 01 Task 1 — updated tests
 * editorStore export state (ExportModeContext removed, suppression tests removed)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/editorStore';

// ---------------------------------------------------------------------------
// editorStore export state
// ---------------------------------------------------------------------------

describe('editorStore export state', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true);
  });

  it('isExporting defaults to false', () => {
    expect(useEditorStore.getState().isExporting).toBe(false);
  });

  it('exportFormat defaults to "png"', () => {
    expect(useEditorStore.getState().exportFormat).toBe('png');
  });

  it('exportQuality defaults to 0.9', () => {
    expect(useEditorStore.getState().exportQuality).toBe(0.9);
  });

  it('setIsExporting(true) sets isExporting to true', () => {
    useEditorStore.getState().setIsExporting(true);
    expect(useEditorStore.getState().isExporting).toBe(true);
  });

  it('setExportFormat("jpeg") sets exportFormat to "jpeg"', () => {
    useEditorStore.getState().setExportFormat('jpeg');
    expect(useEditorStore.getState().exportFormat).toBe('jpeg');
  });

  it('setExportQuality(0.8) sets exportQuality to 0.8', () => {
    useEditorStore.getState().setExportQuality(0.8);
    expect(useEditorStore.getState().exportQuality).toBe(0.8);
  });
});
