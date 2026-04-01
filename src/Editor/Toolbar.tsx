export function Toolbar() {
  return (
    <header className="flex items-center gap-2 h-12 px-4 bg-[#1c1c1c] border-b border-[#2a2a2a] shrink-0">
      <span className="text-sm text-neutral-500">[Undo]</span>
      <span className="text-sm text-neutral-500">[Redo]</span>
      <span className="text-sm text-neutral-500 ml-4">[Zoom]</span>
      <span className="text-sm text-neutral-500 ml-auto">[Safe Zone]</span>
      <span className="text-sm text-neutral-500">[Export]</span>
    </header>
  );
}
