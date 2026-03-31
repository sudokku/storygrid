import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/editorStore';

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
});

describe('editorStore', () => {
  describe('initial state', () => {
    it('selectedNodeId is null', () => {
      const { selectedNodeId } = useEditorStore.getState();
      expect(selectedNodeId).toBeNull();
    });

    it('zoom is 1', () => {
      const { zoom } = useEditorStore.getState();
      expect(zoom).toBe(1);
    });

    it('showSafeZone is false', () => {
      const { showSafeZone } = useEditorStore.getState();
      expect(showSafeZone).toBe(false);
    });

    it('activeTool is "select"', () => {
      const { activeTool } = useEditorStore.getState();
      expect(activeTool).toBe('select');
    });
  });

  describe('setSelectedNode action', () => {
    it('setSelectedNode("abc"): selectedNodeId becomes "abc"', () => {
      useEditorStore.getState().setSelectedNode('abc');
      expect(useEditorStore.getState().selectedNodeId).toBe('abc');
    });

    it('setSelectedNode(null): selectedNodeId becomes null', () => {
      useEditorStore.getState().setSelectedNode('abc');
      useEditorStore.getState().setSelectedNode(null);
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('setZoom action', () => {
    it('setZoom(1.5): zoom becomes 1.5', () => {
      useEditorStore.getState().setZoom(1.5);
      expect(useEditorStore.getState().zoom).toBe(1.5);
    });

    it('setZoom(2.0): zoom clamped to 1.5', () => {
      useEditorStore.getState().setZoom(2.0);
      expect(useEditorStore.getState().zoom).toBe(1.5);
    });

    it('setZoom(0.1): zoom clamped to 0.5', () => {
      useEditorStore.getState().setZoom(0.1);
      expect(useEditorStore.getState().zoom).toBe(0.5);
    });
  });

  describe('toggleSafeZone action', () => {
    it('toggleSafeZone: showSafeZone flips to true', () => {
      useEditorStore.getState().toggleSafeZone();
      expect(useEditorStore.getState().showSafeZone).toBe(true);
    });

    it('toggleSafeZone twice: showSafeZone returns to false', () => {
      useEditorStore.getState().toggleSafeZone();
      useEditorStore.getState().toggleSafeZone();
      expect(useEditorStore.getState().showSafeZone).toBe(false);
    });
  });

  describe('setActiveTool action', () => {
    it('setActiveTool("split-h"): activeTool becomes "split-h"', () => {
      useEditorStore.getState().setActiveTool('split-h');
      expect(useEditorStore.getState().activeTool).toBe('split-h');
    });
  });
});
