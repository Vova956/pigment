import { DrawingToolHandler, type ToolMoveResult } from './DrawingToolHandler';
import type { Point, LayerData } from '../types/canvas';
import { GeometryService } from '../services/GeometryService';

export class EraserToolHandler extends DrawingToolHandler {
  get cursor(): string {
    return 'none';
  }
  get hasStrokePreview(): boolean {
    return false;
  }

  override onMove(
    pt: Point,
    currentPoints: Point[],
    layers: Record<string, LayerData>,
    erasedThisGesture: ReadonlySet<string>
  ): ToolMoveResult {
    const radius = Math.max(this.tool.width, 8);
    const newlyErasedIds: string[] = [];

    for (const layer of Object.values(layers)) {
      for (const stroke of layer.strokes) {
        if (erasedThisGesture.has(stroke.id)) {
          continue;
        }
        if (GeometryService.strokeHitsPoint(stroke, pt, radius)) {
          newlyErasedIds.push(stroke.id);
        }
      }
    }

    return { newPoints: [...currentPoints, pt], newlyErasedIds };
  }
}
