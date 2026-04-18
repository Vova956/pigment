import type { LayerData, Point, CanvasImage, CanvasText } from '../../types/canvas';
import { pointsToSvgPath, HIGHLIGHTER_OPACITY } from '../../types/canvas';

interface MiniMapProps {
  layers: Record<string, LayerData>;
  images: CanvasImage[];
  texts: CanvasText[];
  zoom: number;
  pan: Point;
  svgWidth: number;
  svgHeight: number;
}

const MINI_W = 180;
const MINI_H = 120;

export default function MiniMap({ layers, images, zoom, pan, svgWidth, svgHeight }: MiniMapProps) {
  if (!svgWidth || !svgHeight) return null;

  // World coordinate range — estimate from all stroke points
  let minX = 0, minY = 0, maxX = svgWidth, maxY = svgHeight;
  for (const layer of Object.values(layers)) {
    for (const stroke of layer.strokes) {
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }
  for (const img of images) {
    minX = Math.min(minX, img.x);
    minY = Math.min(minY, img.y);
    maxX = Math.max(maxX, img.x + img.width);
    maxY = Math.max(maxY, img.y + img.height);
  }

  // Add some padding
  const pad = 20;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const worldW = maxX - minX;
  const worldH = maxY - minY;

  // Scale to fit minimap
  const scaleX = MINI_W / worldW;
  const scaleY = MINI_H / worldH;
  const scale  = Math.min(scaleX, scaleY);

  // Viewport rect in world coords
  const vpX = pan.x;
  const vpY = pan.y;
  const vpW = svgWidth  / zoom;
  const vpH = svgHeight / zoom;

  // Convert to minimap coords
  const toMX = (x: number) => (x - minX) * scale;
  const toMY = (y: number) => (y - minY) * scale;

  return (
    <div className="mini-map" aria-label="Canvas overview">
      <svg
        width={MINI_W}
        height={MINI_H}
        viewBox={`0 0 ${MINI_W} ${MINI_H}`}
        style={{ display: 'block' }}
      >
        {/* White background */}
        <rect width={MINI_W} height={MINI_H} fill="white" rx="4" />

        {/* Images */}
        {images.map(img => (
          <rect
            key={img.id}
            x={toMX(img.x)} y={toMY(img.y)}
            width={img.width * scale} height={img.height * scale}
            fill="#cbd5e1" opacity={0.6}
          />
        ))}

        {/* Strokes */}
        {Object.values(layers).filter(l => l.visible).map(layer =>
          layer.strokes.map(stroke => (
            <path
              key={stroke.id}
              d={pointsToSvgPath(stroke.points.map(p => ({ x: toMX(p.x), y: toMY(p.y) })))}
              stroke={stroke.color}
              strokeWidth={Math.max(stroke.width * scale, 0.5)}
              strokeLinecap="round" strokeLinejoin="round"
              fill="none"
              opacity={stroke.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
            />
          ))
        )}

        {/* Viewport rectangle */}
        <rect
          x={toMX(vpX)}
          y={toMY(vpY)}
          width={vpW * scale}
          height={vpH * scale}
          fill="rgba(2,132,199,0.12)"
          stroke="#0284c7"
          strokeWidth={1.5}
          rx={2}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
}
