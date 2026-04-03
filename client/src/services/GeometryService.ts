import type { Point, Stroke } from '../types/canvas';

/**
 * Stateless geometry utilities. All methods are static (no instance needed).
 * Single Responsibility: owns all coordinate-math operations used by the canvas.
 */
export class GeometryService {
  static strokeHitsPoint(stroke: Stroke, pt: Point, radius: number): boolean {
    const r2 = radius * radius;
    return stroke.points.some(p => (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2 < r2);
  }

  static pointInPolygon(pt: Point, poly: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }

  static strokeInLasso(stroke: Stroke, lasso: Point[]): boolean {
    return lasso.length >= 3 && stroke.points.some(p => GeometryService.pointInPolygon(p, lasso));
  }

  /** Convert a mouse/touch event into SVG-local coordinates. */
  static getSvgCoords(
    e: React.MouseEvent | React.TouchEvent,
    svg: SVGSVGElement,
  ): Point | null {
    const pt = svg.createSVGPoint();
    if ('touches' in e) {
      if (!e.touches.length) return null;
      pt.x = e.touches[0].clientX;
      pt.y = e.touches[0].clientY;
    } else {
      pt.x = (e as React.MouseEvent).clientX;
      pt.y = (e as React.MouseEvent).clientY;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }

  /** Extract client-space coordinates from an event (for tooltip positioning). */
  static getClientCoords(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    if ('touches' in e) {
      return { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  }
}
