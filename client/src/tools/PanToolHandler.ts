import { DrawingToolHandler } from './DrawingToolHandler';

export class PanToolHandler extends DrawingToolHandler {
  get cursor(): string {
    return 'grab';
  }
  get hasStrokePreview(): boolean {
    return false;
  }
  // All pan logic is handled directly in Canvas.tsx — this handler is a no-op.
}
