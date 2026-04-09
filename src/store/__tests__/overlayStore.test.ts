import { describe, it, expect, beforeEach } from 'vitest';
// overlayStore does not exist yet — this import fails in RED state
import { useOverlayStore } from '../overlayStore';
import { useEditorStore } from '../editorStore';

beforeEach(() => {
  useOverlayStore.setState({ overlays: [], stickerRegistry: {} });
  useEditorStore.setState({ selectedNodeId: null, selectedOverlayId: null } as Parameters<typeof useEditorStore.setState>[0]);
});

// ---------------------------------------------------------------------------
// addOverlay (OVL-01)
// ---------------------------------------------------------------------------

describe('overlayStore — addOverlay (OVL-01)', () => {
  it('appends a TextOverlay with generated id', () => {
    const id = useOverlayStore.getState().addOverlay({
      type: 'text',
      x: 540,
      y: 960,
      width: 300,
      rotation: 0,
      content: 'Hello',
      fontFamily: 'Geist',
      fontSize: 48,
      color: '#ffffff',
      fontWeight: 'regular',
      textAlign: 'center',
    });
    const { overlays } = useOverlayStore.getState();
    expect(overlays).toHaveLength(1);
    expect(overlays[0].id).toBe(id);
    expect(overlays[0].type).toBe('text');
  });

  it('addOverlay returns the new overlay id', () => {
    const id = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '😀',
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('addOverlay with two overlays produces zIndex 1 then 2', () => {
    useOverlayStore.getState().addOverlay({
      type: 'text',
      x: 540,
      y: 960,
      width: 300,
      rotation: 0,
      content: 'First',
      fontFamily: 'Geist',
      fontSize: 48,
      color: '#ffffff',
      fontWeight: 'regular',
      textAlign: 'center',
    });
    useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 200,
      y: 300,
      width: 80,
      rotation: 0,
      char: '⭐',
    });
    const { overlays } = useOverlayStore.getState();
    expect(overlays[0].zIndex).toBe(1);
    expect(overlays[1].zIndex).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// deleteOverlay
// ---------------------------------------------------------------------------

describe('overlayStore — deleteOverlay', () => {
  it('removes exactly one overlay, leaves others untouched', () => {
    const id1 = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '🎉',
    });
    const id2 = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 300,
      y: 400,
      width: 80,
      rotation: 0,
      char: '🔥',
    });
    useOverlayStore.getState().deleteOverlay(id1);
    const { overlays } = useOverlayStore.getState();
    expect(overlays).toHaveLength(1);
    expect(overlays[0].id).toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// updateOverlay
// ---------------------------------------------------------------------------

describe('overlayStore — updateOverlay', () => {
  it('mutates only the targeted overlay\'s x', () => {
    const id = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '🌟',
    });
    useOverlayStore.getState().updateOverlay(id, { x: 999 });
    const { overlays } = useOverlayStore.getState();
    expect(overlays[0].x).toBe(999);
    expect(overlays[0].y).toBe(200);
  });

  it('updateOverlay of missing id is a no-op (does not throw)', () => {
    const id = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '🌟',
    });
    expect(() => {
      useOverlayStore.getState().updateOverlay('does-not-exist', { x: 500 });
    }).not.toThrow();
    // Original overlay untouched
    expect(useOverlayStore.getState().overlays[0].id).toBe(id);
  });
});

// ---------------------------------------------------------------------------
// z-order (OVL-14)
// ---------------------------------------------------------------------------

describe('overlayStore — z-order (OVL-14)', () => {
  it('bringForward(id) increments the overlay\'s zIndex by 1', () => {
    const id = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '⬆️',
    });
    const before = useOverlayStore.getState().overlays[0].zIndex;
    useOverlayStore.getState().bringForward(id);
    expect(useOverlayStore.getState().overlays[0].zIndex).toBe(before + 1);
  });

  it('sendBackward(id) decrements zIndex by 1, clamped to 0 minimum', () => {
    const id = useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '⬇️',
    });
    // zIndex starts at 1 (first overlay); send backward twice should clamp at 0
    useOverlayStore.getState().sendBackward(id);
    expect(useOverlayStore.getState().overlays[0].zIndex).toBe(0);
    useOverlayStore.getState().sendBackward(id);
    expect(useOverlayStore.getState().overlays[0].zIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// stickerRegistry (OVL-17)
// ---------------------------------------------------------------------------

describe('overlayStore — stickerRegistry (OVL-17)', () => {
  it('addSticker(id, dataUri) writes into stickerRegistry', () => {
    useOverlayStore.getState().addSticker('sk1', 'data:image/png;base64,AAAA');
    const { stickerRegistry } = useOverlayStore.getState();
    expect(stickerRegistry['sk1']).toBe('data:image/png;base64,AAAA');
  });

  it('no overlay object has a dataUri field (OVL-17)', () => {
    useOverlayStore.getState().addSticker('sk2', 'data:image/png;base64,BBBB');
    useOverlayStore.getState().addOverlay({
      type: 'sticker',
      x: 540,
      y: 960,
      width: 200,
      rotation: 0,
      stickerRegistryId: 'sk2',
    });
    const { overlays } = useOverlayStore.getState();
    for (const overlay of overlays) {
      expect(Object.prototype.hasOwnProperty.call(overlay, 'dataUri')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// replaceAll (undo integration)
// ---------------------------------------------------------------------------

describe('overlayStore — replaceAll (undo integration)', () => {
  it('replaces the overlays array verbatim', () => {
    useOverlayStore.getState().addOverlay({
      type: 'emoji',
      x: 100,
      y: 200,
      width: 80,
      rotation: 0,
      char: '🔄',
    });
    const replacement = [
      {
        id: 'fixed-id',
        type: 'emoji' as const,
        x: 300,
        y: 600,
        width: 100,
        rotation: 45,
        zIndex: 5,
        char: '✅',
      },
    ];
    useOverlayStore.getState().replaceAll(replacement);
    const { overlays } = useOverlayStore.getState();
    expect(overlays).toHaveLength(1);
    expect(overlays[0].id).toBe('fixed-id');
    expect(overlays[0].zIndex).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Overlay selection mutual exclusion (OVL-15)
// ---------------------------------------------------------------------------

describe('overlay selection mutual exclusion (OVL-15)', () => {
  it('setSelectedNode clears selectedOverlayId when id is non-null', () => {
    useEditorStore.getState().setSelectedOverlayId('o1');
    expect(useEditorStore.getState().selectedOverlayId).toBe('o1');

    useEditorStore.getState().setSelectedNode('n1');
    expect(useEditorStore.getState().selectedNodeId).toBe('n1');
    expect(useEditorStore.getState().selectedOverlayId).toBeNull();
  });

  it('setSelectedOverlayId clears selectedNodeId when id is non-null', () => {
    useEditorStore.getState().setSelectedNode('n1');
    expect(useEditorStore.getState().selectedNodeId).toBe('n1');

    useEditorStore.getState().setSelectedOverlayId('o1');
    expect(useEditorStore.getState().selectedOverlayId).toBe('o1');
    expect(useEditorStore.getState().selectedNodeId).toBeNull();
  });
});
