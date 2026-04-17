import { describe, it, expect } from 'vitest';
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
