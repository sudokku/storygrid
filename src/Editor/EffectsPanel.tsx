import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGridStore } from '../store/gridStore';
import { findNode } from '../lib/tree';
import { DEFAULT_EFFECTS, type PresetName } from '../lib/effects';
// Thumbnail placeholders — Plan 02 will replace with Instagram-style thumbnails
import clarendonThumb from '../assets/presets/vivid.png';
import larkThumb from '../assets/presets/warm.png';
import junoThumb from '../assets/presets/fade.png';
import reyesThumb from '../assets/presets/cool.png';
import moonThumb from '../assets/presets/bw.png';
import inkwellThumb from '../assets/presets/sepia.png';

const PRESETS: PresetName[] = ['clarendon', 'lark', 'juno', 'reyes', 'moon', 'inkwell'];

const DISPLAY_NAMES: Record<PresetName, string> = {
  clarendon: 'Clarendon',
  lark: 'Lark',
  juno: 'Juno',
  reyes: 'Reyes',
  moon: 'Moon',
  inkwell: 'Inkwell',
};

const PRESET_THUMBS: Record<PresetName, string> = {
  clarendon: clarendonThumb,
  lark: larkThumb,
  juno: junoThumb,
  reyes: reyesThumb,
  moon: moonThumb,
  inkwell: inkwellThumb,
};

const KEYBOARD_NUDGE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

type SliderField = 'brightness' | 'contrast' | 'saturation' | 'blur';

export function EffectsPanel({ nodeId }: { nodeId: string }) {
  const isDraggingRef = useRef(false);

  // Combined selector via useShallow — Zustand v5 removed the custom equality
  // parameter from create(), so this is the supported pattern. Splitting into
  // two useGridStore calls would cause double re-renders during slider drags.
  const { effects, hasMedia } = useGridStore(
    useShallow((s) => {
      const n = findNode(s.root, nodeId);
      const leaf = n && n.type === 'leaf' ? n : null;
      return {
        effects: leaf?.effects ?? DEFAULT_EFFECTS,
        hasMedia: leaf?.mediaId != null,
      };
    }),
  );

  function renderSlider(field: SliderField, label: string) {
    const min = field === 'blur' ? 0 : -100;
    const max = field === 'blur' ? 20 : 100;
    const value = effects[field];
    const readout =
      field === 'blur'
        ? `${value}px`
        : value > 0
          ? `+${value}`
          : `${value}`;

    return (
      <div className="flex items-center gap-2" key={field}>
        <span className="text-xs text-neutral-400 w-16 shrink-0">{label}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={label}
          className="flex-1 accent-[#3b82f6]"
          onPointerDown={() => {
            isDraggingRef.current = true;
            useGridStore.getState().beginEffectsDrag(nodeId);
          }}
          onPointerUp={() => {
            isDraggingRef.current = false;
          }}
          onPointerCancel={() => {
            isDraggingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (!isDraggingRef.current && KEYBOARD_NUDGE_KEYS.has(e.key)) {
              useGridStore.getState().beginEffectsDrag(nodeId);
            }
          }}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            useGridStore.getState().setEffects(nodeId, { [field]: next });
          }}
        />
        <span className="text-xs text-neutral-300 font-mono w-8 text-right shrink-0">
          {readout}
        </span>
      </div>
    );
  }

  const body = (
    <div className="space-y-3">
      {/* Preset chip strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESETS.map((name) => {
          const isActive = effects.preset === name;
          return (
            <button
              key={name}
              type="button"
              aria-label={DISPLAY_NAMES[name]}
              aria-pressed={isActive}
              className="flex flex-col items-center gap-1 p-1"
              onClick={() => useGridStore.getState().applyPreset(nodeId, name)}
            >
              <div
                className={`w-12 h-12 rounded overflow-hidden ${
                  isActive ? 'ring-2 ring-[#3b82f6]' : ''
                }`}
              >
                <img
                  src={PRESET_THUMBS[name]}
                  alt={DISPLAY_NAMES[name]}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[10px] font-normal text-neutral-400">
                {DISPLAY_NAMES[name]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sliders */}
      <div className="space-y-2">
        {renderSlider('brightness', 'Brightness')}
        {renderSlider('contrast', 'Contrast')}
        {renderSlider('saturation', 'Saturation')}
        {renderSlider('blur', 'Blur')}
      </div>

      {/* Reset row */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300"
          onClick={() => useGridStore.getState().resetEffects(nodeId)}
        >
          Reset effects
        </button>
        <button
          type="button"
          className="flex-1 py-1.5 px-3 rounded text-xs bg-[#2a2a2a] hover:bg-red-500/20 text-red-400"
          onClick={() => useGridStore.getState().resetCell(nodeId)}
        >
          Reset cell
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
        Effects
      </p>
      {hasMedia ? (
        body
      ) : (
        <>
          <p className="text-xs text-neutral-500">Add media to apply effects</p>
          <div className="opacity-40 pointer-events-none">{body}</div>
        </>
      )}
    </div>
  );
}
