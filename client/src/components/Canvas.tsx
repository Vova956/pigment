import { useEffect, useState, useRef, useCallback } from 'react';
import { config } from '../config';
import Toolbar from './Toolbar';
import type { Point, Stroke, DrawingTool, User, WebSocketMessage } from '../types/canvas';
import { generateId, pointsToSvgPath, HIGHLIGHTER_OPACITY } from '../types/canvas';

interface CanvasProps {
  userId?: string;
  userName?: string;
  sessionId?: string;
}

export default function Canvas({
  userId = generateId(),
  userName = 'Anonymous',
  sessionId = 'default',
}: CanvasProps) {
  const [connected, setConnected] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [remoteStrokes, setRemoteStrokes] = useState<Stroke[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [tool, setTool] = useState<DrawingTool>({
    type: 'pen',
    color: '#000000',
    width: 3,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);

  useEffect(() => {
    const socket = new WebSocket(config.websocketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to WebSocket');
      setConnected(true);

      socket.send(
        JSON.stringify({
          type: 'join_session',
          sessionId,
          user: { id: userId, name: userName },
        })
      );
    };

    socket.onclose = () => {
      console.log('Disconnected from WebSocket');
      setConnected(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'stroke':
            setRemoteStrokes((prev) => [...prev, message.stroke]);
            break;
          case 'user_joined':
            setActiveUsers((prev) => {
              const exists = prev.find((u) => u.id === message.user.id);
              if (exists) return prev;
              return [...prev, { ...message.user, color: generateUserColor(message.user.id) }];
            });
            break;
          case 'user_left':
            setActiveUsers((prev) => prev.filter((u) => u.id !== message.userId));
            break;
          case 'cursor_update':
            setActiveUsers((prev) =>
              prev.map((u) => (u.id === message.userId ? { ...u, cursor: message.cursor } : u))
            );
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    return () => {
      socket.close();
    };
  }, [sessionId, userId, userName]);

  const generateUserColor = (id: string): string => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
    if (!svgRef.current) return null;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const point = svg.createSVGPoint();

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      point.x = e.touches[0].clientX;
      point.y = e.touches[0].clientY;
    } else {
      point.x = (e as MouseEvent).clientX;
      point.y = (e as MouseEvent).clientY;
    }

    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    const svgPoint = point.matrixTransform(ctm.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  }, []);

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();

      const coords = getCoordinates(e);
      if (!coords) return;

      setIsDrawing(true);
      currentStrokeRef.current = [coords];
      setCurrentStroke([coords]);
    },
    [getCoordinates]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      currentStrokeRef.current = [...currentStrokeRef.current, coords];
      setCurrentStroke([...currentStrokeRef.current]);

      if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'cursor_update',
            userId,
            cursor: coords,
          })
        );
      }
    },
    [isDrawing, connected, getCoordinates, userId]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentStrokeRef.current.length === 0) {
      setIsDrawing(false);
      setCurrentStroke([]);
      currentStrokeRef.current = [];
      return;
    }

    const stroke: Stroke = {
      id: generateId(),
      userId,
      userName,
      points: currentStrokeRef.current,
      color: tool.color,
      width: tool.width,
      tool: tool.type === 'eraser' ? 'pen' : tool.type,
      timestamp: Date.now(),
    };

    setStrokes((prev) => [...prev, stroke]);

    if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'stroke',
          stroke,
        })
      );
    }

    setIsDrawing(false);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, [isDrawing, tool, userId, userName]);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setRemoteStrokes([]);

    if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clear_canvas',
          sessionId,
        })
      );
    }
  }, [sessionId]);

  const undo = useCallback(() => {
    setStrokes((prev) => {
      const userStrokes = prev.filter((s) => s.userId === userId);
      if (userStrokes.length === 0) return prev;

      const lastStroke = userStrokes[userStrokes.length - 1];
      return prev.filter((s) => s.id !== lastStroke.id);
    });
  }, [userId]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDrawing) {
        stopDrawing();
      }
    };

    const handleTouchEnd = () => {
      if (isDrawing) {
        stopDrawing();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDrawing, stopDrawing]);

  const exportCanvas = useCallback(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth;
      canvas.height = svg.clientHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `pigment-${Date.now()}.png`;
        link.href = pngUrl;
        link.click();
      }

      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const allStrokes = [...strokes, ...remoteStrokes];

  return (
    <div className="canvas-container">
      <div className="canvas-header">
        <div className="canvas-header__left">
          <h1 className="canvas-header__title">Pigment</h1>
          <span className={`canvas-header__status ${connected ? 'canvas-header__status--connected' : 'canvas-header__status--disconnected'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="canvas-header__actions">
          <button onClick={undo} disabled={!connected} className="canvas-header__btn">
            Undo
          </button>
          <button onClick={clearCanvas} disabled={!connected} className="canvas-header__btn canvas-header__btn--danger">
            Clear
          </button>
          <button onClick={exportCanvas} className="canvas-header__btn canvas-header__btn--primary">
            Export PNG
          </button>
        </div>
      </div>

      <div className="canvas-main">
        <div className="canvas-toolbar-wrapper">
          <Toolbar tool={tool} onToolChange={setTool} disabled={!connected} />
        </div>

        <div className="canvas-svg-wrapper">
          <svg
            ref={svgRef}
            className="canvas-svg"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            preserveAspectRatio="xMidYMid slice"
          >
            <rect width="100%" height="100%" fill="white" />

            {allStrokes.map((stroke) => (
              <path
                key={stroke.id}
                d={pointsToSvgPath(stroke.points)}
                stroke={stroke.tool === 'highlighter' ? stroke.color : stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={stroke.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {isDrawing && currentStroke.length > 0 && (
              <path
                d={pointsToSvgPath(currentStroke)}
                stroke={tool.type === 'eraser' ? '#000000' : tool.color}
                strokeWidth={tool.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={tool.type === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {activeUsers.map(
              (user) =>
                user.cursor && (
                  <g key={user.id}>
                    <circle cx={user.cursor.x} cy={user.cursor.y} r="4" fill={user.color} />
                    <text
                      x={user.cursor.x + 8}
                      y={user.cursor.y - 8}
                      fill={user.color}
                      fontSize="12"
                      fontFamily="sans-serif"
                    >
                      {user.name}
                    </text>
                  </g>
                )
            )}
          </svg>
        </div>
      </div>

      <div className="canvas-footer">
        <div className="canvas-users">
          <span className="canvas-users__label">Active Users:</span>
          {activeUsers.length === 0 ? (
            <span className="canvas-users__empty">Just you</span>
          ) : (
            <div className="canvas-users__list">
              <span className="canvas-users__item" style={{ color: generateUserColor(userId) }}>
                {userName} (you)
              </span>
              {activeUsers.map((user) => (
                <span key={user.id} className="canvas-users__item" style={{ color: user.color }}>
                  {user.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="canvas-stats">
          {strokes.length} strokes • {allStrokes.length} total
        </div>
      </div>
    </div>
  );
}
