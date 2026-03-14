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
    color: '#1a1a2e',
    width: 3,
  });

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

  const generateUserColor = (id: string): string => {
    const colors = ['#e85d04', '#0d9488', '#7c3aed', '#e11d48', '#0284c7', '#d97706'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  useEffect(() => {
    const socket = new WebSocket(config.websocketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({
        type: 'join_session',
        sessionId,
        user: { id: userId, name: userName },
      }));
    };

    socket.onclose = () => setConnected(false);
    socket.onerror = (error) => console.error('WebSocket error:', error);

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
              const newUser = { ...message.user, color: generateUserColor(message.user.id) };
              setActivityLog((log) => [...log, {
                id: generateId(),
                avatar: message.user.name.charAt(0).toUpperCase(),
                name: message.user.name,
                action: 'joined the session',
                time: new Date(),
              }]);
              return [...prev, newUser];
            });
            break;
          case 'user_left':
            setActiveUsers((prev) => {
              const user = prev.find((u) => u.id === message.userId);
              if (user) {
                setActivityLog((log) => [...log, {
                  id: generateId(),
                  avatar: user.name.charAt(0).toUpperCase(),
                  name: user.name,
                  action: 'left the session',
                  time: new Date(),
                }]);
              }
              return prev.filter((u) => u.id !== message.userId);
            });
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

    return () => socket.close();
  }, [sessionId, userId, userName]);

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
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

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    currentStrokeRef.current = [coords];
    setCurrentStroke([coords]);
  }, [getCoordinates]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoordinates(e);
    if (coords) setCursorPos(coords);

    if (!isDrawing) return;
    if (!coords) return;

    currentStrokeRef.current = [...currentStrokeRef.current, coords];
    setCurrentStroke([...currentStrokeRef.current]);

    if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor_update',
        userId,
        cursor: coords,
      }));
    }
  }, [isDrawing, connected, getCoordinates, userId]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentStrokeRef.current.length === 0) {
      setIsDrawing(false);
      setCurrentStroke([]);
      currentStrokeRef.current = [];
      return;
    }

    const strokeTool: Stroke['tool'] =
      tool.type === 'highlighter' ? 'highlighter' : 'pen';

    const stroke: Stroke = {
      id: generateId(),
      userId,
      userName,
      points: currentStrokeRef.current,
      color: tool.type === 'eraser' ? '#ffffff' : tool.color,
      width: tool.type === 'eraser' ? Math.max(tool.width, 10) : tool.width,
      tool: strokeTool,
      timestamp: Date.now(),
    };

    setStrokes((prev) => [...prev, stroke]);
    setActivityLog((log) => [...log, {
      id: generateId(),
      avatar: userName.charAt(0).toUpperCase(),
      name: 'You',
      action: `drew a ${tool.type} stroke`,
      time: new Date(),
    }]);

    if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stroke', stroke }));
    }

    setIsDrawing(false);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
  }, [isDrawing, tool, userId, userName, connected]);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setRemoteStrokes([]);
    if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear_canvas', sessionId }));
    }
  }, [sessionId, connected]);

  const undo = useCallback(() => {
    setStrokes((prev) => {
      const userStrokes = prev.filter((s) => s.userId === userId);
      if (userStrokes.length === 0) return prev;
      const lastStroke = userStrokes[userStrokes.length - 1];
      return prev.filter((s) => s.id !== lastStroke.id);
    });
  }, [userId]);

  useEffect(() => {
    const handleMouseUp = () => { if (isDrawing) stopDrawing(); };
    const handleTouchEnd = () => { if (isDrawing) stopDrawing(); };
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

  const copyShareLink = useCallback(() => {
    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}?session=${sessionId}`
      : '';
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [sessionId]);

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, {
      id: generateId(),
      userId,
      userName,
      text: chatInput.trim(),
      time: new Date(),
    }]);
    setChatInput('');
  }, [chatInput, userId, userName]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatRelativeTime = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const allStrokes = [...strokes, ...remoteStrokes];
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?session=${sessionId}`
    : '';
  const canvasTitle = sessionId === 'default' ? 'Untitled Canvas' : sessionId;

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
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
              <span className="count">{allStrokes.length}</span>
            </li>
          </ul>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Collaborators</div>
          <ul className="user-list">
            <li className="user-item">
              <div className="user-avatar" style={{ background: generateUserColor(userId) }}>
                {userName.charAt(0).toUpperCase()}
                <span className="status-dot status-online" />
              </div>
              <span className="user-name">{userName}</span>
              <span className="user-role">You</span>
            </li>
            {activeUsers.map((user) => (
              <li key={user.id} className="user-item">
                <div className="user-avatar" style={{ background: user.color }}>
                  {user.name.charAt(0).toUpperCase()}
                  <span className="status-dot status-online" />
                </div>
                <span className="user-name">{user.name}</span>
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

      {/* Main */}
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
            <div className="avatar-stack">
              <div
                className="user-avatar topbar-avatar"
                style={{ background: generateUserColor(userId) }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
              {activeUsers.slice(0, 3).map((user) => (
                <div
                  key={user.id}
                  className="user-avatar topbar-avatar"
                  style={{ background: user.color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <button className="share-btn" onClick={() => setShareModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* Horizontal Toolbar */}
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          onUndo={undo}
          onClear={clearCanvas}
          onExport={exportCanvas}
        />

        {/* Canvas Workspace */}
        <div className="canvas-workspace">
          <div className="canvas-bg-pattern" />
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
                stroke={stroke.color}
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
                stroke={tool.type === 'eraser' ? '#ffffff' : tool.color}
                strokeWidth={tool.type === 'eraser' ? Math.max(tool.width, 10) : tool.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={tool.type === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {activeUsers.map((user) =>
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

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            <span>{tool.type.charAt(0).toUpperCase() + tool.type.slice(1)}</span>
          </div>
          {cursorPos && (
            <div className="stat">
              X: {Math.round(cursorPos.x)} Y: {Math.round(cursorPos.y)}
            </div>
          )}
          <div className="stat">Strokes: {allStrokes.length}</div>
          <div className="stat">
            <span
              className="status-mini-dot"
              style={{ background: connected ? '#22c55e' : '#ef4444' }}
            />
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="right-panel">
        <div className="panel-tabs">
          {(['layers', 'activity', 'chat'] as const).map((panel) => (
            <button
              key={panel}
              className={`panel-tab${activePanel === panel ? ' active' : ''}`}
              onClick={() => setActivePanel(panel)}
            >
              {panel.charAt(0).toUpperCase() + panel.slice(1)}
            </button>
          ))}
        </div>

        {activePanel === 'layers' && (
          <div className="panel-content">
            <div className="panel-section">
              <div className="panel-section-title">Strokes ({allStrokes.length})</div>
              {allStrokes.length === 0 ? (
                <div className="empty-panel">No strokes yet. Start drawing!</div>
              ) : (
                allStrokes.slice().reverse().slice(0, 20).map((stroke) => (
                  <div
                    key={stroke.id}
                    className={`layer-item${stroke.userId === userId ? ' active' : ''}`}
                  >
                    <div
                      className="layer-thumb"
                      style={{
                        background: stroke.color,
                        opacity: stroke.tool === 'highlighter' ? 0.4 : 1,
                      }}
                    />
                    <div className="layer-info">
                      <div className="layer-name">{stroke.userName}'s {stroke.tool}</div>
                      <div className="layer-meta">{stroke.width}px · {stroke.points.length} pts</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activePanel === 'activity' && (
          <div className="panel-content">
            <div className="panel-section">
              <div className="panel-section-title">Recent Activity</div>
              {activityLog.length === 0 ? (
                <div className="empty-panel">No activity yet.</div>
              ) : (
                activityLog.slice().reverse().slice(0, 30).map((event) => (
                  <div key={event.id} className="activity-item">
                    <div
                      className="activity-avatar"
                      style={{ background: generateUserColor(event.name) }}
                    >
                      {event.avatar}
                    </div>
                    <div>
                      <div className="activity-text">
                        <strong>{event.name}</strong> {event.action}
                      </div>
                      <div className="activity-time">{formatRelativeTime(event.time)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activePanel === 'chat' && (
          <div className="panel-content panel-content--chat">
            <div className="chat-section">
              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <div className="empty-panel">No messages yet. Say hi!</div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="chat-msg">
                      <div
                        className="chat-msg-avatar"
                        style={{ background: generateUserColor(msg.userId) }}
                      >
                        {msg.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="chat-msg-content">
                        <div className="chat-msg-header">
                          <span className="chat-msg-name">{msg.userName}</span>
                          <span className="chat-msg-time">{formatTime(msg.time)}</span>
                        </div>
                        <div className="chat-msg-body">{msg.text}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-input-area">
                <input
                  type="text"
                  className="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                />
                <button className="chat-send" onClick={sendChatMessage}>
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

      {/* Share Modal */}
      {shareModalOpen && (
        <div
          className="modal-overlay open"
          onClick={(e) => { if (e.target === e.currentTarget) setShareModalOpen(false); }}
        >
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Share Canvas</span>
              <button className="modal-close" onClick={() => setShareModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="share-link-row">
                <input
                  type="text"
                  className="share-link-input"
                  value={shareUrl}
                  readOnly
                />
                <button
                  className={`copy-btn${copySuccess ? ' copied' : ''}`}
                  onClick={copyShareLink}
                >
                  {copySuccess ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <div className="share-permissions-title">People in session</div>

              <div className="share-user-row">
                <div
                  className="user-avatar"
                  style={{ background: generateUserColor(userId), width: '32px', height: '32px', fontSize: '12px' }}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="share-user-info">
                  <div className="share-user-name">{userName}</div>
                  <div className="share-user-email">This session</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--slate-400)', fontWeight: 600 }}>Owner</span>
              </div>

              {activeUsers.map((user) => (
                <div key={user.id} className="share-user-row">
                  <div
                    className="user-avatar"
                    style={{ background: user.color, width: '32px', height: '32px', fontSize: '12px' }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="share-user-info">
                    <div className="share-user-name">{user.name}</div>
                    <div className="share-user-email">Active now</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--teal)', fontWeight: 600 }}>Editor</span>
                </div>
              ))}

              <div className="invite-row">
                <input
                  type="text"
                  className="invite-input"
                  placeholder="Share the link above to invite collaborators"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
