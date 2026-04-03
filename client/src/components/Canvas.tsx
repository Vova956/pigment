import { useEffect, useState, useRef, useCallback } from 'react';
import { config } from '../config';
import Toolbar from './Toolbar';
import type { Point, Stroke, DrawingTool, User } from '../types/canvas';
import { generateId, pointsToSvgPath, HIGHLIGHTER_OPACITY } from '../types/canvas';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LayerData {
  userName: string;
  visible: boolean;
  strokes: Stroke[];
}

interface ActivityEvent {
  id: string;
  avatar: string;
  name: string;
  action: string;
  time: Date;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  time: Date;
}

interface CanvasProps {
  userId?: string;
  userName?: string;
  sessionId?: string;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function strokeHitsPoint(stroke: Stroke, pt: Point, radius: number): boolean {
  const r2 = radius * radius;
  return stroke.points.some(p => (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2 < r2);
}

function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function strokeInLasso(stroke: Stroke, lasso: Point[]): boolean {
  return lasso.length >= 3 && stroke.points.some(p => pointInPolygon(p, lasso));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Canvas({
  userId = generateId(),
  userName = 'Anonymous',
  sessionId = 'default',
}: CanvasProps) {
  // Connection
  const [connected, setConnected] = useState(false);

  // Layers: one per user
  const [layers, setLayers] = useState<Record<string, LayerData>>({});
  const [soloUserId, setSoloUserId] = useState<string | null>(null);
  const layersRef = useRef<Record<string, LayerData>>({});

  // Users
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [tool, setTool] = useState<DrawingTool>({ type: 'pen', color: '#1a1a2e', width: 3 });

  // Lasso
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hover attribution
  const [hoverInfo, setHoverInfo] = useState<{ userName: string; x: number; y: number } | null>(null);

  // UI state
  const [activePanel, setActivePanel] = useState<'layers' | 'activity' | 'chat'>('layers');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const erasedThisGesture = useRef<Set<string>>(new Set());

  // Keep layersRef in sync so callbacks always read fresh data
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const generateUserColor = (id: string) => {
    const colors = ['#e85d04', '#0d9488', '#7c3aed', '#e11d48', '#0284c7', '#d97706'];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  };

  const addActivity = (avatar: string, name: string, action: string) =>
    setActivityLog(log => [...log, { id: generateId(), avatar, name, action, time: new Date() }]);

  const removeStrokeIds = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setLayers(prev => {
      const next: Record<string, LayerData> = {};
      for (const [uid, layer] of Object.entries(prev))
        next[uid] = { ...layer, strokes: layer.strokes.filter(s => !set.has(s.id)) };
      return next;
    });
  }, []);

  const broadcast = useCallback((payload: object) => {
    if (connected && wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(payload));
  }, [connected]);

  // ── Init own layer ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLayers(prev => ({
      ...prev,
      [userId]: { userName, visible: true, strokes: prev[userId]?.strokes ?? [] },
    }));
  }, [userId, userName]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = new WebSocket(config.websocketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({ type: 'join_session', sessionId, user: { id: userId, name: userName } }));
    };
    socket.onclose = () => setConnected(false);
    socket.onerror = err => console.error('WS error:', err);

    socket.onmessage = event => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {

          case 'session_users':
            setActiveUsers(msg.users.map((u: { id: string; name: string }) => ({
              ...u, color: generateUserColor(u.id),
            })));
            setLayers(prev => {
              const next = { ...prev };
              msg.users.forEach((u: { id: string; name: string }) => {
                if (!next[u.id]) next[u.id] = { userName: u.name, visible: true, strokes: [] };
              });
              return next;
            });
            break;

          case 'user_joined':
            setActiveUsers(prev => {
              if (prev.find(u => u.id === msg.user.id)) return prev;
              return [...prev, { ...msg.user, color: generateUserColor(msg.user.id) }];
            });
            setLayers(prev => ({
              ...prev,
              [msg.user.id]: prev[msg.user.id] ?? { userName: msg.user.name, visible: true, strokes: [] },
            }));
            addActivity(msg.user.name[0].toUpperCase(), msg.user.name, 'joined the session');
            break;

          case 'user_left':
            setActiveUsers(prev => {
              const u = prev.find(u => u.id === msg.userId);
              if (u) addActivity(u.name[0].toUpperCase(), u.name, 'left the session');
              return prev.filter(u => u.id !== msg.userId);
            });
            break;

          case 'cursor_update':
            setActiveUsers(prev =>
              prev.map(u => u.id === msg.userId ? { ...u, cursor: msg.cursor } : u)
            );
            break;

          case 'stroke':
            setLayers(prev => {
              const uid = msg.stroke.userId;
              const layer = prev[uid] ?? { userName: msg.stroke.userName, visible: true, strokes: [] };
              return { ...prev, [uid]: { ...layer, strokes: [...layer.strokes, msg.stroke] } };
            });
            addActivity(
              msg.stroke.userName[0].toUpperCase(),
              msg.stroke.userName,
              `drew a ${msg.stroke.tool} stroke`,
            );
            break;

          case 'strokes_erased':
            removeStrokeIds(msg.strokeIds);
            break;

          case 'clear_canvas':
            setLayers(prev => {
              const next: Record<string, LayerData> = {};
              for (const [uid, l] of Object.entries(prev)) next[uid] = { ...l, strokes: [] };
              return next;
            });
            break;

          case 'chat_message':
            setChatMessages(prev => [...prev, { ...msg.message, time: new Date(msg.message.time) }]);
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    return () => socket.close();
  }, [sessionId, userId, userName, removeStrokeIds]);

  // ── Coordinate transform ──────────────────────────────────────────────────────

  const getCoords = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    if ('touches' in e) {
      if (!e.touches.length) return null;
      pt.x = e.touches[0].clientX; pt.y = e.touches[0].clientY;
    } else {
      pt.x = (e as React.MouseEvent).clientX; pt.y = (e as React.MouseEvent).clientY;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }, []);

  // ── Smart eraser (deletes whole strokes) ──────────────────────────────────────

  const applyEraser = useCallback((pt: Point) => {
    const radius = Math.max(tool.width, 8);
    const toErase: string[] = [];

    setLayers(prev => {
      const next: Record<string, LayerData> = {};
      for (const [uid, layer] of Object.entries(prev)) {
        const remaining = layer.strokes.filter(stroke => {
          if (erasedThisGesture.current.has(stroke.id)) return false;
          if (strokeHitsPoint(stroke, pt, radius)) {
            erasedThisGesture.current.add(stroke.id);
            toErase.push(stroke.id);
            return false;
          }
          return true;
        });
        next[uid] = remaining.length !== layer.strokes.length
          ? { ...layer, strokes: remaining }
          : layer;
      }
      return next;
    });
  }, [tool.width]);

  // ── Drawing handlers ──────────────────────────────────────────────────────────

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getCoords(e);
    if (!pt) return;

    setHoverInfo(null);
    erasedThisGesture.current.clear();

    if (tool.type === 'lasso') {
      setSelectedIds(new Set());
      currentStrokeRef.current = [pt];
      setLassoPoints([pt]);
      setIsDrawing(true);
      return;
    }

    currentStrokeRef.current = [pt];
    setCurrentStroke([pt]);
    setIsDrawing(true);
  }, [getCoords, tool.type]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCoords(e);
    if (pt) setCursorPos(pt);

    // Hover attribution — only when idle
    if (!isDrawing && pt && tool.type !== 'lasso') {
      let found: { userName: string; x: number; y: number } | null = null;
      for (const layer of Object.values(layersRef.current)) {
        for (const stroke of layer.strokes) {
          if (strokeHitsPoint(stroke, pt, 7)) {
            const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;
            found = { userName: stroke.userName, x: clientX ?? 0, y: clientY ?? 0 };
            break;
          }
        }
        if (found) break;
      }
      setHoverInfo(found);
    }

    if (!isDrawing || !pt) return;

    if (tool.type === 'lasso') {
      currentStrokeRef.current = [...currentStrokeRef.current, pt];
      setLassoPoints([...currentStrokeRef.current]);
      return;
    }

    if (tool.type === 'eraser') {
      applyEraser(pt);
    }

    currentStrokeRef.current = [...currentStrokeRef.current, pt];
    setCurrentStroke([...currentStrokeRef.current]);

    broadcast({ type: 'cursor_update', userId, cursor: pt });
  }, [isDrawing, tool.type, getCoords, userId, broadcast, applyEraser]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // ── Lasso: finish selection ──
    if (tool.type === 'lasso') {
      const lasso = currentStrokeRef.current;
      setLassoPoints([]);
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      if (lasso.length >= 3) {
        const sel = new Set<string>();
        for (const layer of Object.values(layersRef.current))
          for (const stroke of layer.strokes)
            if (strokeInLasso(stroke, lasso)) sel.add(stroke.id);
        setSelectedIds(sel);
      }
      return;
    }

    // ── Eraser: broadcast deletions ──
    if (tool.type === 'eraser') {
      const ids = Array.from(erasedThisGesture.current);
      if (ids.length) broadcast({ type: 'strokes_erased', strokeIds: ids });
      erasedThisGesture.current.clear();
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      return;
    }

    // ── Pen / Highlighter ──
    const points = currentStrokeRef.current;
    currentStrokeRef.current = [];
    setCurrentStroke([]);
    if (!points.length) return;

    const stroke: Stroke = {
      id: generateId(),
      userId,
      userName,
      points,
      color: tool.color,
      width: tool.width,
      tool: tool.type === 'highlighter' ? 'highlighter' : 'pen',
      timestamp: Date.now(),
    };

    setLayers(prev => ({
      ...prev,
      [userId]: {
        userName,
        visible: prev[userId]?.visible ?? true,
        strokes: [...(prev[userId]?.strokes ?? []), stroke],
      },
    }));

    addActivity(userName[0].toUpperCase(), 'You', `drew a ${tool.type} stroke`);
    broadcast({ type: 'stroke', stroke });
  }, [isDrawing, tool, userId, userName, broadcast]);

  // ── Delete lasso selection ─────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    removeStrokeIds(ids);
    broadcast({ type: 'strokes_erased', strokeIds: ids });
    setSelectedIds(new Set());
  }, [selectedIds, removeStrokeIds, broadcast]);

  // ── Undo own last stroke ──────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const myStrokes = layersRef.current[userId]?.strokes;
    if (!myStrokes?.length) return;
    const last = myStrokes[myStrokes.length - 1];
    removeStrokeIds([last.id]);
    broadcast({ type: 'strokes_erased', strokeIds: [last.id] });
  }, [userId, removeStrokeIds, broadcast]);

  // ── Clear all layers ──────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    setLayers(prev => {
      const next: Record<string, LayerData> = {};
      for (const [uid, l] of Object.entries(prev)) next[uid] = { ...l, strokes: [] };
      return next;
    });
    broadcast({ type: 'clear_canvas', sessionId });
  }, [sessionId, broadcast]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size) deleteSelected();
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, selectedIds]);

  // ── Global mouse/touch up ─────────────────────────────────────────────────────

  useEffect(() => {
    const up = () => { if (isDrawing) stopDrawing(); };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, [isDrawing, stopDrawing]);

  // ── Export ────────────────────────────────────────────────────────────────────

  const exportCanvas = useCallback(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const str = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = svg.clientWidth; c.height = svg.clientHeight;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.download = `pigment-${Date.now()}.png`; a.href = c.toDataURL('image/png'); a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  // ── Copy share link ───────────────────────────────────────────────────────────

  const copyShareLink = useCallback(() => {
    const url = `${window.location.origin}?session=${sessionId}`;
    const done = () => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); };
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el); done();
    };
    navigator.clipboard ? navigator.clipboard.writeText(url).then(done).catch(fallback) : fallback();
  }, [sessionId]);

  // ── Chat ──────────────────────────────────────────────────────────────────────

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const message: ChatMessage = { id: generateId(), userId, userName, text: chatInput.trim(), time: new Date() };
    setChatMessages(prev => [...prev, message]);
    broadcast({ type: 'chat_message', message });
    setChatInput('');
  }, [chatInput, userId, userName, broadcast]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const totalStrokes = Object.values(layers).reduce((n, l) => n + l.strokes.length, 0);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?session=${sessionId}` : '';
  const canvasTitle = sessionId === 'default' ? 'Untitled Canvas' : sessionId;
  const cursorClass = tool.type === 'lasso' ? 'crosshair' : tool.type === 'eraser' ? 'cell' : 'default';

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rel = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    return s < 60 ? 'Just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="app-layout">

      {/* ── Left Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">P</div>
          <div className="brand-name">Pigment</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Session</div>
          <ul className="canvas-list">
            <li className="canvas-item active">
              <span className="dot" style={{ background: '#e85d04' }} />
              {canvasTitle}
              <span className="count">{totalStrokes}</span>
            </li>
          </ul>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Collaborators</div>
          <ul className="user-list">
            <li className="user-item">
              <div className="user-avatar" style={{ background: generateUserColor(userId) }}>
                {userName[0].toUpperCase()}
                <span className="status-dot status-online" />
              </div>
              <span className="user-name">{userName}</span>
              <span className="user-role">You</span>
            </li>
            {activeUsers.map(u => (
              <li key={u.id} className="user-item">
                <div className="user-avatar" style={{ background: u.color }}>
                  {u.name[0].toUpperCase()}
                  <span className="status-dot status-online" />
                </div>
                <span className="user-name">{u.name}</span>
                <span className="user-role">Editor</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-bottom">
          <div className={`connection-badge connection-badge--${connected ? 'on' : 'off'}`}>
            <span className="connection-dot" />
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>
      </aside>

      {/* ── Main canvas area ── */}
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <div className="canvas-title-area">
            <span className="canvas-title">{canvasTitle}</span>
            <span className={`canvas-badge canvas-badge--${connected ? 'live' : 'offline'}`}>
              {connected ? '● Live' : '● Offline'}
            </span>
          </div>
          <div className="topbar-actions">
            {selectedIds.size > 0 && (
              <button className="action-btn action-btn--danger" onClick={deleteSelected}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
                Delete {selectedIds.size} selected
              </button>
            )}
            <div className="avatar-stack">
              <div className="user-avatar topbar-avatar" style={{ background: generateUserColor(userId) }}>
                {userName[0].toUpperCase()}
              </div>
              {activeUsers.slice(0, 3).map(u => (
                <div key={u.id} className="user-avatar topbar-avatar" style={{ background: u.color }}>
                  {u.name[0].toUpperCase()}
                </div>
              ))}
            </div>
            <button className="share-btn" onClick={() => setShareModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          </div>
        </div>

        <Toolbar
          tool={tool}
          onToolChange={t => { setTool(t); setSelectedIds(new Set()); }}
          onUndo={undo}
          onClear={clearCanvas}
          onExport={exportCanvas}
        />

        {/* Canvas workspace */}
        <div className="canvas-workspace">
          <div className="canvas-bg-pattern" />
          <svg
            ref={svgRef}
            className="canvas-svg"
            style={{ cursor: cursorClass }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseLeave={() => setHoverInfo(null)}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            preserveAspectRatio="xMidYMid slice"
          >
            <rect width="100%" height="100%" fill="white" />

            {/* Render layers — each user's strokes grouped */}
            {Object.entries(layers).map(([uid, layer]) => {
              if (soloUserId ? uid !== soloUserId : !layer.visible) return null;
              return layer.strokes.map(stroke => {
                const sel = selectedIds.has(stroke.id);
                return (
                  <g key={stroke.id}>
                    {sel && (
                      <path
                        d={pointsToSvgPath(stroke.points)}
                        stroke="#0284c7" strokeWidth={stroke.width + 8}
                        strokeLinecap="round" strokeLinejoin="round"
                        fill="none" opacity={0.35}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    <path
                      d={pointsToSvgPath(stroke.points)}
                      stroke={stroke.color}
                      strokeWidth={stroke.width}
                      strokeLinecap="round" strokeLinejoin="round"
                      fill="none"
                      opacity={stroke.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              });
            })}

            {/* Live preview of current pen/highlighter stroke */}
            {isDrawing && currentStroke.length > 0 && tool.type !== 'eraser' && tool.type !== 'lasso' && (
              <path
                d={pointsToSvgPath(currentStroke)}
                stroke={tool.color} strokeWidth={tool.width}
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

            {/* Remote cursors */}
            {activeUsers.map(u => u.cursor && (
              <g key={u.id}>
                <circle cx={u.cursor.x} cy={u.cursor.y} r="5" fill={u.color} opacity={0.85} />
                <text x={u.cursor.x + 8} y={u.cursor.y - 7} fill={u.color}
                  fontSize="11" fontFamily="sans-serif" fontWeight="600">
                  {u.name}
                </text>
              </g>
            ))}
          </svg>

          {/* Hover attribution tooltip (fixed so it can escape SVG bounds) */}
          {hoverInfo && !isDrawing && (
            <div
              className="hover-tooltip"
              style={{ left: hoverInfo.x + 14, top: hoverInfo.y - 34 }}
            >
              {hoverInfo.userName}
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            {tool.type[0].toUpperCase() + tool.type.slice(1)}
          </div>
          {cursorPos && <div className="stat">X:{Math.round(cursorPos.x)} Y:{Math.round(cursorPos.y)}</div>}
          <div className="stat">Strokes: {totalStrokes}</div>
          {selectedIds.size > 0 && (
            <div className="stat" style={{ color: '#0284c7' }}>{selectedIds.size} selected · Del to delete</div>
          )}
          <div className="stat">
            <span className="status-mini-dot" style={{ background: connected ? '#22c55e' : '#ef4444' }} />
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="right-panel">
        <div className="panel-tabs">
          {(['layers', 'activity', 'chat'] as const).map(p => (
            <button key={p} className={`panel-tab${activePanel === p ? ' active' : ''}`}
              onClick={() => setActivePanel(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Layers panel ── */}
        {activePanel === 'layers' && (
          <div className="panel-content">
            <div className="panel-section">
              <div className="panel-section-title">
                <span>Layers ({Object.keys(layers).length})</span>
                {soloUserId && (
                  <button className="link-btn" style={{ fontSize: 11 }} onClick={() => setSoloUserId(null)}>
                    Show all
                  </button>
                )}
              </div>
              {Object.keys(layers).length === 0 && (
                <div className="empty-panel">No layers yet.</div>
              )}
              {Object.entries(layers).map(([uid, layer]) => {
                const isOwn = uid === userId;
                const isSolo = soloUserId === uid;
                const color = generateUserColor(uid);
                return (
                  <div key={uid} className={`layer-item${isSolo ? ' active' : ''}`}>
                    <div className="layer-thumb" style={{ background: color }} />
                    <div className="layer-info">
                      <div className="layer-name">
                        {layer.userName}
                        {isOwn && <span className="user-role" style={{ marginLeft: 6 }}>You</span>}
                      </div>
                      <div className="layer-meta">{layer.strokes.length} stroke{layer.strokes.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="layer-actions">
                      {/* Solo / unsolo */}
                      <button
                        className={`layer-btn${isSolo ? ' layer-btn--active' : ''}`}
                        title={isSolo ? 'Show all layers' : 'View only this layer'}
                        onClick={() => setSoloUserId(isSolo ? null : uid)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                      {/* Visibility toggle */}
                      <button
                        className={`layer-btn${!layer.visible ? ' layer-btn--muted' : ''}`}
                        title={layer.visible ? 'Hide layer' : 'Show layer'}
                        onClick={() => {
                          if (soloUserId) return;
                          setLayers(prev => ({
                            ...prev,
                            [uid]: { ...prev[uid], visible: !prev[uid].visible },
                          }));
                        }}
                      >
                        {layer.visible ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Activity panel ── */}
        {activePanel === 'activity' && (
          <div className="panel-content">
            <div className="panel-section">
              <div className="panel-section-title">Recent Activity</div>
              {activityLog.length === 0
                ? <div className="empty-panel">No activity yet.</div>
                : activityLog.slice().reverse().slice(0, 50).map(ev => (
                    <div key={ev.id} className="activity-item">
                      <div className="activity-avatar" style={{ background: generateUserColor(ev.name) }}>
                        {ev.avatar}
                      </div>
                      <div>
                        <div className="activity-text"><strong>{ev.name}</strong> {ev.action}</div>
                        <div className="activity-time">{rel(ev.time)}</div>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

        {/* ── Chat panel ── */}
        {activePanel === 'chat' && (
          <div className="panel-content panel-content--chat">
            <div className="chat-section">
              <div className="chat-messages">
                {chatMessages.length === 0
                  ? <div className="empty-panel">No messages yet. Say hi!</div>
                  : chatMessages.map(msg => (
                      <div key={msg.id} className="chat-msg">
                        <div className="chat-msg-avatar" style={{ background: generateUserColor(msg.userId) }}>
                          {msg.userName[0].toUpperCase()}
                        </div>
                        <div className="chat-msg-content">
                          <div className="chat-msg-header">
                            <span className="chat-msg-name">{msg.userName}</span>
                            <span className="chat-msg-time">{fmt(msg.time)}</span>
                          </div>
                          <div className="chat-msg-body">{msg.text}</div>
                        </div>
                      </div>
                    ))
                }
              </div>
              <div className="chat-input-area">
                <input
                  type="text" className="chat-input"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Type a message..."
                />
                <button className="chat-send" onClick={sendChat}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Share modal ── */}
      {shareModalOpen && (
        <div className="modal-overlay open"
          onClick={e => { if (e.target === e.currentTarget) setShareModalOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Share Canvas</span>
              <button className="modal-close" onClick={() => setShareModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="share-link-row">
                <input type="text" className="share-link-input" value={shareUrl} readOnly />
                <button className={`copy-btn${copySuccess ? ' copied' : ''}`} onClick={copyShareLink}>
                  {copySuccess ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <div className="share-permissions-title">People in session</div>
              <div className="share-user-row">
                <div className="user-avatar" style={{ background: generateUserColor(userId), width: 32, height: 32, fontSize: 12 }}>
                  {userName[0].toUpperCase()}
                </div>
                <div className="share-user-info">
                  <div className="share-user-name">{userName}</div>
                  <div className="share-user-email">This session</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 600 }}>Owner</span>
              </div>
              {activeUsers.map(u => (
                <div key={u.id} className="share-user-row">
                  <div className="user-avatar" style={{ background: u.color, width: 32, height: 32, fontSize: 12 }}>
                    {u.name[0].toUpperCase()}
                  </div>
                  <div className="share-user-info">
                    <div className="share-user-name">{u.name}</div>
                    <div className="share-user-email">Active now</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>Editor</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
