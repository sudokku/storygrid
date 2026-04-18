/**
 * @dnd-kit/core adapter for the v1.5 unified DnD engine.
 *
 * ───────────────────────────────────────────────────────────────────────
 * BLOCKING RULES — reintroducing any of these reproduces Phase 25 failures.
 * ───────────────────────────────────────────────────────────────────────
 *
 * RULE 1 — DND-01 (REQUIREMENTS.md): Single PointerSensor only.
 *   Do NOT add TouchSensor or MouseSensor. dnd-kit docs explicitly forbid
 *   the Touch + Mouse combination; it was a primary cause of Phase 25's
 *   flaky activation (PITFALLS.md Root Cause Hypothesis).
 *
 * RULE 2 — Pitfall 4 (PITFALLS.md): Activation thresholds.
 *   Touch:  { delay: 250, tolerance: 5 }   (NEVER 500ms — collides with
 *                                            iOS 17.2+ image-action menu
 *                                            at ~500–700ms)
 *   Mouse:  { distance: 8 }                (prevents click-as-drag)
 *
 * RULE 3 — Pitfall 10 (PITFALLS.md): No parallel engines during migration.
 *   Phase 25 wiring (useDraggable / useDroppable / useDndMonitor in
 *   LeafNode.tsx; DndContext + MouseSensor + TouchSensor + KeyboardSensor
 *   + DragZoneRefContext in CanvasWrapper.tsx) is removed in the SAME
 *   phase that wires this adapter — Phase 28. Never ship with both.
 *
 * Phase 27 ships this file as a skeleton only. Phase 28 implements the
 * DndContext host + sensors + onDragStart/onDragOver/onDragEnd/onDragCancel
 * callbacks that wire into dragStore and computeDropZone.
 */

// Phase 27: no exports yet — adapter implementation lands in Phase 28.
export {};
