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

export default function MiniMap({
  layers,
  images,
  texts,
  zoom,
  pan,
  svgWidth,
  svgHeight,
}: MiniMapProps) {
  if (!svgWidth || !svgHeight) {
    return null;
  }

  // Viewport extent in world coords — always included so the red rect stays on-map
  const vpX = pan.x;
  const vpY = pan.y;
  const vpW = svgWidth / zoom;
  const vpH = svgHeight / zoom;

  // World coordinate range — seed with the original canvas rect AND the current viewport,
  // then expand to cover all content (strokes, images, texts).
  let minX = Math.min(0, vpX);
  let minY = Math.min(0, vpY);
  let maxX = Math.max(svgWidth, vpX + vpW);
  let maxY = Math.max(svgHeight, vpY + vpH);
  for (const layer of Object.values(layers)) {
    for (const stroke of layer.strokes) {
      for (const p of stroke.points) {
        if (p.x < minX) {
          minX = p.x;
        }
        if (p.y < minY) {
          minY = p.y;
        }
        if (p.x > maxX) {
          maxX = p.x;
        }
        if (p.y > maxY) {
          maxY = p.y;
        }
      }
    }
  }
  for (const img of images) {
    minX = Math.min(minX, img.x);
    minY = Math.min(minY, img.y);
    maxX = Math.max(maxX, img.x + img.width);
    maxY = Math.max(maxY, img.y + img.height);
  }
  for (const t of texts) {
    // Estimate width so horizontally-long texts aren't clipped on the minimap
    const estW = t.text.length * t.fontSize * 0.6;
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + estW);
    maxY = Math.max(maxY, t.y + t.fontSize);
  }

  // Add some padding
  const pad = 20;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const worldW = maxX - minX;
  const worldH = maxY - minY;

  // Scale to fit minimap
  const scaleX = MINI_W / worldW;
  const scaleY = MINI_H / worldH;
  const scale = Math.min(scaleX, scaleY);

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
        {images.map((img) => (
          <rect
            key={img.id}
            x={toMX(img.x)}
            y={toMY(img.y)}
            width={img.width * scale}
            height={img.height * scale}
            fill="#cbd5e1"
            opacity={0.6}
          />
        ))}

        {/* Texts — shown as small marker dots */}
        {texts.map((t) => (
          <circle key={t.id} cx={toMX(t.x)} cy={toMY(t.y)} r={1.5} fill={t.color} opacity={0.7} />
        ))}

        {/* Strokes */}
        {Object.values(layers)
          .filter((l) => l.visible)
          .map((layer) =>
            layer.strokes.map((stroke) => (
              <path
                key={stroke.id}
                d={pointsToSvgPath(stroke.points.map((p) => ({ x: toMX(p.x), y: toMY(p.y) })))}
                stroke={stroke.color}
                strokeWidth={Math.max(stroke.width * scale, 0.5)}
                strokeLinecap="round"
                strokeLinejoin="round"
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
