import { DrawingToolHandler } from './DrawingToolHandler';
import { PenToolHandler } from './PenToolHandler';
import { HighlighterToolHandler } from './HighlighterToolHandler';
import { EraserToolHandler } from './EraserToolHandler';
import { LassoToolHandler } from './LassoToolHandler';
import { TextToolHandler } from './TextToolHandler';
import type { DrawingTool } from '../types/canvas';

/**
 * Maps a {@link DrawingTool} value to its concrete {@link DrawingToolHandler}.
 *
 * ─────────────────────────────────────────────────────
 * DESIGN PATTERN: Factory Method (simplified static variant)
 * ─────────────────────────────────────────────────────
 * Role in this pattern:
 *   Creator — ToolHandlerFactory.create() is the single factory method.
 *
 * Products:
 *   PenToolHandler | HighlighterToolHandler | EraserToolHandler |
 *   LassoToolHandler | TextToolHandler
 *
 * Abstract Product:
 *   DrawingToolHandler (the type returned to all callers)
 *
 * Why Factory here?
 *   Canvas.tsx needs a different algorithm object depending on which tool the
 *   user has selected, but it should not be coupled to the concrete handler
 *   classes. The Factory centralises all construction decisions in one place:
 *
 *   • Adding a new tool (e.g. ShapeToolHandler) requires only a new case here —
 *     Canvas.tsx and every other caller remain unchanged.
 *   • The switch is an exhaustive type-guard: TypeScript will emit a compile
 *     error if a new DrawingTool type is added to the union but not handled.
 *
 * DESIGN PATTERN: Strategy (companion)
 *   This factory produces Strategy objects. See DrawingToolHandler for the
 *   full Strategy pattern documentation.
 *
 * OOP — POLYMORPHISM:
 *   The return type is the abstract `DrawingToolHandler`, not any concrete
 *   subclass. All callers receive the same type regardless of which tool is
 *   active, enabling runtime polymorphic dispatch (canvas calls onMove/onEnd
 *   on whatever handler this factory produced).
 * ─────────────────────────────────────────────────────
 */
export class ToolHandlerFactory {
  /**
   * @param tool - The active drawing tool configuration.
   * @returns A concrete handler whose behaviour matches `tool.type`.
   */
  static create(tool: DrawingTool): DrawingToolHandler {
    switch (tool.type) {
      case 'pen':         return new PenToolHandler(tool);
      case 'highlighter': return new HighlighterToolHandler(tool);
      case 'eraser':      return new EraserToolHandler(tool);
      case 'lasso':       return new LassoToolHandler(tool);
      case 'text':        return new TextToolHandler(tool);
    }
  }
}
