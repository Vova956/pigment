import { DrawingToolHandler } from './DrawingToolHandler';

/**
 * Text tool handler.
 *
 * Text placement doesn't follow the stroke pointer-down → move → up flow,
 * so onMove and onEnd are intentionally no-ops here. The Canvas component
 * intercepts pointer-down for this tool and opens the text input overlay.
 */
export class TextToolHandler extends DrawingToolHandler {
  get cursor(): string {
    return 'text';
  }
  get hasStrokePreview(): boolean {
    return false;
  }
}
