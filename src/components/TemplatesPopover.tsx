import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutGrid } from 'lucide-react';
import { buildTemplate } from '../lib/tree';
import type { TemplateName } from '../lib/tree';
import { useGridStore } from '../store/gridStore';

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

type TemplateEntry = {
  name: TemplateName;
  label: string;
};

const TEMPLATES: TemplateEntry[] = [
  { name: '2x1', label: '2x1 Stacked' },
  { name: '1x2', label: '1x2 Side by Side' },
  { name: '2x2', label: '2x2 Quad' },
  { name: '3-row', label: '3 Row' },
  { name: 'l-shape', label: 'L-Shape' },
  { name: 'mosaic', label: 'Mosaic' },
];

// ---------------------------------------------------------------------------
// Thumbnail previews — small divs showing the grid pattern
// ---------------------------------------------------------------------------

function Template2x1() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
    </div>
  );
}

function Template1x2() {
  return (
    <div className="w-full h-full flex flex-row gap-0.5">
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
    </div>
  );
}

function Template2x2() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <div className="flex-1 flex flex-row gap-0.5">
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      </div>
      <div className="flex-1 flex flex-row gap-0.5">
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      </div>
    </div>
  );
}

function Template3Row() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
    </div>
  );
}

function TemplateLShape() {
  return (
    <div className="w-full h-full flex flex-row gap-0.5">
      <div className="flex-[2] bg-[#3a3a3a] rounded-sm" />
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      </div>
    </div>
  );
}

function TemplateMosaic() {
  return (
    <div className="w-full h-full flex flex-col gap-0.5">
      <div className="flex-1 flex flex-row gap-0.5">
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      </div>
      <div className="flex-1 flex flex-row gap-0.5">
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
        <div className="flex-1 bg-[#3a3a3a] rounded-sm" />
      </div>
    </div>
  );
}

const THUMBNAILS: Record<TemplateName, React.FC> = {
  '2x1': Template2x1,
  '1x2': Template1x2,
  '2x2': Template2x2,
  '3-row': Template3Row,
  'l-shape': TemplateLShape,
  'mosaic': TemplateMosaic,
};

// ---------------------------------------------------------------------------
// TemplatesPopover
// ---------------------------------------------------------------------------

export function TemplatesPopover() {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const applyTemplate = useGridStore(s => s.applyTemplate);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleApply = useCallback((entry: TemplateEntry) => {
    applyTemplate(buildTemplate(entry.name));
    setOpen(false);
  }, [applyTemplate]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 transition-colors"
        aria-label="Templates"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <LayoutGrid size={16} className="text-[var(--foreground)]" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-1 z-50 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg shadow-xl p-3"
          style={{ minWidth: 280 }}
          data-testid="templates-popover"
        >
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-3">Templates</p>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map(entry => {
              const Thumbnail = THUMBNAILS[entry.name];
              return (
                <button
                  key={entry.name}
                  className="flex flex-col items-center gap-1.5 p-1.5 rounded hover:bg-[#2a2a2a] transition-colors group"
                  onClick={() => handleApply(entry)}
                  data-template={entry.name}
                >
                  <div className="w-16 h-24 bg-[#111] rounded border border-[#333] p-1">
                    <Thumbnail />
                  </div>
                  <span className="text-[10px] text-neutral-400 group-hover:text-neutral-200 leading-tight text-center">
                    {entry.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
