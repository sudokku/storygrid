import { describe, it, expect, beforeEach } from 'vitest';
// overlayStore does not exist yet — this import fails in RED state
import { useOverlayStore } from '../overlayStore';

beforeEach(() => {
  useOverlayStore.setState({ overlays: [], stickerRegistry: {} });
});

describe('stickerRegistry', () => {
  it('addSticker writes into state.stickerRegistry', () => {
    useOverlayStore.getState().addSticker('sk1', 'data:image/png;base64,AAAA');
    const { stickerRegistry } = useOverlayStore.getState();
    expect(stickerRegistry['sk1']).toBe('data:image/png;base64,AAAA');
  });

  it('removeSticker deletes from stickerRegistry', () => {
    useOverlayStore.getState().addSticker('sk1', 'data:image/png;base64,AAAA');
    useOverlayStore.getState().removeSticker('sk1');
    const { stickerRegistry } = useOverlayStore.getState();
    expect(stickerRegistry['sk1']).toBeUndefined();
  });

  it('reading state.stickerRegistry.sk1 after remove returns undefined', () => {
    useOverlayStore.getState().addSticker('sk1', 'data:image/png;base64,AAAA');
    useOverlayStore.getState().removeSticker('sk1');
    expect(useOverlayStore.getState().stickerRegistry['sk1']).toBeUndefined();
  });

  it('stickerRegistry is NOT present in any addOverlay sticker result overlay object (scan Object.keys)', () => {
    useOverlayStore.getState().addSticker('sk1', 'data:image/png;base64,AAAA');
    useOverlayStore.getState().addOverlay({
      type: 'sticker',
      x: 540,
      y: 960,
      width: 200,
      rotation: 0,
      stickerRegistryId: 'sk1',
    });
    const { overlays } = useOverlayStore.getState();
    expect(overlays).toHaveLength(1);
    const overlayKeys = Object.keys(overlays[0]);
    // stickerRegistry data (base64 blob) must not appear on the overlay object
    expect(overlayKeys).not.toContain('dataUri');
    expect(overlayKeys).not.toContain('data');
    // stickerRegistryId is present as a reference only (not the actual data)
    expect(overlays[0].type).toBe('sticker');
  });
});
