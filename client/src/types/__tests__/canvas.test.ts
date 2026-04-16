import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateId,
  pointsToSvgPath,
  hexToRgb,
  HIGHLIGHTER_OPACITY,
  DEFAULT_COLORS,
  type Point,
  type Stroke,
  type LayerData,
} from '../canvas';

// ── generateId ────────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(generateId()).toBeTruthy();
  });

  it('returns unique IDs on successive calls', () => {
    const ids = Array.from({ length: 100 }, generateId);
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });

  it('embeds a timestamp component', () => {
    const before = Date.now();
    const id = generateId();
    const after = Date.now();
    const ts = Number(id.split('-')[0]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('contains only safe URL characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateId()).toMatch(/^[\d]+-[a-z0-9]+$/);
    }
  });
});

// ── pointsToSvgPath ───────────────────────────────────────────────────────────

describe('pointsToSvgPath', () => {
  it('returns empty string for empty array', () => {
    expect(pointsToSvgPath([])).toBe('');
  });

  it('returns a Move command for a single point', () => {
    const result = pointsToSvgPath([{ x: 10, y: 20 }]);
    expect(result).toBe('M 10 20');
  });

  it('starts path with M command at first point', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(pointsToSvgPath(pts)).toMatch(/^M 0 0/);
  });

  it('uses quadratic bezier curves for 3+ points', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
    ];
    const path = pointsToSvgPath(pts);
    expect(path).toContain('Q');
  });

  it('ends with an L command at the last point', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
    ];
    const path = pointsToSvgPath(pts);
    expect(path).toMatch(/L 10 0$/);
  });

  it('handles two-point path with L midpoint', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const path = pointsToSvgPath(pts);
    expect(path).toContain('L 5 5');
  });

  it('produces consistent output for the same input', () => {
    const pts: Point[] = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ];
    expect(pointsToSvgPath(pts)).toBe(pointsToSvgPath(pts));
  });
});

// ── hexToRgb ──────────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses black #000000', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses white #FFFFFF', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses red #FF0000', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses a mixed colour #1A2B3C', () => {
    expect(hexToRgb('#1A2B3C')).toEqual({ r: 26, g: 43, b: 60 });
  });

  it('is case-insensitive', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('accepts hex without leading #', () => {
    expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for invalid hex strings', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(hexToRgb('#GGG')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });

  it('returns null for short hex (3-digit format not supported)', () => {
    expect(hexToRgb('#FFF')).toBeNull();
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('HIGHLIGHTER_OPACITY', () => {
  it('is between 0 and 1', () => {
    expect(HIGHLIGHTER_OPACITY).toBeGreaterThan(0);
    expect(HIGHLIGHTER_OPACITY).toBeLessThan(1);
  });
});

describe('DEFAULT_COLORS', () => {
  it('contains at least one colour', () => {
    expect(DEFAULT_COLORS.length).toBeGreaterThan(0);
  });

  it('every entry is a valid hex colour', () => {
    for (const colour of DEFAULT_COLORS) {
      expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has no duplicate colours', () => {
    expect(new Set(DEFAULT_COLORS).size).toBe(DEFAULT_COLORS.length);
  });
});
