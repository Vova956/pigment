import type { User, UserPermission } from '../../types/canvas';
import { UserColorService } from '../../services/UserColorService';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  userId: string;
  userName: string;
  activeUsers: User[];
  copySuccess: boolean;
  onCopy: () => void;
  onPermissionChange?: (targetUserId: string, permission: UserPermission) => void;
}

export default function ShareModal({
  open,
  onClose,
  shareUrl,
  userId,
  userName,
  activeUsers,
  copySuccess,
  onCopy,
  onPermissionChange,
}: ShareModalProps) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Share Canvas</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="share-link-row">
            <input type="text" className="share-link-input" value={shareUrl} readOnly />
            <button className={`copy-btn${copySuccess ? ' copied' : ''}`} onClick={onCopy}>
              {copySuccess ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="share-permissions-title">People in session</div>

          {/* Current user (always owner/editor) */}
          <div className="share-user-row">
            <div
              className="user-avatar"
              style={{ background: UserColorService.getColor(userId), width: 32, height: 32, fontSize: 12 }}
            >
              {userName[0].toUpperCase()}
            </div>
            <div className="share-user-info">
              <div className="share-user-name">{userName} <span className="share-you-badge">(you)</span></div>
              <div className="share-user-email">This session</div>
            </div>
            <span className="share-role-badge share-role-badge--owner">Owner</span>
          </div>

          {activeUsers.map(u => (
            <div key={u.id} className="share-user-row">
              <div
                className="user-avatar"
                style={{ background: u.color, width: 32, height: 32, fontSize: 12 }}
              >
                {u.name[0].toUpperCase()}
              </div>
              <div className="share-user-info">
                <div className="share-user-name">{u.name}</div>
                <div className="share-user-email">
                  {u.permission === 'viewer' ? (
                    <span className="share-viewer-indicator">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View only
                    </span>
                  ) : 'Active now'}
                </div>
              </div>
              {onPermissionChange ? (
                <select
                  className="share-role-select"
                  value={u.permission ?? 'editor'}
                  onChange={e => onPermissionChange(u.id, e.target.value as UserPermission)}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className={`share-role-badge share-role-badge--${u.permission === 'viewer' ? 'viewer' : 'editor'}`}>
                  {u.permission === 'viewer' ? 'Viewer' : 'Editor'}
                </span>
              )}
            </div>
          ))}

          {activeUsers.length === 0 && (
            <div className="empty-panel" style={{ marginTop: 8 }}>No other collaborators yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
