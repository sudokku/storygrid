import { useRef, useEffect, useCallback } from 'react';
import { videoElementRegistry } from '../lib/videoRegistry';
import { useGridStore } from '../store/gridStore';
import { getAllLeaves } from '../lib/tree';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AudioNodeEntry = {
  sourceNode: MediaElementAudioSourceNode;
  gainNode: GainNode;
};

// ---------------------------------------------------------------------------
// useAudioMix — Web Audio API hook for live editor playback
//
// Decision refs from 21-RESEARCH / 21-VALIDATION:
//   D-02: AudioContext created once on startAudio(), reused, never closed during
//         component lifetime (only closed on component unmount).
//   D-03: MediaElementAudioSourceNode + GainNode pairs created once per video;
//         nodeMapRef guards against duplication.
//   D-04: Gain values = 1/activeCount for cells with audioEnabled AND hasAudioTrack;
//         gain = 0 for muted cells.
//   D-05: Zustand subscribe() watcher triggers updateGains() when audioEnabled or
//         hasAudioTrack changes on any leaf.
//   D-06: startAudio() MUST be called synchronously in the user click handler
//         (before any async ops) so AudioContext construction occurs in the gesture
//         callstack — required by browser autoplay policy.
// ---------------------------------------------------------------------------

export function useAudioMix(): { startAudio: () => void; stopAudio: () => void } {
  // D-02: single AudioContext ref — created once, never closed until unmount
  const audioCtxRef = useRef<AudioContext | null>(null);

  // D-03: node map — never recreated; idempotent has() guard in buildNodeGraph
  const nodeMapRef = useRef<Map<string, AudioNodeEntry>>(new Map());

  // ---------------------------------------------------------------------------
  // updateGains — recompute gain values for all wired nodes
  // ---------------------------------------------------------------------------

  const updateGains = useCallback(() => {
    const { root } = useGridStore.getState();
    const leaves = getAllLeaves(root);

    // Active = audioEnabled AND hasAudioTrack AND has a registered video element
    const activeIds = new Set(
      leaves
        .filter(l => l.audioEnabled && l.hasAudioTrack && videoElementRegistry.has(l.id))
        .map(l => l.id),
    );

    const gain = activeIds.size > 0 ? 1 / activeIds.size : 0;

    for (const [nodeId, { gainNode }] of nodeMapRef.current.entries()) {
      gainNode.gain.value = activeIds.has(nodeId) ? gain : 0;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // buildNodeGraph — wire any new videos not yet in nodeMapRef
  // ---------------------------------------------------------------------------

  const buildNodeGraph = useCallback(
    (ctx: AudioContext) => {
      for (const [nodeId, videoEl] of videoElementRegistry.entries()) {
        // D-03: idempotent — skip already-wired videos
        if (nodeMapRef.current.has(nodeId)) continue;

        const sourceNode = ctx.createMediaElementSource(videoEl);
        const gainNode = ctx.createGain();
        sourceNode.connect(gainNode);
        gainNode.connect(ctx.destination);

        nodeMapRef.current.set(nodeId, { sourceNode, gainNode });
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // startAudio — must be called synchronously from click handler (D-06)
  // ---------------------------------------------------------------------------

  const startAudio = useCallback(() => {
    // D-02: create AudioContext on first call only
    if (!audioCtxRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audioCtxRef.current = new (window as any).AudioContext();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ctx = audioCtxRef.current!;

    // D-03: idempotent wiring of new video elements
    buildNodeGraph(ctx);

    // D-04: normalize gains
    updateGains();

    // Resume if suspended (e.g. after stopAudio)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }, [buildNodeGraph, updateGains]);

  // ---------------------------------------------------------------------------
  // stopAudio — suspend without destroying nodes
  // ---------------------------------------------------------------------------

  const stopAudio = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Reactive subscription — recompute gains when audioEnabled/hasAudioTrack changes
  // D-05: subscribe to gridStore; only recompute if context is active
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsub = useGridStore.subscribe((state, prev) => {
      // Only update if AudioContext is actively running
      if (!audioCtxRef.current || audioCtxRef.current.state !== 'running') return;

      // Check for any leaf-level audio state changes
      const prevLeaves = getAllLeaves(prev.root);
      const nextLeaves = getAllLeaves(state.root);

      let changed = false;
      if (prevLeaves.length !== nextLeaves.length) {
        changed = true;
      } else {
        for (let i = 0; i < nextLeaves.length; i++) {
          if (
            nextLeaves[i].audioEnabled !== prevLeaves[i].audioEnabled ||
            nextLeaves[i].hasAudioTrack !== prevLeaves[i].hasAudioTrack
          ) {
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        updateGains();
      }
    });

    return unsub;
  }, [updateGains]);

  // ---------------------------------------------------------------------------
  // Cleanup — close AudioContext and clear node map on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
      nodeMapRef.current.clear();
    };
  }, []);

  return { startAudio, stopAudio };
}
