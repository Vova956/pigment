import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { config } from '../config';
import Toolbar from './Toolbar';
import CanvasSidebar from './canvas/CanvasSidebar';
import CanvasDrawingSurface from './canvas/CanvasDrawingSurface';
import CanvasRightPanel from './canvas/CanvasRightPanel';
import ShareModal from './canvas/ShareModal';

import type { Point, DrawingTool, User, LayerData, ActivityEvent, ChatMessage, CanvasImage, CanvasText } from '../types/canvas';
import { generateId } from '../types/canvas';

import { GeometryService } from '../services/GeometryService';
import { UserColorService } from '../services/UserColorService';
import { CanvasExporter } from '../services/CanvasExporter';
import { ClipboardService } from '../services/ClipboardService';
import { ImageService } from '../services/ImageService';
import { ToolHandlerFactory } from '../tools/ToolHandlerFactory';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CanvasProps {
  userId?: string;
  userName?: string;
  sessionId?: string;
}

// ── Singletons (stable across renders) ────────────────────────────────────────

const exporter   = new CanvasExporter();
const clipboard  = new ClipboardService();

// ── Component ─────────────────────────────────────────────────────────────────

export default function Canvas({
  userId = generateId(),
  userName = 'Anonymous',
  sessionId = 'default',
}: CanvasProps) {

  // ── Connection ──────────────────────────────────────────────────────────────
  const [connected, setConnected] = useState(false);

  // ── Layers: one entry per user ───────────────────────────────────────────────
  const [layers, setLayers]       = useState<Record<string, LayerData>>({});
  const [soloUserId, setSoloUserId] = useState<string | null>(null);
  const layersRef = useRef<Record<string, LayerData>>({});
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // ── Active users ─────────────────────────────────────────────────────────────
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  // ── Drawing state ────────────────────────────────────────────────────────────
  const [isDrawing, setIsDrawing]       = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [tool, setTool]                 = useState<DrawingTool>({ type: 'pen', color: '#1a1a2e', width: 3 });

  // ── Images ───────────────────────────────────────────────────────────────────
  const [images, setImages] = useState<CanvasImage[]>([]);
  const imagesRef = useRef<CanvasImage[]>([]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  const draggingImageRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // ── Texts ────────────────────────────────────────────────────────────────────
  const [texts, setTexts] = useState<CanvasText[]>([]);
  const [pendingText, setPendingText] = useState<{ svgX: number; svgY: number; clientX: number; clientY: number } | null>(null);
  const [textInput, setTextInput] = useState('');

  // ── Lasso ────────────────────────────────────────────────────────────────────
  const [lassoPoints, setLassoPoints]   = useState<Point[]>([]);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // ── Hover attribution ────────────────────────────────────────────────────────
  const [hoverInfo, setHoverInfo] = useState<{ userName: string; x: number; y: number } | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activePanel, setActivePanel]     = useState<'layers' | 'activity' | 'chat'>('layers');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cursorPos, setCursorPos]         = useState<Point | null>(null);
  const [copySuccess, setCopySuccess]     = useState(false);
  const [activityLog, setActivityLog]     = useState<ActivityEvent[]>([]);
  const [chatMessages, setChatMessages]   = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]         = useState('');

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const svgRef              = useRef<SVGSVGElement>(null);
  const wsRef               = useRef<WebSocket | null>(null);
  const currentStrokeRef    = useRef<Point[]>([]);
  const erasedThisGesture   = useRef<Set<string>>(new Set());

  // ── Tool handler — recreated only when the tool changes ──────────────────────
  const toolHandler = useMemo(() => ToolHandlerFactory.create(tool), [tool]);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const addActivity = useCallback((avatar: string, name: string, action: string) => {
    setActivityLog(log => [...log, { id: generateId(), avatar, name, action, time: new Date() }]);
  }, []);

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
              ...u, color: UserColorService.getColor(u.id),
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
              return [...prev, { ...msg.user, color: UserColorService.getColor(msg.user.id) }];
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
            setImages([]);
            setTexts([]);
            break;

          case 'image':
            setImages(prev => [...prev, msg.image as CanvasImage]);
            break;

          case 'image_move':
            setImages(prev => prev.map(img =>
              img.id === msg.imageId ? { ...img, x: msg.x, y: msg.y } : img
            ));
            break;

          case 'text':
            setTexts(prev => [...prev, msg.canvasText as CanvasText]);
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
  }, [sessionId, userId, userName, removeStrokeIds, addActivity]);

  // ── Drawing: start ────────────────────────────────────────────────────────────

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const pt = GeometryService.getSvgCoords(e, svgRef.current);
    if (!pt) return;

    // Text tool: place an input overlay instead of starting a stroke
    if (tool.type === 'text') {
      const { x: clientX, y: clientY } = GeometryService.getClientCoords(e);
      setPendingText({ svgX: pt.x, svgY: pt.y, clientX, clientY });
      setTextInput('');
      return;
    }

    setHoverInfo(null);
    erasedThisGesture.current.clear();
    currentStrokeRef.current = [pt];

    if (tool.type === 'lasso') {
      setSelectedIds(new Set());
      setLassoPoints([pt]);
    } else {
      setCurrentStroke([pt]);
    }
    setIsDrawing(true);
  }, [tool.type]);

  // ── Image drag ────────────────────────────────────────────────────────────────

  const handleImageMouseDown = useCallback((imageId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent canvas from starting a stroke
    if (!svgRef.current) return;
    const pt = GeometryService.getSvgCoords(e, svgRef.current);
    if (!pt) return;
    const img = imagesRef.current.find(i => i.id === imageId);
    if (!img) return;
    draggingImageRef.current = { id: imageId, offsetX: pt.x - img.x, offsetY: pt.y - img.y };
  }, []);

  // ── Drawing: move ─────────────────────────────────────────────────────────────

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return;
    const pt = GeometryService.getSvgCoords(e, svgRef.current);
    if (pt) setCursorPos(pt);

    // Image drag takes priority — skip all drawing logic while dragging an image
    if (draggingImageRef.current && pt) {
      const { id, offsetX, offsetY } = draggingImageRef.current;
      const x = Math.round(pt.x - offsetX);
      const y = Math.round(pt.y - offsetY);
      setImages(prev => prev.map(img => img.id === id ? { ...img, x, y } : img));
      broadcast({ type: 'image_move', imageId: id, x, y });
      return;
    }

    // Hover attribution — only when idle
    if (!isDrawing && pt && tool.type !== 'lasso') {
      let found: { userName: string; x: number; y: number } | null = null;
      outer: for (const layer of Object.values(layersRef.current)) {
        for (const stroke of layer.strokes) {
          if (GeometryService.strokeHitsPoint(stroke, pt, 7)) {
            const { x, y } = GeometryService.getClientCoords(e);
            found = { userName: stroke.userName, x, y };
            break outer;
          }
        }
      }
      setHoverInfo(found);
    }

    if (!isDrawing || !pt) return;

    const result = toolHandler.onMove(pt, currentStrokeRef.current, layersRef.current, erasedThisGesture.current);
    currentStrokeRef.current = result.newPoints;

    if (tool.type === 'lasso') {
      setLassoPoints([...result.newPoints]);
    } else {
      setCurrentStroke([...result.newPoints]);
    }

    if (result.newlyErasedIds?.length) {
      result.newlyErasedIds.forEach(id => erasedThisGesture.current.add(id));
      removeStrokeIds(result.newlyErasedIds);
    }

    broadcast({ type: 'cursor_update', userId, cursor: pt });
  }, [isDrawing, tool.type, toolHandler, userId, broadcast, removeStrokeIds]);

  // ── Drawing: stop ─────────────────────────────────────────────────────────────

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool.type === 'lasso') {
      const lasso = currentStrokeRef.current;
      setLassoPoints([]);
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      const { lassoSelection } = toolHandler.onEnd(lasso, layersRef.current, userId, userName);
      if (lassoSelection) setSelectedIds(lassoSelection);
      return;
    }

    if (tool.type === 'eraser') {
      const ids = Array.from(erasedThisGesture.current);
      if (ids.length) broadcast({ type: 'strokes_erased', strokeIds: ids });
      erasedThisGesture.current.clear();
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      return;
    }

    const points = currentStrokeRef.current;
    currentStrokeRef.current = [];
    setCurrentStroke([]);
    const { stroke } = toolHandler.onEnd(points, layersRef.current, userId, userName);
    if (!stroke) return;

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
  }, [isDrawing, tool.type, toolHandler, userId, userName, broadcast, addActivity]);

  // ── Delete lasso selection ────────────────────────────────────────────────────

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

  // ── Clear all layers + images ─────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    setLayers(prev => {
      const next: Record<string, LayerData> = {};
      for (const [uid, l] of Object.entries(prev)) next[uid] = { ...l, strokes: [] };
      return next;
    });
    setImages([]);
    setTexts([]);
    broadcast({ type: 'clear_canvas', sessionId });
  }, [sessionId, broadcast]);

  // ── Text commit ───────────────────────────────────────────────────────────────

  const commitText = useCallback(() => {
    if (!pendingText || !textInput.trim()) {
      setPendingText(null);
      setTextInput('');
      return;
    }
    const canvasText: CanvasText = {
      id: generateId(),
      userId,
      userName,
      text: textInput.trim(),
      x: pendingText.svgX,
      y: pendingText.svgY,
      fontSize: Math.max(tool.width, 12),
      color: tool.color,
      timestamp: Date.now(),
    };
    setTexts(prev => [...prev, canvasText]);
    broadcast({ type: 'text', canvasText });
    addActivity(userName[0].toUpperCase(), 'You', 'added text');
    setPendingText(null);
    setTextInput('');
  }, [pendingText, textInput, userId, userName, tool.width, tool.color, broadcast, addActivity]);

  // ── Image upload ──────────────────────────────────────────────────────────────

  const uploadImage = useCallback((file: File) => {
    ImageService.processFile(file).then(({ dataUrl, width, height }) => {
      const svg = svgRef.current;
      const x = svg ? Math.round(svg.clientWidth  / 2 - width  / 2) : 100;
      const y = svg ? Math.round(svg.clientHeight / 2 - height / 2) : 100;
      const image: CanvasImage = {
        id: generateId(), userId, userName, dataUrl, x, y, width, height, timestamp: Date.now(),
      };
      setImages(prev => [...prev, image]);
      broadcast({ type: 'image', image });
      addActivity(userName[0].toUpperCase(), 'You', 'added an image');
    }).catch(err => console.error('Image upload failed:', err));
  }, [userId, userName, broadcast, addActivity]);

  // ── Export ────────────────────────────────────────────────────────────────────

  const exportCanvas = useCallback(() => {
    if (svgRef.current) exporter.exportToPng(svgRef.current);
  }, []);

  // ── Copy share link ───────────────────────────────────────────────────────────

  const copyShareLink = useCallback(() => {
    const url = `${window.location.origin}?session=${sessionId}`;
    clipboard.copyText(url, () => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [sessionId]);

  // ── Chat ──────────────────────────────────────────────────────────────────────

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const message: ChatMessage = {
      id: generateId(), userId, userName, text: chatInput.trim(), time: new Date(),
    };
    setChatMessages(prev => [...prev, message]);
    broadcast({ type: 'chat_message', message });
    setChatInput('');
  }, [chatInput, userId, userName, broadcast]);

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

  // ── Global pointer-up ─────────────────────────────────────────────────────────

  useEffect(() => {
    const up = () => {
      if (draggingImageRef.current) { draggingImageRef.current = null; return; }
      if (isDrawing) stopDrawing();
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, [isDrawing, stopDrawing]);

  // ── Derived values ────────────────────────────────────────────────────────────

  const totalStrokes  = Object.values(layers).reduce((n, l) => n + l.strokes.length, 0);
  const shareUrl      = typeof window !== 'undefined' ? `${window.location.origin}?session=${sessionId}` : '';
  const canvasTitle   = sessionId === 'default' ? 'Untitled Canvas' : sessionId;
  const cursorClass   = toolHandler.cursor;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="app-layout">

      {/* ── Left sidebar ── */}
      <CanvasSidebar
        userId={userId}
        userName={userName}
        connected={connected}
        activeUsers={activeUsers}
        layers={layers}
        totalStrokes={totalStrokes}
        canvasTitle={canvasTitle}
      />

      {/* ── Main area ── */}
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
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
                Delete {selectedIds.size} selected
              </button>
            )}
            <div className="avatar-stack">
              <div className="user-avatar topbar-avatar" style={{ background: UserColorService.getColor(userId) }}>
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
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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
          onImageUpload={uploadImage}
        />

        {/* Drawing surface + stats bar */}
        <CanvasDrawingSurface
          svgRef={svgRef}
          images={images}
          texts={texts}
          layers={layers}
          soloUserId={soloUserId}
          selectedIds={selectedIds}
          currentStroke={currentStroke}
          lassoPoints={lassoPoints}
          isDrawing={isDrawing}
          tool={tool}
          activeUsers={activeUsers}
          hoverInfo={hoverInfo}
          cursorClass={cursorClass}
          connected={connected}
          cursorPos={cursorPos}
          totalStrokes={totalStrokes}
          selectedCount={selectedIds.size}
          onDeleteSelected={deleteSelected}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseLeave={() => setHoverInfo(null)}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onImageMouseDown={handleImageMouseDown}
        />

        {/* ── Floating text input overlay ── */}
        {pendingText && (() => {
          const rect = svgRef.current?.getBoundingClientRect();
          const left = rect ? rect.left + pendingText.svgX : pendingText.clientX;
          const top  = rect ? rect.top  + pendingText.svgY : pendingText.clientY;
          return (
            <input
              autoFocus
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitText();
                if (e.key === 'Escape') { setPendingText(null); setTextInput(''); }
              }}
              onBlur={commitText}
              style={{
                position: 'fixed',
                left,
                top,
                font: `${Math.max(tool.width, 12)}px sans-serif`,
                color: tool.color,
                background: 'transparent',
                border: 'none',
                outline: '1.5px dashed #0284c7',
                padding: '0 2px',
                minWidth: 80,
                zIndex: 100,
              }}
            />
          );
        })()}
      </div>

      {/* ── Right panel ── */}
      <CanvasRightPanel
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        layers={layers}
        userId={userId}
        soloUserId={soloUserId}
        onSoloChange={setSoloUserId}
        onVisibilityToggle={uid =>
          setLayers(prev => ({ ...prev, [uid]: { ...prev[uid], visible: !prev[uid].visible } }))
        }
        activityLog={activityLog}
        chatMessages={chatMessages}
        chatInput={chatInput}
        onChatInput={setChatInput}
        onSendChat={sendChat}
      />

      {/* ── Share modal ── */}
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareUrl={shareUrl}
        userId={userId}
        userName={userName}
        activeUsers={activeUsers}
        copySuccess={copySuccess}
        onCopy={copyShareLink}
      />
    </div>
  );
}
