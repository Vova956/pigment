import { useState } from 'react';
import type { LayerData, ActivityEvent, ChatMessage, LayerComment } from '../../types/canvas';
import { generateId } from '../../types/canvas';
import { UserColorService } from '../../services/UserColorService';

type PanelTab = 'layers' | 'activity' | 'chat';

interface CanvasRightPanelProps {
  activePanel: PanelTab;
  onPanelChange: (p: PanelTab) => void;
  layers: Record<string, LayerData>;
  userId: string;
  userName: string;
  activeLayerId: string;
  soloUserId: string | null;
  onSoloChange: (uid: string | null) => void;
  onVisibilityToggle: (uid: string) => void;
  onAddLayerComment: (layerUserId: string, comment: LayerComment) => void;
  onAddLayer: () => void;
  onSetActiveLayer: (layerId: string) => void;
  activityLog: ActivityEvent[];
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInput: (text: string) => void;
  onSendChat: () => void;
}

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const rel = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  return s < 60 ? 'Just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};

// ── Solo icon (target/focus) ───────────────────────────────────────────────────
function SoloIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

// ── Layers tab ─────────────────────────────────────────────────────────────────

const ALL_LAYERS_SENTINEL = '__all__';

function LayersTab({
  layers, userId, userName, activeLayerId, soloUserId, onSoloChange, onVisibilityToggle, onAddLayerComment, onAddLayer, onSetActiveLayer,
}: Pick<CanvasRightPanelProps, 'layers' | 'userId' | 'userName' | 'activeLayerId' | 'soloUserId' | 'onSoloChange' | 'onVisibilityToggle' | 'onAddLayerComment' | 'onAddLayer' | 'onSetActiveLayer'>) {
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const toggleComments = (uid: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const submitComment = (layerUserId: string) => {
    const text = (commentInputs[layerUserId] ?? '').trim();
    if (!text) return;
    const comment: LayerComment = {
      id: generateId(),
      userId,
      userName,
      text,
      timestamp: Date.now(),
    };
    onAddLayerComment(layerUserId, comment);
    setCommentInputs(prev => ({ ...prev, [layerUserId]: '' }));
  };

  return (
    <div className="panel-content">
      <div className="panel-section">
        <div className="panel-section-title">
          <span>Layers ({Object.keys(layers).length})</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {soloUserId && (
              <button className="link-btn" style={{ fontSize: 11 }} onClick={() => onSoloChange(null)}>
                Show all
              </button>
            )}
            <button
              className="layer-add-btn"
              title="Add a new layer for yourself"
              onClick={onAddLayer}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Layer
            </button>
          </div>
        </div>
        {/* "All my layers" row — shown if user has own layers */}
        {Object.values(layers).some(l => (l.userId ?? '') === userId) && (
          <div
            className={`layer-item layer-item--all${activeLayerId === ALL_LAYERS_SENTINEL ? ' active' : ''}`}
            style={{ cursor: 'pointer', borderLeft: activeLayerId === ALL_LAYERS_SENTINEL ? '2.5px solid #0284c7' : '2.5px solid transparent', paddingLeft: 9 }}
            onClick={() => onSetActiveLayer(ALL_LAYERS_SENTINEL)}
            title="Target all your own layers with the eraser"
          >
            <div className="layer-thumb" style={{ background: 'linear-gradient(135deg,#0284c7,#7c3aed)' }} />
            <div className="layer-info">
              <div className="layer-name">
                All my layers
                {activeLayerId === ALL_LAYERS_SENTINEL && <span className="user-role" style={{ marginLeft: 6 }}>Active</span>}
              </div>
            </div>
          </div>
        )}
        {Object.keys(layers).length === 0 && <div className="empty-panel">No layers yet.</div>}
        {Object.entries(layers).map(([lid, layer]) => {
          const uid = lid;
          const isOwn = (layer.userId ?? lid) === userId;
          const isActive = lid === activeLayerId;
          const isSolo = soloUserId === lid;
          const color = UserColorService.getColor(layer.userId ?? lid);
          const commentsOpen = expandedComments.has(uid);
          const comments = layer.comments ?? [];
          const pickLayer = (e: React.MouseEvent) => {
            if (!isOwn) return;
            const el = e.target as HTMLElement;
            if (el.closest('.layer-actions') || el.closest('.layer-comments')) return;
            onSetActiveLayer(lid);
          };
          return (
            <div
              key={uid}
              className={`layer-item-wrap${isSolo ? ' layer-item-wrap--solo' : ''}${isActive ? ' layer-item-wrap--active' : ''}`}
              onClick={pickLayer}
              style={{ cursor: isOwn ? 'pointer' : undefined }}
            >
              <div className={`layer-item${isSolo ? ' active' : ''}`}>
                <div className="layer-thumb" style={{ background: color }} />
                <div className="layer-info">
                  <div className="layer-name">
                    {layer.name ?? layer.userName}
                    {isOwn && <span className="user-role" style={{ marginLeft: 6 }}>{isActive ? '✓ Active' : 'You'}</span>}
                  </div>
                  <div className="layer-meta">{layer.strokes.length} stroke{layer.strokes.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="layer-actions" onClick={e => e.stopPropagation()}>
                  {/* Solo / unsolo — target icon */}
                  <button
                    className={`layer-btn${isSolo ? ' layer-btn--active' : ''}`}
                    title={isSolo ? 'Show all layers' : 'Solo: view only this layer'}
                    onClick={() => onSoloChange(isSolo ? null : uid)}
                  >
                    <SoloIcon />
                  </button>
                  {/* Visibility toggle — eye icon */}
                  <button
                    className={`layer-btn${!layer.visible ? ' layer-btn--muted' : ''}`}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                    onClick={() => { if (!soloUserId) onVisibilityToggle(uid); }}
                  >
                    {layer.visible ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                  {/* Comments toggle */}
                  <button
                    className={`layer-btn${commentsOpen ? ' layer-btn--active' : ''}`}
                    title={`${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
                    onClick={() => toggleComments(uid)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {comments.length > 0 && <span className="layer-comment-badge">{comments.length}</span>}
                  </button>
                </div>
              </div>
              {/* Layer comments section */}
              {commentsOpen && (
                <div className="layer-comments" onClick={e => e.stopPropagation()}>
                  {comments.length === 0 && <div className="layer-comment-empty">No comments yet.</div>}
                  {comments.map(c => (
                    <div key={c.id} className="layer-comment">
                      <div className="layer-comment-avatar" style={{ background: UserColorService.getColor(c.userId) }}>
                        {c.userName[0].toUpperCase()}
                      </div>
                      <div className="layer-comment-body">
                        <span className="layer-comment-author">{c.userName}</span>
                        <span className="layer-comment-text">{c.text}</span>
                      </div>
                    </div>
                  ))}
                  <div className="layer-comment-input-row">
                    <input
                      className="layer-comment-input"
                      type="text"
                      placeholder="Add comment…"
                      value={commentInputs[uid] ?? ''}
                      onChange={e => setCommentInputs(prev => ({ ...prev, [uid]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && submitComment(uid)}
                    />
                    <button className="layer-comment-send" onClick={() => submitComment(uid)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity tab ───────────────────────────────────────────────────────────────

function ActivityTab({ activityLog }: Pick<CanvasRightPanelProps, 'activityLog'>) {
  return (
    <div className="panel-content">
      <div className="panel-section">
        <div className="panel-section-title">Recent Activity</div>
        {activityLog.length === 0
          ? <div className="empty-panel">No activity yet.</div>
          : activityLog.slice().reverse().slice(0, 50).map(ev => (
              <div key={ev.id} className="activity-item">
                <div className="activity-avatar" style={{ background: UserColorService.getColor(ev.name) }}>
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
  );
}

// ── Chat tab ───────────────────────────────────────────────────────────────────

function ChatTab({
  chatMessages, chatInput, onChatInput, onSendChat,
}: Pick<CanvasRightPanelProps, 'chatMessages' | 'chatInput' | 'onChatInput' | 'onSendChat'>) {
  return (
    <div className="panel-content panel-content--chat">
      <div className="chat-section">
        <div className="chat-messages">
          {chatMessages.length === 0
            ? <div className="empty-panel">No messages yet. Say hi!</div>
            : chatMessages.map(msg => (
                <div key={msg.id} className="chat-msg">
                  <div className="chat-msg-avatar" style={{ background: UserColorService.getColor(msg.userId) }}>
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
            onChange={e => onChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSendChat()}
            placeholder="Type a message..."
          />
          <button className="chat-send" onClick={onSendChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel container ────────────────────────────────────────────────────────────

export default function CanvasRightPanel(props: CanvasRightPanelProps) {
  const { activePanel, onPanelChange } = props;
  const TABS: PanelTab[] = ['layers', 'activity', 'chat'];

  return (
    <div className="right-panel">
      <div className="panel-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`panel-tab${activePanel === tab ? ' active' : ''}`}
            onClick={() => onPanelChange(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activePanel === 'layers'   && <LayersTab   {...props} />}
      {activePanel === 'activity' && <ActivityTab {...props} />}
      {activePanel === 'chat'     && <ChatTab     {...props} />}
    </div>
  );
}
