import { describe, it, expect } from 'vitest';
import { PenToolHandler } from '../PenToolHandler';
import { HighlighterToolHandler } from '../HighlighterToolHandler';
import { EraserToolHandler } from '../EraserToolHandler';
import { LassoToolHandler } from '../LassoToolHandler';
import { TextToolHandler } from '../TextToolHandler';
import type { DrawingTool, LayerData, Point, Stroke } from '../../types/canvas';

// ── Shared test data ──────────────────────────────────────────────────────────

function makeTool(type: DrawingTool['type'], overrides: Partial<DrawingTool> = {}): DrawingTool {
  return { type, color: '#FF0000', width: 4, ...overrides };
}

function makeStroke(points: Point[]): Stroke {
  return {
    id: 'stroke-1',
    userId: 'user-1',
    userName: 'Alice',
    points,
    color: '#000',
    width: 2,
    tool: 'pen',
    timestamp: Date.now(),
  };
}

function makeLayers(strokes: Stroke[]): Record<string, LayerData> {
  return {
    'user-1': { userName: 'Alice', visible: true, strokes },
  };
}

const emptyLayers: Record<string, LayerData> = {};

// ── PenToolHandler ────────────────────────────────────────────────────────────

describe('PenToolHandler', () => {
  const handler = new PenToolHandler(makeTool('pen'));

  it('has cursor "default"', () => {
    expect(handler.cursor).toBe('default');
  });

  it('has stroke preview enabled', () => {
    expect(handler.hasStrokePreview).toBe(true);
  });

  it('onEnd returns empty object for empty points', () => {
    expect(handler.onEnd([], emptyLayers, 'u1', 'Alice')).toEqual({});
  });

  it('onEnd returns a stroke with correct shape', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const result = handler.onEnd(points, emptyLayers, 'user-1', 'Alice');

    expect(result.stroke).toBeDefined();
    expect(result.stroke!.tool).toBe('pen');
    expect(result.stroke!.points).toEqual(points);
    expect(result.stroke!.userId).toBe('user-1');
    expect(result.stroke!.userName).toBe('Alice');
    expect(result.stroke!.color).toBe('#FF0000');
    expect(result.stroke!.width).toBe(4);
  });

  it('onEnd assigns a unique ID each call', () => {
    const points: Point[] = [{ x: 0, y: 0 }];
    const r1 = handler.onEnd(points, emptyLayers, 'u1', 'Alice');
    const r2 = handler.onEnd(points, emptyLayers, 'u1', 'Alice');
    expect(r1.stroke!.id).not.toBe(r2.stroke!.id);
  });

  it('onMove appends the new point', () => {
    const current: Point[] = [{ x: 0, y: 0 }];
    const result = handler.onMove({ x: 5, y: 5 }, current, emptyLayers, new Set());
    expect(result.newPoints).toHaveLength(2);
    expect(result.newPoints[1]).toEqual({ x: 5, y: 5 });
  });
});

// ── HighlighterToolHandler ────────────────────────────────────────────────────

describe('HighlighterToolHandler', () => {
  const handler = new HighlighterToolHandler(makeTool('highlighter'));

  it('has cursor "default"', () => {
    expect(handler.cursor).toBe('default');
  });

  it('has stroke preview enabled', () => {
    expect(handler.hasStrokePreview).toBe(true);
  });

  it('onEnd returns empty object for empty points', () => {
    expect(handler.onEnd([], emptyLayers, 'u1', 'Alice')).toEqual({});
  });

  it('onEnd returns a stroke with tool type "highlighter"', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 20 },
    ];
    const result = handler.onEnd(points, emptyLayers, 'user-1', 'Alice');

    expect(result.stroke!.tool).toBe('highlighter');
    expect(result.stroke!.color).toBe('#FF0000');
  });
});

// ── EraserToolHandler ─────────────────────────────────────────────────────────

