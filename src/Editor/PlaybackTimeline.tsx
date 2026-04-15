import { useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { videoElementRegistry, videoDrawRegistry } from '../lib/videoRegistry';
import { useAudioMix } from '../hooks/useAudioMix';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function seekAll(time: number): void {
  for (const video of videoElementRegistry.values()) {
    video.currentTime = time;
  }
  // Redraw still frames at seek position on next animation frame
  requestAnimationFrame(() => {
    for (const draw of videoDrawRegistry.values()) {
      draw();
    }
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaybackTimeline() {
  const isPlaying = useEditorStore(s => s.isPlaying);
  const playheadTime = useEditorStore(s => s.playheadTime);
  const totalDuration = useEditorStore(s => s.totalDuration);
  const setIsPlaying = useEditorStore(s => s.setIsPlaying);
  const setPlayheadTime = useEditorStore(s => s.setPlayheadTime);

  const { startAudio, stopAudio } = useAudioMix();

  // Playhead update loop — reads from first registered video at 10fps
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const [firstVideo] = videoElementRegistry.values();
      if (firstVideo) {
        const time = firstVideo.currentTime;
        setPlayheadTime(time);
        if (time >= totalDuration - 0.05) {
          // Playback complete — pause all
          for (const video of videoElementRegistry.values()) video.pause();
          stopAudio();
          setIsPlaying(false);
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [isPlaying, totalDuration, setPlayheadTime, setIsPlaying, stopAudio]);

  function handlePlayPause() {
    const store = useEditorStore.getState();
    if (store.isPlaying) {
      // Pause all
      for (const video of videoElementRegistry.values()) video.pause();
      stopAudio();
      store.setIsPlaying(false);
    } else {
      // startAudio MUST be first — AudioContext construction requires
      // synchronous user gesture callstack (D-06, LAUD-04)
      startAudio();
      for (const video of videoElementRegistry.values()) video.play();
      store.setIsPlaying(true);
    }
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value);
    seekAll(value);
    setPlayheadTime(value);
  }

  return (
    <div className="h-12 flex flex-row items-center w-full shrink-0 bg-black/80 backdrop-blur-sm px-4 gap-3">
      {/* Play/Pause button */}
      <button
        type="button"
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10 text-white"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={totalDuration || 1}
        step={0.1}
        value={playheadTime}
        onChange={handleScrub}
        className={[
          'flex-1 appearance-none bg-transparent cursor-pointer',
          '[&::-webkit-slider-runnable-track]:h-[3px]',
          '[&::-webkit-slider-runnable-track]:rounded-full',
          '[&::-webkit-slider-runnable-track]:bg-white/20',
          '[&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-white',
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:-mt-[6.5px]',
          '[&::-webkit-slider-thumb]:transition-transform',
          '[&::-webkit-slider-thumb]:duration-100',
          '[&::-webkit-slider-thumb]:active:scale-150',
          '[&::-webkit-slider-thumb]:cursor-grab',
          '[&::-webkit-slider-thumb]:active:cursor-grabbing',
          '[&::-moz-range-track]:h-[3px]',
          '[&::-moz-range-track]:rounded-full',
          '[&::-moz-range-track]:bg-white/20',
          '[&::-moz-range-thumb]:w-4',
          '[&::-moz-range-thumb]:h-4',
          '[&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-white',
          '[&::-moz-range-thumb]:border-none',
          '[&::-moz-range-thumb]:transition-transform',
          '[&::-moz-range-thumb]:duration-100',
          '[&::-moz-range-thumb]:active:scale-150',
        ].join(' ')}
      />

      {/* Time display */}
      <span className="text-white/70 text-xs tabular-nums min-w-[5rem] text-right">
        {formatTime(playheadTime)} / {formatTime(totalDuration)}
      </span>
    </div>
  );
}
