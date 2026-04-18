import { DrawingToolHandler, type ToolEndResult } from './DrawingToolHandler';
import type { Point, LayerData } from '../types/canvas';
import { generateId } from '../types/canvas';

export class HighlighterToolHandler extends DrawingToolHandler {
  get cursor(): string {
    return 'default';
  }
  get hasStrokePreview(): boolean {
    return true;
  }

  onEnd(
    points: Point[],
    _layers: Record<string, LayerData>,
    userId: string,
    userName: string
  ): ToolEndResult {
    if (!points.length) {
      return {};
    }
    return {
      stroke: {
        id: generateId(),
        userId,
        userName,
        points,
        color: this.tool.color,
        width: this.tool.width,
        tool: 'highlighter',
        timestamp: Date.now(),
      },
    };
  }
}
