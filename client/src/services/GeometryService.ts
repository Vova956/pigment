import type { Point, Stroke } from '../types/canvas';
import { generateId } from '../types/canvas';

/**
 * Stateless geometry utilities for the canvas.
 *
 * ─────────────────────────────────────────────────────
 * OOP — ABSTRACTION
 * ─────────────────────────────────────────────────────
 * This class abstracts coordinate-math complexity behind a clean, domain-
 * level API. Callers (Canvas.tsx, EraserToolHandler, LassoToolHandler) think
 * in terms of "does this stroke hit this point?" or "is this point inside
 * this polygon?" — they never deal with the underlying ray-casting algorithm
 * or SVG matrix transforms directly.
 *
 * All methods are `static` because the service is purely functional:
 * no instance state is needed, no object lifecycle to manage.
 * Callers never construct a GeometryService — they call the class directly.
 *
 * Single Responsibility: this class owns all coordinate-math operations
 * and nothing else.
 * ─────────────────────────────────────────────────────
 */
export class GeometryService {
  /**
   * Returns true if any point of {@link stroke} lies within {@link radius}
   * pixels of {@link pt} (exclusive — boundary is not counted as a hit).
   *
   * Used by EraserToolHandler to detect which strokes the eraser tip overlaps.
   */
  static strokeHitsPoint(stroke: Stroke, pt: Point, radius: number): boolean {
    const r2 = radius * radius;
    // Strict less-than: touching the boundary does NOT count as a hit.
    return stroke.points.some((p) => (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2 < r2);
  }

  /**
   * Ray-casting algorithm: returns true when {@link pt} is strictly inside
   * the closed polygon defined by {@link poly}.
   *
   * ABSTRACTION: callers never see the ray-casting logic; they just ask
   * "is this point inside this polygon?"
   */
  static pointInPolygon(pt: Point, poly: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y;
      const xj = poly[j].x,
        yj = poly[j].y;
      if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  /**
   * Returns true when at least one point of {@link stroke} lies inside the
   * lasso polygon. Requires at least 3 lasso points to form a valid polygon.
   */
  static strokeInLasso(stroke: Stroke, lasso: Point[]): boolean {
    return lasso.length >= 3 && stroke.points.some((p) => GeometryService.pointInPolygon(p, lasso));
  }

  /**
   * Converts a pointer event into SVG-local coordinates using the element's
   * current transformation matrix.
   *
   * ABSTRACTION: hides the browser-specific `getScreenCTM` / `matrixTransform`
   * API behind a simple Point-or-null return value.
   *
   * @returns The SVG-space point, or `null` if the transform is unavailable
   *          or the touch list is empty.
   */
  static getSvgCoords(e: React.MouseEvent | React.TouchEvent, svg: SVGSVGElement): Point | null {
    const pt = svg.createSVGPoint();
    if ('touches' in e) {
      if (!e.touches.length) {
        return null;
      }
      pt.x = e.touches[0].clientX;
      pt.y = e.touches[0].clientY;
    } else {
      pt.x = e.clientX;
      pt.y = e.clientY;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return null;
    }
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }

  /**
   * Splits a stroke into sub-strokes by removing points that fall within
   * `radius` of `eraserCenter`. Consecutive outside-points form new strokes.
   * Returns an empty array if the entire stroke is within the eraser.
   * Returns the original (unchanged) stroke in a one-element array if nothing is erased.
   *
   * Requires at least 2 remaining points to form a valid sub-stroke.
   */
  static splitStrokeAtEraser(stroke: Stroke, eraserCenter: Point, radius: number): Stroke[] {
    const r2 = radius * radius;
    const inside = stroke.points.map(
      (p) => (p.x - eraserCenter.x) ** 2 + (p.y - eraserCenter.y) ** 2 < r2
    );

    // If nothing is erased, return unchanged
    if (!inside.some(Boolean)) {
      return [stroke];
    }
    // If everything is erased, return empty
    if (inside.every(Boolean)) {
      return [];
    }

    // Collect consecutive outside runs → sub-strokes
    const subStrokes: Stroke[] = [];
    let run: Point[] = [];
    for (let i = 0; i < stroke.points.length; i++) {
      if (!inside[i]) {
        run.push(stroke.points[i]);
      } else {
        if (run.length >= 2) {
          subStrokes.push({ ...stroke, id: generateId(), points: run, timestamp: Date.now() });
        }
        run = [];
      }
    }
    if (run.length >= 2) {
      subStrokes.push({ ...stroke, id: generateId(), points: run, timestamp: Date.now() });
    }
    return subStrokes;
  }

  /**
   * Extracts client-space (viewport) coordinates from a pointer event.
   * Used for tooltip positioning where SVG-space coordinates are not needed.
   */
  static getClientCoords(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    if ('touches' in e) {
      return { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
    }
    return { x: e.clientX, y: e.clientY };
  }
}
