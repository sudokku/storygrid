export function Toolbar() {
  return (
    <header className="flex items-center gap-2 h-12 px-4 bg-white border-b border-neutral-200 shrink-0">
      <span className="text-sm text-neutral-400">[Undo]</span>
      <span className="text-sm text-neutral-400">[Redo]</span>
      <span className="text-sm text-neutral-400 ml-4">[Zoom]</span>
      <span className="text-sm text-neutral-400 ml-auto">[Safe Zone]</span>
      <span className="text-sm text-neutral-400">[Export]</span>
    </header>
  );
}
