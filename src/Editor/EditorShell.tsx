import { useEffect } from 'react';
import { Toolbar } from './Toolbar';
import { CanvasArea } from './CanvasArea';
import { Sidebar } from './Sidebar';
import { Onboarding } from './Onboarding';
import { MobileSheet } from './MobileSheet';
import { GlobalActionBar } from './GlobalActionBar';
import { useGridStore } from '../store/gridStore';
import { useEditorStore } from '../store/editorStore';
import { findNode } from '../lib/tree';

export function EditorShell() {
  const undo = useGridStore(s => s.undo);
  const redo = useGridStore(s => s.redo);

  // Cleanup stale blob media on mount — blob URLs don't survive page reloads.
  // Persisted store may contain blob entries that are now dead; null them out.
  useEffect(() => {
    useGridStore.getState().cleanupStaleBlobMedia();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only fire if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const panId = useEditorStore.getState().panModeNodeId;
        if (panId) {
          useEditorStore.getState().setPanModeNodeId(null);
        } else {
          useEditorStore.getState().setSelectedNode(null);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
        const selId = useEditorStore.getState().selectedNodeId;
        if (selId) {
          e.preventDefault();
          useGridStore.getState().remove(selId);
          useEditorStore.getState().setSelectedNode(null);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        const selId = useEditorStore.getState().selectedNodeId;
        if (selId && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          useGridStore.getState().split(selId, 'horizontal');
        }
      } else if (e.key === 'v' || e.key === 'V') {
        const selId = useEditorStore.getState().selectedNodeId;
        if (selId && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          useGridStore.getState().split(selId, 'vertical');
        }
      } else if (e.key === 'f' || e.key === 'F') {
        const selId = useEditorStore.getState().selectedNodeId;
        if (selId && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const root = useGridStore.getState().root;
          const node = findNode(root, selId);
          if (node && node.type === 'leaf') {
            useGridStore.getState().updateCell(selId, { fit: node.fit === 'cover' ? 'contain' : 'cover' });
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        (document.querySelector('[data-testid="export-button"]') as HTMLElement)?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0a]">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden pb-[60px] md:pb-0">
        <CanvasArea />
        <Sidebar />
      </div>
      <MobileSheet />
      <GlobalActionBar />
      <Onboarding />
    </div>
  );
}
