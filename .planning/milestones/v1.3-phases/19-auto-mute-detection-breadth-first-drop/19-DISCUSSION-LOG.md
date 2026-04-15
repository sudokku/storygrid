# Phase 19: Auto-Mute Detection & Breadth-First Drop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 19-auto-mute-detection-breadth-first-drop
**Areas discussed:** Detection integration point, Decode failure fallback, Locked state visual, BFS split direction source

---

## Detection Integration Point

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone utility + call from each upload point | Add `detectAudioTrack(file): Promise<boolean>` in media.ts, call from autoFillCells and LeafNode handleDrop | ✓ |
| Inside autoFillCells() only | Detection only in multi-fill path; LeafNode single-file drop would need separate inline detection | |
| Store action enhancement | Enhance setMedia to detect automatically; indirect access to File | |

**User's choice:** Standalone utility, called from both upload paths. FillActions extended with `setHasAudioTrack`.

---

## Decode Failure Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| true — assume audio present | Fail open: on error, leave toggle interactive. Minor nuisance if video is silent. | ✓ |
| false — assume no audio | Conservative: on error, lock the toggle. Worse outcome if video actually has audio. | |

**User's choice:** `hasAudioTrack = true` on decode failure. Function never rejects.

---

## Locked State Visual

| Option | Description | Selected |
|--------|-------------|----------|
| Gray + opacity-40, no hover, cursor-not-allowed | Locked: gray VolumeX at 40% opacity, disabled, tooltip "No audio track". User-muted: red VolumeX (unchanged). | ✓ |
| Same gray but still interactive | Grayed but clickable — conflicts with non-interactive requirement. | |
| Hide button entirely | No toggle shown for no-audio cells — loses the visual signal. | |

**User's choice:** `text-gray-400 opacity-40 cursor-not-allowed`, `disabled` attribute, tooltip `"No audio track"`. Applies to both ActionBar and SelectedCellPanel.

---

## BFS Split Direction Source

| Option | Description | Selected |
|--------|-------------|----------|
| BFS queue carries depth inline | `getBFSLeavesWithDepth(root)` returns `{leaf, depth}[]`. autoFillCells uses depth from queue for split direction. | ✓ |
| Add getDepth(nodeId) to FillActions | Expose depth query through FillActions; more surface area. | |
| You decide | Implementation detail — just make BFS and depth-based splits work. | |

**User's choice:** New `getBFSLeavesWithDepth()` helper in `tree.ts`; depth carried inline in BFS queue entries.

---
