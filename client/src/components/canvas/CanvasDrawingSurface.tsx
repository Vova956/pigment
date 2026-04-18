import type { RefObject } from 'react';
import type { Point, Stroke, DrawingTool, User, LayerData, CanvasImage, CanvasText } from '../../types/canvas';
import { pointsToSvgPath, HIGHLIGHTER_OPACITY } from '../../types/canvas';
import MiniMap from './MiniMap';

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
  zoom: number;
  pan: Point;
  selectionDragOffset: { dx: number; dy: number } | null;
  showMiniMap?: boolean;
  onDeleteSelected: () => void;
  onMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent<SVGSVGElement>) => void;
  onTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void;
  onImageMouseDown: (imageId: string, e: React.MouseEvent<SVGImageElement>) => void;
  onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
  onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void;
}

interface StrokeLayerProps {
  strokes: Stroke[];
  selectedIds: Set<string>;
  zoom: number;
  selectionDragOffset: { dx: number; dy: number } | null;
}

function StrokeLayer({ strokes, selectedIds, zoom, selectionDragOffset }: StrokeLayerProps) {
  return (
    <>
      {strokes.map(stroke => {
        const isDragged = selectionDragOffset && selectedIds.has(stroke.id);
        const pts = isDragged
          ? stroke.points.map(p => ({ x: p.x + selectionDragOffset.dx, y: p.y + selectionDragOffset.dy }))
          : stroke.points;
        const d = pointsToSvgPath(pts);
        const isSelected = selectedIds.has(stroke.id);
        const sw = stroke.width / zoom;
        return (
          <g key={stroke.id}>
            {isSelected && (
              <path
                data-export-exclude="true"
                d={d}
                stroke="#0284c7" strokeWidth={sw + 8 / zoom}
                strokeLinecap="round" strokeLinejoin="round"
                fill="none" opacity={0.35}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <path
              d={d}
              stroke={stroke.color}
              strokeWidth={sw}
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
  zoom,
  pan,
  selectionDragOffset,
  showMiniMap,
  onDeleteSelected,
  onMouseDown,
  onMouseMove,
  onMouseLeave,
  onTouchStart,
  onTouchMove,
  onImageMouseDown,
  onWheel,
  onContextMenu,
}: CanvasDrawingSurfaceProps) {
  // Compute viewBox: when zoom=1 and pan=(0,0) the SVG fills naturally;
  // otherwise we scale around the pan origin.  svgRef may be null on first render.
  const el = svgRef.current;
  const vbW = el ? el.clientWidth  / zoom : undefined;
  const vbH = el ? el.clientHeight / zoom : undefined;
  const viewBoxStr = vbW != null && vbH != null
    ? `${pan.x} ${pan.y} ${vbW} ${vbH}`
    : undefined;

  return (
    <>
      {/* ── Drawing workspace ── */}
      <div className="canvas-workspace">
        <div className="canvas-bg-pattern" />
        <svg
          ref={svgRef}
          className="canvas-svg"
          style={{ cursor: cursorClass }}
          viewBox={viewBoxStr}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onWheel={onWheel}
          onContextMenu={onContextMenu}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Infinite white background that follows pan/zoom */}
          <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />

          {/* Uploaded images */}
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

          {/* Text elements — fontSize in SVG units, scales naturally with zoom */}
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
            return (
              <StrokeLayer
                key={uid}
                strokes={layer.strokes}
                selectedIds={selectedIds}
                zoom={zoom}
                selectionDragOffset={selectionDragOffset}
              />
            );
          })}

          {/* Live preview — pen / highlighter */}
          {isDrawing && currentStroke.length > 0 && tool.type !== 'eraser' && tool.type !== 'lasso' && (
            <path
              d={pointsToSvgPath(currentStroke)}
              stroke={tool.color}
              strokeWidth={tool.width / zoom}
              strokeLinecap="round" strokeLinejoin="round"
              fill="none"
              opacity={tool.type === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Lasso preview (own) */}
          {lassoPoints.length > 1 && (
            <polyline
              data-export-exclude="true"
              points={lassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(2,132,199,0.07)"
              stroke="#0284c7" strokeWidth={1.5 / zoom}
              strokeDasharray={`${5 / zoom} ${3 / zoom}`} strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Eraser circle preview — follows cursor, shows actual eraser radius */}
          {tool.type === 'eraser' && cursorPos && (
            <g data-export-exclude="true" style={{ pointerEvents: 'none' }}>
              <circle
                cx={cursorPos.x}
                cy={cursorPos.y}
                r={Math.max(tool.width, 8) / zoom}
                fill="rgba(239,68,68,0.08)"
                stroke="#ef4444"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`}
              />
            </g>
          )}

          {/* Remote user selections — ghost outline in that user's color */}
          {activeUsers.map(u => {
            const sel = u.selectedStrokeIds;
            if (!sel?.length) return null;
            const selSet = new Set(sel);
            const strokesToOutline: Stroke[] = [];
            for (const layer of Object.values(layers)) {
              if (soloUserId ? layer.userId !== soloUserId : !layer.visible) continue;
              for (const s of layer.strokes) if (selSet.has(s.id)) strokesToOutline.push(s);
            }
            if (!strokesToOutline.length) return null;
            return (
              <g key={`rselect-${u.id}`} data-export-exclude="true" style={{ pointerEvents: 'none' }}>
                {strokesToOutline.map(s => (
                  <path
                    key={s.id}
                    d={pointsToSvgPath(s.points)}
                    stroke={u.color}
                    strokeWidth={(s.width + 6) / zoom}
                    strokeLinecap="round" strokeLinejoin="round"
                    fill="none" opacity={0.3}
                  />
                ))}
              </g>
            );
          })}

          {/* Remote user lasso previews */}
          {activeUsers.map(u => u.lassoPoints && u.lassoPoints.length > 1 && (
            <g key={`lasso-${u.id}`} data-export-exclude="true">
              <polyline
                points={u.lassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill={`${u.color}18`}
                stroke={u.color} strokeWidth={1.5 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`} strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
              />
              <text
                x={u.lassoPoints[0].x + 6 / zoom}
                y={u.lassoPoints[0].y - 6 / zoom}
                fill={u.color}
                fontSize={11 / zoom}
                fontFamily="sans-serif"
                fontWeight="600"
                style={{ pointerEvents: 'none' }}
              >
                {u.name} selecting…
              </text>
            </g>
          ))}

          {/* Remote user cursors — excluded from export */}
          {activeUsers.map(u => u.cursor && (
            <g key={u.id} data-export-exclude="true">
              <circle cx={u.cursor.x} cy={u.cursor.y} r={5 / zoom} fill={u.color} opacity={0.85} />
              <text
                x={u.cursor.x + 8 / zoom} y={u.cursor.y - 7 / zoom}
                fill={u.color} fontSize={11 / zoom} fontFamily="sans-serif" fontWeight="600"
              >
                {u.name}
                {u.permission === 'viewer' && ' 👁'}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover attribution tooltip */}
        {hoverInfo && !isDrawing && (
          <div className="hover-tooltip" style={{ left: hoverInfo.x + 14, top: hoverInfo.y - 34 }}>
            {hoverInfo.userName}
          </div>
        )}

        {/* Mini-map overlay (shown when zoomed or panning) */}
        {showMiniMap && (
          <MiniMap
            layers={layers}
            images={images}
            texts={texts}
            zoom={zoom}
            pan={pan}
            svgWidth={svgRef.current?.clientWidth ?? 0}
            svgHeight={svgRef.current?.clientHeight ?? 0}
          />
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
        {zoom !== 1 && <div className="stat stat--zoom">{Math.round(zoom * 100)}% <span className="stat-hint">(Ctrl+scroll, Ctrl+0)</span></div>}
        {selectedCount > 0 && (
          <div className="stat" style={{ color: '#0284c7' }}>
            {selectedCount} selected · Del or right-click to delete
          </div>
        )}
        <div className="stat">
          <span className="status-mini-dot" style={{ background: connected ? '#22c55e' : '#ef4444' }} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>
    </>
  );
}
