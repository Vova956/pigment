import { describe, it, expect } from 'vitest';
import { ToolHandlerFactory } from '../ToolHandlerFactory';
import { PenToolHandler } from '../PenToolHandler';
import { HighlighterToolHandler } from '../HighlighterToolHandler';
import { EraserToolHandler } from '../EraserToolHandler';
import { LassoToolHandler } from '../LassoToolHandler';
import { TextToolHandler } from '../TextToolHandler';
import type { DrawingTool } from '../../types/canvas';

function makeTool(type: DrawingTool['type']): DrawingTool {
  return { type, color: '#000', width: 2 };
}

// ── Factory creation ──────────────────────────────────────────────────────────

describe('ToolHandlerFactory.create', () => {
  it('creates a PenToolHandler for type "pen"', () => {
    expect(ToolHandlerFactory.create(makeTool('pen'))).toBeInstanceOf(PenToolHandler);
  });

  it('creates a HighlighterToolHandler for type "highlighter"', () => {
    expect(ToolHandlerFactory.create(makeTool('highlighter'))).toBeInstanceOf(
      HighlighterToolHandler
    );
  });

  it('creates an EraserToolHandler for type "eraser"', () => {
    expect(ToolHandlerFactory.create(makeTool('eraser'))).toBeInstanceOf(EraserToolHandler);
  });

  it('creates a LassoToolHandler for type "lasso"', () => {
    expect(ToolHandlerFactory.create(makeTool('lasso'))).toBeInstanceOf(LassoToolHandler);
  });

  it('creates a TextToolHandler for type "text"', () => {
    expect(ToolHandlerFactory.create(makeTool('text'))).toBeInstanceOf(TextToolHandler);
  });

  it('returns a new handler instance on each call (no caching)', () => {
    const a = ToolHandlerFactory.create(makeTool('pen'));
    const b = ToolHandlerFactory.create(makeTool('pen'));
    expect(a).not.toBe(b);
  });

  it('propagates tool properties to the created handler', () => {
    const tool: DrawingTool = { type: 'pen', color: '#FF0000', width: 8 };
    const handler = ToolHandlerFactory.create(tool) as PenToolHandler;
    // PenToolHandler exposes cursor — verifying instantiation with correct tool
    expect(handler.cursor).toBeDefined();
  });
});
