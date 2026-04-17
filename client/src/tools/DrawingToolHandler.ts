import type { Point, Stroke, DrawingTool, LayerData } from '../types/canvas';

// ── Result types returned by handlers ─────────────────────────────────────────

/**
 * Value returned by {@link DrawingToolHandler.onMove}.
 * Handlers never mutate canvas state directly; they return a description
 * of the change and let the caller (Canvas) apply it.
 * This keeps handlers stateless and trivially testable.
 */
export interface ToolMoveResult {
  /** Accumulated path points after this move step. */
  newPoints: Point[];
  /** Stroke IDs newly intersected by the eraser on this step. */
  newlyErasedIds?: string[];
}

/**
 * Value returned by {@link DrawingToolHandler.onEnd}.
 * At most one of the fields is populated, depending on the tool type.
 */
export interface ToolEndResult {
  /** Completed stroke to commit to the layer (pen / highlighter). */
  stroke?: Stroke;
  /** Set of stroke IDs enclosed by the finished lasso polygon. */
  lassoSelection?: Set<string>;
}

// ── Abstract base class ────────────────────────────────────────────────────────

/**
 * Abstract base class for all drawing-tool behaviours.
 *
 * ─────────────────────────────────────────────────────
 * DESIGN PATTERN: Strategy
 * ─────────────────────────────────────────────────────
 * Role in this pattern:
 *   Abstract Strategy — defines the interface (contract) for every
 *   concrete tool algorithm.
 *
 * Concrete Strategies:
 *   PenToolHandler, HighlighterToolHandler, EraserToolHandler,
 *   LassoToolHandler, TextToolHandler
 *
 * Context:
 *   Canvas.tsx holds a reference to the active DrawingToolHandler
 *   and calls onMove / onEnd without knowing which concrete class it has.
 *   Swapping the active tool at runtime (the "strategy") requires only
 *   replacing this single reference — no branching logic in Canvas.tsx.
 *
 * Why Strategy here?
 *   Drawing tools share the same pointer-event lifecycle (down → move → up)
 *   but differ in what they compute at each step. The Strategy pattern lets
 *   us add new tools (e.g. a shape tool) by subclassing this class alone,
 *   satisfying the Open/Closed Principle.
 * ─────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────
 * OOP PRINCIPLES DEMONSTRATED
 * ─────────────────────────────────────────────────────
 *
 * ABSTRACTION
 *   This class exposes a minimal, stable interface (cursor, hasStrokePreview,
 *   onMove, onEnd) that hides all tool-specific implementation details.
 *   Canvas.tsx depends only on this abstraction — it never imports a concrete
 *   handler class directly.
 *
 * ENCAPSULATION
 *   The `tool: DrawingTool` configuration is held as a `protected readonly`
 *   field. It is accessible to subclasses (they need color/width) but
 *   invisible outside the class hierarchy, preventing external code from
 *   mutating tool configuration mid-gesture.
 *
 * INHERITANCE
 *   Every concrete handler (PenToolHandler, EraserToolHandler, etc.)
 *   extends this class, inheriting the default onMove implementation
 *   (append-the-point) and the base constructor. Subclasses override
 *   only the methods where their behaviour differs.
 *
 * POLYMORPHISM
 *   ToolHandlerFactory.create() returns a DrawingToolHandler reference
 *   regardless of which concrete class was instantiated. Canvas.tsx calls
 *   handler.onMove() and handler.onEnd() polymorphically — the correct
 *   concrete method is dispatched at runtime based on the actual object type.
 * ─────────────────────────────────────────────────────
 *
 * SOLID alignment:
 *   S — each subclass owns exactly one tool's behaviour
 *   O — new tools extend this class; existing classes are never modified
 *   L — every subclass is a drop-in replacement for this type
 *   I — the interface is narrow (only the methods Canvas actually needs)
 *   D — Canvas depends on this abstraction, not on any concrete handler
 */
export abstract class DrawingToolHandler {
  /**
   * ENCAPSULATION: `protected readonly` — accessible to subclasses for reading
   * tool colour/width, but cannot be reassigned or accessed from outside the
   * class hierarchy.
   */
  constructor(protected readonly tool: DrawingTool) {}

  /**
   * ABSTRACTION: Declares *what* a tool must provide (a CSS cursor string)
   * without specifying *how* each tool computes it.
   * Each concrete subclass supplies its own appropriate value.
   */
  abstract get cursor(): string;

  /**
   * ABSTRACTION: Declares whether a live path preview should be rendered
   * while the user is drawing. Pen and Highlighter return true; Eraser,
   * Lasso, and Text return false because they have no meaningful preview.
   */
  abstract get hasStrokePreview(): boolean;

  /**
   * Default move implementation: append the new point to the running path.
   * Suitable for pen, highlighter, lasso, and text (whose move is a no-op at
   * the Canvas level anyway). EraserToolHandler overrides this to also perform
   * hit-detection against existing strokes.
   *
   * POLYMORPHISM: Canvas.tsx calls this method on every pointer-move event.
   * The runtime type of `this` determines which implementation runs — the
   * default here, or the overridden version in EraserToolHandler.
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
   * Default end implementation: no-op.
   * PenToolHandler and HighlighterToolHandler override this to emit a Stroke.
   * LassoToolHandler overrides it to compute the enclosed selection.
   * EraserToolHandler relies on Canvas.tsx applying deletions incrementally
   * during onMove, so its onEnd remains a no-op.
   *
   * INHERITANCE: Subclasses that do nothing on pointer-up (TextToolHandler)
   * inherit this method and never need to override it.
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
