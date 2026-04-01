import { useEffect } from 'react';
import { Toolbar } from './Toolbar';
import { CanvasArea } from './CanvasArea';
import { Sidebar } from './Sidebar';
import { useGridStore } from '../store/gridStore';

export function EditorShell() {
  const undo = useGridStore(s => s.undo);
  const redo = useGridStore(s => s.redo);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#111111]">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <CanvasArea />
        <Sidebar />
      </div>
    </div>
  );
}
