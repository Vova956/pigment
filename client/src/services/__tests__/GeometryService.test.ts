import { describe, it, expect, vi } from 'vitest';
import { GeometryService } from '../GeometryService';
import type { Point, Stroke } from '../../types/canvas';

// ── Test data factories ───────────────────────────────────────────────────────

function makeStroke(points: Point[], overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: 'test-stroke',
    userId: 'user-1',
    userName: 'Alice',
    points,
    color: '#000',
    width: 2,
    tool: 'pen',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── strokeHitsPoint ───────────────────────────────────────────────────────────

describe('GeometryService.strokeHitsPoint', () => {
  it('returns true when a stroke point is within radius', () => {
    const stroke = makeStroke([{ x: 10, y: 10 }]);
    expect(GeometryService.strokeHitsPoint(stroke, { x: 10, y: 10 }, 5)).toBe(true);
  });

  it('returns true when point is just inside the radius', () => {
    const stroke = makeStroke([{ x: 0, y: 0 }]);
    // distance 4.9 < radius 5 → hit
    expect(GeometryService.strokeHitsPoint(stroke, { x: 4, y: 2 }, 5)).toBe(true);
  });

  it('returns false when no stroke points are within radius', () => {
    const stroke = makeStroke([{ x: 100, y: 100 }]);
    expect(GeometryService.strokeHitsPoint(stroke, { x: 0, y: 0 }, 5)).toBe(false);
  });

  it('returns false for an empty stroke', () => {
    const stroke = makeStroke([]);
    expect(GeometryService.strokeHitsPoint(stroke, { x: 0, y: 0 }, 100)).toBe(false);
  });

  it('returns true when any one of many points is in range', () => {
    const points: Point[] = [
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      { x: 5, y: 5 }, // close to origin
    ];
    const stroke = makeStroke(points);
    expect(GeometryService.strokeHitsPoint(stroke, { x: 0, y: 0 }, 10)).toBe(true);
  });

  it('uses strictly-less-than comparison (boundary is excluded)', () => {
    // distance² = 25, radius² = 25 → NOT inside (strict <)
    const stroke = makeStroke([{ x: 5, y: 0 }]);
    expect(GeometryService.strokeHitsPoint(stroke, { x: 0, y: 0 }, 5)).toBe(false);
  });
});

// ── pointInPolygon ────────────────────────────────────────────────────────────

describe('GeometryService.pointInPolygon', () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('returns true for a point clearly inside a square', () => {
    expect(GeometryService.pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside a square', () => {
    expect(GeometryService.pointInPolygon({ x: 20, y: 20 }, square)).toBe(false);
  });

  it('returns false for a point with same x but outside y range', () => {
    expect(GeometryService.pointInPolygon({ x: 5, y: 15 }, square)).toBe(false);
  });

  it('returns false for an empty polygon', () => {
    expect(GeometryService.pointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
  });

  it('works with a non-convex (L-shaped) polygon', () => {
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(GeometryService.pointInPolygon({ x: 2, y: 2 }, lShape)).toBe(true);
    expect(GeometryService.pointInPolygon({ x: 7, y: 2 }, lShape)).toBe(false);
  });
});

// ── strokeInLasso ─────────────────────────────────────────────────────────────

describe('GeometryService.strokeInLasso', () => {
  const boxLasso: Point[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ];

  it('returns true when a stroke point is inside the lasso', () => {
    const stroke = makeStroke([{ x: 10, y: 10 }]);
    expect(GeometryService.strokeInLasso(stroke, boxLasso)).toBe(true);
  });

  it('returns false when no stroke points are inside the lasso', () => {
    const stroke = makeStroke([{ x: 50, y: 50 }]);
    expect(GeometryService.strokeInLasso(stroke, boxLasso)).toBe(false);
  });

  it('returns false when lasso has fewer than 3 points', () => {
    const stroke = makeStroke([{ x: 5, y: 5 }]);
    const twoPointLasso: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(GeometryService.strokeInLasso(stroke, twoPointLasso)).toBe(false);
  });

  it('returns false when lasso is empty', () => {
    const stroke = makeStroke([{ x: 5, y: 5 }]);
    expect(GeometryService.strokeInLasso(stroke, [])).toBe(false);
  });

  it('returns true if at least one of several stroke points is inside', () => {
    const stroke = makeStroke([
      { x: 50, y: 50 }, // outside
      { x: 10, y: 10 }, // inside
    ]);
    expect(GeometryService.strokeInLasso(stroke, boxLasso)).toBe(true);
  });
});

// ── splitStrokeAtEraser ───────────────────────────────────────────────────────

describe('GeometryService.splitStrokeAtEraser', () => {
  it('returns the original stroke when nothing is erased', () => {
    const stroke = makeStroke([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const result = GeometryService.splitStrokeAtEraser(stroke, { x: 100, y: 100 }, 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(stroke);
  });

  it('returns an empty array when the whole stroke is erased', () => {
    const stroke = makeStroke([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    const result = GeometryService.splitStrokeAtEraser(stroke, { x: 0, y: 0 }, 50);
    expect(result).toEqual([]);
  });

  it('splits the stroke into two sub-strokes when the middle is erased', () => {
    const stroke = makeStroke([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 50, y: 0 }, // erased
      { x: 51, y: 0 }, // erased
      { x: 100, y: 0 },
      { x: 101, y: 0 },
    ]);
    const result = GeometryService.splitStrokeAtEraser(stroke, { x: 50, y: 0 }, 5);
    expect(result).toHaveLength(2);
    expect(result[0].points).toHaveLength(2);
    expect(result[1].points).toHaveLength(2);
  });

  it('assigns fresh IDs to sub-strokes (different from the original)', () => {
    const stroke = makeStroke(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 50, y: 0 }, // erased
        { x: 100, y: 0 },
        { x: 101, y: 0 },
      ],
      { id: 'original-id' }
    );
    const result = GeometryService.splitStrokeAtEraser(stroke, { x: 50, y: 0 }, 5);
    for (const sub of result) {
      expect(sub.id).not.toBe('original-id');
    }
  });

  it('discards run fragments that contain fewer than 2 points', () => {
    const stroke = makeStroke([
      { x: 0, y: 0 }, // outside (1 point → discarded)
      { x: 50, y: 0 }, // erased
      { x: 100, y: 0 },
      { x: 101, y: 0 }, // outside (2 points → kept)
    ]);
    const result = GeometryService.splitStrokeAtEraser(stroke, { x: 50, y: 0 }, 5);
    expect(result).toHaveLength(1);
    expect(result[0].points).toEqual([
      { x: 100, y: 0 },
      { x: 101, y: 0 },
    ]);
  });
});

// ── getSvgCoords ──────────────────────────────────────────────────────────────

describe('GeometryService.getSvgCoords', () => {
  function makeSvg() {
    const matrix = { inverse: vi.fn().mockReturnValue({ dummy: true }) };
    const pt = {
      x: 0,
      y: 0,
      matrixTransform: vi.fn().mockReturnValue({ x: 10, y: 20 }),
    };
    const svg = {
      createSVGPoint: vi.fn().mockReturnValue(pt),
      getScreenCTM: vi.fn().mockReturnValue(matrix),
    } as unknown as SVGSVGElement;
    return { svg, pt };
  }

  it('returns null when getScreenCTM is null', () => {
    const svg = {
      createSVGPoint: vi.fn().mockReturnValue({ x: 0, y: 0, matrixTransform: vi.fn() }),
      getScreenCTM: vi.fn().mockReturnValue(null),
    } as unknown as SVGSVGElement;

    const event = { clientX: 5, clientY: 10 } as unknown as React.MouseEvent;
    expect(GeometryService.getSvgCoords(event, svg)).toBeNull();
  });

  it('returns null for a touch event with no touches', () => {
    const { svg } = makeSvg();
    const event = { touches: [] } as unknown as React.TouchEvent;
    expect(GeometryService.getSvgCoords(event, svg)).toBeNull();
  });

  it('returns transformed coordinates for a mouse event', () => {
    const { svg, pt } = makeSvg();
    const event = { clientX: 100, clientY: 200 } as unknown as React.MouseEvent;
    const result = GeometryService.getSvgCoords(event, svg);
    expect(pt.x).toBe(100);
    expect(pt.y).toBe(200);
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('uses the first touch for touch events', () => {
    const { svg, pt } = makeSvg();
    const event = {
      touches: [{ clientX: 50, clientY: 75 }],
    } as unknown as React.TouchEvent;
    const result = GeometryService.getSvgCoords(event, svg);
    expect(pt.x).toBe(50);
    expect(pt.y).toBe(75);
    expect(result).toEqual({ x: 10, y: 20 });
  });
});

// ── getClientCoords ───────────────────────────────────────────────────────────

describe('GeometryService.getClientCoords', () => {
  it('returns client coordinates from a mouse event', () => {
    const event = { clientX: 123, clientY: 456 } as unknown as React.MouseEvent;
    expect(GeometryService.getClientCoords(event)).toEqual({ x: 123, y: 456 });
  });

  it('returns client coordinates from a touch event', () => {
    const event = {
      touches: [{ clientX: 12, clientY: 34 }],
    } as unknown as React.TouchEvent;
    expect(GeometryService.getClientCoords(event)).toEqual({ x: 12, y: 34 });
  });

  it('returns { x: 0, y: 0 } for a touch event with no touches', () => {
    const event = { touches: [] } as unknown as React.TouchEvent;
    expect(GeometryService.getClientCoords(event)).toEqual({ x: 0, y: 0 });
  });
});
