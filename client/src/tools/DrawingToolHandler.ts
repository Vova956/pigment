import type { Point, Stroke, DrawingTool, LayerData } from '../types/canvas';

// ── Result types returned by handlers (never mutate state directly) ────────────

export interface ToolMoveResult {
  /** Updated path so far. */
  newPoints: Point[];
  /** Stroke IDs newly hit by the eraser on this move step. */
  newlyErasedIds?: string[];
}

export interface ToolEndResult {
  /** Completed stroke to commit (pen / highlighter). */
  stroke?: Stroke;
  /** Strokes enclosed by the finished lasso. */
  lassoSelection?: Set<string>;
}

// ── Abstract base ─────────────────────────────────────────────────────────────

/**
 * Strategy base class for every drawing tool.
 *
 * Open/Closed: add new tools by subclassing — Canvas.tsx never needs to change.
 * Liskov: every subclass is a drop-in replacement for this type.
 * Dependency Inversion: Canvas.tsx depends on this abstraction, not on concrete tools.
 */
export abstract class DrawingToolHandler {
  constructor(protected readonly tool: DrawingTool) {}

  /** CSS cursor value for this tool. */
  abstract get cursor(): string;

  /** Whether a live path preview should be rendered while drawing. */
  abstract get hasStrokePreview(): boolean;

  /**
   * Called each time the pointer moves while drawing.
   * Default: append point (suitable for pen / lasso).
   */
  onMove(
    pt: Point,
    currentPoints: Point[],
    _layers: Record<string, LayerData>,
    _erasedThisGesture: ReadonlySet<string>,
  ): ToolMoveResult {
    return { newPoints: [...currentPoints, pt] };
  }

  /**
   * Called when the pointer is released.
   * Default: no-op (eraser handles its own commit logic in Canvas.tsx).
   */
  onEnd(
    _points: Point[],
    _layers: Record<string, LayerData>,
    _userId: string,
    _userName: string,
  ): ToolEndResult {
    return {};
  }
}
