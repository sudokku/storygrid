import { CanvasWrapper } from '../Grid/CanvasWrapper';
import { useEditorStore } from '../store/editorStore';
import { useGridStore } from '../store/gridStore';
import { PlaybackTimeline } from './PlaybackTimeline';

export function CanvasArea() {
  const sheetSnapState = useEditorStore(s => s.sheetSnapState);
  const sheetOpen = sheetSnapState !== 'collapsed';
  const hasVideos = useGridStore(s => Object.values(s.mediaTypeMap).some(t => t === 'video'));

  return (
    <main
      className="flex flex-col flex-1 items-center overflow-hidden bg-[#0f0f0f] p-0 pt-2 md:p-8"
      style={sheetOpen ? { touchAction: 'none' } : undefined}
    >
      <div className="flex-1 flex items-start justify-center w-full overflow-hidden">
        <CanvasWrapper />
      </div>
      {hasVideos && <PlaybackTimeline />}
    </main>
  );
}
