import { CanvasWrapper } from '../Grid/CanvasWrapper';
import { useEditorStore } from '../store/editorStore';

export function CanvasArea() {
  const sheetSnapState = useEditorStore(s => s.sheetSnapState);
  const sheetOpen = sheetSnapState !== 'collapsed';

  return (
    <main
      className="flex flex-1 items-start justify-center overflow-hidden bg-[#0f0f0f] p-0 pt-2 md:p-8"
      style={sheetOpen ? { touchAction: 'none' } : undefined}
    >
      <CanvasWrapper />
    </main>
  );
}
