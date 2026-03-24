import { useState } from 'react';
import { config } from '../config';

type View = 'home' | 'login' | 'register';

interface HomePageProps {
  onEnterSession: (sessionId: string, userName: string) => void;
}

export default function HomePage({ onEnterSession }: HomePageProps) {
  const [view, setView] = useState<View>('home');
  const [joinCode, setJoinCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);

  const effectiveName = loggedInUser || guestName.trim() || 'Guest';

  async function handleCreate() {
    setLoading(true);
    setJoinError('');
    try {
      const res = await fetch(`${config.apiUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const { sessionId } = await res.json();
      onEnterSession(sessionId, effectiveName);
    } catch {
      setJoinError('Could not create session. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setJoinError('Enter a session code'); return; }
    setLoading(true);
    setJoinError('');
    try {
      const res = await fetch(`${config.apiUrl}/sessions/${code}`);
      if (res.status === 404) { setJoinError('Session not found. Check the code and try again.'); return; }
      if (!res.ok) throw new Error('Server error');
      onEnterSession(code, effectiveName);
    } catch (err: any) {
      if (err.message === 'Session not found. Check the code and try again.') setJoinError(err.message);
      else setJoinError('Could not reach server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Login failed'); return; }
      setLoggedInUser(data.user.username);
      setView('home');
    } catch {
      setAuthError('Could not reach server.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${config.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Registration failed'); return; }
      // Auto-login after register
      const loginRes = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        setLoggedInUser(loginData.user.username);
        setView('home');
      } else {
        setAuthError('Registered! Please log in.');
        setView('login');
      }
    } catch {
      setAuthError('Could not reach server.');
    } finally {
      setAuthLoading(false);
    }
  }

  if (view === 'login' || view === 'register') {
    return (
      <div className="home-page">
        <div className="home-center">
          <div className="home-brand">
            <div className="home-brand-icon">P</div>
            <span className="home-brand-name">Pigment</span>
          </div>

          <div className="auth-card">
            <div className="auth-tabs">
              <button
                className={`auth-tab${view === 'login' ? ' active' : ''}`}
                onClick={() => { setView('login'); setAuthError(''); }}
              >
                Log in
              </button>
              <button
                className={`auth-tab${view === 'register' ? ' active' : ''}`}
                onClick={() => { setView('register'); setAuthError(''); }}
              >
                Sign up
              </button>
            </div>

            <div className="auth-form">
              {view === 'register' && (
                <div className="form-field">
                  <label className="form-label">Username</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="yourname"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                  />
                </div>
              )}
              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (view === 'login' ? handleLogin() : handleRegister())}
                />
              </div>
              {authError && <div className="form-error">{authError}</div>}
              <button
                className="btn-primary"
                onClick={view === 'login' ? handleLogin : handleRegister}
                disabled={authLoading}
              >
                {authLoading ? '...' : view === 'login' ? 'Log in' : 'Create account'}
              </button>
            </div>

            <button className="auth-back" onClick={() => setView('home')}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-center">
        <div className="home-brand">
          <div className="home-brand-icon">P</div>
          <span className="home-brand-name">Pigment</span>
        </div>
        <p className="home-tagline">Real-time collaborative drawing</p>

        {/* Name input (guest mode) */}
        {!loggedInUser && (
          <div className="guest-row">
            <input
              className="form-input"
              type="text"
              placeholder="Your display name (optional)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={30}
            />
          </div>
        )}

        {loggedInUser && (
          <div className="logged-in-row">
            <span className="logged-in-label">Signed in as <strong>{loggedInUser}</strong></span>
            <button className="link-btn" onClick={() => setLoggedInUser(null)}>Sign out</button>
          </div>
        )}

        <div className="session-cards">
          {/* Create session */}
          <div className="session-card">
            <div className="session-card-icon">+</div>
            <div className="session-card-title">New Session</div>
            <div className="session-card-desc">Start a fresh canvas and invite others with a code.</div>
            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </div>

          {/* Join session */}
          <div className="session-card">
            <div className="session-card-icon">→</div>
            <div className="session-card-title">Join Session</div>
            <div className="session-card-desc">Enter a 6-character code to join an existing canvas.</div>
            <input
              className="form-input code-input"
              type="text"
              placeholder="ABC123"
              maxLength={6}
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button className="btn-secondary" onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining…' : 'Join Session'}
            </button>
          </div>
        </div>

        {joinError && <div className="form-error join-error">{joinError}</div>}

        {/* Auth link */}
        {!loggedInUser && (
          <div className="auth-link-row">
            <button className="link-btn" onClick={() => setView('login')}>Log in</button>
            <span className="auth-sep">·</span>
            <button className="link-btn" onClick={() => setView('register')}>Sign up</button>
            <span className="auth-sep">to save your sessions</span>
          </div>
        )}
      </div>
    </div>
  );
}
