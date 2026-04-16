import type { RefObject } from 'react';
import type { Point, Stroke, DrawingTool, User, LayerData, CanvasImage, CanvasText } from '../../types/canvas';
import { pointsToSvgPath, HIGHLIGHTER_OPACITY } from '../../types/canvas';

interface HoverInfo {
  userName: string;
  x: number;
  y: number;
}

interface CanvasDrawingSurfaceProps {
  svgRef: RefObject<SVGSVGElement>;
  images: CanvasImage[];
  texts: CanvasText[];
  layers: Record<string, LayerData>;
  soloUserId: string | null;
  selectedIds: Set<string>;
  currentStroke: Point[];
  lassoPoints: Point[];
  isDrawing: boolean;
  tool: DrawingTool;
  activeUsers: User[];
  hoverInfo: HoverInfo | null;
  cursorClass: string;
  connected: boolean;
  cursorPos: Point | null;
  totalStrokes: number;
  selectedCount: number;
  onDeleteSelected: () => void;
  onMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent<SVGSVGElement>) => void;
  onTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void;
  onImageMouseDown: (imageId: string, e: React.MouseEvent<SVGImageElement>) => void;
}

function StrokeLayer({ strokes, selectedIds }: { strokes: Stroke[]; selectedIds: Set<string> }) {
  return (
    <>
      {strokes.map(stroke => {
        const d = pointsToSvgPath(stroke.points);
        const isSelected = selectedIds.has(stroke.id);
        return (
          <g key={stroke.id}>
            {isSelected && (
              <path
                d={d}
                stroke="#0284c7" strokeWidth={stroke.width + 8}
                strokeLinecap="round" strokeLinejoin="round"
                fill="none" opacity={0.35}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <path
              d={d}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round" strokeLinejoin="round"
              fill="none"
              opacity={stroke.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </>
  );
}

export default function CanvasDrawingSurface({
  svgRef,
  images,
  texts,
  layers,
  soloUserId,
  selectedIds,
  currentStroke,
  lassoPoints,
  isDrawing,
  tool,
  activeUsers,
  hoverInfo,
  cursorClass,
  connected,
  cursorPos,
  totalStrokes,
  selectedCount,
  onDeleteSelected,
  onMouseDown,
  onMouseMove,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onImageMouseDown,
}: CanvasDrawingSurfaceProps) {
  return (
    <>
      {/* ── Drawing workspace ── */}
      <div className="canvas-workspace">
        <div className="canvas-bg-pattern" />
        <svg
          ref={svgRef}
          className="canvas-svg"
          style={{ cursor: cursorClass }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          preserveAspectRatio="xMidYMid slice"
        >
          <rect width="100%" height="100%" fill="white" />

          {/* Uploaded images — rendered below all strokes */}
          {images.map(img => (
            <image
              key={img.id}
              href={img.dataUrl}
              x={img.x}
              y={img.y}
              width={img.width}
              height={img.height}
              style={{ cursor: 'move' }}
              onMouseDown={e => onImageMouseDown(img.id, e)}
            />
          ))}

          {/* Text elements — above images, below strokes */}
          {texts.map(ct => (
            <text
              key={ct.id}
              x={ct.x}
              y={ct.y}
              fontSize={ct.fontSize}
              fill={ct.color}
              fontFamily="sans-serif"
              dominantBaseline="hanging"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {ct.text}
            </text>
          ))}

          {/* Committed strokes per user layer */}
          {Object.entries(layers).map(([uid, layer]) => {
            if (soloUserId ? uid !== soloUserId : !layer.visible) return null;
            return <StrokeLayer key={uid} strokes={layer.strokes} selectedIds={selectedIds} />;
          })}

          {/* Live preview — pen / highlighter */}
          {isDrawing && currentStroke.length > 0 && tool.type !== 'eraser' && tool.type !== 'lasso' && (
            <path
              d={pointsToSvgPath(currentStroke)}
              stroke={tool.color}
              strokeWidth={tool.width}
              strokeLinecap="round" strokeLinejoin="round"
              fill="none"
              opacity={tool.type === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Lasso preview */}
          {lassoPoints.length > 1 && (
            <polyline
              points={lassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(2,132,199,0.07)"
              stroke="#0284c7" strokeWidth="1.5"
              strokeDasharray="5 3" strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Remote user cursors */}
          {activeUsers.map(u => u.cursor && (
            <g key={u.id}>
              <circle cx={u.cursor.x} cy={u.cursor.y} r="5" fill={u.color} opacity={0.85} />
              <text
                x={u.cursor.x + 8} y={u.cursor.y - 7}
                fill={u.color} fontSize="11" fontFamily="sans-serif" fontWeight="600"
              >
                {u.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover attribution tooltip — fixed so it can escape SVG bounds */}
        {hoverInfo && !isDrawing && (
          <div className="hover-tooltip" style={{ left: hoverInfo.x + 14, top: hoverInfo.y - 34 }}>
            {hoverInfo.userName}
          </div>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="stats-bar">
        <div className="stat">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          {tool.type[0].toUpperCase() + tool.type.slice(1)}
        </div>
        {cursorPos && <div className="stat">X:{Math.round(cursorPos.x)} Y:{Math.round(cursorPos.y)}</div>}
        <div className="stat">Strokes: {totalStrokes}</div>
        {selectedCount > 0 && (
          <div className="stat" style={{ color: '#0284c7' }}>{selectedCount} selected · Del to delete</div>
        )}
        <div className="stat">
          <span className="status-mini-dot" style={{ background: connected ? '#22c55e' : '#ef4444' }} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>
    </>
  );
}
