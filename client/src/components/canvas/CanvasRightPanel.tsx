import type { LayerData, ActivityEvent, ChatMessage } from '../../types/canvas';
import { UserColorService } from '../../services/UserColorService';

type PanelTab = 'layers' | 'activity' | 'chat';

interface CanvasRightPanelProps {
  activePanel: PanelTab;
  onPanelChange: (p: PanelTab) => void;
  layers: Record<string, LayerData>;
  userId: string;
  soloUserId: string | null;
  onSoloChange: (uid: string | null) => void;
  onVisibilityToggle: (uid: string) => void;
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

// ── Layers tab ─────────────────────────────────────────────────────────────────

function LayersTab({
  layers, userId, soloUserId, onSoloChange, onVisibilityToggle,
}: Pick<CanvasRightPanelProps, 'layers' | 'userId' | 'soloUserId' | 'onSoloChange' | 'onVisibilityToggle'>) {
  return (
    <div className="panel-content">
      <div className="panel-section">
        <div className="panel-section-title">
          <span>Layers ({Object.keys(layers).length})</span>
          {soloUserId && (
            <button className="link-btn" style={{ fontSize: 11 }} onClick={() => onSoloChange(null)}>
              Show all
            </button>
          )}
        </div>
        {Object.keys(layers).length === 0 && <div className="empty-panel">No layers yet.</div>}
        {Object.entries(layers).map(([uid, layer]) => {
          const isOwn = uid === userId;
          const isSolo = soloUserId === uid;
          const color = UserColorService.getColor(uid);
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
                  onClick={() => onSoloChange(isSolo ? null : uid)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                {/* Visibility toggle */}
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
              </div>
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
