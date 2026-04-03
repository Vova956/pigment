import type { User } from '../../types/canvas';
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
          <div className="share-user-row">
            <div
              className="user-avatar"
              style={{ background: UserColorService.getColor(userId), width: 32, height: 32, fontSize: 12 }}
            >
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
              <div
                className="user-avatar"
                style={{ background: u.color, width: 32, height: 32, fontSize: 12 }}
              >
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
  );
}
