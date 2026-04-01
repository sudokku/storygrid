import { Toolbar } from './Toolbar';
import { CanvasArea } from './CanvasArea';
import { Sidebar } from './Sidebar';

export function EditorShell() {
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
