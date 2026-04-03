import { DrawingToolHandler, type ToolEndResult } from './DrawingToolHandler';
import type { Point, LayerData } from '../types/canvas';
import { GeometryService } from '../services/GeometryService';

export class LassoToolHandler extends DrawingToolHandler {
  get cursor(): string { return 'crosshair'; }
  get hasStrokePreview(): boolean { return false; }

  /**
   * On pointer-up, compute which strokes fall inside the lasso polygon.
   */
  override onEnd(
    points: Point[],
    layers: Record<string, LayerData>,
    _userId: string,
    _userName: string,
  ): ToolEndResult {
    if (points.length < 3) return {};
    const selection = new Set<string>();
    for (const layer of Object.values(layers))
      for (const stroke of layer.strokes)
        if (GeometryService.strokeInLasso(stroke, points)) selection.add(stroke.id);
    return { lassoSelection: selection };
  }
}
