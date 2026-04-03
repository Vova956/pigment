import { DrawingToolHandler } from './DrawingToolHandler';
import { PenToolHandler } from './PenToolHandler';
import { HighlighterToolHandler } from './HighlighterToolHandler';
import { EraserToolHandler } from './EraserToolHandler';
import { LassoToolHandler } from './LassoToolHandler';
import type { DrawingTool } from '../types/canvas';

/**
 * Factory that maps a DrawingTool value to its handler.
 *
 * Open/Closed: register new tools here without touching Canvas.tsx.
 */
export class ToolHandlerFactory {
  static create(tool: DrawingTool): DrawingToolHandler {
    switch (tool.type) {
      case 'pen':         return new PenToolHandler(tool);
      case 'highlighter': return new HighlighterToolHandler(tool);
      case 'eraser':      return new EraserToolHandler(tool);
      case 'lasso':       return new LassoToolHandler(tool);
    }
  }
}
