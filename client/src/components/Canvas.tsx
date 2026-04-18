import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { config } from '../config';
import Toolbar from './Toolbar';
import CanvasSidebar from './canvas/CanvasSidebar';
import CanvasDrawingSurface from './canvas/CanvasDrawingSurface';
import CanvasRightPanel from './canvas/CanvasRightPanel';
import ShareModal from './canvas/ShareModal';

import type {
  Point,
  DrawingTool,
  Stroke,
  User,
  LayerData,
  ActivityEvent,
  ChatMessage,
  CanvasImage,
  CanvasText,
  UndoAction,
  LayerComment,
  UserPermission,
} from '../types/canvas';
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

// ── Singletons ────────────────────────────────────────────────────────────────

const exporter = new CanvasExporter();
const clipboard = new ClipboardService();

// ── Component ─────────────────────────────────────────────────────────────────

export default function Canvas({
  userId = generateId(),
  userName = 'Anonymous',
  sessionId = 'default',
}: CanvasProps) {
  // ── Connection ──────────────────────────────────────────────────────────────
  const [connected, setConnected] = useState(false);

  // ── Layers ──────────────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<Record<string, LayerData>>({});
  const [soloUserId, setSoloUserId] = useState<string | null>(null);
  /**
   * The layer key that strokes from the current user are added to.
   * The sentinel `'__all__'` means "all of my own layers" (eraser targets all own layers).
   */
  const ALL_LAYERS_SENTINEL = '__all__';
  const [activeLayerId, setActiveLayerId] = useState<string>(ALL_LAYERS_SENTINEL);
  const layersRef = useRef<Record<string, LayerData>>({});
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  // ── Active users + permissions ───────────────────────────────────────────────
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [myPermission, setMyPermission] = useState<UserPermission>('editor');

  // ── Undo stack ───────────────────────────────────────────────────────────────
  const undoStackRef = useRef<UndoAction[]>([]);

  // ── Drawing state ────────────────────────────────────────────────────────────
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [tool, setTool] = useState<DrawingTool>({ type: 'pen', color: '#1a1a2e', width: 3 });

  // ── Zoom / pan ───────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(
    null
  );

  // ── Images ───────────────────────────────────────────────────────────────────
  const [images, setImages] = useState<CanvasImage[]>([]);
  const imagesRef = useRef<CanvasImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  const draggingImageRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // ── Texts ────────────────────────────────────────────────────────────────────
  const [texts, setTexts] = useState<CanvasText[]>([]);
  const [pendingText, setPendingText] = useState<{
    svgX: number;
    svgY: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [textInput, setTextInput] = useState('');

  // ── Lasso ────────────────────────────────────────────────────────────────────
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isDraggingSelectionRef = useRef(false);
  const selectionDragStartRef = useRef<Point | null>(null);
  const [selectionDragOffset, setSelectionDragOffset] = useState<{ dx: number; dy: number } | null>(
    null
  );

  // ── Clipboard ────────────────────────────────────────────────────────────────
  const [clipboardStrokes, setClipboardStrokes] = useState<Stroke[] | null>(null);

  // ── Context menu (right-click near selection) ─────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // ── Hover attribution ────────────────────────────────────────────────────────
  const [hoverInfo, setHoverInfo] = useState<{ userName: string; x: number; y: number } | null>(
    null
  );

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<'layers' | 'activity' | 'chat'>('layers');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // ── Space-hold for temporary pan ─────────────────────────────────────────────
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const erasedThisGesture = useRef<Set<string>>(new Set());
  /** Stores full stroke objects by ID as they are erased, BEFORE removal, for undo. */
  const erasedStrokesRef = useRef<Map<string, { layerId: string; stroke: Stroke }>>(new Map());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Always-current refs so callbacks don't need extra deps
  const panRef = useRef(pan);
  const pendingTextRef = useRef(pendingText);
  const textInputRef = useRef(textInput);
  const toolRef = useRef(tool);
  const activeLayerIdRef = useRef(activeLayerId);
  panRef.current = pan;
  pendingTextRef.current = pendingText;
  textInputRef.current = textInput;
  toolRef.current = tool;
  activeLayerIdRef.current = activeLayerId;

  // ── Tool handler ──────────────────────────────────────────────────────────────
  const toolHandler = useMemo(() => ToolHandlerFactory.create(tool), [tool]);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const addActivity = useCallback((avatar: string, name: string, action: string) => {
    setActivityLog((log) => [...log, { id: generateId(), avatar, name, action, time: new Date() }]);
  }, []);

  const removeStrokeIds = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setLayers((prev) => {
      const next: Record<string, LayerData> = {};
      for (const [lid, layer] of Object.entries(prev)) {
        next[lid] = { ...layer, strokes: layer.strokes.filter((s) => !set.has(s.id)) };
      }
      return next;
    });
  }, []);

  /** Look up full stroke objects by ID across all layers, returning layerId. */
  const getStrokesByIds = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const found: Array<{ layerId: string; stroke: Stroke }> = [];
    for (const [layerId, layer] of Object.entries(layersRef.current)) {
      for (const stroke of layer.strokes) {
        if (set.has(stroke.id)) {
          found.push({ layerId, stroke });
        }
      }
    }
    return found;
  }, []);

  const broadcast = useCallback(
    (payload: object) => {
      if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    },
    [connected]
  );

  /** Update local selection and notify peers so they can render a ghost outline. */
  const setAndBroadcastSelection = useCallback(
    (ids: Set<string>) => {
      setSelectedIds(ids);
      broadcast({ type: 'selection_update', userId, strokeIds: Array.from(ids) });
    },
    [broadcast, userId]
  );

  // ── Init own layer ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLayers((prev) => ({
      ...prev,
      [userId]: {
        userName,
        userId,
        visible: true,
        strokes: prev[userId]?.strokes ?? [],
        comments: prev[userId]?.comments ?? [],
      },
    }));
  }, [userId, userName]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const socket = new WebSocket(config.websocketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(
        JSON.stringify({ type: 'join_session', sessionId, user: { id: userId, name: userName } })
      );
    };
    socket.onclose = () => setConnected(false);
    socket.onerror = (err) => console.error('WS error:', err);

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'session_snapshot': {
            const snap = msg.snapshot as {
              layers: Record<string, LayerData>;
              images: CanvasImage[];
              texts: CanvasText[];
            };
            // Merge persisted layers with any locally pre-seeded ones (the
            // current user's own layer was created before the snapshot arrived).
            setLayers((prev) => {
              const merged: Record<string, LayerData> = { ...snap.layers };
              for (const [lid, local] of Object.entries(prev)) {
                const server = merged[lid];
                merged[lid] = server
                  ? { ...server, visible: local.visible, strokes: server.strokes }
                  : local;
              }
              return merged;
            });
            setImages(snap.images ?? []);
            setTexts(snap.texts ?? []);
            break;
          }

          case 'session_users':
            setActiveUsers(
              msg.users.map((u: { id: string; name: string }) => ({
                ...u,
                color: UserColorService.getColor(u.id),
              }))
            );
            setLayers((prev) => {
              const next = { ...prev };
              msg.users.forEach((u: { id: string; name: string }) => {
                if (!next[u.id]) {
                  next[u.id] = {
                    userName: u.name,
                    userId: u.id,
                    visible: true,
                    strokes: [],
                    comments: [],
                  };
                }
              });
              return next;
            });
            break;

          case 'user_joined':
            setActiveUsers((prev) => {
              if (prev.find((u) => u.id === msg.user.id)) {
                return prev;
              }
              return [...prev, { ...msg.user, color: UserColorService.getColor(msg.user.id) }];
            });
            setLayers((prev) => ({
              ...prev,
              [msg.user.id]: prev[msg.user.id] ?? {
                userName: msg.user.name,
                userId: msg.user.id,
                visible: true,
                strokes: [],
                comments: [],
              },
            }));
            addActivity(msg.user.name[0].toUpperCase(), msg.user.name, 'joined the session');
            break;

          case 'user_left':
            setActiveUsers((prev) => {
              const u = prev.find((u) => u.id === msg.userId);
              if (u) {
                addActivity(u.name[0].toUpperCase(), u.name, 'left the session');
              }
              return prev.filter((u) => u.id !== msg.userId);
            });
            break;

          case 'cursor_update':
            setActiveUsers((prev) =>
              prev.map((u) => (u.id === msg.userId ? { ...u, cursor: msg.cursor } : u))
            );
            break;

          case 'lasso_update':
            setActiveUsers((prev) =>
              prev.map((u) => (u.id === msg.userId ? { ...u, lassoPoints: msg.points } : u))
            );
            break;

          case 'selection_update':
            setActiveUsers((prev) =>
              prev.map((u) =>
                u.id === msg.userId ? { ...u, selectedStrokeIds: msg.strokeIds } : u
              )
            );
            break;

          case 'stroke': {
            // msg.layerId is the specific layer key; fall back to stroke.userId for legacy messages
            const targetLayerId = msg.layerId ?? msg.stroke.userId;
            setLayers((prev) => {
              const existing = prev[targetLayerId] ?? {
                userName: msg.stroke.userName,
                userId: msg.stroke.userId,
                visible: true,
                strokes: [],
                comments: [],
              };
              return {
                ...prev,
                [targetLayerId]: { ...existing, strokes: [...existing.strokes, msg.stroke] },
              };
            });
            addActivity(
              msg.stroke.userName[0].toUpperCase(),
              msg.stroke.userName,
              `drew a ${msg.stroke.tool} stroke`
            );
            break;
          }

          case 'strokes_erased':
            removeStrokeIds(msg.strokeIds);
            break;

          case 'strokes_moved': {
            const moves: Array<{ id: string; points: Point[] }> = msg.strokes;
            const moveMap = new Map(moves.map((m) => [m.id, m.points]));
            setLayers((prev) => {
              const next: Record<string, LayerData> = {};
              for (const [lid, layer] of Object.entries(prev)) {
                next[lid] = {
                  ...layer,
                  strokes: layer.strokes.map((s) =>
                    moveMap.has(s.id) ? { ...s, points: moveMap.get(s.id)! } : s
                  ),
                };
              }
              return next;
            });
            break;
          }

          case 'clear_canvas':
            setLayers((prev) => {
              const next: Record<string, LayerData> = {};
              for (const [lid, l] of Object.entries(prev)) {
                next[lid] = { ...l, strokes: [] };
              }
              return next;
            });
            setImages([]);
            setTexts([]);
            break;

          case 'image':
            setImages((prev) => [...prev, msg.image as CanvasImage]);
            break;

          case 'image_move':
            setImages((prev) =>
              prev.map((img) => (img.id === msg.imageId ? { ...img, x: msg.x, y: msg.y } : img))
            );
            break;

          case 'text':
            setTexts((prev) => [...prev, msg.canvasText as CanvasText]);
            break;

          case 'chat_message':
            setChatMessages((prev) => [
              ...prev,
              { ...msg.message, time: new Date(msg.message.time) },
            ]);
            break;

          case 'layer_comment':
            setLayers((prev) => {
              const layer = prev[msg.layerUserId];
              if (!layer) {
                return prev;
              }
              return {
                ...prev,
                [msg.layerUserId]: {
                  ...layer,
                  comments: [...(layer.comments ?? []), msg.comment],
                },
              };
            });
            break;

          case 'permission_update':
            if (msg.targetUserId === userId) {
              setMyPermission(msg.permission);
            }
            setActiveUsers((prev) =>
              prev.map((u) =>
                u.id === msg.targetUserId ? { ...u, permission: msg.permission } : u
              )
            );
            break;
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    return () => socket.close();
  }, [sessionId, userId, userName, removeStrokeIds, addActivity]);

  // ── Mini-map: show briefly during pan/zoom then auto-hide ────────────────────
  const [showMiniMap, setShowMiniMap] = useState(false);
  const miniMapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerMiniMap = useCallback(() => {
    setShowMiniMap(true);
    if (miniMapTimerRef.current) {
      clearTimeout(miniMapTimerRef.current);
    }
    miniMapTimerRef.current = setTimeout(() => setShowMiniMap(false), 1500);
  }, []);

  // ── Zoom / pan via mouse wheel ────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      e.preventDefault();
      if (!svgRef.current) {
        return;
      }
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom((prevZoom) => {
        const next = Math.min(Math.max(prevZoom * factor, 0.1), 8);
        setPan((prevPan) => ({
          x:
            prevPan.x +
            (mx / rect.width) * (rect.width / prevZoom) -
            (mx / rect.width) * (rect.width / next),
          y:
            prevPan.y +
            (my / rect.height) * (rect.height / prevZoom) -
            (my / rect.height) * (rect.height / next),
        }));
        return next;
      });
      triggerMiniMap();
    },
    [triggerMiniMap]
  );

  // ── Context menu ─────────────────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (selectedIdsRef.current.size > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // ── Inline helper: commit any in-progress text (called from startDrawing) ─────
  const commitPendingTextInline = useCallback(() => {
    const pt0 = pendingTextRef.current;
    const ti = textInputRef.current.trim();
    const t = toolRef.current;
    if (!pt0 || !ti) {
      setPendingText(null);
      setTextInput('');
      return;
    }
    const canvasText: CanvasText = {
      id: generateId(),
      userId,
      userName,
      text: ti,
      x: pt0.svgX,
      y: pt0.svgY,
      fontSize: Math.max(t.width, 12),
      color: t.color,
      timestamp: Date.now(),
    };
    setTexts((prev) => [...prev, canvasText]);
    undoStackRef.current.push({ kind: 'add_text', text: canvasText });
    broadcast({ type: 'text', canvasText });
    addActivity(userName[0].toUpperCase(), 'You', 'added text');
    setPendingText(null);
    setTextInput('');
  }, [userId, userName, broadcast, addActivity]);

  // ── Drawing: start ────────────────────────────────────────────────────────────

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (myPermission === 'viewer') {
        return;
      }
      e.preventDefault();
      if (!svgRef.current) {
        return;
      }
      const pt = GeometryService.getSvgCoords(e, svgRef.current);
      if (!pt) {
        return;
      }

      // Pan tool or space-held: start canvas pan
      if (toolRef.current.type === 'pan' || isSpaceHeld) {
        isPanningRef.current = true;
        triggerMiniMap();
        const { x: clientX, y: clientY } = GeometryService.getClientCoords(e);
        panStartRef.current = {
          mouseX: clientX,
          mouseY: clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        setIsDrawing(true);
        return;
      }

      // Text tool: commit any existing text then place a new input
      if (toolRef.current.type === 'text') {
        commitPendingTextInline();
        const { x: clientX, y: clientY } = GeometryService.getClientCoords(e);
        setPendingText({ svgX: pt.x, svgY: pt.y, clientX, clientY });
        setTextInput('');
        return;
      }

      setHoverInfo(null);
      setContextMenu(null);
      erasedThisGesture.current.clear();
      erasedStrokesRef.current.clear();
      currentStrokeRef.current = [pt];

      if (toolRef.current.type === 'lasso') {
        // Check if clicking on a selected stroke to start drag
        if (selectedIds.size > 0) {
          for (const layer of Object.values(layersRef.current)) {
            for (const stroke of layer.strokes) {
              if (selectedIds.has(stroke.id) && GeometryService.strokeHitsPoint(stroke, pt, 10)) {
                isDraggingSelectionRef.current = true;
                selectionDragStartRef.current = pt;
                setIsDrawing(true);
                return;
              }
            }
          }
        }
        // Clear selection and start new lasso
        setAndBroadcastSelection(new Set());
        setLassoPoints([pt]);
      } else {
        setCurrentStroke([pt]);
      }
      setIsDrawing(true);
    },
    [myPermission, selectedIds, isSpaceHeld, commitPendingTextInline, triggerMiniMap]
  );

  // ── Image drag ────────────────────────────────────────────────────────────────

  const handleImageMouseDown = useCallback((imageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!svgRef.current) {
      return;
    }
    const pt = GeometryService.getSvgCoords(e, svgRef.current);
    if (!pt) {
      return;
    }
    const img = imagesRef.current.find((i) => i.id === imageId);
    if (!img) {
      return;
    }
    draggingImageRef.current = { id: imageId, offsetX: pt.x - img.x, offsetY: pt.y - img.y };
  }, []);

  // ── Drawing: move ─────────────────────────────────────────────────────────────

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!svgRef.current) {
        return;
      }
      const pt = GeometryService.getSvgCoords(e, svgRef.current);
      if (pt) {
        setCursorPos(pt);
      }

      // Image drag
      if (draggingImageRef.current && pt) {
        const { id, offsetX, offsetY } = draggingImageRef.current;
        const x = Math.round(pt.x - offsetX);
        const y = Math.round(pt.y - offsetY);
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, x, y } : img)));
        broadcast({ type: 'image_move', imageId: id, x, y });
        return;
      }

      // Selection drag
      if (isDraggingSelectionRef.current && selectionDragStartRef.current && pt) {
        const dx = pt.x - selectionDragStartRef.current.x;
        const dy = pt.y - selectionDragStartRef.current.y;
        setSelectionDragOffset({ dx, dy });
        return;
      }

      // Hover attribution when idle
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

      if (!isDrawing || !pt) {
        return;
      }

      // Eraser only works on the current user's own layers.
      // When activeLayerId is the sentinel '__all__', target all own layers;
      // otherwise target only the specific active layer.
      const eraserLayers =
        tool.type === 'eraser'
          ? Object.fromEntries(
              Object.entries(layersRef.current).filter(([lid, layer]) => {
                if ((layer.userId ?? lid) !== userId) {
                  return false;
                }
                if (activeLayerIdRef.current === ALL_LAYERS_SENTINEL) {
                  return true;
                }
                return lid === activeLayerIdRef.current;
              })
            )
          : layersRef.current;

      const result = toolHandler.onMove(
        pt,
        currentStrokeRef.current,
        eraserLayers,
        erasedThisGesture.current
      );
      currentStrokeRef.current = result.newPoints;

      if (tool.type === 'lasso') {
        setLassoPoints([...result.newPoints]);
        broadcast({ type: 'lasso_update', userId, points: result.newPoints });
      } else {
        setCurrentStroke([...result.newPoints]);
      }

      if (result.newlyErasedIds?.length) {
        for (const id of result.newlyErasedIds) {
          erasedThisGesture.current.add(id);
          // Capture the stroke object before it is removed (for undo)
          if (!erasedStrokesRef.current.has(id)) {
            for (const [layerId, layer] of Object.entries(layersRef.current)) {
              const stroke = layer.strokes.find((s) => s.id === id);
              if (stroke) {
                erasedStrokesRef.current.set(id, { layerId, stroke });
                break;
              }
            }
          }
        }
        removeStrokeIds(result.newlyErasedIds);
      }

      broadcast({ type: 'cursor_update', userId, cursor: pt });
    },
    [isDrawing, tool.type, toolHandler, userId, broadcast, removeStrokeIds]
  );

  // ── Drawing: stop ─────────────────────────────────────────────────────────────

  const stopDrawing = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
      if (isDrawing) {
        setIsDrawing(false);
      }
      return;
    }
    if (draggingImageRef.current) {
      draggingImageRef.current = null;
      return;
    }
    if (!isDrawing) {
      return;
    }
    setIsDrawing(false);

    // Commit selection drag → push undo
    if (isDraggingSelectionRef.current && selectionDragOffset) {
      const { dx, dy } = selectionDragOffset;
      const ids = Array.from(selectedIds);
      // Push undo before applying so layersRef still has pre-move positions
      undoStackRef.current.push({ kind: 'move', ids, dx, dy });
      setLayers((prev) => {
        const next: Record<string, LayerData> = {};
        for (const [lid, layer] of Object.entries(prev)) {
          next[lid] = {
            ...layer,
            strokes: layer.strokes.map((s) =>
              ids.includes(s.id)
                ? { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
                : s
            ),
          };
        }
        return next;
      });
      // Broadcast moved strokes (compute final positions from current state + offset)
      const movedStrokes = ids
        .map((id) => {
          for (const layer of Object.values(layersRef.current)) {
            const s = layer.strokes.find((s) => s.id === id);
            if (s) {
              return { id, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
            }
          }
          return null;
        })
        .filter(Boolean);
      broadcast({ type: 'strokes_moved', strokes: movedStrokes });
      isDraggingSelectionRef.current = false;
      selectionDragStartRef.current = null;
      setSelectionDragOffset(null);
      return;
    }

    if (toolRef.current.type === 'lasso') {
      const lasso = currentStrokeRef.current;
      broadcast({ type: 'lasso_update', userId, points: [] });
      setLassoPoints([]);
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      // Lasso only selects strokes from own layers (same scope as eraser)
      const lassoLayers = Object.fromEntries(
        Object.entries(layersRef.current).filter(([lid, l]) => {
          if ((l.userId ?? lid) !== userId) {
            return false;
          }
          if (activeLayerIdRef.current === ALL_LAYERS_SENTINEL) {
            return true;
          }
          return lid === activeLayerIdRef.current;
        })
      );
      const { lassoSelection } = toolHandler.onEnd(lasso, lassoLayers, userId, userName);
      if (!lassoSelection?.size) {
        setAndBroadcastSelection(new Set());
        return;
      }
      // Only keep IDs that actually live in the allowed layer slice (defensive)
      const allowedIds = new Set<string>();
      for (const layer of Object.values(lassoLayers)) {
        for (const s of layer.strokes) {
          allowedIds.add(s.id);
        }
      }
      setAndBroadcastSelection(new Set([...lassoSelection].filter((id) => allowedIds.has(id))));
      return;
    }

    if (toolRef.current.type === 'eraser') {
      // Single-click eraser: if no drag movement happened, check the click point once
      if (erasedThisGesture.current.size === 0 && currentStrokeRef.current.length === 1) {
        const pt = currentStrokeRef.current[0];
        const radius = Math.max(toolRef.current.width, 8);
        const ownLayerIds = new Set(
          Object.entries(layersRef.current)
            .filter(([lid, l]) => {
              if ((l.userId ?? lid) !== userId) {
                return false;
              }
              if (activeLayerIdRef.current === ALL_LAYERS_SENTINEL) {
                return true;
              }
              return lid === activeLayerIdRef.current;
            })
            .map(([lid]) => lid)
        );
        for (const [layerId, layer] of Object.entries(layersRef.current)) {
          if (!ownLayerIds.has(layerId)) {
            continue;
          }
          for (const stroke of layer.strokes) {
            if (
              !erasedThisGesture.current.has(stroke.id) &&
              GeometryService.strokeHitsPoint(stroke, pt, radius)
            ) {
              erasedThisGesture.current.add(stroke.id);
              erasedStrokesRef.current.set(stroke.id, { layerId, stroke });
            }
          }
        }
        if (erasedThisGesture.current.size > 0) {
          removeStrokeIds(Array.from(erasedThisGesture.current));
        }
      }

      const ids = Array.from(erasedThisGesture.current);
      if (ids.length) {
        const originals = Array.from(erasedStrokesRef.current.values());
        undoStackRef.current.push({ kind: 'erase', originals, addedSubIds: [] });
        broadcast({ type: 'strokes_erased', strokeIds: ids });
        addActivity(
          userName[0].toUpperCase(),
          'You',
          `erased ${ids.length} stroke${ids.length !== 1 ? 's' : ''}`
        );
      }
      erasedThisGesture.current.clear();
      erasedStrokesRef.current.clear();
      currentStrokeRef.current = [];
      setCurrentStroke([]);
      return;
    }

    const points = currentStrokeRef.current;
    currentStrokeRef.current = [];
    setCurrentStroke([]);

    // Single-click (no movement): synthesize a tiny dot stroke
    if (points.length === 1) {
      points.push({ x: points[0].x + 0.1, y: points[0].y + 0.1 });
    }

    const { stroke } = toolHandler.onEnd(points, layersRef.current, userId, userName);
    if (!stroke) {
      return;
    }

    // When 'All Layers' is the active sentinel, strokes go to the main userId layer
    const lid =
      activeLayerIdRef.current === ALL_LAYERS_SENTINEL ? userId : activeLayerIdRef.current;
    setLayers((prev) => ({
      ...prev,
      [lid]: {
        userName: prev[lid]?.userName ?? userName,
        userId,
        visible: prev[lid]?.visible ?? true,
        strokes: [...(prev[lid]?.strokes ?? []), stroke],
        comments: prev[lid]?.comments ?? [],
      },
    }));
    undoStackRef.current.push({ kind: 'add_stroke', stroke, layerId: lid });
    addActivity(userName[0].toUpperCase(), 'You', `drew a ${toolRef.current.type} stroke`);
    broadcast({ type: 'stroke', stroke, layerId: lid });
  }, [
    isDrawing,
    toolHandler,
    userId,
    userName,
    broadcast,
    addActivity,
    selectedIds,
    selectionDragOffset,
  ]);

  // ── Middle-mouse pan wrappers (defined after startDrawing/draw) ──────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        return;
      }
      if (e.button === 2) {
        return;
      }
      startDrawing(e);
    },
    [startDrawing]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanningRef.current && panStartRef.current) {
        const dx = (e.clientX - panStartRef.current.mouseX) / zoom;
        const dy = (e.clientY - panStartRef.current.mouseY) / zoom;
        setPan({ x: panStartRef.current.panX - dx, y: panStartRef.current.panY - dy });
        triggerMiniMap();
        return;
      }
      draw(e);
    },
    [zoom, draw, triggerMiniMap]
  );

  // ── Delete lasso selection ────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (!selectedIds.size) {
      return;
    }
    const ids = Array.from(selectedIds);
    const found = getStrokesByIds(ids);
    undoStackRef.current.push({ kind: 'erase', originals: found, addedSubIds: [] });
    removeStrokeIds(ids);
    broadcast({ type: 'strokes_erased', strokeIds: ids });
    setAndBroadcastSelection(new Set());
    setContextMenu(null);
  }, [selectedIds, removeStrokeIds, broadcast, getStrokesByIds, setAndBroadcastSelection]);

  // ── Copy / Cut / Paste ────────────────────────────────────────────────────────

  const copySelected = useCallback(() => {
    if (!selectedIds.size) {
      return;
    }
    const strokes = getStrokesByIds(Array.from(selectedIds)).map((e) => e.stroke);
    setClipboardStrokes(strokes);
  }, [selectedIds, getStrokesByIds]);

  const cutSelected = useCallback(() => {
    if (!selectedIds.size) {
      return;
    }
    const ids = Array.from(selectedIds);
    const found = getStrokesByIds(ids);
    setClipboardStrokes(found.map((e) => e.stroke));
    undoStackRef.current.push({ kind: 'erase', originals: found, addedSubIds: [] });
    removeStrokeIds(ids);
    broadcast({ type: 'strokes_erased', strokeIds: ids });
    setAndBroadcastSelection(new Set());
    setContextMenu(null);
  }, [selectedIds, getStrokesByIds, removeStrokeIds, broadcast, setAndBroadcastSelection]);

  const pasteStrokes = useCallback(() => {
    if (!clipboardStrokes?.length) {
      return;
    }
    const OFFSET = 20;
    const lid =
      activeLayerIdRef.current === ALL_LAYERS_SENTINEL ? userId : activeLayerIdRef.current;
    const newStrokes: Stroke[] = clipboardStrokes.map((s) => ({
      ...s,
      id: generateId(),
      timestamp: Date.now(),
      points: s.points.map((p) => ({ x: p.x + OFFSET, y: p.y + OFFSET })),
    }));
    setLayers((prev) => ({
      ...prev,
      [lid]: {
        userName: prev[lid]?.userName ?? userName,
        userId,
        visible: prev[lid]?.visible ?? true,
        strokes: [...(prev[lid]?.strokes ?? []), ...newStrokes],
        comments: prev[lid]?.comments ?? [],
      },
    }));
    for (const stroke of newStrokes) {
      undoStackRef.current.push({ kind: 'add_stroke', stroke, layerId: lid });
      broadcast({ type: 'stroke', stroke, layerId: lid });
    }
    // Select pasted strokes
    setAndBroadcastSelection(new Set(newStrokes.map((s) => s.id)));
    addActivity(
      userName[0].toUpperCase(),
      'You',
      `pasted ${newStrokes.length} stroke${newStrokes.length !== 1 ? 's' : ''}`
    );
  }, [clipboardStrokes, userId, userName, broadcast, addActivity, setAndBroadcastSelection]);

  // ── Undo ──────────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) {
      return;
    }
    addActivity(userName[0].toUpperCase(), 'You', 'undid an action');

    if (entry.kind === 'add_stroke') {
      removeStrokeIds([entry.stroke.id]);
      broadcast({ type: 'strokes_erased', strokeIds: [entry.stroke.id] });
    } else if (entry.kind === 'erase') {
      // Remove the sub-strokes that were added by the segment eraser
      if (entry.addedSubIds.length) {
        removeStrokeIds(entry.addedSubIds);
        broadcast({ type: 'strokes_erased', strokeIds: entry.addedSubIds });
      }
      // Re-add the original strokes
      setLayers((prev) => {
        const next = { ...prev };
        for (const { layerId, stroke } of entry.originals) {
          if (next[layerId]) {
            next[layerId] = { ...next[layerId], strokes: [...next[layerId].strokes, stroke] };
          }
        }
        return next;
      });
      for (const { layerId, stroke } of entry.originals) {
        broadcast({ type: 'stroke', stroke, layerId });
      }
    } else if (entry.kind === 'clear') {
      setLayers((prev) => {
        const next = { ...prev };
        for (const [lid, strokes] of Object.entries(entry.strokesByLayer)) {
          if (next[lid]) {
            next[lid] = { ...next[lid], strokes };
          }
        }
        return next;
      });
      setImages(entry.images);
      setTexts(entry.texts);
      for (const strokes of Object.values(entry.strokesByLayer)) {
        for (const stroke of strokes) {
          broadcast({ type: 'stroke', stroke });
        }
      }
    } else if (entry.kind === 'add_text') {
      setTexts((prev) => prev.filter((t) => t.id !== entry.text.id));
    } else if (entry.kind === 'add_image') {
      setImages((prev) => prev.filter((i) => i.id !== entry.image.id));
    } else if (entry.kind === 'move') {
      // Reverse the move
      const idSet = new Set(entry.ids);
      setLayers((prev) => {
        const next: Record<string, LayerData> = {};
        for (const [lid, layer] of Object.entries(prev)) {
          next[lid] = {
            ...layer,
            strokes: layer.strokes.map((s) =>
              idSet.has(s.id)
                ? { ...s, points: s.points.map((p) => ({ x: p.x - entry.dx, y: p.y - entry.dy })) }
                : s
            ),
          };
        }
        return next;
      });
      // Broadcast reversed positions (use layersRef which is still pre-update, apply -dx -dy)
      const reversed = entry.ids
        .map((id) => {
          for (const layer of Object.values(layersRef.current)) {
            const s = layer.strokes.find((s) => s.id === id);
            if (s) {
              return {
                id,
                points: s.points.map((p) => ({ x: p.x - entry.dx, y: p.y - entry.dy })),
              };
            }
          }
          return null;
        })
        .filter(Boolean);
      broadcast({ type: 'strokes_moved', strokes: reversed });
    }
  }, [removeStrokeIds, broadcast, addActivity, userName]);

  // ── Clear all layers + images ─────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    const strokesByLayer: Record<string, Stroke[]> = {};
    for (const [lid, layer] of Object.entries(layersRef.current)) {
      strokesByLayer[lid] = [...layer.strokes];
    }
    undoStackRef.current.push({
      kind: 'clear',
      strokesByLayer,
      images: [...imagesRef.current],
      texts: [],
    });

    setLayers((prev) => {
      const next: Record<string, LayerData> = {};
      for (const [lid, l] of Object.entries(prev)) {
        next[lid] = { ...l, strokes: [] };
      }
      return next;
    });
    setImages([]);
    setTexts([]);
    broadcast({ type: 'clear_canvas', sessionId });
    addActivity(userName[0].toUpperCase(), 'You', 'cleared the canvas');
  }, [sessionId, broadcast, addActivity, userName]);

  // ── Text commit (used by onBlur — delegates to the inline version) ───────────

  const commitText = useCallback(() => {
    commitPendingTextInline();
  }, [commitPendingTextInline]);

  // ── Image upload ──────────────────────────────────────────────────────────────

  const uploadImage = useCallback(
    (file: File) => {
      ImageService.processFile(file)
        .then(({ dataUrl, width, height }) => {
          const svg = svgRef.current;
          const x = svg ? Math.round(svg.clientWidth / 2 - width / 2) : 100;
          const y = svg ? Math.round(svg.clientHeight / 2 - height / 2) : 100;
          const image: CanvasImage = {
            id: generateId(),
            userId,
            userName,
            dataUrl,
            x,
            y,
            width,
            height,
            timestamp: Date.now(),
          };
          setImages((prev) => [...prev, image]);
          undoStackRef.current.push({ kind: 'add_image', image });
          broadcast({ type: 'image', image });
          addActivity(userName[0].toUpperCase(), 'You', 'added an image');
        })
        .catch((err) => console.error('Image upload failed:', err));
    },
    [userId, userName, broadcast, addActivity]
  );

  // ── Export ────────────────────────────────────────────────────────────────────

  const exportCanvas = useCallback(() => {
    if (svgRef.current) {
      exporter.exportToPng(svgRef.current);
    }
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
    if (!chatInput.trim()) {
      return;
    }
    const message: ChatMessage = {
      id: generateId(),
      userId,
      userName,
      text: chatInput.trim(),
      time: new Date(),
    };
    setChatMessages((prev) => [...prev, message]);
    broadcast({ type: 'chat_message', message });
    setChatInput('');
  }, [chatInput, userId, userName, broadcast]);

  // ── Layer comments ────────────────────────────────────────────────────────────

  const handleAddLayerComment = useCallback(
    (layerUserId: string, comment: LayerComment) => {
      setLayers((prev) => {
        const layer = prev[layerUserId];
        if (!layer) {
          return prev;
        }
        return {
          ...prev,
          [layerUserId]: { ...layer, comments: [...(layer.comments ?? []), comment] },
        };
      });
      broadcast({ type: 'layer_comment', layerUserId, comment });
    },
    [broadcast]
  );

  // ── Add layer for current user ────────────────────────────────────────────────

  const handleAddLayer = useCallback(() => {
    const existingCount = Object.values(layersRef.current).filter(
      (l) => l.userId === userId
    ).length;
    const newLayerId = `${userId}_${Date.now()}`;
    const newLayerName = `${userName} (Layer ${existingCount + 1})`;
    setLayers((prev) => ({
      ...prev,
      [newLayerId]: {
        userName: newLayerName,
        userId,
        visible: true,
        strokes: [],
        comments: [],
        name: newLayerName,
      },
    }));
    setActiveLayerId(newLayerId);
  }, [userId, userName]);

  const handleSetActiveLayer = useCallback((layerId: string) => {
    setActiveLayerId(layerId);
  }, []);

  // ── Permission change ─────────────────────────────────────────────────────────

  const handlePermissionChange = useCallback(
    (targetUserId: string, permission: UserPermission) => {
      setActiveUsers((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, permission } : u)));
      broadcast({ type: 'permission_update', targetUserId, permission });
    },
    [broadcast]
  );

  // ── Keyboard shortcuts + space-hold pan ──────────────────────────────────────

  useEffect(() => {
    const TOOL_HOTKEYS: Record<string, DrawingTool['type']> = {
      p: 'pen',
      h: 'highlighter',
      e: 'eraser',
      l: 'lasso',
      t: 'text',
      v: 'pan',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.size) {
        deleteSelected();
      }

      if (e.key === 'Escape') {
        setAndBroadcastSelection(new Set());
        setContextMenu(null);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }

      // Copy / Cut / Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        cutSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteStrokes();
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const type = TOOL_HOTKEYS[e.key.toLowerCase()];
        if (type) {
          if (toolRef.current.type === 'text') {
            commitPendingTextInline();
          }
          setTool((prev) => ({ ...prev, type }));
          setAndBroadcastSelection(new Set());
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    deleteSelected,
    undo,
    commitPendingTextInline,
    copySelected,
    cutSelected,
    pasteStrokes,
    setAndBroadcastSelection,
  ]);

  // ── Global pointer-up ─────────────────────────────────────────────────────────

  useEffect(() => {
    const up = () => stopDrawing();
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [stopDrawing]);

  // ── Dismiss context menu on outside click ─────────────────────────────────────

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const dismiss = () => setContextMenu(null);
    window.addEventListener('mousedown', dismiss);
    return () => window.removeEventListener('mousedown', dismiss);
  }, [contextMenu]);

  // ── Derived values ────────────────────────────────────────────────────────────

  const totalStrokes = Object.values(layers).reduce((n, l) => n + l.strokes.length, 0);
  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}?session=${sessionId}` : '';
  const canvasTitle = sessionId === 'default' ? 'Untitled Canvas' : sessionId;
  // showMiniMap is managed by triggerMiniMap() + auto-hide timer (defined above)

  const cursorClass = (() => {
    if (myPermission === 'viewer') {
      return 'not-allowed';
    }
    if (isSpaceHeld) {
      return isPanningRef.current ? 'grabbing' : 'grab';
    }
    if (tool.type === 'pan') {
      return isPanningRef.current ? 'grabbing' : 'grab';
    }
    if (tool.type === 'eraser') {
      return 'none';
    }
    if (tool.type === 'lasso') {
      if (selectionDragOffset) {
        return 'grabbing';
      }
      if (selectedIds.size > 0) {
        return 'grab';
      }
    }
    return toolHandler.cursor;
  })();

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
        myPermission={myPermission}
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
            {myPermission === 'viewer' && (
              <span className="canvas-badge canvas-badge--viewer">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View only
              </span>
            )}
          </div>
          <div className="topbar-actions">
            {/* Zoom slider */}
            <div className="zoom-control" title="Zoom level">
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <input
                type="range"
                className="zoom-slider"
                min={10}
                max={800}
                step={5}
                value={Math.round(zoom * 100)}
                onChange={(e) => {
                  const next = Number(e.target.value) / 100;
                  setZoom(next);
                }}
              />
              {zoom !== 1 && (
                <button
                  className="zoom-reset-btn"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  title="Reset zoom (Ctrl+0)"
                >
                  Reset
                </button>
              )}
            </div>
            {selectedIds.size > 0 && (
              <button className="action-btn action-btn--danger" onClick={deleteSelected}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
                Delete {selectedIds.size} selected
              </button>
            )}
            <div className="avatar-stack">
              <div
                className="user-avatar topbar-avatar"
                style={{ background: UserColorService.getColor(userId) }}
              >
                {userName[0].toUpperCase()}
              </div>
              {activeUsers.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="user-avatar topbar-avatar"
                  title={u.permission === 'viewer' ? `${u.name} (viewer)` : u.name}
                  style={{ background: u.color }}
                >
                  {u.name[0].toUpperCase()}
                  {u.permission === 'viewer' && <span className="viewer-dot" />}
                </div>
              ))}
            </div>
            <button className="share-btn" onClick={() => setShareModalOpen(true)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>
        </div>

        <Toolbar
          tool={tool}
          onToolChange={(t) => {
            if (tool.type === 'text') {
              commitPendingTextInline();
            }
            setTool(t);
            setAndBroadcastSelection(new Set());
          }}
          onUndo={undo}
          onClear={clearCanvas}
          onExport={exportCanvas}
          onImageUpload={uploadImage}
          disabled={myPermission === 'viewer'}
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
          zoom={zoom}
          pan={pan}
          selectionDragOffset={selectionDragOffset}
          showMiniMap={showMiniMap}
          onDeleteSelected={deleteSelected}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onImageMouseDown={handleImageMouseDown}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />

        {/* Floating text input overlay */}
        {pendingText &&
          (() => {
            const rect = svgRef.current?.getBoundingClientRect();
            const left = rect ? rect.left + (pendingText.svgX - pan.x) * zoom : pendingText.clientX;
            const top = rect ? rect.top + (pendingText.svgY - pan.y) * zoom : pendingText.clientY;
            return (
              <input
                autoFocus
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitText();
                  }
                  if (e.key === 'Escape') {
                    setPendingText(null);
                    setTextInput('');
                  }
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

        {/* Right-click context menu */}
        {contextMenu && (
          <div
            className="canvas-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="context-menu-item" onClick={copySelected}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy <kbd>⌘C</kbd>
            </button>
            <button className="context-menu-item" onClick={cutSelected}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              Cut <kbd>⌘X</kbd>
            </button>
            <div className="context-menu-separator" />
            <button
              className="context-menu-item context-menu-item--danger"
              onClick={deleteSelected}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
              Delete {selectedIds.size} selected
            </button>
            <button
              className="context-menu-item"
              onClick={() => setAndBroadcastSelection(new Set())}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Deselect
            </button>
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      <CanvasRightPanel
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        layers={layers}
        userId={userId}
        userName={userName}
        activeLayerId={activeLayerId}
        soloUserId={soloUserId}
        onSoloChange={setSoloUserId}
        onVisibilityToggle={(uid) =>
          setLayers((prev) => ({ ...prev, [uid]: { ...prev[uid], visible: !prev[uid].visible } }))
        }
        onAddLayerComment={handleAddLayerComment}
        onAddLayer={handleAddLayer}
        onSetActiveLayer={handleSetActiveLayer}
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
        onPermissionChange={handlePermissionChange}
      />
    </div>
  );
}