describe('EraserToolHandler', () => {
  const handler = new EraserToolHandler(makeTool('eraser', { width: 4 }));

  it('has cursor "cell"', () => {
    expect(handler.cursor).toBe('cell');
  });

  it('has stroke preview disabled', () => {
    expect(handler.hasStrokePreview).toBe(false);
  });

  it('onMove returns empty newlyErasedIds when no strokes are hit', () => {
    const layers = makeLayers([makeStroke([{ x: 100, y: 100 }])]);
    const result = handler.onMove({ x: 0, y: 0 }, [], layers, new Set());
    expect(result.newlyErasedIds).toHaveLength(0);
  });

  it('onMove returns strokes that the eraser radius hits', () => {
    const layers = makeLayers([makeStroke([{ x: 5, y: 5 }])]);
    const result = handler.onMove({ x: 5, y: 5 }, [], layers, new Set());
    expect(result.newlyErasedIds).toContain('stroke-1');
  });

  it('onMove skips strokes already erased this gesture', () => {
    const layers = makeLayers([makeStroke([{ x: 5, y: 5 }])]);
    const alreadyErased = new Set(['stroke-1']);
    const result = handler.onMove({ x: 5, y: 5 }, [], layers, alreadyErased);
    expect(result.newlyErasedIds).not.toContain('stroke-1');
  });

  it('uses at least 8px radius regardless of tool width', () => {
    const narrowHandler = new EraserToolHandler(makeTool('eraser', { width: 1 }));
    // At width=1, radius=max(1,8)=8, so a stroke at distance 7 should be hit
    const layers = makeLayers([makeStroke([{ x: 7, y: 0 }])]);
    const result = narrowHandler.onMove({ x: 0, y: 0 }, [], layers, new Set());
    expect(result.newlyErasedIds).toContain('stroke-1');
  });

  it('appends the current point to newPoints', () => {
    const result = handler.onMove({ x: 3, y: 7 }, [{ x: 0, y: 0 }], emptyLayers, new Set());
    expect(result.newPoints).toHaveLength(2);
    expect(result.newPoints[1]).toEqual({ x: 3, y: 7 });
  });
});

// ── LassoToolHandler ──────────────────────────────────────────────────────────

describe('LassoToolHandler', () => {
  const handler = new LassoToolHandler(makeTool('lasso'));

  it('has cursor "crosshair"', () => {
    expect(handler.cursor).toBe('crosshair');
  });

  it('has stroke preview disabled', () => {
    expect(handler.hasStrokePreview).toBe(false);
  });

  it('onEnd returns empty result for fewer than 3 points', () => {
    expect(handler.onEnd([], emptyLayers, 'u1', 'Alice')).toEqual({});
    expect(
      handler.onEnd(
        [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
        emptyLayers,
        'u1',
        'Alice'
      )
    ).toEqual({});
  });

  it('onEnd selects strokes inside the lasso polygon', () => {
    const boxLasso: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    const layers = makeLayers([makeStroke([{ x: 10, y: 10 }])]);
    const result = handler.onEnd(boxLasso, layers, 'u1', 'Alice');
    expect(result.lassoSelection).toBeInstanceOf(Set);
    expect(result.lassoSelection!.has('stroke-1')).toBe(true);
  });

  it('onEnd does not select strokes outside the lasso polygon', () => {
    const boxLasso: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ];
    const layers = makeLayers([makeStroke([{ x: 50, y: 50 }])]);
    const result = handler.onEnd(boxLasso, layers, 'u1', 'Alice');
    expect(result.lassoSelection!.size).toBe(0);
  });

  it('onEnd returns an empty Set when no strokes exist', () => {
    const boxLasso: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    const result = handler.onEnd(boxLasso, emptyLayers, 'u1', 'Alice');
    expect(result.lassoSelection!.size).toBe(0);
  });
});

// ── TextToolHandler ───────────────────────────────────────────────────────────

describe('TextToolHandler', () => {
  const handler = new TextToolHandler(makeTool('text'));

  it('has cursor "text"', () => {
    expect(handler.cursor).toBe('text');
  });

  it('has stroke preview disabled', () => {
    expect(handler.hasStrokePreview).toBe(false);
  });

  it('onMove delegates to base class and appends the point', () => {
    const current: Point[] = [{ x: 0, y: 0 }];
    const result = handler.onMove({ x: 5, y: 5 }, current, emptyLayers, new Set());
    expect(result.newPoints).toHaveLength(2);
  });

  it('onEnd returns empty result (text placement is handled by Canvas)', () => {
    const result = handler.onEnd([{ x: 0, y: 0 }], emptyLayers, 'u1', 'Alice');
    expect(result).toEqual({});
  });
});
