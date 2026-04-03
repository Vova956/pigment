import type { User, LayerData } from '../../types/canvas';
import { UserColorService } from '../../services/UserColorService';

interface CanvasSidebarProps {
  userId: string;
  userName: string;
  connected: boolean;
  activeUsers: User[];
  layers: Record<string, LayerData>;
  totalStrokes: number;
  canvasTitle: string;
}

export default function CanvasSidebar({
  userId,
  userName,
  connected,
  activeUsers,
  totalStrokes,
  canvasTitle,
}: CanvasSidebarProps) {
  return (
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
            <div className="user-avatar" style={{ background: UserColorService.getColor(userId) }}>
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
  );
}
